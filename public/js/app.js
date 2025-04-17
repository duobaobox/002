// 导入需要的模块
import {
  Canvas,
  Note,
  createEmptyAiNote,
  getHighestZIndex,
  updateNoteContent,
} from "./modules/index.js";

class App {
  constructor() {
    this.notes = [];
    this.canvas = new Canvas();
    this.nextId = 1;

    // 从服务器加载便签数据
    this.loadNotes();

    this.initEventListeners();
    this.updateButtonVisibility();
    this.initSettingsModal(); // 新增初始化设置弹窗
    this.checkAuth(); // 检查认证状态

    // 初始化邀请码管理
    this.inviteCodes = [];
    this.inviteApiAvailable = false; // 标记API是否可用
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

  initEventListeners() {
    // 添加普通便签按钮
    document.getElementById("add-note").addEventListener("click", () => {
      this.addEmptyNote();
    });

    // AI生成便签按钮
    document.getElementById("ai-generate").addEventListener("click", () => {
      this.generateAiNote();
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

    // 监听输入框内容变化
    const promptElement = document.getElementById("ai-prompt");
    promptElement.addEventListener("input", () => {
      this.updateButtonVisibility();
    });

    // 监听Enter键提交
    promptElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const hasText = promptElement.value.trim().length > 0;
        if (hasText) {
          this.generateAiNote();
        } else {
          this.addEmptyNote();
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

    // 重置设置
    const resetButton = document.querySelector(".reset-button");
    let resetClickCount = 0;
    let resetClickTimer = null;

    resetButton.addEventListener("click", () => {
      resetClickCount++;

      // 更新按钮文本，显示还需点击几次
      if (resetClickCount === 1) {
        resetButton.innerHTML = `再点击 2 次确认重置 <span class="reset-progress">⚫◯◯</span>`;
        resetButton.classList.add("reset-warning");
      } else if (resetClickCount === 2) {
        resetButton.innerHTML = `再点击 1 次确认重置 <span class="reset-progress">⚫⚫◯</span>`;
        resetButton.classList.add("reset-danger");
      } else if (resetClickCount >= 3) {
        resetButton.innerHTML = `正在重置...`;
        resetButton.disabled = true;

        // 执行重置操作
        this.resetAllData()
          .then((success) => {
            if (success) {
              // 重置完成后恢复按钮状态
              resetButton.innerHTML = `重置所有设置`;
              resetButton.classList.remove("reset-warning", "reset-danger");
              resetButton.disabled = false;

              // 显示重置成功消息
              this.showMessage("所有数据已重置", "success");

              // 重新加载页面以显示空白状态
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            }
          })
          .catch((error) => {
            console.error("重置失败:", error);
            this.showMessage(`重置失败: ${error.message}`, "error");

            // 恢复按钮状态
            resetButton.innerHTML = `重置所有设置`;
            resetButton.classList.remove("reset-warning", "reset-danger");
            resetButton.disabled = false;
          });

        // 重置计数器
        resetClickCount = 0;
        if (resetClickTimer) {
          clearTimeout(resetClickTimer);
        }
        return;
      }

      // 设置超时，如果超过3秒没有下一次点击，则重置计数器
      if (resetClickTimer) {
        clearTimeout(resetClickTimer);
      }

      resetClickTimer = setTimeout(() => {
        resetClickCount = 0;
        resetButton.innerHTML = `重置所有设置`;
        resetButton.classList.remove("reset-warning", "reset-danger");
      }, 3000);
    });

    // 清除AI设置按钮
    const clearAiSettingsButton = document.getElementById("clear-ai-settings");
    let clearAiClickCount = 0;
    let clearAiClickTimer = null;

    if (clearAiSettingsButton) {
      clearAiSettingsButton.addEventListener("click", () => {
        clearAiClickCount++;

        // 更新按钮文本，显示还需点击几次
        if (clearAiClickCount === 1) {
          clearAiSettingsButton.innerHTML = `再点击 2 次确认清除 <span class="reset-progress">⚫◯◯</span>`;
          clearAiSettingsButton.classList.add("reset-warning");
        } else if (clearAiClickCount === 2) {
          clearAiSettingsButton.innerHTML = `再点击 1 次确认清除 <span class="reset-progress">⚫⚫◯</span>`;
          clearAiSettingsButton.classList.add("reset-danger");
        } else if (clearAiClickCount >= 3) {
          clearAiSettingsButton.innerHTML = `正在清除...`;
          clearAiSettingsButton.disabled = true;

          // 执行清除操作
          this.clearAISettings()
            .then((success) => {
              if (success) {
                // 清空表单值
                document.getElementById("ai-api-key").value = "";
                document.getElementById("ai-base-url").value = "";
                document.getElementById("ai-model").value = "";
                document.getElementById("ai-max-tokens").value = "800";
                document.getElementById("ai-temperature").value = "0.7";

                // 更新温度值显示 - 重新获取元素
                const tempValueElement =
                  document.getElementById("temperature-value");
                if (tempValueElement) {
                  // Check if the element exists
                  tempValueElement.textContent = "0.7"; // Update its text content
                }

                // 更新底部栏的AI模型显示
                const aiModelDisplay = document.querySelector(".ai-model");
                if (aiModelDisplay) {
                  aiModelDisplay.textContent = "未设置";
                }

                // 清除完成后恢复按钮状态
                clearAiSettingsButton.innerHTML = `清除 AI 设置`;
                clearAiSettingsButton.classList.remove(
                  "reset-warning",
                  "reset-danger"
                );
                clearAiSettingsButton.disabled = false;

                // 显示成功消息
                this.showMessage("所有AI设置已清除", "success");
              }
            })
            .catch((error) => {
              console.error("清除AI设置失败:", error);
              this.showMessage(`清除失败: ${error.message}`, "error");

              // 恢复按钮状态
              clearAiSettingsButton.innerHTML = `清除 AI 设置`;
              clearAiSettingsButton.classList.remove(
                "reset-warning",
                "reset-danger"
              );
              clearAiSettingsButton.disabled = false;
            });

          // 重置计数器
          clearAiClickCount = 0;
          if (clearAiClickTimer) {
            clearTimeout(clearAiClickTimer);
          }
          return;
        }

        // 设置超时，如果超过3秒没有下一次点击，则重置计数器
        if (clearAiClickTimer) {
          clearTimeout(clearAiClickTimer);
        }

        clearAiClickTimer = setTimeout(() => {
          clearAiClickCount = 0;
          clearAiSettingsButton.innerHTML = `清除 AI 设置`;
          clearAiSettingsButton.classList.remove(
            "reset-warning",
            "reset-danger"
          );
        }, 3000);
      });
    }

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
  }

  // 根据输入内容更新按钮可见性
  updateButtonVisibility() {
    const promptElement = document.getElementById("ai-prompt");
    const hasText = promptElement.value.trim().length > 0;

    const addButton = document.getElementById("add-note");
    const aiButton = document.getElementById("ai-generate");

    if (hasText) {
      addButton.style.display = "none";
      aiButton.style.display = "block";
    } else {
      addButton.style.display = "block";
      aiButton.style.display = "none";
    }
  }

  // 添加空白便签
  async addEmptyNote() {
    try {
      // 随机位置
      const x = 100 + Math.random() * 200;
      const y = 100 + Math.random() * 200;

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
    try {
      const response = await fetch("/api/notes");
      const data = await response.json();

      if (data.success) {
        this.nextId = data.nextId;

        // 清空现有便签
        this.notes = [];
        const noteContainer = document.getElementById("note-container");
        while (noteContainer.firstChild) {
          noteContainer.removeChild(noteContainer.firstChild);
        }

        // 添加服务器返回的便签
        data.notes.forEach((noteData) => {
          const note = new Note(
            noteData.id,
            noteData.text,
            noteData.x,
            noteData.y,
            noteData.title,
            noteData.colorClass
          );

          // 如果有宽度和高度数据，应用它们
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
    }
  }

  // 在服务器上更新便签
  async updateNoteOnServer(id) {
    const note = this.notes.find((n) => n.id === id);
    if (!note) return;

    const element = note.element;
    if (!element) return;

    try {
      // 获取便签的当前位置和尺寸
      const rect = element.getBoundingClientRect();
      const x = parseInt(element.style.left);
      const y = parseInt(element.style.top);
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      const zIndex = parseInt(
        element.style.zIndex || window.getComputedStyle(element).zIndex
      );

      // 发送更新请求到服务器
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

      if (!data.success) {
        console.error("更新便签失败:", data.message);
      }
    } catch (error) {
      console.error("更新便签时发生错误:", error);
    }
  }

  // 从服务器删除便签
  async removeNote(id) {
    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        this.notes = this.notes.filter((note) => note.id !== id);
        console.log(`便签 ${id} 已删除`);
      } else {
        console.error("删除便签失败:", data);
      }
    } catch (error) {
      console.error("删除便签时出错:", error);
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

    // 禁用按钮和输入框，添加生成中的动画样式
    generateButton.disabled = true;
    generateButton.classList.add("generating"); // 添加生成中的动画类
    promptElement.disabled = true; // 禁用文本输入框
    // 不在这里显示全局消息，由打字效果提供反馈

    // 首先创建一个空便签，准备接收流式内容
    // 注意：createEmptyAiNote 现在需要在 note.js 中恢复
    const { noteElement, noteId } = createEmptyAiNote();

    try {
      // 在发送请求前先检查AI配置状态
      const configCheckResponse = await fetch("/api/test-ai-connection"); // Use the specific test endpoint
      const configCheckData = await configCheckResponse.json();

      if (!configCheckData.success) {
        // 如果AI服务未配置，显示友好的错误提示并引导用户设置
        this.showMessage(
          configCheckData.message || "AI服务连接失败或未配置",
          "warning"
        );
        // 打开设置面板并切换到AI设置选项卡
        document.getElementById("settings-modal").classList.add("visible");
        document.querySelector(".nav-item[data-tab='ai']").click(); // Simulate click to switch tab

        // 移除临时便签
        noteElement.remove();
        throw new Error("AI configuration needed"); // Stop execution
      }

      // 设置便签标题 - 修改为使用正确的标题元素
      const titleElem = noteElement.querySelector(".note-title");
      if (titleElem) {
        titleElem.textContent =
          prompt.substring(0, 20) + (prompt.length > 20 ? "... " : "");
      }

      // 获取临时便签的位置和颜色
      const x = parseInt(noteElement.style.left) || 100 + Math.random() * 200;
      const y = parseInt(noteElement.style.top) || 100 + Math.random() * 200;
      const colorClass = noteElement.classList[1]; // 获取当前颜色类

      console.log("发送AI生成请求，提示:", prompt);

      // API请求AI内容生成
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      // 处理API密钥验证中的情况 (保持之前的逻辑)
      if (!response.ok && response.status === 202 && data.needVerification) {
        if (noteElement) {
          const contentElement = noteElement.querySelector(".note-content");
          if (contentElement) {
            contentElement.innerHTML =
              "<p><i>正在验证API连接，请稍候...</i></p>";
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
        noteElement.remove();
        this.showMessage("API正在初始化中，请稍后再试", "info");
        return; // Stop execution here
      }

      if (!response.ok) {
        console.error("服务器响应错误:", data);
        // 移除临时便签
        noteElement.remove();
        throw new Error(data.message || `服务器响应错误: ${response.status}`);
      }

      if (data.success && data.text) {
        // 显示打字机效果
        // 注意：updateNoteContent 需要在 note.js 中恢复
        await this.displayTypingEffect(noteElement, data.text);

        // AI标题
        const aiTitle =
          prompt.length > 15 ? prompt.substring(0, 15) + "..." : prompt;
        const finalTitle = `AI: ${aiTitle}`;

        // 创建便签到服务器
        const noteResponse = await fetch("/api/notes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: data.text,
            x,
            y,
            title: finalTitle,
            colorClass: colorClass,
            zIndex: parseInt(
              noteElement.style.zIndex || getHighestZIndex() + 1
            ), // Pass zIndex
          }),
        });

        const noteData = await noteResponse.json();

        // 移除临时便签
        noteElement.remove();

        if (noteData.success && noteData.note) {
          console.log("AI便签已添加，ID:", noteData.note.id);

          // 创建正式的Note实例替代临时便签
          const note = new Note(
            noteData.note.id,
            noteData.note.text,
            noteData.note.x || x,
            noteData.note.y || y,
            noteData.note.title || finalTitle,
            noteData.note.colorClass // Use color from server or temp note
          );

          // 确保新创建的便签在最上层 (使用服务器返回的zIndex或临时便签的)
          if (note.element) {
            note.element.style.zIndex =
              noteData.note.zIndex ||
              parseInt(noteElement.style.zIndex || getHighestZIndex() + 1);
          }

          // 添加到notes数组
          this.notes.push(note);

          // 添加高亮效果
          note.element.classList.add("new-note-highlight");
          setTimeout(() => {
            note.element.classList.remove("new-note-highlight");
          }, 1500);

          // this.showMessage("AI 便签生成成功！", "success"); // Commented out: Do not show success message for AI note generation
        } else {
          console.error("创建AI便签失败:", noteData);
          throw new Error(noteData.message || "无法创建AI便签");
        }

        // 清空输入框
        promptElement.value = "";
        this.updateButtonVisibility(); // 更新按钮状态
      } else {
        // 移除临时便签
        noteElement.remove();
        throw new Error(data.message || "服务器返回了无效的数据");
      }
    } catch (error) {
      console.error("生成AI便签出错:", error);
      // 确保在出错时也移除临时便签 (如果它还存在)
      if (noteElement && noteElement.parentNode) {
        noteElement.remove();
      }
      this.showMessage(`生成失败: ${error.message}`, "error"); // Keep error message display
    } finally {
      // 恢复按钮和输入框状态
      generateButton.disabled = false;
      generateButton.classList.remove("generating"); // 移除生成中的动画类
      promptElement.disabled = false; // 恢复文本输入框
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
  initSettingsModal() {
    // 不需要获取设置按钮，因为我们在canvas.js中处理了
    const settingsModal = document.getElementById("settings-modal");
    const closeSettings = document.getElementById("close-settings");
    const saveButton = document.querySelector("#ai-panel .save-button"); // 更新选择器
    const resetButton = document.querySelector("#backup-panel .reset-button"); // 更新选择器
    const navItems = document.querySelectorAll(".nav-item");
    const colorOptions = document.querySelectorAll(".color-option");
    const themeOptions = document.querySelectorAll(".theme-option");
    const rangeInputs = document.querySelectorAll('input[type="range"]');

    // 移除对不存在方法的调用
    // this.initCustomModelSelect();

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

    // 当个人中心标签被点击时，检查邀请码API是否可用
    const profileTab = document.querySelector('.nav-item[data-tab="profile"]');
    if (profileTab) {
      profileTab.addEventListener("click", () => {
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
  }

  // 修改密码
  async changePassword() {
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

    if (newPassword !== confirmPassword) {
      this.showMessage("两次输入的新密码不匹配", "error");
      return;
    }

    try {
      const changePasswordButton = document.getElementById(
        "change-password-button"
      );
      changePasswordButton.disabled = true;
      changePasswordButton.textContent = "更新中...";

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

      if (data.success) {
        this.showMessage("密码已成功更新", "success");
        // 清空输入框
        document.getElementById("current-password").value = "";
        document.getElementById("new-password").value = "";
        document.getElementById("confirm-password").value = "";
      } else {
        this.showMessage(data.message || "密码更新失败", "error");
      }
    } catch (error) {
      console.error("更新密码失败:", error);
      this.showMessage("更新密码请求失败", "error");
    } finally {
      const changePasswordButton = document.getElementById(
        "change-password-button"
      );
      changePasswordButton.disabled = false;
      changePasswordButton.textContent = "更新密码";
    }
  }

  // 清除AI设置
  async clearAISettings() {
    try {
      const response = await fetch("/api/settings/ai/clear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "清除设置失败");
      }

      // 直接清空UI上的所有输入框，不依赖后续的loadAISettings
      document.getElementById("ai-api-key").value = "";
      document.getElementById("ai-base-url").value = "";
      document.getElementById("ai-model").value = "";
      document.getElementById("ai-max-tokens").value = "800";
      document.getElementById("ai-temperature").value = "0.7";

      // 更新底部栏显示
      const aiModelDisplay = document.querySelector(".ai-model");
      if (aiModelDisplay) {
        aiModelDisplay.textContent = "未设置";
      }

      return true;
    } catch (error) {
      console.error("清除AI设置失败:", error);
      throw error;
    }
  }

  // 加载AI设置
  async loadAISettings() {
    try {
      const response = await fetch("/api/ai-settings");

      // 检查响应类型
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`收到非JSON响应: ${contentType}`);
      }

      const data = await response.json();

      if (data.success && data.settings) {
        const settings = data.settings;

        // 检查是否是空配置
        const isEmpty =
          settings.isEmpty ||
          (!settings.apiKey && !settings.baseURL && !settings.model);

        // 填充表单 - 确保ID与HTML中的匹配
        const apiKeyInput = document.getElementById("ai-api-key");
        apiKeyInput.value = isEmpty ? "" : settings.apiKey || "";
        apiKeyInput.type = "password"; // 确保密钥默认是隐藏的

        // 只有当配置非空时，才填充默认值
        document.getElementById("ai-base-url").value = isEmpty
          ? ""
          : settings.baseURL || "";
        document.getElementById("ai-model").value = isEmpty
          ? ""
          : settings.model || "";
        document.getElementById("ai-max-tokens").value =
          settings.maxTokens || 800;
        document.getElementById("ai-temperature").value =
          settings.temperature || 0.7;

        // 更新底部栏的AI模型显示
        const aiModelDisplay = document.querySelector(".ai-model");
        if (aiModelDisplay) {
          if (isEmpty || !settings.model) {
            aiModelDisplay.textContent = "未设置";
          } else {
            // 使用完整的模型名称，不再提取简短版本
            aiModelDisplay.textContent = settings.model;
          }
        }

        console.log("AI设置已加载:", isEmpty ? "空配置" : settings);
      } else {
        console.warn("未找到AI设置或加载失败");

        // 更新底部栏显示为未设置状态
        const aiModelDisplay = document.querySelector(".ai-model");
        if (aiModelDisplay) {
          aiModelDisplay.textContent = "未设置";
        }

        // 清空所有输入框
        document.getElementById("ai-api-key").value = "";
        document.getElementById("ai-base-url").value = "";
        document.getElementById("ai-model").value = "";
      }
    } catch (error) {
      console.error("加载AI设置失败:", error);
      this.showMessage("无法加载AI设置", "error");

      // 确保在错误情况下也更新UI
      const aiModelDisplay = document.querySelector(".ai-model");
      if (aiModelDisplay) {
        aiModelDisplay.textContent = "未设置";
      }
    }
  }

  // 保存AI设置
  async saveAISettings() {
    try {
      // 获取表单值
      const apiKey = document.getElementById("ai-api-key").value;
      const baseURL = document.getElementById("ai-base-url").value;
      const model = document.getElementById("ai-model").value;
      const maxTokens = parseInt(
        document.getElementById("ai-max-tokens").value
      );
      const temperature = parseFloat(
        document.getElementById("ai-temperature").value
      );

      // 验证必填字段
      if (!baseURL || !model) {
        this.showMessage("请填写API地址和模型名称", "error");
        return false;
      }

      // 验证数字
      if (isNaN(maxTokens) || isNaN(temperature)) {
        this.showMessage("最大令牌数和温度必须是有效数字", "error");
        return false;
      }

      // 发送到服务器
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
      if (!data.success) {
        throw new Error(data.message || "保存设置失败");
      }

      // 更新AI模型显示在底部栏
      const aiModelDisplay = document.querySelector(".ai-model");
      if (aiModelDisplay) {
        // 使用完整的模型名称，不再提取简短版本
        aiModelDisplay.textContent = model;
      }

      this.showMessage("AI设置已成功保存", "success");
      return true;
    } catch (error) {
      console.error("保存AI设置失败:", error);
      throw error;
    }
  }

  // 测试AI连接 - 更新为与保存设置相同的消息提示机制
  async testAIConnection() {
    // 显示测试中的状态
    this.showMessage("正在测试API连接...", "info");

    try {
      // 使用专门的测试连接端点
      const response = await fetch("/api/test-ai-connection");
      const data = await response.json();

      if (data.success) {
        this.showMessage(
          `✓ 连接成功！模型: ${data.model || "未知"}`,
          "success"
        );
      } else {
        let errorMessage = `✗ 连接失败: ${data.message || "未知错误"}`;
        if (data.details) {
          const missing = Object.entries(data.details)
            .filter(([, value]) => value)
            .map(([key]) => key.replace("missing", "").toLowerCase())
            .join(", ");
          if (missing) errorMessage += ` (缺少: ${missing})`;
        }
        this.showMessage(errorMessage, "error");
      }
    } catch (error) {
      this.showMessage(`✗ 请求失败: ${error.message}`, "error");
    }
  }

  // 显示消息提示 - 统一在屏幕顶部居中显示
  showMessage(message, type = "info") {
    // 移除旧的消息元素（如果存在）以避免重叠
    const existingMessage = document.querySelector(".message-top-center");
    if (existingMessage) {
      existingMessage.remove();
    }

    // 创建新的消息元素
    const msgElement = document.createElement("div");
    // 添加基础类和类型特定的类，以及新的定位类
    msgElement.className = `message-top-center message-${type}`;
    msgElement.textContent = message;
    document.body.appendChild(msgElement);

    // 显示动画 (通过添加 'show' 类触发 CSS 动画)
    setTimeout(() => {
      msgElement.classList.add("show");
      // 设置定时器自动移除消息
      setTimeout(() => {
        msgElement.classList.remove("show");
        // 等待动画完成后再从DOM中移除
        setTimeout(() => {
          if (msgElement.parentNode) {
            document.body.removeChild(msgElement);
          }
        }, 500); // 动画持续时间 (应与 CSS 中的 transition/animation duration 匹配)
      }, 3000); // 消息显示时间
    }, 10); // 短暂延迟以触发动画
  }

  // 导出便签数据
  async exportNotesAsJson() {
    // Renamed from exportNotesData
    try {
      this.showMessage("正在准备导出便签 (JSON)...", "info"); // Updated message

      // ... rest of the existing JSON export logic remains the same ...
      const response = await fetch("/api/notes");
      const data = await response.json();
      if (!data.success) throw new Error("获取便签数据失败");
      const exportData = {
        notes: data.notes,
        exportDate: new Date().toISOString(),
        version: "1.0",
      };
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date();
      const dateStr = date.toISOString().split("T")[0];
      a.download = `ai-notes-${dateStr}.json`; // Keep filename specific to notes
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showMessage("便签数据 (JSON) 导出成功！", "success"); // Updated message
      }, 100);
    } catch (error) {
      console.error("导出便签 JSON 失败:", error); // Updated message
      this.showMessage(`导出便签 JSON 失败: ${error.message}`, "error"); // Updated message
    }
  }

  // New function to handle database file export
  exportDatabaseFile() {
    try {
      this.showMessage("正在准备导出数据库文件...", "info");
      // Simply navigate to the backend endpoint. The browser will handle the download.
      window.location.href = "/api/database/export";
      // Optionally show a success message after a short delay,
      // although browser download indication might be sufficient.
      setTimeout(() => {
        this.showMessage("数据库文件下载已开始...", "success");
      }, 1500); // Adjust delay as needed
    } catch (error) {
      // This catch block might not be very useful for window.location navigation errors
      console.error("启动数据库导出失败:", error);
      this.showMessage(`启动数据库导出失败: ${error.message}`, "error");
    }
  }

  // Rename existing import function for clarity
  async importNotesFromJson(file) {
    // Renamed from importNotesData
    try {
      this.showMessage("正在读取 JSON 文件...", "info");
      console.log("[Import] Starting import process for file:", file.name); // Log start

      // 检查文件类型
      if (file.type !== "application/json" && !file.name.endsWith(".json")) {
        console.error("[Import] Invalid file type:", file.type || file.name); // Log error
        throw new Error("只能导入JSON格式的文件");
      }

      // 读取文件内容
      const reader = new FileReader();
      console.log("[Import] Reading file content..."); // Log reading start

      // 创建一个Promise包装FileReader
      const fileData = await new Promise((resolve, reject) => {
        reader.onload = (event) => {
          console.log("[Import] File read successfully."); // Log success
          resolve(event.target.result);
        };
        reader.onerror = (error) => {
          console.error("[Import] File reading failed:", error); // Log error
          reject(new Error("文件读取失败"));
        };
        reader.readAsText(file);
      });

      // 解析JSON
      let importedData;
      try {
        console.log("[Import] Parsing JSON data..."); // Log parsing start
        importedData = JSON.parse(fileData);
        console.log(
          "[Import] JSON parsed successfully. Found keys:",
          Object.keys(importedData)
        ); // Log parsed keys
      } catch (error) {
        console.error("[Import] JSON parsing failed:", error); // Log error
        throw new Error("文件格式无效，无法解析JSON");
      }

      // 验证导入数据的格式
      if (!importedData.notes || !Array.isArray(importedData.notes)) {
        console.error(
          "[Import] Invalid data format: 'notes' array not found or not an array.",
          importedData
        ); // Log error
        throw new Error("文件格式无效，缺少便签数据");
      }
      console.log(
        `[Import] Found ${importedData.notes.length} notes in the file.`
      ); // Log note count

      // 确认导入
      if (
        !confirm(
          `确定要导入 ${importedData.notes.length} 个便签吗？这将替换当前的所有便签数据。`
        )
      ) {
        console.log("[Import] Import cancelled by user."); // Log cancellation
        this.showMessage("导入已取消", "info");
        return;
      }

      // 发送数据到服务器进行导入
      console.log("[Import] Sending data to /api/notes/import..."); // Log API call start
      const response = await fetch("/api/notes/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: importedData.notes }), // Ensure payload is correct
      });
      console.log(
        "[Import] Received response from server:",
        response.status,
        response.statusText
      ); // Log response status

      const result = await response.json();
      console.log("[Import] Parsed server response:", result); // Log parsed response

      if (result.success) {
        console.log("[Import] Server reported success. Reloading notes..."); // Log success
        await this.loadNotes();
        this.showMessage(
          `成功导入 ${result.importedCount} 个便签！`,
          "success"
        );
      } else {
        console.error("[Import] Server reported failure:", result.message); // Log server error message
        throw new Error(result.message || "导入失败");
      }
    } catch (error) {
      // This catch block now catches errors from reading, parsing, validation, or API call
      console.error("导入便签 JSON 失败 (Overall Catch):", error); // Updated message
      this.showMessage(`导入便签 JSON 失败: ${error.message}`, "error"); // Updated message
    }
  }

  // 重置所有数据（包括AI设置和便签数据）
  async resetAllData() {
    try {
      // 1. 清除AI设置
      await this.clearAISettings();

      // 2. 清除便签数据
      const response = await fetch("/api/notes/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "重置便签数据失败");
      }

      // 3. 清空本地便签数组
      this.notes = [];

      // 4. 清空画布
      const noteContainer = document.getElementById("note-container");
      while (noteContainer && noteContainer.firstChild) {
        noteContainer.removeChild(noteContainer.firstChild);
      }

      return true;
    } catch (error) {
      console.error("重置所有数据失败:", error);
      throw error;
    }
  }

  // 添加新方法替代原来的initCustomModelSelect
  setupModelSelector() {
    const container = document.querySelector(".custom-select-container");
    if (!container) {
      console.warn("未找到自定义选择器容器");
      return; // 如果容器不存在，提前退出函数
    }

    console.log("自定义模型选择器初始化跳过");
    // 根据需要添加模型选择器初始化代码
  }

  // 生成新的邀请码
  async generateInviteCode() {
    if (!this.inviteApiAvailable) {
      this.showMessage("邀请码功能尚未实现", "error");
      return;
    }

    try {
      const response = await fetch("/api/invite-codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        // 添加新邀请码到列表
        this.inviteCodes.push(data.inviteCode);
        this.renderInviteCodes();
        this.showMessage("已生成新邀请码", "success");
      } else {
        this.showMessage(data.message || "生成邀请码失败", "error");
      }
    } catch (error) {
      console.error("生成邀请码出错:", error);
      this.showMessage("生成邀请码请求失败", "error");
    }
  }

  // 加载邀请码列表
  async loadInviteCodes() {
    if (!this.inviteApiAvailable) {
      return; // 如果API不可用，直接返回
    }

    try {
      const response = await fetch("/api/invite-codes");

      // 首先检查响应类型
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("邀请码API返回了非JSON响应:", contentType);
        this.inviteApiAvailable = false;
        this.updateInviteUIForUnavailableAPI();
        return;
      }

      const data = await response.json();

      if (data.success) {
        this.inviteCodes = data.inviteCodes || [];
        this.renderInviteCodes();
      } else {
        console.error("加载邀请码失败:", data.message);
      }
    } catch (error) {
      console.error("加载邀请码出错:", error);
      this.inviteApiAvailable = false;
      this.updateInviteUIForUnavailableAPI();
    }
  }

  // 更新UI以显示API不可用状态
  updateInviteUIForUnavailableAPI() {
    const container = document.querySelector(".invite-code-container");
    if (container) {
      container.innerHTML = `
        <div class="api-unavailable-message">
          <p>邀请码功能尚未在服务器端实现。</p>
          <p>请联系管理员完成后端API设置。</p>
        </div>
      `;
    }

    // 禁用生成按钮（如果存在）
    const generateBtn = document.getElementById("generate-invite-code");
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.title = "邀请码API尚未实现";
    }
  }

  // 删除邀请码
  async deleteInviteCode(code) {
    try {
      const response = await fetch(
        `/api/invite-codes/${encodeURIComponent(code)}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        // 从列表中移除
        this.inviteCodes = this.inviteCodes.filter((c) => c.code !== code);
        this.renderInviteCodes();
        this.showMessage("邀请码已删除", "success");
      } else {
        this.showMessage(data.message || "删除邀请码失败", "error");
      }
    } catch (error) {
      console.error("删除邀请码出错:", error);
      this.showMessage("删除邀请码请求失败", "error");
    }
  }

  // 渲染邀请码列表
  renderInviteCodes() {
    const container = document.getElementById("invite-codes-container");
    const emptyState = document.getElementById("no-invite-codes");

    if (!container) return;

    // 清空当前列表
    container.innerHTML = "";

    // 显示或隐藏空状态
    if (this.inviteCodes.length === 0) {
      if (emptyState) emptyState.style.display = "block";
      return;
    } else {
      if (emptyState) emptyState.style.display = "none";
    }

    // 添加邀请码项
    this.inviteCodes.forEach((inviteCode) => {
      const item = document.createElement("li");
      item.className = "invite-code-item";

      const code = document.createElement("div");
      code.className = "invite-code";
      code.textContent = inviteCode.code;

      const actions = document.createElement("div");
      actions.className = "invite-code-actions";

      const copyButton = document.createElement("button");
      copyButton.className = "invite-code-button copy-button";
      copyButton.innerHTML = '<i class="icon-copy">📋</i>';
      copyButton.title = "复制邀请码";
      copyButton.addEventListener("click", () =>
        this.copyInviteCode(inviteCode.code)
      );

      const deleteButton = document.createElement("button");
      deleteButton.className = "invite-code-button delete-button";
      deleteButton.innerHTML = '<i class="icon-delete">🗑️</i>';
      deleteButton.title = "删除邀请码";
      deleteButton.addEventListener("click", () =>
        this.deleteInviteCode(inviteCode.code)
      );

      actions.appendChild(copyButton);
      actions.appendChild(deleteButton);

      item.appendChild(code);
      item.appendChild(actions);

      container.appendChild(item);
    });
  }

  // 复制邀请码到剪贴板
  copyInviteCode(code) {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        this.showMessage("邀请码已复制到剪贴板", "success");
      })
      .catch((err) => {
        console.error("复制失败:", err);
        this.showMessage("复制邀请码失败", "error");
      });
  }
}

// 当文档加载完成后初始化应用
document.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});
