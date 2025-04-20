/**
 * 阅读模式模块
 * 负责管理阅读模式弹窗的显示、隐藏和内容管理
 */

import { renderMarkdown } from "../utils/MarkdownUtils.js";

class ReadingMode {
  constructor() {
    this.modal = document.getElementById("reading-modal");
    this.container = this.modal?.querySelector(".reading-container");
    this.readingNav = this.modal?.querySelector(".reading-nav");
    this.readingPanels = this.modal?.querySelector(".reading-panels");
    this.noNotesMessage = document.getElementById("no-notes-message");

    this.initializeEvents();

    // 缓存渲染后的便签内容，避免重复渲染
    this.contentCache = new Map();

    // 追踪当前显示的便签，实现懒加载
    this.currentNoteId = null;
    this.loadedNotes = new Set();
    this.allNotes = [];
  }

  /**
   * 初始化事件监听
   */
  initializeEvents() {
    // 设置关闭阅读模式弹窗的按钮
    const closeReadingBtn = document.getElementById("close-reading");
    if (closeReadingBtn) {
      closeReadingBtn.addEventListener("click", () => this.close());
    }

    // 点击阅读模式弹窗外部区域关闭
    if (this.modal) {
      this.modal.addEventListener("click", (e) => {
        if (e.target === this.modal) {
          this.close();
        }
      });
    }
  }

  /**
   * 打开阅读模式弹窗
   * @param {Array} notes - 便签元素数组
   */
  open(notes) {
    if (!this.modal || !this.container) return;

    // 保存所有便签引用
    this.allNotes = Array.from(notes);
    this.loadedNotes.clear();

    if (!notes || notes.length === 0) {
      // 显示无便签提示
      if (this.noNotesMessage) {
        this.noNotesMessage.style.display = "flex";
      }
    } else {
      // 隐藏无便签提示
      if (this.noNotesMessage) {
        this.noNotesMessage.style.display = "none";
      }

      // 清空导航和面板
      if (this.readingNav) {
        this.readingNav.innerHTML = "";
      }

      // 移除旧的内容面板（除了空白提示外）
      if (this.readingPanels) {
        const oldPanels = this.readingPanels.querySelectorAll(".reading-panel");
        oldPanels.forEach((panel) => panel.remove());
      }

      // 创建导航，但内容采用懒加载
      this.createNavigation(notes);

      // 初始加载第一个便签内容
      if (this.currentNoteId) {
        this.loadNoteContent(this.currentNoteId);
      }
    }

    // 先显示弹窗背景
    this.modal.classList.add("visible");

    // 重要：确保弹窗元素初始位置在底部
    this.container.style.transform = "translateY(100%)";

    // 等待一个短暂的延迟后执行滑入动画
    setTimeout(() => {
      this.container.style.transform = "translateY(0)";
    }, 50);
  }

  /**
   * 创建导航菜单
   * @param {Array} notes - 便签元素数组
   */
  createNavigation(notes) {
    if (!this.readingNav) return;

    let firstNoteId = null;

    notes.forEach((note, index) => {
      const noteId = note.id || `note-${index}`;
      if (index === 0) {
        firstNoteId = noteId;
        this.currentNoteId = noteId;
      }

      // 获取便签标题
      const noteTitle =
        note.querySelector(".note-title")?.textContent || `便签 ${index + 1}`;

      // 创建导航项
      const navItem = document.createElement("button");
      navItem.className = index === 0 ? "nav-item active" : "nav-item";
      navItem.setAttribute("data-note-id", noteId);
      navItem.textContent = noteTitle;
      navItem.addEventListener("click", () => this.switchTab(noteId));

      this.readingNav.appendChild(navItem);

      // 为第一个便签创建面板容器，但暂不填充内容
      if (index === 0) {
        this.createEmptyPanel(noteId);
      }
    });
  }

  /**
   * 创建空面板容器
   * @param {string} noteId - 便签ID
   */
  createEmptyPanel(noteId) {
    if (!this.readingPanels) return;

    // 创建面板容器
    const panel = document.createElement("div");
    panel.className = "reading-panel active";
    panel.id = `${noteId}-panel`;

    // 添加加载指示器
    const loading = document.createElement("div");
    loading.className = "reading-loading";
    loading.innerHTML = `<div class="loading-spinner"></div><p>加载中...</p>`;
    panel.appendChild(loading);

    // 添加内容容器
    const contentDiv = document.createElement("div");
    contentDiv.className = "reading-panel-content markdown-content";
    contentDiv.style.display = "none"; // 初始隐藏
    panel.appendChild(contentDiv);

    this.readingPanels.appendChild(panel);
  }

