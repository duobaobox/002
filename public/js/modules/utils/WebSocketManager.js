/**
 * WebSocket管理器
 * 用于管理与服务器的WebSocket连接，接收实时通知
 */

class WebSocketManager {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000; // 3秒
    this.reconnectTimer = null;
    this.handlers = {
      account_deleted: [],
      connection: [],
      error: []
    };
    this.connected = false;
  }

  /**
   * 初始化WebSocket连接
   * @param {string} username - 当前用户名
   */
  connect(username) {
    if (!username) {
      console.error('WebSocketManager: 无法连接，未提供用户名');
      return;
    }

    // 如果已经连接，先断开
    if (this.socket) {
      this.disconnect();
    }

    // 确定WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws?username=${encodeURIComponent(username)}`;

    console.log(`WebSocketManager: 正在连接到 ${url}`);

    try {
      this.socket = new WebSocket(url);

      // 连接打开事件
      this.socket.onopen = () => {
        console.log('WebSocketManager: 连接已建立');
        this.connected = true;
        this.reconnectAttempts = 0;
        this._triggerHandlers('connection', { connected: true });
      };

      // 接收消息事件
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocketManager: 收到消息', data);

          // 根据消息类型触发相应的处理器
          if (data.type && this.handlers[data.type]) {
            this._triggerHandlers(data.type, data);
          }
        } catch (error) {
          console.error('WebSocketManager: 解析消息失败', error);
        }
      };

      // 连接关闭事件
      this.socket.onclose = (event) => {
        this.connected = false;
        console.log(`WebSocketManager: 连接已关闭，代码: ${event.code}`);
        this._triggerHandlers('connection', { connected: false });

        // 尝试重新连接
        this._attemptReconnect(username);
      };

      // 错误事件
      this.socket.onerror = (error) => {
        console.error('WebSocketManager: 连接错误', error);
        this._triggerHandlers('error', { error });
      };
    } catch (error) {
      console.error('WebSocketManager: 创建WebSocket连接失败', error);
      this._triggerHandlers('error', { error });
      this._attemptReconnect(username);
    }
  }

  /**
   * 断开WebSocket连接
   */
  disconnect() {
    if (this.socket) {
      console.log('WebSocketManager: 正在断开连接');
      this.socket.close();
      this.socket = null;
      this.connected = false;
    }

    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 添加事件处理器
   * @param {string} event - 事件类型
   * @param {Function} handler - 处理函数
   */
  on(event, handler) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
  }

  /**
   * 移除事件处理器
   * @param {string} event - 事件类型
   * @param {Function} handler - 处理函数
   */
  off(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  }

  /**
   * 触发事件处理器
   * @param {string} event - 事件类型
   * @param {Object} data - 事件数据
   * @private
   */
  _triggerHandlers(event, data) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`WebSocketManager: 处理 ${event} 事件时出错`, error);
        }
      });
    }
  }

  /**
   * 尝试重新连接
   * @param {string} username - 用户名
   * @private
   */
  _attemptReconnect(username) {
    // 清除可能存在的重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // 检查重连次数
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      
      console.log(`WebSocketManager: 将在 ${delay}ms 后尝试重新连接 (尝试 ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimer = setTimeout(() => {
        console.log(`WebSocketManager: 正在尝试重新连接...`);
        this.connect(username);
      }, delay);
    } else {
      console.log('WebSocketManager: 达到最大重连次数，停止重连');
    }
  }
}

// 创建单例实例
const webSocketManager = new WebSocketManager();

export default webSocketManager;
