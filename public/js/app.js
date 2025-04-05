class App {
  constructor() {
    this.notes = [];
    this.canvas = new Canvas();
    this.nextId = 1;

    // 从服务器加载便签数据
    this.loadNotes();

    this.initEventListeners();
    this.updateButtonVisibility();
    this.initWebDrawer();
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
  }

  // 初始化网页抽屉功能
  initWebDrawer() {
    const webButton = document.getElementById("web-button");
    const webDrawer = document.getElementById("web-drawer");
    const drawerClose = document.getElementById("drawer-close");
    const drawerOverlay = document.getElementById("drawer-overlay");
    const dragIndicator = document.querySelector(".drawer-drag-indicator");
    const addTabButton = document.getElementById("add-tab");

    // 打开抽屉
    webButton.addEventListener("click", () => {
      webDrawer.classList.add("open");
      drawerOverlay.classList.add("visible");
      document.body.style.overflow = "hidden"; // 防止背景滚动
    });

    // 关闭抽屉的两种方式
    drawerClose.addEventListener("click", this.closeDrawer);
    drawerOverlay.addEventListener("click", this.closeDrawer);

    // 初始化标签页功能
    this.initTabsSystem();

    // 添加新标签页
    addTabButton.addEventListener("click", () => {
      this.addNewTab();
    });

    // 支持拖动关闭
    let startY = 0;
    let currentY = 0;

    // 拖动开始
    dragIndicator.addEventListener("touchstart", (e) => {
      startY = e.touches[0].clientY;
    });
    dragIndicator.addEventListener("mousedown", (e) => {
      startY = e.clientY;
      document.addEventListener("mousemove", handleDrag);
      document.addEventListener("mouseup", endDrag);
    });

    // 拖动进行中
    const handleDrag = (e) => {
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      currentY = clientY - startY;

      // 只允许向下拖动
      if (currentY > 0) {
        webDrawer.style.bottom = `-${currentY}px`;
      }
    };

    dragIndicator.addEventListener("touchmove", handleDrag);

    // 拖动结束
    const endDrag = (e) => {
      document.removeEventListener("mousemove", handleDrag);
      document.removeEventListener("mouseup", endDrag);

      // 如果拖动超过150px，则关闭抽屉
      if (currentY > 150) {
        this.closeDrawer();
      } else {
        // 否则回到原位
        webDrawer.style.bottom = "0";
      }
    };

    dragIndicator.addEventListener("touchend", endDrag);

    // 按ESC键关闭抽屉
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && webDrawer.classList.contains("open")) {
        this.closeDrawer();
      }
    });
  }

  // 初始化标签页系统
  initTabsSystem() {
    // 为所有标签添加点击事件
    document.querySelectorAll(".tab").forEach((tab) => {
      // 标签点击事件 - 切换标签
      tab.addEventListener("click", (e) => {
        // 忽略关闭按钮点击
        if (e.target.classList.contains("tab-close")) return;

        const tabId = tab.getAttribute("data-tab-id");
        this.activateTab(tabId);
      });

      // 标签关闭按钮点击事件
      const closeBtn = tab.querySelector(".tab-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const tabId = tab.getAttribute("data-tab-id");
          this.closeTab(tabId);
        });
      }
    });
  }

  // 激活特定标签
  activateTab(tabId) {
    // 移除所有标签和内容区域的active类
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".iframe-container")
      .forEach((c) => c.classList.remove("active"));

    // 激活选中的标签和内容
    document
      .querySelector(`.tab[data-tab-id="${tabId}"]`)
      ?.classList.add("active");
    document.getElementById(tabId)?.classList.add("active");
  }

  // 关闭标签页
  closeTab(tabId) {
    const tab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
    const container = document.getElementById(tabId);

    // 如果是当前激活的标签，激活相邻标签
    if (tab.classList.contains("active")) {
      const nextTab = tab.nextElementSibling;
      const prevTab = tab.previousElementSibling;

      if (nextTab && !nextTab.classList.contains("add-tab")) {
        this.activateTab(nextTab.getAttribute("data-tab-id"));
      } else if (prevTab) {
        this.activateTab(prevTab.getAttribute("data-tab-id"));
      }
    }

    // 移除标签和内容
    tab.remove();
    container?.remove();

    // 如果没有标签了，自动添加一个新标签
    if (document.querySelectorAll(".tab").length === 0) {
      this.addNewTab("https://kimi.moonshot.cn/", "Kimi AI", "🤖");
    }
  }

  // 添加新标签
  addNewTab(url = "https://kimi.moonshot.cn/", title = "Kimi AI", icon = "🤖") {
    // 生成唯一ID
    const tabCount = document.querySelectorAll(".tab").length;
    const tabId = `tab-${tabCount + 1}`;

    // 创建新标签
    const tabsContainer = document.querySelector(".tabs-container");
    const addTabButton = document.getElementById("add-tab");

    const newTab = document.createElement("button");
    newTab.className = "tab";
    newTab.setAttribute("data-tab-id", tabId);
    newTab.innerHTML = `
      <span class="tab-icon">${icon}</span>
      ${title}
      <span class="tab-close">&times;</span>
    `;

    // 插入新标签
    tabsContainer.insertBefore(newTab, addTabButton);

    // 创建新内容
    const newContent = document.createElement("div");
    newContent.className = "iframe-container";
    newContent.id = tabId;
    newContent.innerHTML = `
      <iframe class="web-frame" src="${url}" title="${title}" loading="lazy"
        onerror="this.srcdoc='<div style=\"padding:20px;font-family:sans-serif;color:#333;text-align:center;\"><h2>连接失败</h2><p>无法加载 ${title} 网页，可能是由于内容安全策略限制。</p><p><a href=\"${url}\" target=\"_blank\" style=\"color:#1a73e8;text-decoration:none;\">在新窗口中打开</a></p></div>'"></iframe>
    `;

    // 添加内容到抽屉
    document.querySelector(".drawer-content").appendChild(newContent);

    // 添加标签事件
    newTab.addEventListener("click", (e) => {
      if (!e.target.classList.contains("tab-close")) {
        this.activateTab(tabId);
      }
    });

    // 添加关闭按钮事件
    newTab.querySelector(".tab-close").addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeTab(tabId);
    });

    // 激活新标签
    this.activateTab(tabId);
  }

  // 关闭抽屉方法
  closeDrawer() {
    const webDrawer = document.getElementById("web-drawer");
    const drawerOverlay = document.getElementById("drawer-overlay");

    webDrawer.style.bottom = ""; // 重置内联样式
    webDrawer.classList.remove("open");
    drawerOverlay.classList.remove("visible");
    document.body.style.overflow = ""; // 恢复背景滚动
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

  addNote(text = "", x = 50, y = 50, title = "") {
    // 添加默认标题参数
    const note = new Note(this.nextId++, text, x, y, title);
    this.notes.push(note);
    return note;
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
    const originalText = generateButton.textContent;

    if (!prompt) {
      // 使用更友好的提示方式
      promptElement.focus();
      promptElement.placeholder = "请输入内容后再生成便笺...";
      setTimeout(() => {
        promptElement.placeholder = "请输入文本";
      }, 2000);
      return;
    }

    try {
      // 在发送请求前先检查AI配置状态
      const configCheckResponse = await fetch("/api/test");
      const configCheckData = await configCheckResponse.json();

      if (!configCheckData.success) {
        // 如果AI服务未配置，显示友好的错误提示并引导用户设置
        this.showMessage(
          configCheckData.message || "AI服务尚未配置，请先在设置中完成配置",
          "warning"
        );

        // 打开设置面板并切换到AI设置选项卡
        document.getElementById("settings-modal").classList.add("visible");
        document
          .querySelectorAll(".nav-item")
          .forEach((item) => item.classList.remove("active"));
        document
          .querySelector(".nav-item[data-tab='ai']")
          .classList.add("active");
        document
          .querySelectorAll(".settings-panel")
          .forEach((panel) => panel.classList.remove("active"));
        document.getElementById("ai-panel").classList.add("active");

        return;
      }

      // 禁用按钮和输入框
      generateButton.disabled = true;
      promptElement.disabled = true; // 新增：禁用文本输入框
      generateButton.textContent = "生成中...";

      // 首先创建一个空便签，准备接收流式内容
      const { noteElement, noteId } = createEmptyAiNote();

      // 设置便签标题 - 修改为使用正确的标题元素
      const titleElem = noteElement.querySelector(".note-title");
      if (titleElem) {
        titleElem.textContent =
          prompt.substring(0, 20) + (prompt.length > 20 ? "... " : "");
      }

      // 随机选择便签位置和颜色
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

      // 处理API密钥验证中的情况
      if (!response.ok && response.status === 202 && data.needVerification) {
        // 显示验证中的状态
        if (noteElement) {
          const contentElement = noteElement.querySelector(".note-content");
          if (contentElement) {
            contentElement.innerHTML =
              "<p><i>正在验证API连接，请稍候...</i></p>";
          }
        }

        // 短暂延迟后重试
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 移除临时便签
        noteElement.remove();

        // 提示用户
        this.showMessage("API正在初始化中，请稍后再试", "info");

        return;
      }

      if (!response.ok) {
        console.error("服务器响应错误:", data);
        throw new Error(data.message || `服务器响应错误: ${response.status}`);
      }

      if (data.success && data.text) {
        // 显示打字机效果
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
          }),
        });

        const noteData = await noteResponse.json();

        if (noteData.success && noteData.note) {
          console.log("AI便签已添加，ID:", noteData.note.id);

          // 移除临时便签
          noteElement.remove();

          // 创建正式的Note实例替代临时便签
          const note = new Note(
            noteData.note.id,
            data.text,
            noteData.note.x || x,
            noteData.note.y || y,
            noteData.note.title || finalTitle,
            colorClass
          );

          // 确保新创建的便签在最上层
          if (note.element) {
            note.element.style.zIndex = getHighestZIndex() + 1;
          }

          // 添加到notes数组
          this.notes.push(note);
        } else {
          console.error("创建AI便签失败:", noteData);
          throw new Error("无法创建AI便签");
        }

        // 清空输入框
        promptElement.value = "";
        this.updateButtonVisibility(); // 更新按钮状态
      } else {
        throw new Error("服务器返回了无效的数据");
      }
    } catch (error) {
      console.error("生成AI便签出错:", error);
      // 显示更友好的错误提示
      const errorMsg = document.createElement("div");
      errorMsg.className = "error-message";
      errorMsg.textContent = `生成失败: ${error.message}`;
      document.body.appendChild(errorMsg);

      setTimeout(() => {
        errorMsg.classList.add("show");
        setTimeout(() => {
          errorMsg.classList.remove("show");
          setTimeout(() => {
            document.body.removeChild(errorMsg);
          }, 300);
        }, 3000);
      }, 10);
    } finally {
      // 恢复按钮和输入框状态
      generateButton.disabled = false;
      promptElement.disabled = false; // 新增：恢复文本输入框
      generateButton.textContent = originalText;
    }
  }

  // 添加打字机效果方法
  async displayTypingEffect(noteElement, fullText) {
    return new Promise((resolve) => {
      let currentContent = "";
      let charIndex = 0;

      // 设置内容区域为Markdown
      const contentElement = noteElement.querySelector(".note-content");
      const previewElement = noteElement.querySelector(".markdown-preview");
      contentElement.classList.add("markdown");

      // 确保预览区域就绪
      if (previewElement) {
        previewElement.style.display = "block";
        contentElement.style.display = "none";
      }

      // 模拟打字效果
      const typingInterval = setInterval(() => {
        if (charIndex < fullText.length) {
          currentContent += fullText.charAt(charIndex);
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
    // const settingsButton = document.getElementById("settings-button"); // 删除这行
    const settingsModal = document.getElementById("settings-modal");
    const closeSettings = document.getElementById("close-settings");
    const saveButton = document.querySelector(".save-button");
    const resetButton = document.querySelector(".reset-button");
    const navItems = document.querySelectorAll(".nav-item");
    const colorOptions = document.querySelectorAll(".color-option");
    const themeOptions = document.querySelectorAll(".theme-option");
    const rangeInputs = document.querySelectorAll('input[type="range"]');

    // 删除打开设置弹窗的事件监听（现在在canvas.js中处理）
    // settingsButton.addEventListener("click", () => {
    //   settingsModal.classList.add("visible");
    // });

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

    // 范围滑块值显示更新
    rangeInputs.forEach((input) => {
      const valueDisplay = input.nextElementSibling;

      // 初始化显示值
      if (input.id === "font-size") {
        valueDisplay.textContent = `${input.value}px`;
      } else {
        valueDisplay.textContent = input.value;
      }

      // 滑动时更新值
      input.addEventListener("input", () => {
        if (input.id === "font-size") {
          valueDisplay.textContent = `${input.value}px`;
        } else {
          valueDisplay.textContent = input.value;
        }
      });
    });

    // 保存设置 (目前仅关闭弹窗，实际保存功能待实现)
    saveButton.addEventListener("click", () => {
      // 在此处添加保存设置的逻辑
      settingsModal.classList.remove("visible");
    });

    // 重置设置
    resetButton.addEventListener("click", () => {
      if (confirm("确定要重置所有设置吗？这将清除所有AI配置信息。")) {
        this.clearAISettings()
          .then((success) => {
            if (success) {
              // 清空表单值
              document.getElementById("ai-api-key").value = "";
              document.getElementById("ai-base-url").value = "";
              document.getElementById("ai-model").value = "";
              document.getElementById("ai-max-tokens").value = "800";
              document.getElementById("ai-temperature").value = "0.7";

              // 更新底部栏的AI模型显示
              const aiModelDisplay = document.querySelector(".ai-model");
              if (aiModelDisplay) {
                aiModelDisplay.textContent = "未设置";
              }

              this.showMessage("所有AI设置已重置", "success");
            }
          })
          .catch((error) => {
            console.error("重置设置失败:", error);
            this.showMessage(`重置失败: ${error.message}`, "error");
          });
      }
    });

    // 导出数据
    const exportButton = document.querySelector(".export-button");
    exportButton.addEventListener("click", () => {
      // 在此处添加导出数据的逻辑
      alert("导出功能将在后续版本实现");
    });

    // 导入数据
    const importFile = document.getElementById("import-file");
    importFile.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        // 在此处添加导入数据的逻辑
        alert("导入功能将在后续版本实现");
      }
    });

    // 加载AI设置
    this.loadAISettings();

    // 测试AI连接
    const testConnectionButton = document.getElementById("test-ai-connection");
    if (testConnectionButton) {
      testConnectionButton.addEventListener("click", () => {
        this.testAIConnection();
      });
    }

    // 清除AI设置按钮
    const clearAiSettingsButton = document.getElementById("clear-ai-settings");
    if (clearAiSettingsButton) {
      clearAiSettingsButton.addEventListener("click", () => {
        if (confirm("确定要清除所有AI设置吗？这将删除API密钥和其他配置。")) {
          this.clearAISettings()
            .then((success) => {
              if (success) {
                // 清空表单值
                document.getElementById("ai-api-key").value = "";
                document.getElementById("ai-base-url").value = "";
                document.getElementById("ai-model").value = "";
                document.getElementById("ai-max-tokens").value = "800";
                document.getElementById("ai-temperature").value = "0.7";

                // 隐藏状态显示
                const statusElem = document.getElementById("connection-status");
                statusElem.style.display = "none";

                // 更新底部栏的AI模型显示
                const aiModelDisplay = document.querySelector(".ai-model");
                if (aiModelDisplay) {
                  aiModelDisplay.textContent = "未设置";
                }

                this.showMessage("所有AI设置已清除", "info");
              }
            })
            .catch((error) => {
              console.error("清除AI设置失败:", error);
              this.showMessage(`清除失败: ${error.message}`, "error");
            });
        }
      });
    }

    // 保存设置
    saveButton.addEventListener("click", () => {
      // 保存AI设置
      this.saveAISettings()
        .then((success) => {
          if (success) {
            settingsModal.classList.remove("visible");
            this.showMessage("设置已保存", "success");
          }
        })
        .catch((error) => {
          console.error("保存设置失败:", error);
          this.showMessage(`保存失败: ${error.message}`, "error");
        });
    });

    // 设置API密钥可见性切换
    const toggleApiKeyBtn = document.getElementById("toggle-api-key");
    const apiKeyInput = document.getElementById("ai-api-key");

    if (toggleApiKeyBtn && apiKeyInput) {
      apiKeyInput.type = "password"; // 默认隐藏

      toggleApiKeyBtn.addEventListener("click", () => {
        if (apiKeyInput.type === "password") {
          apiKeyInput.type = "text"; // 显示密钥
          toggleApiKeyBtn.title = "隐藏密钥";
          toggleApiKeyBtn.querySelector(".eye-icon").style.opacity = "1";
        } else {
          apiKeyInput.type = "password"; // 隐藏密钥
          toggleApiKeyBtn.title = "显示密钥";
          toggleApiKeyBtn.querySelector(".eye-icon").style.opacity = "0.7";
        }
      });
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
            // 提取模型名称的简短版本，去掉前缀如"gpt-"
            const modelName = settings.model.split("-").pop() || settings.model;
            aiModelDisplay.textContent = modelName;
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
        // 提取模型名称的简短版本，去掉前缀如"gpt-"
        const modelName = model.split("-").pop() || model;
        aiModelDisplay.textContent = modelName;
      }

      this.showMessage("AI设置已成功保存", "success");
      return true;
    } catch (error) {
      console.error("保存AI设置失败:", error);
      throw error;
    }
  }

  // 测试AI连接
  async testAIConnection() {
    const statusElem = document.getElementById("connection-status");
    statusElem.style.display = "block";
    statusElem.className = "ai-test-status info";
    statusElem.textContent = "正在测试API连接...";

    try {
      const response = await fetch("/api/test");
      const data = await response.json();

      if (data.success) {
        statusElem.className = "ai-test-status success";
        statusElem.textContent = "✓ 连接成功！API密钥有效。";
      } else {
        statusElem.className = "ai-test-status error";
        statusElem.textContent = `✗ 连接失败: ${data.message || "未知错误"}`;

        // 如果有更详细的配置状态信息
        if (data.configStatus) {
          const details = [];
          if (!data.configStatus.hasApiKey) details.push("缺少API密钥");
          if (!data.configStatus.hasBaseUrl) details.push("缺少基础URL");
          if (!data.configStatus.hasModel) details.push("缺少模型设置");

          if (details.length > 0) {
            statusElem.textContent += ` (${details.join(", ")})`;
          }
        }
      }
    } catch (error) {
      statusElem.className = "ai-test-status error";
      statusElem.textContent = `✗ 请求失败: ${error.message}`;
    }
  }

  // 显示消息提示
  showMessage(message, type = "info") {
    const msgElement = document.createElement("div");
    msgElement.className = `message message-${type}`;
    msgElement.textContent = message;
    document.body.appendChild(msgElement);

    // 显示动画
    setTimeout(() => {
      msgElement.classList.add("show");
      setTimeout(() => {
        msgElement.classList.remove("show");
        setTimeout(() => {
          document.body.removeChild(msgElement);
        }, 300);
      }, 3000);
    }, 10);
  }
}

// 当文档加载完成后初始化应用
document.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});