  /**
   * 按需加载便签内容
   * @param {string} noteId - 便签ID
   */
  loadNoteContent(noteId) {
    // 如果已经加载过这个便签内容，直接返回
    if (this.loadedNotes.has(noteId)) return;

    // 查找对应的便签元素
    let note = null;
    const index = parseInt(noteId.replace("note-", ""));

    // 首先尝试通过id精确匹配
    note = this.allNotes.find((n) => n.id === noteId);

    // 如果找不到，则尝试通过index匹配
    if (!note && !isNaN(index) && index >= 0 && index < this.allNotes.length) {
      note = this.allNotes[index];
    }

    // 最后尝试通过startsWith匹配
    if (!note) {
      note = this.allNotes.find(
        (n) =>
          (n.id && noteId.startsWith(n.id)) ||
          (n.id === undefined && noteId.startsWith("note-"))
      );
    }

    if (!note) {
      console.warn(`找不到便签: ${noteId}，将创建空面板`);

      // 即使找不到便签，也要显示一个空面板，避免用户体验中断
      const panel = document.getElementById(`${noteId}-panel`);
      if (panel) {
        const contentDiv = panel.querySelector(".reading-panel-content");
        const loadingDiv = panel.querySelector(".reading-loading");

        if (contentDiv && loadingDiv) {
          loadingDiv.style.display = "none";
          contentDiv.style.display = "block";
          contentDiv.innerHTML = "<p>无法加载此便签内容</p>";
          this.loadedNotes.add(noteId);
        }
      }
      return;
    }

    // 获取便签内容
    let noteContent = "";
    const contentElement = note.querySelector(".note-content");
    const previewElement = note.querySelector(".markdown-preview");

    // 尝试从不同来源获取便签内容
    if (contentElement) {
      noteContent = contentElement.value || contentElement.textContent || "";
    }

    if (previewElement && previewElement.style.display !== "none") {
      const originalMarkdown = contentElement?.getAttribute("data-markdown");
      if (originalMarkdown) {
        noteContent = originalMarkdown;
      } else if (!noteContent) {
        noteContent = previewElement.textContent || "";
      }
    }

    // 查找面板元素
    const panel = document.getElementById(`${noteId}-panel`);
    if (!panel) return;

    const contentDiv = panel.querySelector(".reading-panel-content");
    const loadingDiv = panel.querySelector(".reading-loading");

    if (!contentDiv) return;

    // 检查缓存中是否有渲染好的内容
    let renderedContent = "";
    if (this.contentCache.has(noteId)) {
      renderedContent = this.contentCache.get(noteId);
    } else {
      try {
        renderedContent = renderMarkdown(noteContent);

        // 将渲染后的内容添加到缓存
        this.contentCache.set(noteId, renderedContent);
      } catch (error) {
        console.error("渲染便签内容失败:", error);
        renderedContent = `<p>内容渲染失败</p><pre>${noteContent}</pre>`;
      }
    }

    // 更新面板内容
    contentDiv.innerHTML = renderedContent;

    // 隐藏加载指示器，显示内容
    if (loadingDiv) loadingDiv.style.display = "none";
    contentDiv.style.display = "block";

    // 标记为已加载
    this.loadedNotes.add(noteId);

    // 确保代码块中的语法高亮
    if (window.hljs) {
      try {
        contentDiv.querySelectorAll("pre code").forEach((block) => {
          window.hljs.highlightElement(block);
        });
      } catch (error) {
        console.error("代码高亮失败:", error);
      }
    }
  }

  /**
   * 切换阅读模式中的标签页
   * @param {string} noteId - 便签ID
   */
  switchTab(noteId) {
    this.currentNoteId = noteId;

    // 更新导航项的活动状态
    const navItems = document.querySelectorAll(".reading-nav .nav-item");
    navItems.forEach((item) => {
      if (item.getAttribute("data-note-id") === noteId) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // 检查该便签的面板是否存在
    let panel = document.getElementById(`${noteId}-panel`);

    // 如果面板不存在，创建新面板
    if (!panel) {
      this.createEmptyPanel(noteId);
      panel = document.getElementById(`${noteId}-panel`);
    }

    // 更新面板的显示状态
    const panels = document.querySelectorAll(".reading-panels .reading-panel");
    panels.forEach((p) => {
      if (p.id === `${noteId}-panel`) {
        p.classList.add("active");
      } else {
        p.classList.remove("active");
      }
    });

    // 按需加载内容
    this.loadNoteContent(noteId);
  }

  /**
   * 关闭阅读模式弹窗
   */
  close() {
    if (!this.modal || !this.container) return;

    // 先添加向下滑出的动画
    this.container.style.transform = "translateY(100%)";

    // 等待动画完成后移除 visible 类
    setTimeout(() => {
      this.modal.classList.remove("visible");

      // 清理缓存，如果缓存过大
      if (this.contentCache.size > 50) {
        this.contentCache.clear();
      }

      // 重置 transform，以便下次打开时能正常显示
      setTimeout(() => {
        this.container.style.transform = "";
      }, 100);
    }, 300); // 等待时间应与 CSS 中的过渡时间匹配
  }
}

export default ReadingMode;
