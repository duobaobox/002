/**
 * App 模块类
 * 应用程序的主控制类，管理便签和UI交互
 */

import {
  Canvas,
  Note,
  createEmptyAiNote,
  getHighestZIndex,
  updateNoteContent,
} from "../index.js";

// 导入智能连接管理器
import connectionManager from "../utils/ConnectionManager.js";
// 导入节点连接管理器
import nodeConnectionManager from "../utils/NodeConnectionManager.js";

/**
 * App 主控制类
 */
export class App {
  constructor() {
    // 设置自定义事件
    this.customEvents = {};

    // 初始化便签数组
    this.notes = [];
    this.canvas = new Canvas();
    this.nextId = 1;

    // 添加一个防抖延迟对象，用于跟踪每个便签的更新请求
    this.updateDebounceTimers = {};
    // 设置防抖延迟时间(毫秒)
    this.updateDebounceDelay = 1000;

    // 当前备份区域元素
    this.backupStatusArea = null;

    // 注册清理任务 - 在页面卸载前关闭所有连接
    this.registerConnectionCleanupTask();

    // 创建并初始化设置模态框
    this.initSettingsModal();

    // AI 预连接相关属性
    this.preconnectTimer = null; // 预连接定时器
    this.activeSession = null; // 当前活跃的会话信息
    this.preconnectDelay = 800; // 预连接延迟时间(毫秒)
    this.connectionTimeout = 120000; // 连接超时时间(2分钟)
    this.lastConfigCheck = 0; // 上次配置检查时间戳
    this.configCheckInterval = 30000; // 配置检查间隔(30秒)
    this.configValid = false; // 配置有效性标志
    this.inputActivityTimeout = null; // 输入活动超时定时器
    this.minInputLength = 3; // 最小输入长度才触发预连接
    this.currentAbortController = null; // 当前的中止控制器

    // 连接管理相关属性
    this.sessionManager = {
      // 会话管理配置
      connectionTimeout: 3 * 60 * 1000, // 会话超时时间 (3分钟)
      preconnectDelay: 800, // 预连接延迟时间(毫秒)
      minInputLength: 3, // 最小输入长度才触发预连接
      maxRetries: 2, // 最大重试次数

      // 状态跟踪
      activeSessionId: null, // 当前活跃的会话ID
      eventSource: null, // 当前EventSource实例
      lastActivity: 0, // 最后活动时间戳
      isConnected: false, // 连接状态
      isInUse: false, // 是否正在使用中

      // 定时器
      preconnectTimer: null, // 预连接定时器
      activityTimer: null, // 活动检测定时器
      pingTimer: null, // 保活定时器

      // 配置缓存
      lastConfigCheck: 0, // 上次配置检查时间戳
      configCheckInterval: 30000, // 配置检查间隔(30秒)
      configValid: false, // 配置有效性标志
    };

    // 在设置中添加连接管理高级选项
    this.advancedSettings = {
      keepConnectionOpen: true, // 默认保持连接打开以便复用
      automaticPreconnect: true, // 默认启用自动预连接
      showConnectionStatus: false, // 默认不显示连接状态
    };

    // 初始化邀请码管理
    this.inviteCodes = [];
    this.inviteApiAvailable = false; // 标记API是否可用

    // 更新按钮可见性
    this.updateButtonVisibility();

    // 检查认证状态
    this.checkAuth();

    // 初始化事件监听器 (只初始化一次)
    this.initEventListeners().then(() => {
      console.log("事件监听器初始化完成");

      // 初始化完成后添加延迟检查便签连接状态
      setTimeout(() => {
        if (window.nodeConnectionManager) {
          const connectedNotes =
            window.nodeConnectionManager.getConnectedNotes();
          if (connectedNotes && connectedNotes.length > 0) {
            console.log(
              "App初始化：检测到已连接便签数量:",
              connectedNotes.length
            );
            this.updatePromptPlaceholder();
            this.updateButtonVisibility();
          }
        }
      }, 1000);

      // 加载便签数据 (只在事件监听器初始化完成后加载一次)
      this.loadNotes();
    });
  }

  // 检查认证状态
  async checkAuth() {
    try {
      const response = await fetch("/api/session");
      const data = await response.json();

      if (!data.success || !data.isLoggedIn) {
        // 未登录，重定向到登录页
        window.location.href = "/login.html";
      } else {
        // 更新顶部用户信息（如果有这个元素）
        const userDisplay = document.querySelector(".user-display");
        if (userDisplay && data.user) {
          userDisplay.textContent = data.user.username;
        }

        // 在检查登录成功后，加载邀请码
        if (
          data.success &&
          data.isLoggedIn &&
          data.user &&
          data.user.username === "admin"
        ) {
          // 尝试加载邀请码
          this.checkIfInviteApiAvailable();
        }
      }
    } catch (error) {
      console.error("检查认证状态失败:", error);
      this.showMessage("检查登录状态失败", "error");
    }
  }

  /**
   * 处理API响应错误
   * @param {Response} response - Fetch API响应对象
   * @param {Object} data - 响应数据
   * @returns {boolean} 如果错误已处理返回true，否则返回false
   */
  handleApiError(response, data) {
    // 检查是否是认证错误
    if (response.status === 401) {
      // 检查是否是账户被删除的情况
      if (data.accountDeleted) {
        // 如果服务器指示强制重定向，立即执行
        if (data.forceRedirect) {
          console.log("服务器要求强制重定向到登录页面");
          sessionStorage.setItem("accountDeleted", "true");
          window.location.href = data.redirectTo || "/login.html";
          return true;
        }
        // 创建一个特殊的账户删除提示，更加醒目
        let messageContainer = document.querySelector(
          ".account-deleted-message"
        );

        // 如果不存在，创建一个
        if (!messageContainer) {
          messageContainer = document.createElement("div");
          messageContainer.className =
            "message-top-center account-deleted-message message-error";
          document.body.appendChild(messageContainer);

          // 添加更详细的消息内容
          messageContainer.innerHTML = `
            <div class="account-deleted-icon">⚠️</div>
            <div class="account-deleted-content">
              <div class="account-deleted-title">您的账户已被删除</div>
              <div class="account-deleted-text">您的账户已被管理员删除，即将返回登录页面</div>
            </div>
          `;

          // 添加自定义样式
          const style = document.createElement("style");
          style.textContent = `
            .account-deleted-message {
              display: flex;
              align-items: center;
              padding: 16px 25px !important;
              background-color: rgba(244, 67, 54, 0.95) !important;
              max-width: 400px !important;
            }
            .account-deleted-icon {
              font-size: 24px;
              margin-right: 15px;
            }
            .account-deleted-content {
              display: flex;
              flex-direction: column;
            }
            .account-deleted-title {
              font-weight: bold;
              margin-bottom: 5px;
              font-size: 16px;
            }
            .account-deleted-text {
              font-size: 14px;
            }
          `;
          document.head.appendChild(style);
        }

        // 显示消息
        setTimeout(() => {
          messageContainer.classList.add("show");
          console.log("账户删除消息已显示，准备重定向...");

          // 延迟重定向，让用户有时间看到消息
          setTimeout(() => {
            console.log("执行重定向到登录页面...");
            // 将账户删除状态存储在 sessionStorage 中，以便登录页面可以显示相应消息
            sessionStorage.setItem("accountDeleted", "true");

            // 使用更可靠的重定向方法
            try {
              // 方法1：直接设置location.href
              window.location.href = "/login.html";

              // 方法2：如果上面的方法失败，使用replace方法
              setTimeout(() => {
                if (window.location.pathname !== "/login.html") {
                  console.log("使用location.replace方法重定向...");
                  window.location.replace("/login.html");
                }
              }, 100);

              // 方法3：最后的备选方案，创建一个表单并提交
              setTimeout(() => {
                if (window.location.pathname !== "/login.html") {
                  console.log("使用表单提交方法重定向...");
                  const form = document.createElement("form");
                  form.method = "GET";
                  form.action = "/login.html";
                  document.body.appendChild(form);
                  form.submit();
                }
              }, 200);
            } catch (e) {
              console.error("重定向过程中发生错误:", e);
              alert("您的账户已被删除，请手动返回登录页面");
            }
          }, 2000);
        }, 100);

        return true;
      }

      // 普通的认证错误（会话过期等）
      if (data.redirectTo) {
        this.showMessage("您的登录已过期，请重新登录", "warning");
        // 延迟重定向，让用户有时间看到消息
        setTimeout(() => {
          window.location.href = data.redirectTo;
        }, 1500);
        return true;
      }
    }

    // 其他错误
    if (!data.success && data.message) {
      this.showMessage(data.message, "error");
      return true;
    }

    return false; // 错误未处理
  }

  // 检查邀请码API是否可用
  async checkIfInviteApiAvailable() {
    try {
      const response = await fetch("/api/invite-codes", {
        method: "HEAD", // 使用HEAD请求只检查API存在性，不获取数据
      });

      // 如果状态码是404或其他非2xx状态，API可能不可用
      this.inviteApiAvailable = response.ok;

      if (this.inviteApiAvailable) {
        // API可用，可以加载邀请码
        this.loadInviteCodes();
      } else {
        console.warn("邀请码API尚未实现，邀请码功能将不可用");
        this.updateInviteUIForUnavailableAPI();
      }
    } catch (error) {
      console.warn("检查邀请码API失败:", error);
      this.inviteApiAvailable = false;
      this.updateInviteUIForUnavailableAPI();
    }
  }

