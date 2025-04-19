/**
 * 智能连接管理器
 * 提供智能预连接、连接复用和自适应连接管理功能
 */

import { updateConnectionStatus } from "./ConnectionUtils.js";

/**
 * 智能连接管理器类
 */
export class ConnectionManager {
  constructor() {
    // 连接配置
    this.config = {
      minInputLength: 2, // 降低触发预连接的最小输入长度，更早预连接
      typingIdleDelay: 500, // 减少输入停顿触发预连接的时间 (毫秒)
      connectionTimeout: 15000, // 减少连接超时时间 (15秒)
      closeDelay: 30000, // 增加使用后延迟关闭时间 (30秒)，减少重复连接
      maxPoolSize: 1, // 连接池大小 (通常为1)
      frequentUseThreshold: 2, // 降低频繁使用阈值 (次数/分钟)
      frequentUserTimeout: 180000, // 增加频繁用户的连接保持时间 (3分钟)
    };

    // 连接状态
    this.activeConnection = null; // 当前活跃连接
    this.isConnecting = false; // 是否正在建立连接
    this.lastActivity = 0; // 最后活动时间
    this.usageHistory = []; // 使用历史记录

    // 定时器
    this.typingTimer = null; // 输入停顿计时器
    this.closeTimer = null; // 延迟关闭计时器

    // 绑定方法
    this.handleInput = this.handleInput.bind(this);
    this.preconnect = this.preconnect.bind(this);
    this.getConnection = this.getConnection.bind(this);
    this.releaseConnection = this.releaseConnection.bind(this);
    this.closeConnection = this.closeConnection.bind(this);

    // 初始化
    this.init();
  }

  /**
   * 初始化连接管理器
   */
  init() {
    // 监听输入事件
    const promptInput = document.getElementById("ai-prompt");
    if (promptInput) {
      promptInput.addEventListener("input", this.handleInput);
    }

    // 监听页面卸载事件，确保关闭连接
    window.addEventListener("beforeunload", () => {
      if (this.activeConnection) {
        this.closeConnection(true); // 强制关闭
      }
    });

    // 初始化连接状态
    updateConnectionStatus("disconnected");

    console.log("智能连接管理器已初始化");
  }

  /**
   * 处理输入事件
   * @param {Event} event - 输入事件
   */
  handleInput(event) {
    const input = event.target.value.trim();

    // 清除之前的定时器
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }

    // 如果输入为空，不触发预连接
    if (!input) {
      return;
    }

