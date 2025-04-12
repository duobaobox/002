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

    // 导出数据
    const exportButton = document.querySelector(".export-button");
    exportButton.addEventListener("click", () => {
      // 导出便签数据功能
      this.exportNotesData();
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

    // 初始化自定义模型选择器
    this.initCustomModelSelect();

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
  }

  // 初始化自定义模型选择器
  initCustomModelSelect() {
    const container = document.querySelector(".custom-select-container");
    const input = document.getElementById("ai-model");
    const dropdown = document.getElementById("model-dropdown");
    const options = dropdown.querySelectorAll(".select-option");
    const toggleBtn = document.querySelector(".select-toggle");

    // 点击下拉按钮切换下拉列表显示状态
    toggleBtn.addEventListener("click", () => {
      container.classList.toggle("open");
      if (container.classList.contains("open")) {
        // 高亮当前选中的选项
        const currentValue = input.value;
        options.forEach((option) => {
          if (option.dataset.value === currentValue) {
            option.classList.add("selected");
          } else {
            option.classList.remove("selected");
          }
        });
      }
    });

    // 点击选项时更新输入框值
    options.forEach((option) => {
      option.addEventListener("click", () => {
        input.value = option.dataset.value;
        options.forEach((opt) => opt.classList.remove("selected"));
        option.classList.add("selected");
        container.classList.remove("open");
      });
    });

    // 点击输入框也触发下拉列表
    input.addEventListener("click", () => {
      container.classList.toggle("open");
      if (container.classList.contains("open")) {
        const currentValue = input.value;
        options.forEach((option) => {
          if (option.dataset.value === currentValue) {
            option.classList.add("selected");
          } else {
            option.classList.remove("selected");
          }
        });
      }
    });

    // 点击页面其他区域关闭下拉列表
    document.addEventListener("click", (e) => {
      if (!container.contains(e.target)) {
        container.classList.remove("open");
      }
    });

    // 输入内容变化时查找匹配项
    input.addEventListener("input", () => {
      const value = input.value.toLowerCase();
      let hasExactMatch = false;

      options.forEach((option) => {
        const optionValue = option.dataset.value.toLowerCase();
        if (optionValue === value) {
          hasExactMatch = true;
        }
      });

      // 如果输入框有值且没有完全匹配，保持下拉菜单打开
      if (value && !hasExactMatch) {
        container.classList.add("open");
      }
    });
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
  async exportNotesData() {
    try {
      // 显示正在导出的消息
      this.showMessage("正在准备导出数据...", "info");

      // 从服务器获取最新的便签数据
      const response = await fetch("/api/notes");
      const data = await response.json();

      if (!data.success) {
        throw new Error("获取便签数据失败");
      }

      // 准备导出的数据
      const exportData = {
        notes: data.notes,
        exportDate: new Date().toISOString(),
        version: "1.0",
      };

      // 转换为JSON字符串
      const jsonString = JSON.stringify(exportData, null, 2);

      // 创建Blob对象
      const blob = new Blob([jsonString], { type: "application/json" });

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // 设置文件名 (格式: ai-notes-yyyy-mm-dd.json)
      const date = new Date();
      const dateStr = date.toISOString().split("T")[0]; // 提取yyyy-mm-dd部分
      a.download = `ai-notes-${dateStr}.json`;

      // 添加到文档并触发点击
      document.body.appendChild(a);
      a.click();

      // 清理
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showMessage("数据导出成功！", "success");
      }, 100);
    } catch (error) {
      console.error("导出便签数据失败:", error);
      this.showMessage(`导出失败: ${error.message}`, "error");
    }
  }

  // 导入便签数据
  async importNotesData(file) {
    try {
      // 显示正在导入的消息
      this.showMessage("正在读取导入文件...", "info");

      // 检查文件类型
      if (file.type !== "application/json" && !file.name.endsWith(".json")) {
        throw new Error("只能导入JSON格式的文件");
      }

      // 读取文件内容
      const reader = new FileReader();

      // 创建一个Promise包装FileReader
      const fileData = await new Promise((resolve, reject) => {
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (error) => reject(new Error("文件读取失败"));
        reader.readAsText(file);
      });

      // 解析JSON
      let importedData;
      try {
        importedData = JSON.parse(fileData);
      } catch (error) {
        throw new Error("文件格式无效，无法解析JSON");
      }

      // 验证导入数据的格式
      if (!importedData.notes || !Array.isArray(importedData.notes)) {
        throw new Error("文件格式无效，缺少便签数据");
      }

      // 确认导入
      if (
        !confirm(
          `确定要导入 ${importedData.notes.length} 个便签吗？这将替换当前的所有便签数据。`
        )
      ) {
        this.showMessage("导入已取消", "info");
        return;
      }

      // 发送数据到服务器进行导入
      const response = await fetch("/api/notes/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: importedData.notes }),
      });

      const result = await response.json();

      if (result.success) {
        // 重新加载便签
        await this.loadNotes();
        this.showMessage(
          `成功导入 ${result.importedCount} 个便签！`,
          "success"
        );
      } else {
        throw new Error(result.message || "导入失败");
      }
    } catch (error) {
      console.error("导入便签数据失败:", error);
      this.showMessage(`导入失败: ${error.message}`, "error");
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
}

// 当文档加载完成后初始化应用
document.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});