  // 添加登出方法
  async logout() {
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        // 登出成功，重定向到登录页
        window.location.href = "/login.html";
      } else {
        this.showMessage("登出失败", "error");
      }
    } catch (error) {
      console.error("登出请求失败:", error);
      this.showMessage("登出请求失败", "error");
    }
  }

  // 修改现有的事件监听器方法，添加预连接功能
  async initEventListeners() {
    // 导入连接工具（保留导入，但不再显示连接状态）
    const { updateConnectionStatus } = await import(
      "../utils/ConnectionUtils.js"
    );
    this.updateConnectionStatus = updateConnectionStatus;

    // 在应用启动时就预连接
    this.smartPreconnectAIService();

    // 添加页面可见性变化事件，当用户切回页面时预连接
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        // 页面变为可见时预连接
        this.smartPreconnectAIService();
      }
    });
    // 添加普通便签按钮
    document.getElementById("add-note").addEventListener("click", () => {
      this.addEmptyNote();
    });

    // AI生成便签按钮 - 添加取消功能
    const aiGenerateButton = document.getElementById("ai-generate");
    aiGenerateButton.addEventListener("click", () => {
      // 如果按钮处于生成中状态，则取消生成
      if (aiGenerateButton.classList.contains("generating")) {
        this.cancelGeneration().then((canceled) => {
          if (canceled) {
            this.showMessage("已取消AI生成", "info");

            // 恢复按钮和输入框状态
            aiGenerateButton.disabled = false;
            aiGenerateButton.classList.remove("generating");
            aiGenerateButton.title = "AI生成便签";

            const promptElement = document.getElementById("ai-prompt");
            if (promptElement) {
              promptElement.disabled = false;
            }
          }
        });
      } else {
        // 确保nodeConnectionManager已初始化
        if (!window.nodeConnectionManager) {
          console.warn("节点连接管理器未初始化，尝试获取实例");
          // 尝试从window对象获取实例
          const nodeConnectionManagerInstance = window.nodeConnectionManager;
          if (!nodeConnectionManagerInstance) {
            console.error("无法获取节点连接管理器实例");
            this.showMessage("连接功能暂不可用，请刷新页面重试", "error");
            return;
          }
        }

        // 强制刷新一次连接状态，确保获取最新连接列表
        if (window.nodeConnectionManager) {
          window.nodeConnectionManager.forceUpdateAllConnections();
        }

        // 延迟50ms确保连接状态已更新
        setTimeout(() => {
          // 获取连接的便签
          const connectedNotes = window.nodeConnectionManager
            ? window.nodeConnectionManager.getConnectedNotes()
            : [];

          console.log(`检测到 ${connectedNotes.length} 个连接的便签`);

          if (connectedNotes.length > 0) {
            // 如果有连接的便签，使用连接便签生成
            this.generateFromConnectedNotes();
          } else {
            // 否则使用普通生成
            this.generateAiNote();
          }
        }, 50);
      }
    });

    // 监听便签删除事件
    document.addEventListener("note-removed", (e) => {
      this.removeNote(e.detail.id);
    });

    // 监听便签更新事件
    document.addEventListener("note-updated", (e) => {
      this.updateNoteOnServer(e.detail.id);
    });

    // 监听便签移动事件
    document.addEventListener("note-moved", (e) => {
      this.updateNoteOnServer(e.detail.id);
    });

    // 监听便签调整大小事件
    document.addEventListener("note-resized", (e) => {
      this.updateNoteOnServer(e.detail.id);
    });

    // 监听便签层级变化事件
    document.addEventListener("note-zindex-changed", (e) => {
      this.updateNoteOnServer(e.detail.id);
    });

    // 监听便签选中事件
    document.addEventListener("note-selected", (e) => {
      console.log("便签选中:", e.detail.note.id);
    });

    // 监听便签取消选中事件
    document.addEventListener("note-deselected", () => {
      console.log("便签取消选中");
    });

    // 监听便签连接事件
    document.addEventListener("note-connected", (e) => {
      console.log("便签已连接:", e.detail.note.id);
      this.updatePromptPlaceholder();
      this.updateButtonVisibility(); // 更新按钮状态
    });

    // 监听便签断开连接事件
    document.addEventListener("note-disconnected", (e) => {
      console.log("便签已断开连接:", e.detail.note.id);
      this.updatePromptPlaceholder();
      this.updateButtonVisibility(); // 更新按钮状态
    });

    // 监听新版便签连接建立事件
    document.addEventListener("note-connection-established", (e) => {
      console.log("便签连接已建立:", e.detail.note.id);
      this.updatePromptPlaceholder();
      this.updateButtonVisibility(); // 更新按钮状态
    });

    // 监听便签连接移除事件
    document.addEventListener("note-connection-removed", (e) => {
      console.log("便签连接已移除:", e.detail.note.id);
      this.updatePromptPlaceholder();
      this.updateButtonVisibility(); // 更新按钮状态
    });

    // 监听所有连接清除事件
    document.addEventListener("all-connections-cleared", () => {
      console.log("所有便签连接已清除");
      this.updatePromptPlaceholder();
      this.updateButtonVisibility(); // 更新按钮状态
      this.showMessage("已清除所有便签连接", "info");
    });

    // 取消AI生成事件监听器已移除，现在直接通过AI生成按钮处理取消

    // 监听输入框内容变化
    const promptElement = document.getElementById("ai-prompt");
    promptElement.addEventListener("input", () => {
      this.updateButtonVisibility();

      // 添加预连接功能：当用户开始输入时预热AI连接
      this.smartPreconnectAIService();
    });

    // 监听输入框聚焦事件，当用户聚焦到输入框时预连接
    promptElement.addEventListener("focus", () => {
      // 当输入框获得焦点时预连接
      this.smartPreconnectAIService();
    });

    // 修改回车键行为，使用回车键为换行，Shift+Enter才触发生成
    promptElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (e.shiftKey) {
          // Shift+Enter 触发生成
          e.preventDefault();
          const hasText = promptElement.value.trim().length > 0;

          if (hasText) {
            // 确保nodeConnectionManager已初始化
            if (!window.nodeConnectionManager) {
              console.warn("快捷键生成：节点连接管理器未初始化");
              this.generateAiNote();
              return;
            }

            // 强制刷新一次连接状态，确保获取最新连接列表
            window.nodeConnectionManager.forceUpdateAllConnections();

            // 延迟50ms确保连接状态已更新
            setTimeout(() => {
              // 获取连接的便签
              const connectedNotes =
                window.nodeConnectionManager.getConnectedNotes();

              if (connectedNotes && connectedNotes.length > 0) {
                console.log(
                  `快捷键生成：检测到 ${connectedNotes.length} 个连接的便签`
                );
                this.generateFromConnectedNotes();
              } else {
                this.generateAiNote();
              }
            }, 50);
          } else {
            // 无文本时添加空白便签
            this.addEmptyNote();
          }
        } else {
          // 普通回车键，添加换行
          // 已由默认行为处理
        }
      }
    });

    // 底部控制栏折叠/展开功能
    const toggleBarButton = document.querySelector(".toggle-bar-button");
    if (toggleBarButton) {
      toggleBarButton.addEventListener("click", () => {
        const bottomBar = document.querySelector(".bottom-bar");
        bottomBar.classList.toggle("collapsed");

        // 保存折叠状态到本地存储
        const isCollapsed = bottomBar.classList.contains("collapsed");
        localStorage.setItem("bottomBarCollapsed", isCollapsed);

        // 更新按钮提示文本 - 修改提示文本以匹配新的展开方向
        toggleBarButton.title = isCollapsed
          ? "向上展开输入区域"
          : "隐藏输入区域";
      });

      // 加载保存的折叠状态
      const savedCollapsedState = localStorage.getItem("bottomBarCollapsed");
      if (savedCollapsedState === "true") {
        document.querySelector(".bottom-bar").classList.add("collapsed");
        toggleBarButton.title = "向上展开输入区域";
      } else {
        toggleBarButton.title = "隐藏输入区域";
      }
    }

    // 自动聚焦到输入框当用户点击底部栏时（如果不处于折叠状态）
    const bottomBar = document.querySelector(".bottom-bar");
    bottomBar.addEventListener("click", (e) => {
      // 只在点击底部栏而不是其中的控件时聚焦
      if (
        e.target === bottomBar ||
        e.target.classList.contains("bottom-bar-content")
      ) {
        if (!bottomBar.classList.contains("collapsed")) {
          promptElement.focus();
        }
      }
    });

    // 导出便签 (JSON)
    // Ensure the selector matches the updated button ID in HTML
    const exportJsonButton = document.getElementById("export-notes-json");
    if (exportJsonButton) {
      // Check if the element exists
      exportJsonButton.addEventListener("click", () => {
        // Call the existing JSON export function (maybe rename it for clarity)
        this.exportNotesAsJson(); // Renamed function for clarity
      });
    } else {
      console.warn("Export JSON button not found");
    }

    // 导出数据库 (.db) - New Event Listener
    const exportDbButton = document.getElementById("export-database-db");
    if (exportDbButton) {
      // Check if the element exists
      exportDbButton.addEventListener("click", () => {
        this.exportDatabaseFile(); // Call new function
      });
    } else {
      console.warn("Export DB button not found");
    }

    // 导入数据 (JSON) - Keep existing logic
    const importFile = document.getElementById("import-file");
    if (importFile) {
      // Check if the element exists
      importFile.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
          // Call the existing JSON import function (maybe rename it for clarity)
          this.importNotesFromJson(e.target.files[0]); // Renamed function for clarity
          // Clear file input
          importFile.value = "";
        }
      });
    } else {
      console.warn("Import file input not found");
    }

    // 创建通用的多次点击确认函数
    const setupMultiClickConfirmation = (button, options) => {
      if (!button) return;

      const {
        buttonText, // 按钮原始文本
        confirmationTexts, // 确认过程中的文本 [第一次点击文本, 第二次点击文本]
        processingText, // 处理中的文本
        successText, // 成功后的文本
        action, // 执行的操作函数
        successCallback, // 成功后的回调
        timeoutMs = 3000, // 超时时间
      } = options;

      let clickCount = 0;
      let clickTimer = null;

      button.addEventListener("click", () => {
        clickCount++;

        // 更新按钮文本，显示还需点击几次
        if (clickCount === 1) {
          button.innerHTML = `${confirmationTexts[0]} <span class="reset-progress">⚫◯◯</span>`;
          button.classList.add("reset-warning");
        } else if (clickCount === 2) {
          button.innerHTML = `${confirmationTexts[1]} <span class="reset-progress">⚫⚫◯</span>`;
          button.classList.add("reset-danger");
        } else if (clickCount >= 3) {
          button.innerHTML = processingText;
          button.disabled = true;

          // 执行操作
          action()
            .then((success) => {
              if (success) {
                // 操作完成后恢复按钮状态
                button.innerHTML = successText || buttonText;
                button.classList.remove("reset-warning", "reset-danger");
                button.disabled = false;

                // 执行成功回调
                if (successCallback) {
                  successCallback();
                }
              }
            })
            .catch((error) => {
              console.error(`操作失败:`, error);
              this.showMessage(`操作失败: ${error.message}`, "error");

              // 恢复按钮状态
              button.innerHTML = buttonText;
              button.classList.remove("reset-warning", "reset-danger");
              button.disabled = false;
            });

          // 重置计数器
          clickCount = 0;
          if (clickTimer) {
            clearTimeout(clickTimer);
          }
          return;
        }

        // 设置超时，如果超过指定时间没有下一次点击，则重置计数器
        if (clickTimer) {
          clearTimeout(clickTimer);
        }

        clickTimer = setTimeout(() => {
          clickCount = 0;
          button.innerHTML = buttonText;
          button.classList.remove("reset-warning", "reset-danger");
        }, timeoutMs);
      });
    };

    // 重置设置按钮
    const resetButton = document.querySelector(".reset-button");
    setupMultiClickConfirmation(resetButton, {
      buttonText: "重置所有设置",
      confirmationTexts: ["再点击 2 次确认重置", "再点击 1 次确认重置"],
      processingText: "正在重置...",
      action: () => this.resetAllData(),
      successCallback: () => {
        this.showMessage("所有数据已重置", "success");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      },
    });

    // 清除AI设置按钮
    const clearAiSettingsButton = document.getElementById("clear-ai-settings");
    setupMultiClickConfirmation(clearAiSettingsButton, {
      buttonText: "清除 AI 设置及历史",
      confirmationTexts: [
        "再点击 2 次确认清除设置及历史",
        "再点击 1 次确认清除设置及历史",
      ],
      processingText: "正在清除设置及历史...",
      action: () => this.clearAISettings(),
      successCallback: () => {
        // 清空表单值
        document.getElementById("ai-api-key").value = "";
        document.getElementById("ai-base-url").value = "";
        document.getElementById("ai-model").value = "";
        document.getElementById("ai-max-tokens").value = "800";
        document.getElementById("ai-temperature").value = "0.7";

        // 更新温度值显示
        const tempValueElement = document.getElementById("temperature-value");
        if (tempValueElement) {
          tempValueElement.textContent = "0.7";
        }

        // 更新底部栏的AI模型显示
        const aiModelDisplay = document.querySelector(".ai-model");
        if (aiModelDisplay) {
          aiModelDisplay.textContent = "未设置";
        }

        this.showMessage("所有AI设置及历史已清除", "success");
      },
    });

    // 测试AI连接按钮 (修正选择器)
    const testConnectionButton = document.getElementById("test-ai-connection");
    if (testConnectionButton) {
      testConnectionButton.addEventListener("click", () => {
        this.testAIConnection(); // 使用更新后的方法名
      });
    }

    // 更新登出按钮事件监听器 - 使用设置面板中的按钮
    const logoutButton = document.getElementById("settings-logout-button");
    if (logoutButton) {
      logoutButton.addEventListener("click", () => {
        this.logout();
      });
    }

    // 邀请码生成按钮
    const generateInviteCodeButton = document.getElementById(
      "generate-invite-code"
    );
    if (generateInviteCodeButton) {
      generateInviteCodeButton.addEventListener("click", () => {
        this.generateInviteCode();
      });
    }

    // 监听连接状态变化事件
    document.addEventListener("connections-changed", (e) => {
      console.log("连接状态变化，更新UI");
      // 更新占位符和按钮显示
      this.updatePromptPlaceholder();
      this.updateButtonVisibility();

      // 更新底部栏的视觉提示
      const connectedNotes =
        window.nodeConnectionManager?.getConnectedNotes() || [];
      const bottomBar = document.querySelector(".bottom-bar");
      if (bottomBar) {
        if (connectedNotes.length > 0) {
          bottomBar.classList.add("connection-mode");
        } else {
          bottomBar.classList.remove("connection-mode");
        }
      }
    });

    // 初始化时检查连接状态
    setTimeout(() => {
      if (window.nodeConnectionManager) {
        const connected =
          window.nodeConnectionManager.forceUpdateAllConnections();
        console.log(`初始化事件监听器：检测到 ${connected} 个连接的便签`);
      }
    }, 500);
  }

  // 根据输入内容更新按钮可见性
  updateButtonVisibility() {
    const promptElement = document.getElementById("ai-prompt");
    const hasText = promptElement.value.trim().length > 0;

    const addButton = document.getElementById("add-note");
    const aiButton = document.getElementById("ai-generate");

    // 安全地获取连接的便签数量
    let connectedNotes = [];
    if (window.nodeConnectionManager) {
      try {
        connectedNotes = window.nodeConnectionManager.getConnectedNotes() || [];
      } catch (e) {
        console.warn("获取连接便签失败:", e);
      }
    }
    const hasConnectedNotes = connectedNotes.length > 0;

    // 当有便签连接时，始终禁用手动添加按钮
    if (hasConnectedNotes) {
      // 无论是否有文本输入，都隐藏添加按钮，显示AI生成按钮
      addButton.style.display = "none";
      aiButton.style.display = "block";

      // 为AI按钮添加连接模式样式
      aiButton.classList.add("connected-mode");
      aiButton.title = `基于 ${connectedNotes.length} 个便签生成内容`;

      // 对底部输入区域添加视觉提示
      const bottomBar = document.querySelector(".bottom-bar");
      if (bottomBar) {
        bottomBar.classList.add("connection-mode");
      }
    } else {
      // 没有连接的便签时，恢复正常行为
      if (hasText) {
        addButton.style.display = "none";
        aiButton.style.display = "block";
        aiButton.classList.remove("connected-mode");
        aiButton.title = "AI生成便签";
      } else {
        addButton.style.display = "block";
        aiButton.style.display = "none";
      }

      // 移除底部栏的连接模式样式
      const bottomBar = document.querySelector(".bottom-bar");
      if (bottomBar) {
        bottomBar.classList.remove("connection-mode");
      }
    }
  }

  // 更新提示框占位文本
  updatePromptPlaceholder() {
    const promptElement = document.getElementById("ai-prompt");
    if (!promptElement) return;

    // 安全地获取连接的便签
    let connectedNotes = [];
    if (window.nodeConnectionManager) {
      try {
        connectedNotes = window.nodeConnectionManager.getConnectedNotes() || [];
      } catch (e) {
        console.warn("获取连接便签失败:", e);
      }
    }

    if (connectedNotes.length > 0) {
      // 更加详细和有指导性的占位文本
      const noteCount = connectedNotes.length;
      promptElement.placeholder = `请输入指令，处理这 ${noteCount} 个便签的内容...`;

      // 为输入框添加连接模式样式
      promptElement.classList.add("connection-input-mode");

      // 更新便签标题
      const noteTitles = connectedNotes
        .map((note) => note.title || "无标题便签")
        .join(", ");
      if (noteTitles.length > 50) {
        promptElement.title = `连接的便签: ${noteTitles.substring(0, 47)}...`;
      } else {
        promptElement.title = `连接的便签: ${noteTitles}`;
      }
    } else {
      // 恢复默认占位文本
      promptElement.placeholder = "输入提示或直接添加便签...";

      // 移除连接模式样式
      promptElement.classList.remove("connection-input-mode");
      promptElement.title = "";
    }
  }

  // 基于连接的便签生成新便签
  async generateFromConnectedNotes() {
    const promptElement = document.getElementById("ai-prompt");
    const userPrompt = promptElement.value.trim();

    // 直接从window对象获取最新连接状态
    if (!window.nodeConnectionManager) {
      this.showMessage("连接管理器未初始化，无法获取连接便签", "error");
      return;
    }

    // 强制刷新一次连接
    window.nodeConnectionManager.forceUpdateAllConnections();

    // 获取连接的便签
    const connectedNotes = window.nodeConnectionManager.getConnectedNotes();
    console.log(`生成内容：检测到 ${connectedNotes.length} 个连接的便签`);

    if (connectedNotes.length === 0) {
      this.showMessage("没有连接的便签", "warning");
      return;
    }

    // 获取生成按钮
    const generateButton = document.getElementById("ai-generate");

    // 禁用按钮和输入框，防止重复提交
    generateButton.disabled = true;
    generateButton.classList.add("generating");
    generateButton.title = "点击取消生成";
    promptElement.disabled = true;

    // 更新连接状态为生成中
    if (this.updateConnectionStatus) {
      this.updateConnectionStatus("generating");
    }

    try {
      // 创建临时便签
      const { noteElement, noteId } = createEmptyAiNote();
      const noteContainer = document.getElementById("note-container");
      noteContainer.appendChild(noteElement);

      // 构建提示词
      let combinedPrompt = "基于以下内容";
      if (userPrompt) {
        combinedPrompt += `，按照要求"${userPrompt}"`;
      }
      combinedPrompt += "生成新的内容：\n\n";

      // 添加连接便签的内容
      connectedNotes.forEach((note, index) => {
        combinedPrompt += `【便签 ${index + 1}：${note.title || "无标题"}】\n${
          note.text || "空白内容"
        }\n\n`;
      });

      // 生成内容
      const fullText = await this.generateWithSSE(combinedPrompt, noteElement);

      // 获取临时便签的位置和大小
      const currentX = parseInt(noteElement.style.left) || 100;
      const currentY = parseInt(noteElement.style.top) || 100;
      const noteWidth = noteElement.offsetWidth;
      const noteHeight = noteElement.offsetHeight;

      // 设置标题
      let finalTitle = userPrompt;
      if (!finalTitle || finalTitle.length === 0) {
        finalTitle = "基于连接便签生成";
      }
      if (finalTitle.length > 20) {
        finalTitle = finalTitle.substring(0, 20) + "...";
      }

      // 获取颜色类
      const colorClass = noteElement.classList[1] || "note-yellow";

      // 保存到服务器
      await this.saveStreamingNoteToServer(
        noteElement,
        fullText,
        currentX,
        currentY,
        finalTitle,
        colorClass,
        noteWidth,
        noteHeight
      );

      // 清空输入框
      promptElement.value = "";
      this.updateButtonVisibility();

      // 显示成功消息
      this.showMessage(
        `基于 ${connectedNotes.length} 个便签生成内容成功`,
        "success"
      );
    } catch (error) {
      console.error("基于连接便签生成失败:", error);
      this.showMessage("生成失败: " + error.message, "error");
    } finally {
      // 恢复按钮和输入框状态
      generateButton.disabled = false;
      generateButton.classList.remove("generating");
      generateButton.title = "AI生成便签";
      promptElement.disabled = false;

      // 更新连接状态
      if (this.updateConnectionStatus) {
        this.updateConnectionStatus("connected");
      }
    }
  }

  // 添加空白便签
  async addEmptyNote() {
    try {
      // 计算屏幕可见区域内的位置 - 确保便签生成在屏幕内
      // 获取画布实例以便进行坐标转换
      const canvas = window.canvasInstance;

      // 默认位置（如果无法获取画布实例）
      let x = 100 + Math.random() * 200;
      let y = 100 + Math.random() * 200;

      if (canvas) {
        // 获取视口尺寸
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 获取当前已存在的便签数量，用于计算错开位置
        const existingNotes = document.querySelectorAll(".note").length;

        // 计算屏幕居中偏左上的基准位置
        const baseScreenX = Math.max(viewportWidth * 0.25, 80);
        const baseScreenY = Math.max(viewportHeight * 0.15, 60);

        // 根据已存在的便签数量计算错开位置
        // 使用错开模式，每个新便签都会在基准位置的基础上错开一定距离
        const offsetX = (existingNotes % 5) * 60; // 每个便签水平错开60像素
        const offsetY = Math.floor(existingNotes / 5) * 80; // 每行5个便签，每行垂直错开80像素

        // 计算最终的屏幕坐标，并添加少量随机性
        const screenX = baseScreenX + offsetX + (Math.random() * 20 - 10);
        const screenY = baseScreenY + offsetY + (Math.random() * 20 - 10);

        // 将屏幕坐标转换为画布坐标
        const canvasPos = canvas.screenToCanvasPosition(screenX, screenY);
        x = canvasPos.x;
        y = canvasPos.y;

        console.log("空白便签生成位置(画布坐标):", {
          x,
          y,
          existingNotes,
          offsetX,
          offsetY,
        });
      }

      // 获取随机颜色类 (与Note类中定义保持一致)
      const colorClasses = [
        "note-yellow",
        "note-blue",
        "note-green",
        "note-pink",
        "note-purple",
      ];
      const colorClass =
        colorClasses[Math.floor(Math.random() * colorClasses.length)];

      const response = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ x, y, colorClass }),
      });

      const data = await response.json();

      if (data.success && data.note) {
        const note = new Note(
          data.note.id,
          data.note.text,
          data.note.x,
          data.note.y,
          data.note.title
        );
        this.notes.push(note);
        console.log("空白便签已添加，ID:", data.note.id);
      } else {
        console.error("创建便签失败:", data);
      }
    } catch (error) {
      console.error("添加便签出错:", error);
    }
  }

  // 从服务器加载便签
  async loadNotes() {
    // 防止重复加载
    if (this._isLoadingNotes) {
      console.log("便签加载中，跳过重复加载");
      return;
    }

    // 设置加载标志
    this._isLoadingNotes = true;

    try {
      const response = await fetch("/api/notes");
      const data = await response.json();

      // 处理可能的错误（如用户被删除）
      if (this.handleApiError(response, data)) {
        this._isLoadingNotes = false; // 重置加载标志
        return; // 错误已处理，直接返回
      }

      if (data.success) {
        this.nextId = data.nextId;

        // 清空现有便签
        this.notes = [];
        const noteContainer = document.getElementById("note-container");

        // 记录当前便签数量，用于检测是否清空干净
        const currentNoteCount = noteContainer.childElementCount;

        // 如果有便签，先清空，避免重复添加
        if (currentNoteCount > 0) {
          console.log(`清空 ${currentNoteCount} 个现有便签`);
          while (noteContainer.firstChild) {
            noteContainer.removeChild(noteContainer.firstChild);
          }
        }

        // 添加服务器返回的便签
        console.log(`从服务器加载 ${data.notes.length} 个便签`);
        data.notes.forEach((noteData) => {
          // 直接使用数据库中保存的坐标，Note类会正确处理坐标系转换
          // Note类的构造函数会将这些坐标视为画布坐标系中的位置
          const note = new Note(
            noteData.id,
            noteData.text,
            noteData.x,
            noteData.y,
            noteData.title,
            noteData.colorClass
          );

          // 如果有宽度和高度数据，应用它们
          // 数据库中保存的是画布坐标系中的实际尺寸，直接应用
          if (noteData.width) {
            note.element.style.width = `${noteData.width}px`;
          }
          if (noteData.height) {
            note.element.style.height = `${noteData.height}px`;
          }

          // 如果有zIndex数据，应用它
          if (noteData.zIndex) {
            note.element.style.zIndex = noteData.zIndex;
          }

          this.notes.push(note);
        });
      } else {
        console.error("加载便签失败:", data.message);
      }
    } catch (error) {
      console.error("加载便签时发生错误:", error);
    } finally {
      // 重置加载标志
      this._isLoadingNotes = false;
    }
  }

  // 在服务器上更新便签
  async updateNoteOnServer(id) {
    // 如果 id 无效或者便签已经被删除，直接返回
    if (!id || !this.notes.some((note) => note.id === id)) {
      // 清除已有的定时器
      if (this.updateDebounceTimers[id]) {
        clearTimeout(this.updateDebounceTimers[id]);
        delete this.updateDebounceTimers[id];
      }
      return;
    }

    const note = this.notes.find((n) => n.id === id);
    if (!note) return;

    const element = note.element;
    if (!element) return;

    // 清除之前的防抖延迟
    if (this.updateDebounceTimers[id]) {
      clearTimeout(this.updateDebounceTimers[id]);
    }

    // 设置新的防抖延迟
    this.updateDebounceTimers[id] = setTimeout(async () => {
      try {
        // 再次确认便签是否仍然存在（可能在延迟期间被删除）
        if (!this.notes.some((n) => n.id === id)) {
          console.log(`便签 ${id} 已被删除，取消更新操作`);
          delete this.updateDebounceTimers[id];
          return;
        }

        // 获取便签的当前位置和尺寸
        const rect = element.getBoundingClientRect();

        // 获取便签在画布坐标系中的位置
        const x = parseInt(element.style.left);
        const y = parseInt(element.style.top);

        // 获取画布缩放比例
        const canvasScale = window.canvasInstance
          ? window.canvasInstance.getScale()
          : 1.0;

        // 获取便签的尺寸，考虑画布缩放比例
        // 将屏幕上的尺寸除以缩放比例，得到画布坐标系中的实际尺寸
        const width = Math.round(rect.width / canvasScale);
        const height = Math.round(rect.height / canvasScale);

        // 获取z-index
        const zIndex = parseInt(
          element.style.zIndex || window.getComputedStyle(element).zIndex
        );

        // 发送更新请求到服务器
        // 使用画布坐标系中的位置，不需要进行缩放转换
        const response = await fetch(`/api/notes/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: note.text,
            title: note.title,
            x,
            y,
            width,
            height,
            colorClass: note.colorClass,
            zIndex, // 添加zIndex值到更新请求
          }),
        });

        const data = await response.json();

        // 处理可能的错误（如用户被删除）
        if (this.handleApiError(response, data)) {
          // 错误已处理，清除定时器
          delete this.updateDebounceTimers[id];
          return;
        }

        if (!data.success) {
          // 如果是404错误（便签不存在），可能是便签已被删除，我们应该从内存中移除它
          if (response.status === 404) {
            console.log(`服务器找不到便签 ${id}，可能已被删除`);
            // 确保从本地列表中也删除该便签
            this.notes = this.notes.filter((n) => n.id !== id);
          } else {
            console.error("更新便签失败:", data.message);
          }
        }
        // 无论成功与否，清除定时器
        delete this.updateDebounceTimers[id];
      } catch (error) {
        console.error("更新便签时发生错误:", error);
        // 发生错误时稍后再尝试更新，但首先检查便签是否还存在
        setTimeout(() => {
          // 只有当便签仍然存在时才重试
          if (
            this.notes.some((n) => n.id === id) &&
            this.updateDebounceTimers[id]
          ) {
            delete this.updateDebounceTimers[id]; // 删除当前定时器引用
            this.updateNoteOnServer(id); // 重试更新
          }
        }, 2000); // 2秒后重试
      }
    }, this.updateDebounceDelay);
  }

  // 从服务器删除便签
  async removeNote(id) {
    try {
      // 首先从前端列表中移除便签，确保用户即时获得反馈
      const originalNotes = [...this.notes];
      this.notes = this.notes.filter((note) => note.id !== id);

      const response = await fetch(`/api/notes/${id}`, {
        method: "DELETE",
      });

      // 检查响应状态
      if (response.status === 404) {
        // 便签不存在，但已从前端移除，这是正常的
        console.log(`便签 ${id} 在服务器上不存在，已从本地移除`);
        return;
      }

      // 尝试解析JSON响应
      let data;
      try {
        data = await response.json();
      } catch (error) {
        // 如果无法解析JSON (可能是空响应)，检查状态码
        if (response.ok) {
          console.log(`便签 ${id} 已删除 (无响应数据)`);
          return;
        } else {
          throw new Error(`删除便签失败，HTTP状态码: ${response.status}`);
        }
      }

      // 处理可能的错误（如用户被删除）
      if (this.handleApiError(response, data)) {
        return; // 错误已处理，直接返回
      }

      if (data.success) {
        console.log(`便签 ${id} 已成功删除`);
      } else {
        // 如果服务器返回错误，但不是404，恢复便签列表
        console.error("删除便签失败:", data.message || "未知错误");
        if (response.status !== 404) {
          this.notes = originalNotes; // 恢复原始便签列表
        }
      }
    } catch (error) {
      console.error("删除便签时出错:", error);
      // 删除出错时不要恢复列表，因为大多数情况下便签已经被删除了
    }
  }

  async generateAiNote() {
    const promptElement = document.getElementById("ai-prompt");
    const prompt = promptElement.value.trim();
    const generateButton = document.getElementById("ai-generate");

    if (!prompt) {
      // 使用更友好的提示方式
      promptElement.focus();
      promptElement.placeholder = "请输入内容后再生成便笺...";
      setTimeout(() => {
        promptElement.placeholder = "请输入文本";
      }, 2000);
      return;
    }

    // 清除已取消的便签列表，开始新的生成
    if (this.canceledNoteIds) {
      this.canceledNoteIds.clear();
    }

    // 更新连接状态为生成中
    if (this.updateConnectionStatus) {
      this.updateConnectionStatus("generating");
    }

    // 禁用按钮和输入框，添加生成中的动画样式
    generateButton.disabled = false; // 保持按钮可点击，用于取消生成
    generateButton.classList.add("generating"); // 添加生成中的动画类
    generateButton.title = "点击取消生成"; // 更新提示文本
    promptElement.disabled = true; // 禁用文本输入框

    // 首先创建一个空便签，准备接收流式内容
    const { noteElement } = createEmptyAiNote();

    try {
      // 在发送请求前先检查AI配置状态
      const configCheckResponse = await fetch("/api/test-ai-connection");
      const configCheckData = await configCheckResponse.json();

      if (!configCheckData.success) {
        // 如果AI服务未配置，显示友好的错误提示并引导用户设置
        this.showMessage(
          configCheckData.message || "AI服务连接失败或未配置",
          "warning"
        );
        // 打开设置面板并切换到AI设置选项卡
        document.getElementById("settings-modal").classList.add("visible");
        document.querySelector(".nav-item[data-tab='ai']").click();

        // 更新连接状态为错误
        if (this.updateConnectionStatus) {
          this.updateConnectionStatus("error");
        }

        // 移除临时便签，同时移除AI生成中的样式
        noteElement.classList.remove("ai-generating-note");
        noteElement.remove();
        throw new Error("AI配置需要完成");
      }

      // 设置便签标题
      const titleElem = noteElement.querySelector(".note-title");
      if (titleElem) {
        titleElem.textContent =
          prompt.substring(0, 20) + (prompt.length > 20 ? "... " : "");
      }

      // 获取临时便签的位置和颜色
      const x = parseInt(noteElement.style.left) || 100 + Math.random() * 200;
      const y = parseInt(noteElement.style.top) || 100 + Math.random() * 200;
      const colorClass = noteElement.classList[1]; // 获取当前颜色类

      console.log("发送AI流式生成请求，提示:", prompt);

      // 准备接收流式内容
      const contentElement = noteElement.querySelector(".note-content");
      const previewElement = noteElement.querySelector(".markdown-preview");

      // 确保预览区域就绪
      if (previewElement) {
        previewElement.style.display = "block";
        contentElement.style.display = "none"; // 隐藏文本区域
      }

      // 移除加载指示器
      const loader = noteElement.querySelector(".ai-typing-indicator");
      if (loader) loader.remove();

      // 使用新的连接管理和流式处理方法
      const fullText = await this.generateWithSSE(prompt, noteElement);

      // 保存生成的内容到服务器
      await this.saveStreamingNoteToServer(
        noteElement,
        fullText,
        x,
        y,
        prompt,
        colorClass
      );

      // 清空输入框
      promptElement.value = "";
      this.updateButtonVisibility();
    } catch (error) {
      console.error("生成AI便签出错:", error);
      // 确保在出错时也移除临时便签
      if (noteElement && noteElement.parentNode) {
        // 移除临时便签，同时移除AI生成中的样式
        noteElement.classList.remove("ai-generating-note");
        noteElement.remove();
      }

      // 更新连接状态为错误
      if (this.updateConnectionStatus) {
        this.updateConnectionStatus("error");
      }

      this.showMessage(`生成失败: ${error.message}`, "error");
    } finally {
      // 恢复按钮和输入框状态
      generateButton.disabled = false;
      generateButton.classList.remove("generating");
      promptElement.disabled = false;

      // 更新连接状态为已连接（如果连接有效）
      if (
        this.updateConnectionStatus &&
        this.sessionManager &&
        this.sessionManager.isConnected
      ) {
        this.updateConnectionStatus("connected");
      }
    }
  }

  // 将流式生成的便签保存到服务器
  async saveStreamingNoteToServer(noteElement, text, x, y, prompt, colorClass) {
    try {
      // AI标题
      const aiTitle =
        prompt.length > 15 ? prompt.substring(0, 15) + "..." : prompt;
      const finalTitle = `AI: ${aiTitle}`;

      // 获取画布缩放比例
      const canvasScale = window.canvasInstance
        ? window.canvasInstance.getScale()
        : 1.0;

      // 获取临时便签的当前位置和大小
      // 这些值可能在生成过程中被用户修改过
      // 使用画布坐标系中的位置，不需要进行缩放转换
      const currentX = parseInt(noteElement.style.left) || x;
      const currentY = parseInt(noteElement.style.top) || y;

      // 获取便签的尺寸，考虑画布缩放比例
      // 将屏幕上的尺寸除以缩放比例，得到画布坐标系中的实际尺寸
      let noteWidth = Math.round(noteElement.offsetWidth / canvasScale);
      let noteHeight = Math.round(noteElement.offsetHeight / canvasScale);

      console.log("保存便签，使用当前位置和大小:", {
        x: currentX,
        y: currentY,
        width: noteWidth,
        height: noteHeight,
      });

      // 创建便签到服务器
      const noteResponse = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text,
          x: currentX,
          y: currentY,
          width: noteWidth,
          height: noteHeight,
          title: finalTitle,
          colorClass: colorClass,
          zIndex: parseInt(noteElement.style.zIndex || getHighestZIndex() + 1),
        }),
      });

      const noteData = await noteResponse.json();

      // 处理可能的错误（如用户被删除）
      if (this.handleApiError(noteResponse, noteData)) {
        // 移除临时便签
        if (noteElement && noteElement.parentNode) {
          noteElement.remove();
        }
        return; // 错误已处理，直接返回
      }

      if (noteData.success && noteData.note) {
        console.log("AI便签已添加，ID:", noteData.note.id);

        // 先移除临时便签
        if (noteElement && noteElement.parentNode) {
          // 在移除前记录临时便签的位置和大小，以便新便签能够无缝衔接
          const tempNoteRect = {
            x: parseInt(noteElement.style.left) || x,
            y: parseInt(noteElement.style.top) || y,
            width: noteElement.offsetWidth,
            height: noteElement.offsetHeight,
          };

          // 移除临时便签
          noteElement.remove();

          // 使用临时便签的位置和大小
          x = tempNoteRect.x;
          y = tempNoteRect.y;
          noteWidth = tempNoteRect.width;
          noteHeight = tempNoteRect.height;
        }

        // 创建正式的Note实例替代临时便签
        const note = new Note(
          noteData.note.id,
          noteData.note.text,
          noteData.note.x || x,
          noteData.note.y || y,
          noteData.note.title || finalTitle,
          noteData.note.colorClass
        );

        // 设置便签的宽度和高度
        if (note.element) {
          if (noteData.note.width) {
            note.element.style.width = `${noteData.note.width}px`;
          }
          if (noteData.note.height) {
            note.element.style.height = `${noteData.note.height}px`;
          }
        }

        // 确保新创建的便签在最上层
        if (note.element) {
          note.element.style.zIndex =
            noteData.note.zIndex || getHighestZIndex() + 1;
        }

        // 添加到notes数组
        this.notes.push(note);

        // 添加苹果风格的AI高亮效果，并确保平滑过渡
        note.element.classList.add("new-note-highlight");
        // 延迟移除高亮效果
        setTimeout(() => {
          note.element.classList.remove("new-note-highlight");
        }, 2000);

        // 清空输入框
        document.getElementById("ai-prompt").value = "";
        this.updateButtonVisibility();
      } else {
        // 如果创建失败，也需要移除临时便签
        if (noteElement && noteElement.parentNode) {
          // 移除临时便签，同时移除AI生成中的样式
          noteElement.classList.remove("ai-generating-note");
          noteElement.remove();
        }
        console.error("创建AI便签失败:", noteData);
        throw new Error(noteData.message || "无法创建AI便签");
      }
    } catch (error) {
      // 确保在出错时也移除临时便签
      if (noteElement && noteElement.parentNode) {
        // 移除临时便签，同时移除AI生成中的样式
        noteElement.classList.remove("ai-generating-note");
        noteElement.remove();
      }
      console.error("保存AI便签到服务器出错:", error);
      this.showMessage(`保存失败: ${error.message}`, "error");
    }
  }

  // 添加打字机效果方法 (恢复)
  async displayTypingEffect(noteElement, fullText) {
    return new Promise((resolve) => {
      let currentContent = "";
      let charIndex = 0;

      // 设置内容区域为Markdown
      const contentElement = noteElement.querySelector(".note-content");
      const previewElement = noteElement.querySelector(".markdown-preview");
      // Ensure markdown class is present if needed, or handle based on content type
      contentElement.classList.add("markdown"); // Assuming AI content is markdown

      // 确保预览区域就绪
      if (previewElement) {
        previewElement.style.display = "block";
        contentElement.style.display = "none"; // Hide textarea during typing
      }

      // 移除加载指示器
      const loader = noteElement.querySelector(".ai-typing-indicator");
      if (loader) loader.remove();

      // 模拟打字效果
      const typingInterval = setInterval(() => {
        if (charIndex < fullText.length) {
          currentContent += fullText.charAt(charIndex);
          // 注意：updateNoteContent 需要在 note.js 中恢复
          updateNoteContent(noteElement, currentContent);
          charIndex++;
        } else {
          clearInterval(typingInterval);
          resolve(); // 打字效果完成
        }
      }, 25); // 每个字符之间的延迟，可以调整
    });
  }

  // 初始化设置弹窗
  async initSettingsModal() {
    // 不需要获取设置按钮，因为我们在canvas.js中处理了
    const settingsModal = document.getElementById("settings-modal");
    const closeSettings = document.getElementById("close-settings");
    const saveButton = document.querySelector("#ai-panel .save-button"); // 更新选择器
    const resetButton = document.querySelector("#backup-panel .reset-button"); // 更新选择器
    const navItems = document.querySelectorAll(".nav-item");
    const colorOptions = document.querySelectorAll(".color-option");
    const themeOptions = document.querySelectorAll(".theme-option");
    const rangeInputs = document.querySelectorAll('input[type="range"]');

    // 导入设置面板模块
    const { initSettingsPanel } = await import("../settings/SettingsPanel.js");
    initSettingsPanel();

    // 如果需要，可以在这里直接添加自定义模型选择器的初始化代码
    this.setupModelSelector();

    // 关闭设置弹窗
    closeSettings.addEventListener("click", () => {
      settingsModal.classList.remove("visible");
    });

    // 点击弹窗外部区域关闭
    settingsModal.addEventListener("click", (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.remove("visible");
      }
    });

    // ESC键关闭设置弹窗
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && settingsModal.classList.contains("visible")) {
        settingsModal.classList.remove("visible");
      }
    });

    // 导航切换
    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        // 移除所有导航项的active类
        navItems.forEach((nav) => nav.classList.remove("active"));

        // 添加当前导航项的active类
        item.classList.add("active");

        // 隐藏所有面板
        document.querySelectorAll(".settings-panel").forEach((panel) => {
          panel.classList.remove("active");
        });

        // 显示当前面板
        const tabId = item.getAttribute("data-tab");
        document.getElementById(`${tabId}-panel`).classList.add("active");
      });
    });

    // 颜色选项切换
    colorOptions.forEach((option) => {
      option.addEventListener("click", () => {
        colorOptions.forEach((opt) => opt.classList.remove("active"));
        option.classList.add("active");
      });
    });

    // 主题选项切换
    themeOptions.forEach((option) => {
      option.addEventListener("click", () => {
        themeOptions.forEach((opt) => opt.classList.remove("active"));
        option.classList.add("active");
      });
    });

    // 苹果风格的范围滑块值显示增强
    const temperatureSlider = document.getElementById("ai-temperature");
    const temperatureValue = document.getElementById("temperature-value");

    if (temperatureSlider && temperatureValue) {
      // 初始化显示值
      temperatureValue.textContent = temperatureSlider.value;

      // 滑动时实时更新值
      temperatureSlider.addEventListener("input", () => {
        temperatureValue.textContent = temperatureSlider.value;

        // 添加值变化的视觉反馈
        temperatureValue.classList.add("updating");
        setTimeout(() => {
          temperatureValue.classList.remove("updating");
        }, 200);
      });
    }

    // 范围滑块值显示更新
    rangeInputs.forEach((input) => {
      const valueDisplay = input.nextElementSibling;
      if (!valueDisplay) return;

      // 初始化显示值
      if (input.id === "font-size") {
        valueDisplay.textContent = `${input.value}px`;
      } else if (input.id !== "ai-temperature") {
        // 温度滑块已单独处理
        valueDisplay.textContent = input.value;
      }

      // 滑动时更新值
      input.addEventListener("input", () => {
        if (input.id === "font-size") {
          valueDisplay.textContent = `${input.value}px`;
        } else if (input.id !== "ai-temperature") {
          // 温度滑块已单独处理
          valueDisplay.textContent = input.value;
        }
      });
    });

    // 导入数据
    const importFile = document.getElementById("import-file");
    importFile.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        // 导入便签数据功能
        this.importNotesData(e.target.files[0]);
        // 清空文件输入，以便同一文件可以再次选择导入
        importFile.value = "";
      }
    });

    // 加载AI设置
    this.loadAISettings();

    // 测试AI连接按钮
    const testConnectionButton = document.getElementById("test-ai-connection");
    if (testConnectionButton) {
      testConnectionButton.addEventListener("click", () => {
        this.testAIConnection();
      });
    }

    // 保存设置
    saveButton.addEventListener("click", () => {
      // 保存AI设置
      this.saveAISettings()
        .then((success) => {
          if (success) {
            // 不再自动关闭弹窗，只显示成功消息
            // settingsModal.classList.remove("visible");  // 移除这行代码
            this.showMessage("设置已保存", "success");
          }
        })
        .catch((error) => {
          console.error("保存设置失败:", error);
          this.showMessage(`保存失败: ${error.message}`, "error");
        });
    });

    // 设置API密钥可见性切换 - 增强苹果风格的交互
    const toggleApiKeyBtn = document.getElementById("toggle-api-key");
    const apiKeyInput = document.getElementById("ai-api-key");

    if (toggleApiKeyBtn && apiKeyInput) {
      apiKeyInput.type = "password"; // 默认隐藏
      toggleApiKeyBtn.setAttribute("data-state", "hidden");

      toggleApiKeyBtn.addEventListener("click", () => {
        if (apiKeyInput.type === "password") {
          apiKeyInput.type = "text"; // 显示密钥
          toggleApiKeyBtn.setAttribute("data-state", "visible");
          toggleApiKeyBtn.title = "隐藏密钥";
        } else {
          apiKeyInput.type = "password"; // 隐藏密钥
          toggleApiKeyBtn.setAttribute("data-state", "hidden");
          toggleApiKeyBtn.title = "显示密钥";
        }
      });
    }

    // 修改密码功能
    const changePasswordButton = document.getElementById(
      "change-password-button"
    );
    if (changePasswordButton) {
      changePasswordButton.addEventListener("click", () => {
        this.changePassword();
      });
    }

    // 当用户管理标签被点击时，检查邀请码API是否可用
    const usersTab = document.querySelector('.nav-item[data-tab="users"]');
    if (usersTab) {
      usersTab.addEventListener("click", () => {
        if (this.inviteApiAvailable) {
          this.loadInviteCodes();
        }
      });
    }

    // 激活默认标签 (修改为AI设置)
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active");
    });
    document.querySelectorAll(".settings-panel").forEach((panel) => {
      panel.classList.remove("active");
    });
    document.querySelector('.nav-item[data-tab="ai"]').classList.add("active");
    document.getElementById("ai-panel").classList.add("active");

    // 在初始化完成后，检查并同步已连接便签状态
    // 这是解决初次启动服务时连接便签未响应的关键
    setTimeout(() => {
      if (window.nodeConnectionManager) {
        try {
          // 强制刷新一次连接状态
          window.nodeConnectionManager.forceUpdateAllConnections();

          // 获取连接便签并更新UI
          const connectedNotes =
            window.nodeConnectionManager.getConnectedNotes();

          if (connectedNotes && connectedNotes.length > 0) {
            console.log(
              `设置初始化：检测到 ${connectedNotes.length} 个已连接便签`
            );
            // 更新UI状态
            this.updatePromptPlaceholder();
            this.updateButtonVisibility();

            // 注册一个额外的延迟检查，确保连接稳定
            setTimeout(() => {
              // 再次强制刷新连接状态
              window.nodeConnectionManager.forceUpdateAllConnections();

              // 再次获取连接便签并确认UI状态
              const reconfirmedNotes =
                window.nodeConnectionManager.getConnectedNotes();
              if (reconfirmedNotes && reconfirmedNotes.length > 0) {
                console.log(
                  `二次确认：检测到 ${reconfirmedNotes.length} 个已连接便签`
                );
                this.updatePromptPlaceholder();
                this.updateButtonVisibility();
              }
            }, 1000);
          }
        } catch (e) {
          console.error("连接状态检查出错:", e);
        }
      }
    }, 500);
  }

  // 修改密码
  async changePassword() {
    try {
      // 获取输入值
      const currentPassword = document.getElementById("current-password").value;
      const newPassword = document.getElementById("new-password").value;
      const confirmPassword = document.getElementById("confirm-password").value;

      // 基本验证
      if (!currentPassword) {
        this.showMessage("请输入当前密码", "error");
        return;
      }

      if (!newPassword) {
        this.showMessage("请输入新密码", "error");
        return;
      }

      if (newPassword.length < 6) {
        this.showMessage("新密码长度不能少于6个字符", "error");
        return;
      }

      if (newPassword !== confirmPassword) {
        this.showMessage("两次输入的新密码不一致", "error");
        return;
      }

      // 显示加载状态
      const changePasswordButton = document.getElementById(
        "change-password-button"
      );
      const originalText = changePasswordButton.textContent;
      changePasswordButton.textContent = "更新中...";
      changePasswordButton.disabled = true;

      // 发送请求到服务器
      const response = await fetch("/api/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      // 恢复按钮状态
      changePasswordButton.textContent = originalText;
      changePasswordButton.disabled = false;

      if (data.success) {
        // 密码修改成功
        this.showMessage("密码已成功更新", "success");

        // 清空输入框
        document.getElementById("current-password").value = "";
        document.getElementById("new-password").value = "";
        document.getElementById("confirm-password").value = "";
      } else {
        // 密码修改失败
        this.showMessage(data.message || "密码更新失败", "error");
      }
    } catch (error) {
      console.error("修改密码出错:", error);
      this.showMessage("修改密码时发生错误", "error");

      // 确保按钮状态恢复
      const changePasswordButton = document.getElementById(
        "change-password-button"
      );
      if (changePasswordButton) {
        changePasswordButton.textContent = "更新密码";
        changePasswordButton.disabled = false;
      }
    }
  }

  // 清除AI设置
  async clearAISettings() {
    try {
      // 清除设置
      const settingsResponse = await fetch("/api/settings/ai/clear", {
        method: "POST",
      });

      const settingsData = await settingsResponse.json();

      if (!settingsData.success) {
        throw new Error(settingsData.message || "清除设置失败");
      }

      // 清除历史记录
      const historyResponse = await fetch("/api/api-history/all", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // 确保包含认证Cookie
      });

      const historyData = await historyResponse.json();

      if (!historyData.success) {
        console.warn("清除历史记录失败:", historyData.message);
        // 即使历史记录清除失败，也不影响设置清除的成功
      }

      console.log("AI设置和历史记录已清除");

      // 更新底部栏的AI模型显示
      const aiModelDisplay = document.querySelector(".ai-model");
      if (aiModelDisplay) {
        aiModelDisplay.textContent = "未设置";
      }

      // 更新AI设置界面的输入框
      document.getElementById("ai-api-key").value = "";
      document.getElementById("ai-base-url").value = "";
      document.getElementById("ai-model").value = "";
      document.getElementById("ai-max-tokens").value = "800";
      document.getElementById("ai-temperature").value = "0.7";

      // 更新温度显示
      const tempValueElement = document.getElementById("temperature-value");
      if (tempValueElement) {
        tempValueElement.textContent = "0.7";
      }

      return true;
    } catch (error) {
      console.error("清除AI设置出错:", error);
      this.showMessage(`清除失败: ${error.message}`, "error");
      return false;
    }
  }

  // 加载AI设置
  async loadAISettings() {
    try {
      const response = await fetch("/api/ai-settings");
      const data = await response.json();

      if (data.success && data.settings) {
        // 在表单中填充API设置
        document.getElementById("ai-api-key").value =
          data.settings.apiKey || "";
        document.getElementById("ai-base-url").value =
          data.settings.baseURL || "";
        document.getElementById("ai-model").value = data.settings.model || "";
        document.getElementById("ai-max-tokens").value =
          data.settings.maxTokens || "800";
        document.getElementById("ai-temperature").value =
          data.settings.temperature || "0.7";

        // 更新温度值显示
        const tempValueElement = document.getElementById("temperature-value");
        if (tempValueElement) {
          tempValueElement.textContent = data.settings.temperature || "0.7";
        }

        // 更新底部栏的AI模型显示
        const aiModelDisplay = document.querySelector(".ai-model");
        if (aiModelDisplay && data.settings.model) {
          aiModelDisplay.textContent = data.settings.model;
        } else if (aiModelDisplay) {
          aiModelDisplay.textContent = "未设置";
        }

        console.log("AI设置已加载:", {
          apiKey: data.settings.apiKey ? "已设置" : "未设置",
          baseURL: data.settings.baseURL,
          model: data.settings.model,
          maxTokens: data.settings.maxTokens,
          temperature: data.settings.temperature,
        });
      } else {
        console.error("加载AI设置失败:", data.message);
      }
    } catch (error) {
      console.error("加载AI设置时出错:", error);
    }
  }

  // 保存AI设置
  async saveAISettings() {
    try {
      const apiKey = document.getElementById("ai-api-key").value.trim();
      const baseURL = document.getElementById("ai-base-url").value.trim();
      const model = document.getElementById("ai-model").value.trim();
      const maxTokens = document.getElementById("ai-max-tokens").value.trim();
      const temperature = document
        .getElementById("ai-temperature")
        .value.trim();

      // 基本验证
      if (!baseURL) {
        this.showMessage("请输入基础URL", "error");
        return false;
      }
      if (!model) {
        this.showMessage("请输入AI模型名称", "error");
        return false;
      }

      // 发送设置到服务器
      const response = await fetch("/api/settings/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey,
          baseURL,
          model,
          maxTokens,
          temperature,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log("AI设置已保存");
        // 更新底部栏的AI模型显示
        const aiModelDisplay = document.querySelector(".ai-model");
        if (aiModelDisplay && model) {
          aiModelDisplay.textContent = model;
        } else if (aiModelDisplay) {
          aiModelDisplay.textContent = "未设置";
        }
        return true;
      } else {
        throw new Error(data.message || "保存设置失败");
      }
    } catch (error) {
      console.error("保存AI设置出错:", error);
      this.showMessage(`保存失败: ${error.message}`, "error");
      return false;
    }
  }

  // 测试AI连接
  async testAIConnection() {
    const testButton = document.getElementById("test-ai-connection");
    const originalText = testButton.textContent;

    // 如果按钮已经禁用，说明正在测试中，不重复执行
    if (testButton.disabled) {
      console.log("测试已在进行中，忽略重复点击");
      return;
    }

    // 更改按钮状态以指示测试正在进行
    testButton.textContent = "正在测试...";
    testButton.disabled = true;

    // 获取API设置以用于日志
    const apiKey = document.getElementById("ai-api-key").value.trim();
    const baseURL = document.getElementById("ai-base-url").value.trim();
    const model = document.getElementById("ai-model").value.trim();
    const hasApiKey = !!apiKey;
    const hasBaseURL = !!baseURL;
    const hasModel = !!model;

    console.log(
      `测试连接参数检查: apiKey=${hasApiKey ? "已设置" : "未设置"}, baseURL=${
        hasBaseURL ? baseURL : "未设置"
      }, model=${hasModel ? model : "未设置"}`
    );

    // 添加一个超时保护，确保按钮状态一定会恢复（增加到15秒）
    const timeoutId = setTimeout(() => {
      if (testButton.disabled) {
        testButton.textContent = originalText;
        testButton.disabled = false;
        this.showMessage("连接测试超时，请检查网络或API地址", "error");
        console.error("AI连接测试超时");
      }
    }, 15000); // 15秒超时，增加超时时间

    // 使用AbortController来控制请求
    const controller = new AbortController();
    const abortTimeout = setTimeout(() => {
      controller.abort();
      console.log("测试请求超时，已中断");
    }, 12000); // 12秒后中断请求

    try {
      // 发送测试请求到服务器
      const response = await fetch("/api/test-ai-connection", {
        signal: controller.signal,
        // 添加缓存控制头，防止缓存影响测试结果
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      // 请求完成，清除超时保护
      clearTimeout(timeoutId);
      clearTimeout(abortTimeout);

      // 解析响应
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        // 如果JSON解析失败，确保恢复按钮状态
        testButton.textContent = originalText;
        testButton.disabled = false;
        console.error("解析API测试响应出错:", jsonError);
        this.showMessage("服务器返回了无效的响应格式", "error");
        return;
      }

      // 始终恢复按钮状态，无论成功与否
      testButton.textContent = originalText;
      testButton.disabled = false;

      if (data.success) {
        // 测试成功
        this.showMessage(`连接测试成功！使用模型: ${data.model}`, "success");
        // 更新设置表单中的模型值，以防服务器返回规范化的模型名称
        if (
          data.model &&
          data.model !== model &&
          document.getElementById("ai-model")
        ) {
          document.getElementById("ai-model").value = data.model;
        }
      } else {
        // 测试失败，显示详细错误信息
        let errorMsg = data.message || "连接测试失败";
        // 如果有详细的缺失配置信息，显示更具体的消息
        if (data.details) {
          const missing = [];
          if (data.details.apiKey) missing.push("API密钥");
          if (data.details.baseURL) missing.push("API基础URL");
          if (data.details.model) missing.push("AI模型名称");

          if (missing.length > 0) {
            errorMsg += `，缺少: ${missing.join(", ")}`;
          }
        }
        this.showMessage(errorMsg, "error");
      }
    } catch (error) {
      // 请求出错，清除超时保护
      clearTimeout(timeoutId);
      clearTimeout(abortTimeout);

      // 恢复按钮状态
      testButton.textContent = originalText;
      testButton.disabled = false;

      console.error("测试AI连接时发生错误:", error);
      // 针对网络错误提供更明确的提示
      const errorMessage =
        error.name === "AbortError"
          ? "连接测试超时，请检查API地址是否正确或网络是否稳定"
          : `连接测试出错: ${error.message}`;

      this.showMessage(errorMessage, "error");
    }
  }

  // 显示消息提示
  showMessage(message, type = "info") {
    // 移除特定设置面板内的条件判断，统一使用顶部中央通知
    let messageContainer = document.querySelector(".message-top-center");

    // 如果不存在，创建一个
    if (!messageContainer) {
      messageContainer = document.createElement("div");
      messageContainer.className = "message-top-center";
      document.body.appendChild(messageContainer);
    }

    // 设置消息内容和类型
    messageContainer.textContent = message;
    messageContainer.className = `message-top-center message-${type}`;

    // 确保元素在DOM中
    if (!messageContainer.parentNode) {
      document.body.appendChild(messageContainer);
    }

    // 重置状态，确保先隐藏
    messageContainer.classList.remove("show");

    // 使用RAF确保DOM更新后再添加show类
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        messageContainer.classList.add("show");

        // 自动隐藏
        setTimeout(() => {
          messageContainer.classList.remove("show");

          // 移除元素，保持DOM干净
          setTimeout(() => {
            if (messageContainer.parentNode) {
              messageContainer.parentNode.removeChild(messageContainer);
            }
          }, 400); // 等待过渡完成
        }, 3000);
      });
    });
  }

  // 导出便签数据
  async exportNotesAsJson() {
    // ...省略方法实现，保持与原方法相同
  }

  // 导出数据库文件
  exportDatabaseFile() {
    // ...省略方法实现，保持与原方法相同
  }

  // 导入便签数据
  async importNotesFromJson(file) {
    // ...省略方法实现，保持与原方法相同
  }

  // 重置所有数据
  async resetAllData() {
    // ...省略方法实现，保持与原方法相同
  }

  // 设置模型选择器
  setupModelSelector() {
    // 获取相关DOM元素
    const modelInput = document.getElementById("ai-model");
    const modelDropdown = document.getElementById("model-dropdown");
    const selectOptions = document.querySelectorAll(
      "#model-dropdown .select-option"
    );

    // 添加模型历史记录下拉菜单元素
    // 检查是否已存在，如果不存在则创建
    let modelHistoryDropdown = document.getElementById(
      "model-history-dropdown"
    );
    if (!modelHistoryDropdown) {
      modelHistoryDropdown = document.createElement("div");
      modelHistoryDropdown.id = "model-history-dropdown";
      modelHistoryDropdown.className = "history-dropdown";

      // 创建内容容器
      const content = document.createElement("div");
      content.className = "history-dropdown-content";
      content.innerHTML = '<div class="history-item-loading">加载中...</div>';

      // 将内容容器添加到下拉菜单
      modelHistoryDropdown.appendChild(content);

      // 将下拉菜单添加到容器中
      const historyContainer = modelInput.closest(".history-input-container");
      if (historyContainer) {
        historyContainer.appendChild(modelHistoryDropdown);
      }
    }

    if (!modelInput || !modelDropdown) {
      console.warn("模型选择器初始化失败：缺少必要的DOM元素");
      return;
    }

    // 添加双击事件打开模型选择下拉菜单
    modelInput.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 关闭历史记录下拉菜单
      if (modelHistoryDropdown) {
        modelHistoryDropdown.classList.remove("active");
      }

      // 切换模型下拉菜单
      modelDropdown.classList.toggle("active");
    });

    // 处理选项点击事件
    selectOptions.forEach((option) => {
      option.addEventListener("click", () => {
        const selectedValue = option.getAttribute("data-value");
        console.log("选中模型:", selectedValue);

        // 更新输入框的值
        modelInput.value = selectedValue;

        // 关闭下拉菜单
        modelDropdown.classList.remove("active");

        // 触发输入事件以便其他监听可以响应
        modelInput.dispatchEvent(new Event("input", { bubbles: true }));

        // 添加或更新模型历史记录
        this.addOrUpdateModelHistory(selectedValue);
      });
    });

    // 点击页面其他区域时关闭下拉菜单
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".history-input-container")) {
        modelDropdown.classList.remove("active");
      }
    });

    // 允许用户手动输入模型名称
    modelInput.addEventListener("focus", () => {
      modelInput.setAttribute("placeholder", "");

      // 关闭模型选择下拉菜单
      modelDropdown.classList.remove("active");

      // 显示历史记录下拉菜单
      if (modelHistoryDropdown) {
        modelHistoryDropdown.classList.add("active");
        this.loadModelHistory(modelHistoryDropdown);
      }
    });

    modelInput.addEventListener("blur", () => {
      if (!modelInput.value) {
        modelInput.setAttribute(
          "placeholder",
          "例如: gpt-3.5-turbo, gpt-4-turbo"
        );
      }
    });

    // 在输入框值变化时触发添加历史记录
    modelInput.addEventListener("change", () => {
      if (modelInput.value.trim()) {
        this.addOrUpdateModelHistory(modelInput.value.trim());
      }
    });

    // 初始化历史记录功能
    this.initApiHistoryFeatures();
  }

  // 添加或更新模型历史记录
  async addOrUpdateModelHistory(modelName) {
    if (!modelName) return;

    try {
      // 发送请求到服务器添加或更新模型历史记录
      const response = await fetch("/api/api-history/model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // 确保包含认证Cookie
        body: JSON.stringify({ modelName }),
      });

      const data = await response.json();
      if (!data.success) {
        console.warn("更新模型历史记录失败:", data.message);
      }
    } catch (error) {
      console.error("添加模型历史记录出错:", error);
    }
  }

  // API 配置历史记录功能初始化
  async initApiHistoryFeatures() {
    // 获取下拉菜单
    const apiKeyHistoryDropdown = document.getElementById(
      "api-key-history-dropdown"
    );
    const baseUrlHistoryDropdown = document.getElementById(
      "base-url-history-dropdown"
    );
    const modelHistoryDropdown = document.getElementById(
      "model-history-dropdown"
    );

    // 获取相关输入框
    const apiKeyInput = document.getElementById("ai-api-key");
    const baseUrlInput = document.getElementById("ai-base-url");
    const modelInput = document.getElementById("ai-model");

    // 添加输入框焦点事件，当输入框获得焦点时显示对应的历史记录
    if (apiKeyInput && apiKeyHistoryDropdown) {
      apiKeyInput.addEventListener("focus", () => {
        // 关闭其他所有下拉菜单
        baseUrlHistoryDropdown?.classList.remove("active");
        modelHistoryDropdown?.classList.remove("active");
        document.getElementById("model-dropdown")?.classList.remove("active");

        // 显示当前下拉菜单
        apiKeyHistoryDropdown.classList.add("active");

        // 加载历史记录
        this.loadApiKeyHistory(apiKeyHistoryDropdown);
      });
    }

    if (baseUrlInput && baseUrlHistoryDropdown) {
      baseUrlInput.addEventListener("focus", () => {
        // 关闭其他所有下拉菜单
        apiKeyHistoryDropdown?.classList.remove("active");
        modelHistoryDropdown?.classList.remove("active");
        document.getElementById("model-dropdown")?.classList.remove("active");

        // 显示当前下拉菜单
        baseUrlHistoryDropdown.classList.add("active");

        // 加载历史记录
        this.loadBaseUrlHistory(baseUrlHistoryDropdown);
      });

      // 添加 URL 变化事件，当 URL 变化时自动更新其他历史记录
      baseUrlInput.addEventListener("change", async () => {
        const newBaseUrl = baseUrlInput.value.trim();
        // 先清空 API 密钥和模型输入框
        apiKeyInput.value = "";
        modelInput.value = "";

        // 如果URL不为空，尝试获取匹配的API密钥和模型
        if (newBaseUrl) {
          try {
            // 获取与此URL匹配的API密钥
            const keyResponse = await fetch(
              `/api/api-history/key?baseUrl=${encodeURIComponent(newBaseUrl)}`
            );
            const keyData = await keyResponse.json();

            // 获取与此URL匹配的模型
            const modelResponse = await fetch(
              `/api/api-history/model?baseUrl=${encodeURIComponent(newBaseUrl)}`
            );
            const modelData = await modelResponse.json();

            // 如果找到匹配的API密钥，填充第一个
            if (
              keyData.success &&
              keyData.history &&
              keyData.history.length > 0
            ) {
              apiKeyInput.value = keyData.history[0].apiKey;
            }

            // 如果找到匹配的模型，填充第一个
            if (
              modelData.success &&
              modelData.history &&
              modelData.history.length > 0
            ) {
              modelInput.value = modelData.history[0].modelName;
            }
          } catch (error) {
            console.error("获取匹配的API密钥和模型失败:", error);
          }
        }
      });
    }

    if (modelInput && modelHistoryDropdown) {
      modelInput.addEventListener("focus", () => {
        // 关闭其他所有下拉菜单
        apiKeyHistoryDropdown?.classList.remove("active");
        baseUrlHistoryDropdown?.classList.remove("active");
        document.getElementById("model-dropdown")?.classList.remove("active");

        // 显示当前下拉菜单
        modelHistoryDropdown.classList.add("active");

        // 加载历史记录
        this.loadModelHistory(modelHistoryDropdown);
      });
    }

    // 点击页面其他区域关闭所有历史记录下拉菜单
    document.addEventListener("click", (e) => {
      if (
        !e.target.closest(".history-input-container") &&
        !e.target.classList.contains("history-item-delete")
      ) {
        apiKeyHistoryDropdown?.classList.remove("active");
        baseUrlHistoryDropdown?.classList.remove("active");
        modelHistoryDropdown?.classList.remove("active");
      }
    });
  }

  // 加载 API 密钥历史记录
  async loadApiKeyHistory(dropdownElement) {
    try {
      // 获取当前选中的基础URL
      const baseUrl = document.getElementById("ai-base-url").value.trim();

      // 构建查询参数
      const queryParams = baseUrl
        ? `?baseUrl=${encodeURIComponent(baseUrl)}`
        : "";

      const response = await fetch(`/api/api-history/key${queryParams}`);
      const data = await response.json();

      if (data.success) {
        this.renderHistoryItems(
          dropdownElement,
          data.history,
          "apiKey",
          (value) => {
            // 密钥显示处理 - 显示部分隐藏的密钥
            return value.length > 8
              ? `${value.substring(0, 4)}...${value.substring(
                  value.length - 4
                )}`
              : value;
          },
          document.getElementById("ai-api-key")
        );
      } else {
        this.renderHistoryError(dropdownElement, "无法加载历史记录");
      }
    } catch (error) {
      console.error("加载API密钥历史记录失败:", error);
      this.renderHistoryError(dropdownElement, "加载失败");
    }
  }

  // 加载基础 URL 历史记录
  async loadBaseUrlHistory(dropdownElement) {
    try {
      const response = await fetch("/api/api-history/url");
      const data = await response.json();

      if (data.success) {
        this.renderHistoryItems(
          dropdownElement,
          data.history,
          "baseUrl",
          null,
          document.getElementById("ai-base-url")
        );
      } else {
        this.renderHistoryError(dropdownElement, "无法加载历史记录");
      }
    } catch (error) {
      console.error("加载基础URL历史记录失败:", error);
      this.renderHistoryError(dropdownElement, "加载失败");
    }
  }

  // 加载模型历史记录
  async loadModelHistory(dropdownElement) {
    try {
      // 获取当前选中的基础URL
      const baseUrl = document.getElementById("ai-base-url").value.trim();

      // 构建查询参数
      const queryParams = baseUrl
        ? `?baseUrl=${encodeURIComponent(baseUrl)}`
        : "";

      const response = await fetch(`/api/api-history/model${queryParams}`);
      const data = await response.json();

      if (data.success) {
        this.renderHistoryItems(
          dropdownElement,
          data.history,
          "modelName",
          null,
          document.getElementById("ai-model")
        );
      } else {
        this.renderHistoryError(dropdownElement, "无法加载历史记录");
      }
    } catch (error) {
      console.error("加载模型历史记录失败:", error);
      this.renderHistoryError(dropdownElement, "加载失败");
    }
  }

  // 渲染历史记录项目
  renderHistoryItems(
    dropdownElement,
    historyItems,
    valueKey,
    valueFormatter,
    inputElement
  ) {
    const contentElement = dropdownElement.querySelector(
      ".history-dropdown-content"
    );
    contentElement.innerHTML = "";

    // 获取当前选中的基础URL
    const baseUrl = document.getElementById("ai-base-url").value.trim();

    // 添加提示信息，说明当前筛选状态
    if (baseUrl && (valueKey === "apiKey" || valueKey === "modelName")) {
      contentElement.innerHTML = `<div class="history-filter-info">当前显示与 URL "${baseUrl}" 匹配的记录</div>`;
    }

    if (!historyItems || historyItems.length === 0) {
      if (baseUrl && (valueKey === "apiKey" || valueKey === "modelName")) {
        contentElement.innerHTML +=
          '<div class="history-empty">没有找到与当前 URL 匹配的记录</div>';
      } else {
        contentElement.innerHTML +=
          '<div class="history-empty">暂无历史记录</div>';
      }
      return;
    }

    historyItems.forEach((item) => {
      const historyItem = document.createElement("div");
      historyItem.className = "history-item";

      // 格式化使用时间，添加时分秒
      const lastUsedDate = new Date(item.lastUsed);
      const formattedDate = lastUsedDate.toLocaleString(); // 使用toLocaleString包含日期和时间

      // 格式化显示的值 (对API密钥进行部分隐藏处理)
      const displayValue = valueFormatter
        ? valueFormatter(item[valueKey])
        : item[valueKey];

      historyItem.innerHTML = `
        <div class="history-item-value" title="${item[valueKey]}">${displayValue}</div>
        <div class="history-item-info">
          使用次数: ${item.useCount} | 最后使用: ${formattedDate}
        </div>
        <div class="history-item-actions">
          <button class="history-item-delete" title="删除此记录">×</button>
        </div>
      `;

      // 添加点击事件，选择此历史记录
      historyItem.addEventListener("click", async (e) => {
        if (!e.target.classList.contains("history-item-delete")) {
          if (inputElement) {
            inputElement.value = item[valueKey];
            if (inputElement.type === "password") {
              // 如果是密码输入框，触发show-password效果提示用户看到了变化
              inputElement.type = "text";
              setTimeout(() => {
                inputElement.type = "password";
              }, 500);
            }

            // 如果是选择了URL，尝试自动填充匹配的API密钥和模型
            if (valueKey === "baseUrl") {
              const selectedBaseUrl = item[valueKey];
              // 清空现有的API密钥和模型
              const apiKeyInput = document.getElementById("ai-api-key");
              const modelInput = document.getElementById("ai-model");
              if (apiKeyInput) apiKeyInput.value = "";
              if (modelInput) modelInput.value = "";

              try {
                // 获取与此URL匹配的API密钥
                const keyResponse = await fetch(
                  `/api/api-history/key?baseUrl=${encodeURIComponent(
                    selectedBaseUrl
                  )}`
                );
                const keyData = await keyResponse.json();

                // 获取与此URL匹配的模型
                const modelResponse = await fetch(
                  `/api/api-history/model?baseUrl=${encodeURIComponent(
                    selectedBaseUrl
                  )}`
                );
                const modelData = await modelResponse.json();

                // 如果找到匹配的API密钥，填充第一个
                if (
                  keyData.success &&
                  keyData.history &&
                  keyData.history.length > 0
                ) {
                  apiKeyInput.value = keyData.history[0].apiKey;
                }

                // 如果找到匹配的模型，填充第一个
                if (
                  modelData.success &&
                  modelData.history &&
                  modelData.history.length > 0
                ) {
                  modelInput.value = modelData.history[0].modelName;
                }
              } catch (error) {
                console.error("获取匹配的API密钥和模型失败:", error);
              }
            }

            inputElement.dispatchEvent(new Event("input"));
            // 对于URL变更，还需要触发change事件
            if (valueKey === "baseUrl") {
              inputElement.dispatchEvent(new Event("change"));
            }
          }
          dropdownElement.classList.remove("active");
        }
      });

      // 添加删除按钮点击事件
      const deleteButton = historyItem.querySelector(".history-item-delete");
      deleteButton.addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteHistoryItem(item.id, valueKey, dropdownElement);
      });

      contentElement.appendChild(historyItem);
    });
  }

  // 渲染历史记录错误
  renderHistoryError(dropdownElement, errorMessage) {
    const contentElement = dropdownElement.querySelector(
      ".history-dropdown-content"
    );
    contentElement.innerHTML = `<div class="history-empty">${errorMessage}</div>`;
  }

  // 删除历史记录项目
  async deleteHistoryItem(id, type, dropdownElement) {
    try {
      let endpoint;
      switch (type) {
        case "apiKey":
          endpoint = `/api/api-history/key/${id}`;
          break;
        case "baseUrl":
          endpoint = `/api/api-history/url/${id}`;
          break;
        case "modelName":
          endpoint = `/api/api-history/model/${id}`;
          break;
        default:
          throw new Error("未知的历史记录类型");
      }

      const response = await fetch(endpoint, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        // 重新加载对应的历史记录
        if (type === "apiKey") {
          this.loadApiKeyHistory(dropdownElement);
        } else if (type === "baseUrl") {
          this.loadBaseUrlHistory(dropdownElement);
        } else if (type === "modelName") {
          this.loadModelHistory(dropdownElement);
        }
      } else {
        this.showMessage(`删除历史记录失败: ${data.message}`, "error");
      }
    } catch (error) {
      console.error("删除历史记录失败:", error);
      this.showMessage("删除历史记录失败", "error");
    }
  }

  // 生成新的邀请码
  async generateInviteCode() {
    try {
      // 获取生成按钮并更新状态
      const generateButton = document.getElementById("generate-invite-code");
      if (generateButton) {
        generateButton.disabled = true;
        generateButton.textContent = "生成中...";
      }

      // 发送请求创建新邀请码
      const response = await fetch("/api/invite-codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        // 重新加载邀请码列表
        this.loadInviteCodes();
        this.showMessage("邀请码创建成功", "success");
      } else {
        this.showMessage(`创建邀请码失败: ${data.message}`, "error");
      }
    } catch (error) {
      console.error("创建邀请码失败:", error);
      this.showMessage("创建邀请码失败，请稍后重试", "error");
    } finally {
      // 恢复按钮状态
      const generateButton = document.getElementById("generate-invite-code");
      if (generateButton) {
        generateButton.disabled = false;
        generateButton.textContent = "生成新邀请码";
      }
    }
  }

  // 加载邀请码列表
  async loadInviteCodes() {
    try {
      // 获取邀请码管理容器
      const inviteCodeManagerContainer = document.getElementById(
        "invite-code-manager-container"
      );

      if (!inviteCodeManagerContainer) {
        console.warn("邀请码管理容器元素未找到");
        return;
      }

      // 使用InviteCodeManager模块来处理邀请码管理
      const { initInviteCodeManager } = await import(
        "../settings/InviteCodeManager.js"
      );
      initInviteCodeManager(inviteCodeManagerContainer);
    } catch (error) {
      console.error("初始化邀请码管理器失败:", error);
    }
  }

  // 更新UI以显示API不可用状态
  updateInviteUIForUnavailableAPI() {
    // 获取邀请码管理容器
    const inviteCodeManagerContainer = document.getElementById(
      "invite-code-manager-container"
    );

    // 显示不可用提示
    if (inviteCodeManagerContainer) {
      inviteCodeManagerContainer.innerHTML = "<p>邀请码功能暂不可用</p>";
    }
  }

  // 预连接到 AI 服务 - 优化版本
  preconnectAIService() {
    // 获取当前输入
    const promptInput = document.getElementById("ai-prompt");
    const prompt = promptInput.value.trim();

    // 如果内容为空或太短，不预连接
    if (!prompt || prompt.length < this.sessionManager.minInputLength) {
      // 清除可能存在的计时器
      if (this.sessionManager.preconnectTimer) {
        clearTimeout(this.sessionManager.preconnectTimer);
        this.sessionManager.preconnectTimer = null;
      }

      // 设置一个延迟的关闭，避免用户短暂删除内容时立即关闭连接
      if (this.sessionManager.activityTimer) {
        clearTimeout(this.sessionManager.activityTimer);
      }

      this.sessionManager.activityTimer = setTimeout(() => {
        // 确认内容仍然为空后再关闭
        if (
          !promptInput.value.trim() ||
          promptInput.value.trim().length < this.sessionManager.minInputLength
        ) {
          // 如果有活跃连接，关闭它
          if (this.sessionManager.activeSessionId) {
            this.closeConnection(
              this.sessionManager.activeSessionId,
              "用户输入内容不足"
            );
          }
        }
      }, 5000); // 5秒后再检查是否需要关闭连接

      return;
    }

    // 如果已经存在预连接计时器，先清除它
    if (this.sessionManager.preconnectTimer) {
      clearTimeout(this.sessionManager.preconnectTimer);
      this.sessionManager.preconnectTimer = null;
    }

    // 设置新的预连接计时器，短暂延迟后建立连接
    this.sessionManager.preconnectTimer = setTimeout(async () => {
      // 更新连接状态为"连接中"
      if (this.updateConnectionStatus) {
        this.updateConnectionStatus("connecting");
      }
      // 检查是否已有活跃连接，如果有且未超时，则复用
      if (
        this.sessionManager.activeSessionId &&
        this.sessionManager.isConnected &&
        !this.sessionManager.isInUse &&
        Date.now() - this.sessionManager.lastActivity <
          this.sessionManager.connectionTimeout
      ) {
        console.log("已有活跃的AI连接，无需重新连接");
        return;
      }

      // 避免频繁检查配置，使用缓存的配置有效性
      const now = Date.now();
      if (
        now - this.sessionManager.lastConfigCheck >
        this.sessionManager.configCheckInterval
      ) {
        try {
          // 使用低优先级的配置检查请求
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 增加超时时间到5秒

          const configCheckResponse = await fetch("/api/test-ai-connection", {
            signal: controller.signal,
            priority: "low", // 使用低优先级请求，不阻塞其他重要请求
          });

          clearTimeout(timeoutId);

          const configData = await configCheckResponse.json();
          this.sessionManager.configValid = configData.success;
          this.sessionManager.lastConfigCheck = now;
          console.log(
            "AI配置检查结果:",
            this.sessionManager.configValid ? "有效" : "无效"
          );
        } catch (error) {
          console.log("AI配置检查请求取消或超时:", error.name);
          // 如果是超时或取消，不应立即将配置标记为无效
          // 仅在确认无效时才设置configValid为false
          if (error.name !== "AbortError") {
            this.sessionManager.configValid = false;
          }
          // 更新最后检查时间，避免频繁重试
          this.sessionManager.lastConfigCheck = now;
        }
      }

      // 如果配置无效，不建立连接
      if (!this.sessionManager.configValid) {
        console.log("AI服务配置无效，跳过预连接");
        return;
      }

      try {
        // 尝试创建新连接
        const sessionId = await this.createNewConnection();
        console.log(`预连接成功创建，会话ID: ${sessionId}`);
      } catch (error) {
        console.log(`预连接失败: ${error.message}`);
      }
    }, this.sessionManager.preconnectDelay);
  }

  // 智能预连接到 AI 服务 - 使用连接管理器
  smartPreconnectAIService() {
    // 获取当前输入内容
    const promptElement = document.getElementById("ai-prompt");
    if (!promptElement) return;

    const promptText = promptElement.value.trim();

    // 添加更智能的触发条件
    // 1. 检查输入长度是否足够触发预连接
    if (promptText.length < this.sessionManager.minInputLength) {
      return;
    }

    // 2. 检查是否包含完整句子（以句号、问号或感叹号结尾）
    const hasCompleteSentence = /[.!?。！？]/.test(promptText);

    // 3. 检查用户是否停止输入（使用防抖）
    clearTimeout(this._preconnectDebounceTimer);

    // 4. 检查是否已经有活跃连接
    const hasActiveConnection =
      connectionManager &&
      connectionManager.hasActiveConnection &&
      connectionManager.hasActiveConnection();

    // 如果已有活跃连接，不需要再次预连接
    if (hasActiveConnection) {
      return;
    }

    // 如果有完整句子，立即预连接；否则等待用户停止输入
    if (hasCompleteSentence) {
      connectionManager.preconnect();
    } else {
      // 用户停止输入 1 秒后再预连接，避免频繁请求
      this._preconnectDebounceTimer = setTimeout(() => {
        connectionManager.preconnect();
      }, 1000);
    }
  }

  // 关闭活跃的AI会话 - 使用统一的连接管理
  closeActiveSession() {
    // 如果有活跃的会话，关闭它
    if (this.sessionManager.activeSessionId) {
      this.closeConnection(this.sessionManager.activeSessionId, "用户请求关闭");
    }
  }

  // 注册连接清理任务
  registerConnectionCleanupTask() {
    // 每5分钟检查一次连接状态，清理过期连接
    setInterval(() => {
      this.checkAndCleanupConnections();
    }, 5 * 60 * 1000);

    // 页面卸载时确保关闭连接
    window.addEventListener("beforeunload", () => {
      this.closeAllConnections();
    });
  }

  // 检查和清理过期的连接
  checkAndCleanupConnections() {
    const now = Date.now();

    // 如果有活跃的会话，检查是否超时
    if (this.sessionManager.activeSessionId) {
      const idleTime = now - this.sessionManager.lastActivity;
      if (idleTime > this.sessionManager.connectionTimeout) {
        console.log(
          `连接 ${this.sessionManager.activeSessionId} 已闲置 ${Math.round(
            idleTime / 1000
          )} 秒，超过阈值，主动关闭`
        );
        this.closeConnection(this.sessionManager.activeSessionId, "闲置超时");
      }
    }
  }

  // 获取SSE连接
  async getConnection() {
    // 如果已有活跃连接并且未超时，直接返回它
    if (
      this.sessionManager.activeSessionId &&
      this.sessionManager.isConnected &&
      !this.sessionManager.isInUse &&
      Date.now() - this.sessionManager.lastActivity <
        this.sessionManager.connectionTimeout
    ) {
      // 标记连接为活跃
      this.sessionManager.lastActivity = Date.now();
      return this.sessionManager.activeSessionId;
    }

    // 关闭可能存在的旧连接
    if (this.sessionManager.activeSessionId) {
      await this.closeConnection(
        this.sessionManager.activeSessionId,
        "替换为新连接"
      );
    }

    // 创建新连接
    return this.createNewConnection();
  }

  // 创建新的SSE连接
  async createNewConnection() {
    // 生成新的会话ID
    const sessionId = `session_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    // 如果已经有EventSource，先关闭它
    if (this.sessionManager.eventSource) {
      this.sessionManager.eventSource.close();
    }

    // 创建并记录新的连接
    this.sessionManager.activeSessionId = sessionId;
    this.sessionManager.isInUse = false;
    this.sessionManager.isConnected = false;
    this.sessionManager.lastActivity = Date.now();

    try {
      // 创建EventSource连接
      const eventSource = new EventSource(
        `/api/stream-connection/${sessionId}`
      );
      this.sessionManager.eventSource = eventSource;

      // 等待连接建立
      await new Promise((resolve, reject) => {
        // 设置超时
        const connectionTimeout = setTimeout(() => {
          reject(new Error("连接建立超时"));
        }, 10000); // 10秒超时

        // 连接建立成功
        eventSource.addEventListener("open", () => {
          console.log(`SSE连接 ${sessionId} 已建立`);
          this.sessionManager.isConnected = true;
          this.sessionManager.lastActivity = Date.now();

          // 更新连接状态为"已连接"
          if (this.updateConnectionStatus) {
            this.updateConnectionStatus("connected");
          }

          clearTimeout(connectionTimeout);
          resolve();
        });

        // 连接错误处理
        eventSource.addEventListener("error", () => {
          clearTimeout(connectionTimeout);
          reject(new Error("连接建立失败"));
        });

        // 接收连接成功消息
        eventSource.addEventListener("message", (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === "connected") {
              this.sessionManager.isConnected = true;
              this.sessionManager.lastActivity = Date.now();
              clearTimeout(connectionTimeout);
              resolve();
            }
          } catch (error) {
            // 忽略解析错误
          }
        });
      });

      // 设置保活定时器
      this.setupKeepAlive(sessionId);

      // 返回会话ID
      return sessionId;
    } catch (error) {
      console.error("建立SSE连接失败:", error);

      // 清理失败的连接
      if (this.sessionManager.eventSource) {
        this.sessionManager.eventSource.close();
      }

      if (this.sessionManager.activeSessionId === sessionId) {
        this.sessionManager.activeSessionId = null;
        this.sessionManager.eventSource = null;
        this.sessionManager.isConnected = false;
      }

      throw error;
    }
  }

  // 设置保活定时器
  setupKeepAlive(sessionId) {
    // 清除可能存在的旧定时器
    if (this.sessionManager.pingTimer) {
      clearInterval(this.sessionManager.pingTimer);
    }

    // 创建新的保活定时器，每30秒刷新一次连接活跃时间
    this.sessionManager.pingTimer = setInterval(() => {
      // 如果连接ID已变更，停止当前的保活
      if (this.sessionManager.activeSessionId !== sessionId) {
        clearInterval(this.sessionManager.pingTimer);
        this.sessionManager.pingTimer = null;
        return;
      }

      // 客户端主动记录活跃时间，不需要向服务端发请求
      this.sessionManager.lastActivity = Date.now();
    }, 30000); // 30秒
  }

  // 关闭连接
  async closeConnection(sessionId, reason = "手动关闭") {
    if (!sessionId) return;

    // 清除保活定时器
    if (this.sessionManager.pingTimer) {
      clearInterval(this.sessionManager.pingTimer);
      this.sessionManager.pingTimer = null;
    }

    // 如果是当前活跃的连接
    if (this.sessionManager.activeSessionId === sessionId) {
      // 关闭EventSource
      if (this.sessionManager.eventSource) {
        this.sessionManager.eventSource.close();
        this.sessionManager.eventSource = null;
      }

      // 尝试通知服务器关闭连接
      try {
        const response = await fetch(`/api/close-connection/${sessionId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        // 如果成功，输出日志
        if (response.ok) {
          console.log(`成功关闭连接 ${sessionId}, 原因: ${reason}`);
        }
      } catch (error) {
        // 忽略关闭错误，因为连接可能已经关闭
        console.debug(`关闭连接 ${sessionId} 时出错:`, error);
      }

      // 重置会话状态
      this.sessionManager.activeSessionId = null;
      this.sessionManager.isConnected = false;
      this.sessionManager.isInUse = false;

      // 更新连接状态为"未连接"
      if (this.updateConnectionStatus) {
        this.updateConnectionStatus("disconnected");
      }
    }
  }

  // 关闭所有连接
  closeAllConnections() {
    // 关闭当前活跃的连接
    if (this.sessionManager.activeSessionId) {
      this.closeConnection(this.sessionManager.activeSessionId, "应用关闭");
    }

    // 重置所有定时器
    if (this.sessionManager.pingTimer) {
      clearInterval(this.sessionManager.pingTimer);
      this.sessionManager.pingTimer = null;
    }

    if (this.sessionManager.preconnectTimer) {
      clearTimeout(this.sessionManager.preconnectTimer);
      this.sessionManager.preconnectTimer = null;
    }

    if (this.sessionManager.activityTimer) {
      clearTimeout(this.sessionManager.activityTimer);
      this.sessionManager.activityTimer = null;
    }
  }

  // 使用SSE连接发送AI请求并处理流式回复 - 优化版本
  async generateWithSSE(prompt, noteElement) {
    // 导入增量更新函数
    const { updateNoteContentIncrementalThrottled } = await import(
      "../utils/MarkdownUtils.js"
    );

    // 使用智能连接管理器获取连接
    let connection;
    try {
      // 获取连接
      connection = await connectionManager.getConnection();
    } catch (error) {
      console.error("获取AI连接失败:", error);
      throw new Error("无法建立与AI服务的连接");
    }

    // 创建 AbortController 用于取消请求
    const abortController = new AbortController();
    this.currentAbortController = abortController;

    // 保存当前会话信息，以便取消时使用
    this.currentSessionId = connection.sessionId;
    this.currentNoteElement = noteElement;

    // 保存便签 ID，以便取消时使用
    const noteId = noteElement.id;
    this.currentNoteId = noteId;

    try {
      // 初始化内容元素
      const previewElement = noteElement.querySelector(".markdown-preview");

      // 初始化内容变量
      let fullText = "";

      // 创建Promise来追踪处理过程
      return new Promise((resolve, reject) => {
        // 设置消息处理器
        const messageHandler = (event) => {
          try {
            // 检查便签是否已被取消
            if (this.canceledNoteIds && this.canceledNoteIds.has(noteId)) {
              console.log(`已跳过已取消便签 ${noteId} 的消息处理`);
              return; // 已取消，不处理消息
            }

            const data = JSON.parse(event.data);

            switch (data.event) {
              case "start":
                // 开始生成，不需要额外处理
                break;

              case "chunk":
                // 再次检查便签是否已被取消
                if (this.canceledNoteIds && this.canceledNoteIds.has(noteId)) {
                  console.log(`已跳过已取消便签 ${noteId} 的内容块处理`);
                  return; // 已取消，不处理消息
                }

                // 提取新块和完整文本
                const chunk = data.chunk || "";
                fullText = data.fullText || fullText + chunk;

                // 使用增量更新函数
                updateNoteContentIncrementalThrottled(
                  noteElement,
                  chunk,
                  fullText
                );

                // 更新生成进度指示器
                this.updateGenerationProgress(noteElement, fullText);
                break;

              case "end":
                // 检查便签是否已被取消
                if (this.canceledNoteIds && this.canceledNoteIds.has(noteId)) {
                  console.log(`已跳过已取消便签 ${noteId} 的完成处理`);
                  // 移除事件监听器
                  if (connection.eventSource) {
                    connection.eventSource.removeEventListener(
                      "message",
                      messageHandler
                    );
                  }
                  // 释放连接
                  connectionManager.releaseConnection(true);
                  // 拒绝Promise，因为已取消
                  reject(new Error("生成已取消"));
                  return;
                }

                // 移除事件监听器
                if (connection.eventSource) {
                  connection.eventSource.removeEventListener(
                    "message",
                    messageHandler
                  );
                }
                // 生成完成

                // 更新进度指示器显示最终字符数
                const progressElement = noteElement.querySelector(
                  ".generation-progress"
                );
                if (progressElement) {
                  const charCount = fullText.length;
                  progressElement.innerHTML = `<span class='chars-count'>${charCount}</span> 字符 (完成)`;
                }

                // 释放连接
                connectionManager.releaseConnection(true);
                // 清除当前的 AbortController
                this.currentAbortController = null;
                // 清除当前会话信息
                this.currentSessionId = null;
                this.currentNoteElement = null;
                this.currentNoteId = null;
                // 完成Promise
                resolve(fullText);
                break;

              case "error":
                // 检查便签是否已被取消
                if (this.canceledNoteIds && this.canceledNoteIds.has(noteId)) {
                  console.log(`已跳过已取消便签 ${noteId} 的错误处理`);
                  // 移除事件监听器
                  if (connection.eventSource) {
                    connection.eventSource.removeEventListener(
                      "message",
                      messageHandler
                    );
                  }
                  // 释放连接
                  connectionManager.releaseConnection(false);
                  // 拒绝Promise，因为已取消
                  reject(new Error("生成已取消"));
                  return;
                }

                // 移除事件监听器
                if (connection.eventSource) {
                  connection.eventSource.removeEventListener(
                    "message",
                    messageHandler
                  );
                }
                // 释放连接，标记为失败
                connectionManager.releaseConnection(false);
                // 清除当前的 AbortController
                this.currentAbortController = null;
                // 清除当前会话信息
                this.currentSessionId = null;
                this.currentNoteElement = null;
                this.currentNoteId = null;
                // 拒绝Promise
                reject(new Error(data.message || "生成过程中发生错误"));
                break;

              case "connection-closed":
                // 释放连接
                connectionManager.releaseConnection(false);
                break;
            }
          } catch (error) {
            // 忽略解析错误，不中断生成过程
          }
        };

        // 添加消息监听器
        if (connection.eventSource) {
          connection.eventSource.addEventListener("message", messageHandler);
        } else {
          reject(new Error("连接已关闭"));
          return;
        }

        // 使用 Promise.race 实现请求竞争，加快响应速度
        Promise.race([
          // 主请求
          fetch(`/api/process-stream/${connection.sessionId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ prompt }),
            signal: abortController.signal,
            // 添加高优先级
            priority: "high",
          }),

          // 超时处理
          new Promise((_, timeoutReject) =>
            setTimeout(() => timeoutReject(new Error("请求超时")), 10000)
          ),
        ])
          .then((response) => {
            if (!response.ok) {
              return response.json().then((data) => {
                throw new Error(data.message || "处理请求失败");
              });
            }
            // 处理已发送，结果将通过SSE返回
          })
          .catch((error) => {
            // 忽略中止错误
            if (error.name === "AbortError") {
              return;
            }

            // 移除事件监听器
            if (connection.eventSource) {
              connection.eventSource.removeEventListener(
                "message",
                messageHandler
              );
            }
            // 释放连接，标记为失败
            connectionManager.releaseConnection(false);
            // 清除当前的 AbortController
            this.currentAbortController = null;
            // 拒绝Promise
            reject(error);
          });

        // 设置总超时
        setTimeout(() => {
          // 检查是否已完成
          if (this.currentAbortController === abortController) {
            // 中止请求
            abortController.abort();

            // 移除事件监听器
            if (connection.eventSource) {
              connection.eventSource.removeEventListener(
                "message",
                messageHandler
              );
            }
            // 释放连接，标记为失败
            connectionManager.releaseConnection(false);
            // 清除当前的 AbortController
            this.currentAbortController = null;

            // 如果已有一些内容，使用它
            if (fullText.trim()) {
              // 超时处理，不需要额外处理
              resolve(fullText);
            } else {
              reject(new Error("AI生成内容超时"));
            }
          }
        }, 90 * 1000); // 减少超时时间到90秒
      });
    } catch (error) {
      // 发生任何错误，释放连接
      if (connection) {
        connectionManager.releaseConnection(false);
      }
      // 清除当前的 AbortController
      this.currentAbortController = null;
      throw error;
    }
  }

  // 更新生成进度指示器 - 只显示字符数，不显示估计百分比
  updateGenerationProgress(noteElement, fullText) {
    // 获取字符计数元素
    const charsCountElement = noteElement.querySelector(".chars-count");
    if (!charsCountElement) return;

    // 更新字符数
    const charCount = fullText.length;
    charsCountElement.textContent = charCount;

    // 更新进度元素，只显示字符数
    const progressElement = noteElement.querySelector(".generation-progress");
    if (progressElement) {
      progressElement.innerHTML = `<span class='chars-count'>${charCount}</span> 字符`;
    }
  }

  // 取消当前的AI生成请求
  async cancelGeneration() {
    if (this.currentAbortController && this.currentSessionId) {
      console.log("取消AI生成请求");

      try {
        // 首先中止当前请求
        this.currentAbortController.abort();

        // 尝试通知服务器关闭连接
        await fetch(`/api/close-connection/${this.currentSessionId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        // 标记当前便签为已取消，防止后续消息处理
        if (this.currentNoteId) {
          // 将便签 ID 添加到已取消列表中
          if (!this.canceledNoteIds) {
            this.canceledNoteIds = new Set();
          }
          this.canceledNoteIds.add(this.currentNoteId);

          // 移除临时便签
          if (this.currentNoteId.startsWith("temp-ai-note-")) {
            const noteElement = document.getElementById(this.currentNoteId);
            if (noteElement && noteElement.parentNode) {
              // 移除临时便签，同时移除AI生成中的样式
              noteElement.classList.remove("ai-generating-note");
              noteElement.remove();
            }
          }
        }
      } catch (error) {
        console.error("取消生成时出错:", error);
        // 即使出错也继续处理
      } finally {
        // 清除当前状态
        this.currentAbortController = null;
        this.currentSessionId = null;
        this.currentNoteElement = null;
        this.currentNoteId = null;
      }

      return true;
    }
    return false;
  }

  // 生成邀请码
  async generateInviteCode() {
    try {
      const generateButton = document.getElementById("generate-invite-code");
      if (!generateButton) {
        console.warn("生成邀请码按钮未找到");
        return;
      }

      // 禁用按钮并显示加载状态
      generateButton.disabled = true;
      generateButton.textContent = "生成中...";

      // 发送请求创建邀请码
      const response = await fetch("/api/invite-codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        // 重新加载邀请码列表
        this.loadInviteCodes();
        this.showMessage("邀请码创建成功", "success");
      } else {
        this.showMessage(`创建邀请码失败: ${data.message}`, "error");
      }
    } catch (error) {
      console.error("创建邀请码失败:", error);
      this.showMessage("创建邀请码失败，请稍后重试", "error");
    } finally {
      // 恢复按钮状态
      const generateButton = document.getElementById("generate-invite-code");
      if (generateButton) {
        generateButton.disabled = false;
        generateButton.textContent = "生成新邀请码";
      }
    }
  }
}

export default App;
