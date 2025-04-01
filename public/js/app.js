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

      if (data.success && Array.isArray(data.notes)) {
        console.log(`正在从服务器加载 ${data.notes.length} 个便签...`);

        // 设置下一个ID
        this.nextId = data.nextId || 1;

        // 检查 Note 类是否已定义
        if (typeof Note === "undefined") {
          console.error("错误: Note 类未定义，无法加载便签");
          return;
        }

        // 创建便签
        data.notes.forEach((noteData) => {
          const note = new Note(
            noteData.id,
            noteData.text || "",
            noteData.x || 50,
            noteData.y || 50,
            noteData.title || `便签 ${noteData.id}`,
            noteData.colorClass
          );

          // 设置自定义尺寸
          if (noteData.width && noteData.height && note.element) {
            note.element.style.width = `${noteData.width}px`;
            note.element.style.height = `${noteData.height}px`;

            // 更新滚动条
            const textarea = note.element.querySelector(".note-content");
            const scrollbarThumb =
              note.element.querySelector(".scrollbar-thumb");
            if (textarea && scrollbarThumb) {
              note.updateScrollbar(textarea, scrollbarThumb);
            }
          }

          // 有内容的便签应默认显示为预览模式
          if (noteData.text && noteData.text.trim() !== "") {
            note.editMode = false;
            const textarea = note.element.querySelector(".note-content");
            const preview = note.element.querySelector(".markdown-preview");
            if (textarea && preview) {
              note.toggleEditPreviewMode(textarea, preview);
            }
          }

          this.notes.push(note);
        });

        console.log(`成功加载了 ${this.notes.length} 个便签`);
      } else {
        console.error("无法加载便签:", data);
      }
    } catch (error) {
      console.error("加载便签时出错:", error);
    }
  }

  // 在服务器上更新便签
  async updateNoteOnServer(id) {
    try {
      const note = this.notes.find((n) => n.id === id);
      if (!note || !note.element) return;

      const noteData = {
        text: note.text,
        x: parseInt(note.element.style.left),
        y: parseInt(note.element.style.top),
        title: note.title,
        width: note.element.offsetWidth,
        height: note.element.offsetHeight,
        colorClass: note.colorClass, // 添加颜色类
      };

      const response = await fetch(`/api/notes/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(noteData),
      });

      const data = await response.json();

      if (!data.success) {
        console.error("更新便签失败:", data);
      }
    } catch (error) {
      console.error("更新便签时出错:", error);
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
      // 禁用按钮并显示加载状态
      generateButton.disabled = true;
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
      // 恢复按钮状态
      generateButton.disabled = false;
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
}

// 当文档加载完成后初始化应用
document.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});