    // 如果输入长度达到阈值，立即触发预连接
    if (input.length >= this.config.minInputLength) {
      // 使用requestIdleCallback在浏览器空闲时预连接，不阻塞UI
      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => this.preconnect(), { timeout: 1000 });
      } else {
        // 降级方案
        setTimeout(() => this.preconnect(), 0);
      }
      return;
    }

    // 否则，设置定时器，在输入停顿后触发预连接
    this.typingTimer = setTimeout(() => {
      if (input.length > 0) {
        this.preconnect();
      }
    }, this.config.typingIdleDelay);
  }

  /**
   * 预连接到AI服务
   */
  async preconnect() {
    // 如果已经有活跃连接或正在连接中，不重复连接
    if (this.activeConnection || this.isConnecting) {
      return;
    }

    // 标记为连接中
    this.isConnecting = true;
    updateConnectionStatus("connecting");

    try {
      // 创建新连接 - 移除预先检查配置步骤，加快连接速度
      // 如果配置无效，连接会自然失败
      const connection = await this.createConnection();

      // 保存连接
      this.activeConnection = connection;
      this.lastActivity = Date.now();

      // 更新状态
      updateConnectionStatus("connected");
    } catch (error) {
      console.error("预连接失败:", error);
      updateConnectionStatus("error");
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * 检查AI配置是否有效
   * @returns {Promise<boolean>} 配置是否有效
   */
  async checkAIConfig() {
    try {
      const response = await fetch("/api/test-ai-connection");
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error("检查AI配置失败:", error);
      return false;
    }
  }

  /**
   * 创建新连接
   * @returns {Promise<Object>} 连接对象
   */
  async createConnection() {
    // 生成会话ID
    const sessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    // 创建EventSource连接
    const eventSource = new EventSource(`/api/stream-connection/${sessionId}`);

    // 等待连接建立 - 优化连接建立逻辑
    await new Promise((resolve, reject) => {
      // 设置超时
      const connectionTimeout = setTimeout(() => {
        eventSource.close();
        reject(new Error("连接建立超时"));
      }, this.config.connectionTimeout);

      // 使用单一事件处理器处理所有事件，减少事件监听器数量
      const handleEvent = (event) => {
        if (event.type === "open") {
          clearTimeout(connectionTimeout);
          resolve();
        } else if (event.type === "error") {
          clearTimeout(connectionTimeout);
          reject(new Error("连接建立失败"));
        } else if (event.type === "message") {
          try {
            const data = JSON.parse(event.data);
            if (data.event === "connected") {
              clearTimeout(connectionTimeout);
              resolve();
            }
          } catch (error) {
            // 忽略解析错误
          }
        }
      };

      // 添加事件监听器
      eventSource.addEventListener("open", handleEvent);
      eventSource.addEventListener("error", handleEvent);
      eventSource.addEventListener("message", handleEvent);
    });

    // 返回连接对象
    return {
      sessionId,
      eventSource,
      createdAt: Date.now(),
      inUse: false,
    };
  }

  /**
   * 获取连接
   * @returns {Promise<Object>} 连接对象
   */
  async getConnection() {
    // 记录使用历史
    this.recordUsage();

    // 如果有活跃连接且未在使用中，直接返回
    if (this.activeConnection && !this.activeConnection.inUse) {
      console.log("复用现有连接");

      // 清除可能存在的关闭定时器
      if (this.closeTimer) {
        clearTimeout(this.closeTimer);
        this.closeTimer = null;
      }

      // 标记为使用中
      this.activeConnection.inUse = true;
      this.lastActivity = Date.now();

      return this.activeConnection;
    }

    // 否则创建新连接
    console.log("创建新连接");
    updateConnectionStatus("connecting");

    try {
      const connection = await this.createConnection();
      this.activeConnection = connection;
      this.activeConnection.inUse = true;
      this.lastActivity = Date.now();

      updateConnectionStatus("connected");
      return this.activeConnection;
    } catch (error) {
      updateConnectionStatus("error");
      throw error;
    }
  }

  /**
   * 释放连接
   * @param {boolean} success - 连接使用是否成功
   */
  releaseConnection(success = true) {
    if (!this.activeConnection) return;

    // 标记为不在使用中
    this.activeConnection.inUse = false;
    this.lastActivity = Date.now();

    // 更新连接状态
    updateConnectionStatus(success ? "connected" : "error");

    // 对于频繁用户，保持连接更长时间
    const closeDelay = this.isFrequentUser()
      ? this.config.frequentUserTimeout
      : this.config.closeDelay;

    // 设置延迟关闭定时器
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }

    // 使用requestIdleCallback在浏览器空闲时关闭连接，不阻塞UI
    this.closeTimer = setTimeout(() => {
      if (this.activeConnection && !this.activeConnection.inUse) {
        if (window.requestIdleCallback) {
          window.requestIdleCallback(() => this.closeConnection(), {
            timeout: 2000,
          });
        } else {
          this.closeConnection();
        }
      }
    }, closeDelay);
  }

  /**
   * 关闭连接
   * @param {boolean} force - 是否强制关闭
   */
  closeConnection(force = false) {
    if (!this.activeConnection) return;

    // 如果连接正在使用中且非强制关闭，不关闭
    if (this.activeConnection.inUse && !force) {
      return;
    }

    // 关闭EventSource
    if (this.activeConnection.eventSource) {
      this.activeConnection.eventSource.close();
    }

    // 清除连接
    this.activeConnection = null;

    // 清除定时器
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }

    // 更新状态
    updateConnectionStatus("disconnected");
    console.log("连接已关闭");
  }

  /**
   * 记录使用历史
   */
  recordUsage() {
    const now = Date.now();

    // 清理超过1分钟的历史记录
    this.usageHistory = this.usageHistory.filter((time) => now - time < 60000);

    // 添加当前使用时间
    this.usageHistory.push(now);
  }

  /**
   * 判断是否为频繁用户
   * @returns {boolean} 是否为频繁用户
   */
  isFrequentUser() {
    // 如果1分钟内使用次数超过阈值，视为频繁用户
    return this.usageHistory.length >= this.config.frequentUseThreshold;
  }

  /**
   * 获取连接状态
   * @returns {Object} 连接状态信息
   */
  getStatus() {
    return {
      connected: !!this.activeConnection,
      inUse: this.activeConnection ? this.activeConnection.inUse : false,
      sessionId: this.activeConnection ? this.activeConnection.sessionId : null,
      createdAt: this.activeConnection ? this.activeConnection.createdAt : null,
      lastActivity: this.lastActivity,
      isFrequentUser: this.isFrequentUser(),
      usageCount: this.usageHistory.length,
    };
  }
}

// 创建单例实例
const connectionManager = new ConnectionManager();

export default connectionManager;
