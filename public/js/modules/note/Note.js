/**
 * Note 类模块
 * 便签的核心实现类
 */

import { getHighestZIndex, dispatchCustomEvent } from "../utils/DOMUtils.js";
import { renderMarkdown, updateScrollbar } from "../utils/MarkdownUtils.js";
import {
  setupDragEvents,
  setupResizeEvents,
  setupResizeObserver,
} from "./NoteEvents.js";
import {
  toggleEditPreviewMode,
  updateEditHintVisibility,
  editTitle,
} from "./NoteUI.js";
import nodeConnectionManager from "../utils/NodeConnectionManager.js";

/**
 * 便签类 - 负责创建和管理便签实例
 */
export class Note {
  /**
   * 创建一个新便签
   * @param {number} id - 便签ID
   * @param {string} text - 便签文本内容
   * @param {number} x - 便签X坐标
   * @param {number} y - 便签Y坐标
   * @param {string} title - 便签标题
   * @param {string} colorClass - 便签颜色类名
   */
  constructor(id, text = "", x = 50, y = 50, title = "", colorClass = null) {
    this.id = id;
    this.text = text;

    // 将传入的坐标视为画布坐标系中的位置
    this.x = x;
    this.y = y;

    this.title = title || `便签 ${id}`; // 默认标题为"便签+id"
    this.element = null;
    this.isDragging = false;
    this.isResizing = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.resizeStartWidth = 0;
    this.resizeStartHeight = 0;
    this.resizeStartX = 0;
    this.resizeStartY = 0;
    // 如果文本不为空，默认设置为预览模式
    this.editMode = text.trim() === "";
    this.updateTimer = null; // 用于防抖渲染
    this.resizeTimer = null; // 用于resize操作的防抖

    // 节点连接相关属性
    this.isSelected = false; // 是否被选中
    this.isConnected = false; // 是否已连接

    // 保存便签的颜色类名
    this.colorClass = colorClass;

    // 便签颜色类名
    this.colorClasses = [
      "note-yellow",
      "note-blue",
      "note-green",
      "note-pink",
      "note-purple",
    ];

    this.create();
  }

  /**
   * 创建便签DOM元素
   * @returns {HTMLElement} 创建的便签元素
   */
  create() {
    // 创建便签元素
    const note = document.createElement("div");

    // 使用保存的颜色类或随机生成一个
    const colorClass = this.colorClass || this.getRandomColorClass();
    // 保存选择的颜色类
    this.colorClass = colorClass;

    note.className = "note " + colorClass;

    // 设置便签位置 - 直接使用保存的画布坐标
    note.style.left = `${this.x}px`;
    note.style.top = `${this.y}px`;

    // 设置便签默认大小
    const DEFAULT_NOTE_SIZE = {
      width: 320,
      height: 350,
    };

    note.style.width = `${DEFAULT_NOTE_SIZE.width}px`;
    note.style.height = `${DEFAULT_NOTE_SIZE.height}px`;

    // 先设置 this.element，这样在后续创建过程中就可以引用
    this.element = note;

    // 创建便签头部、内容等UI元素
    this.createNoteHeader(note);
    this.createNoteBody(note);

    // 设置拖动和缩放事件
    setupDragEvents(note, note.querySelector(".note-header"), this);
    setupResizeEvents(note, note.querySelector(".note-resize-handle"), this);

    // 检查note-container是否存在，不存在则创建
    let noteContainer = document.getElementById("note-container");
    if (!noteContainer) {
      console.log("创建便签时未找到容器，尝试创建新容器");

      // 获取画布元素
      const canvas = document.getElementById("note-canvas");
      if (canvas) {
        // 创建便签容器
        noteContainer = document.createElement("div");
        noteContainer.id = "note-container";
        noteContainer.className = "note-container";

        // 应用与Canvas.js中相同的样式
        noteContainer.style.position = "absolute";
        noteContainer.style.width = "100%";
        noteContainer.style.height = "100%";
        noteContainer.style.top = "0";
        noteContainer.style.left = "0";
        noteContainer.style.transformOrigin = "0 0";

        // 添加到画布
        canvas.appendChild(noteContainer);
        console.log("已创建新的便签容器");
      } else {
        console.error("无法找到note-canvas元素，便签无法添加到DOM");
        return note; // 返回便签但不添加到DOM
      }
    }

    // 现在安全地添加便签到容器
    noteContainer.appendChild(note);

    // 设置初始z-index
    note.style.zIndex = getHighestZIndex() + 1;

    // 添加ResizeObserver监听便签大小变化
    setupResizeObserver(note, this);

    // 初始切换模式 - 有内容的便签默认显示预览模式
    this.toggleEditPreviewMode();

    // 初始化滚动条
    const scrollbarThumb = note.querySelector(".scrollbar-thumb");
    const activeElement = this.editMode
      ? note.querySelector(".note-content")
      : note.querySelector(".markdown-preview");
    updateScrollbar(activeElement, scrollbarThumb);

    // 聚焦到文本区域 (仅对空白便签)
    if (this.text === "") {
      setTimeout(() => {
        const contentElement = note.querySelector(".note-content");
        if (contentElement) contentElement.focus();
      }, 0);
    }

    return note;
  }

  /**
   * 创建便签头部
   * @param {HTMLElement} note - 便签元素
   */
  createNoteHeader(note) {
    const header = document.createElement("div");
    header.className = "note-header";

    // 创建便签标题
    const title = document.createElement("div");
    title.className = "note-title";
    title.textContent = this.title;
    title.setAttribute("title", "双击编辑标题");

    // 添加双击编辑标题功能
    title.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this.editNoteTitle(title);
    });

    // 创建关闭按钮
    const closeBtn = document.createElement("div");
    closeBtn.className = "note-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.remove();
    });

    // 组装头部
    header.appendChild(title);
    header.appendChild(closeBtn);
    note.appendChild(header);
  }

  /**
   * 创建便签主体
   * @param {HTMLElement} note - 便签元素
   */
  createNoteBody(note) {
    // 创建内容容器
    const body = document.createElement("div");
    body.className = "note-body";

    // 创建文本区域
    const textarea = document.createElement("textarea");
    textarea.className = "note-content";
    textarea.value = this.text;
    textarea.placeholder = "支持 Markdown 语法...";

    // 创建 Markdown 预览区域
    const markdownPreview = document.createElement("div");
    markdownPreview.className = "markdown-preview";

    // 创建编辑提示元素
    const editHint = document.createElement("div");
    editHint.className = "edit-hint";
    editHint.textContent = "双击编辑";
    editHint.style.position = "absolute";
    editHint.style.right = "10px";
    editHint.style.bottom = "10px";
    editHint.style.fontSize = "11px";
    editHint.style.color = "rgba(0, 0, 0, 0.3)";
    editHint.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
    editHint.style.padding = "2px 5px";
    editHint.style.borderRadius = "3px";
    editHint.style.opacity = "0";
    editHint.style.transition = "opacity 0.3s";
    editHint.style.pointerEvents = "none";
    editHint.style.zIndex = "100";

    // 设置便签内容的事件监听
    this.setupContentEvents(textarea, markdownPreview, editHint);

    // 创建自定义滚动条
    const scrollbarContainer = document.createElement("div");
    scrollbarContainer.className = "custom-scrollbar";

    const scrollbarThumb = document.createElement("div");
    scrollbarThumb.className = "scrollbar-thumb";
    scrollbarContainer.appendChild(scrollbarThumb);

    // 创建调整大小控件
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "note-resize-handle";

    // 创建节点按钮
    const nodeButton = document.createElement("div");
    nodeButton.className = "note-node-button";
    nodeButton.title = "连接到底部插槽";
    nodeButton.addEventListener("click", (e) => {
      e.stopPropagation(); // 阻止事件冒泡
      this.toggleConnection();
    });

    // 组装便签
    body.appendChild(textarea);
    body.appendChild(markdownPreview);
    body.appendChild(scrollbarContainer);
    body.appendChild(editHint);
    note.appendChild(body);
    note.appendChild(resizeHandle);
    note.appendChild(nodeButton);

    // 添加点击事件，确保点击时将便签置于最前
    this.setupNoteClickEvent(note);
  }

  /**
   * 设置便签内容区域的事件监听
   * @param {HTMLElement} textarea - 文本区域元素
   * @param {HTMLElement} markdownPreview - Markdown预览区域元素
   * @param {HTMLElement} editHint - 编辑提示元素
   */
  setupContentEvents(textarea, markdownPreview, editHint) {
    // 添加安全检查，确保元素存在
    if (!textarea || !markdownPreview || !editHint || !this.element) {
      console.error("设置事件监听失败: 一个或多个必要元素不存在", {
        hasTextarea: !!textarea,
        hasPreview: !!markdownPreview,
        hasEditHint: !!editHint,
        hasElement: !!this.element,
      });
      return; // 如果任何元素不存在，提前退出
    }

    this.setupEditModeEvents(textarea, markdownPreview, editHint);
    this.setupTextareaEvents(textarea);
    this.setupScrollEvents(textarea, markdownPreview);
    this.setupHoverEvents();
    this.setupResizeEvents();
  }

  /**
   * 设置编辑模式相关事件
   * @param {HTMLElement} textarea - 文本区域元素
   * @param {HTMLElement} markdownPreview - Markdown预览区域元素
   * @param {HTMLElement} editHint - 编辑提示元素
   */
  setupEditModeEvents(textarea, markdownPreview, editHint) {
    // 为预览区域添加双击事件，切换回编辑模式
    markdownPreview.addEventListener("dblclick", () => {
      this.editMode = true;
      // 立即隐藏编辑提示
      editHint.style.opacity = "0";
      editHint.style.pointerEvents = "none";
      this.toggleEditPreviewMode();
      setTimeout(() => textarea.focus(), 10); // 聚焦到文本区域
    });

    // 为编辑提示添加点击事件
    editHint.addEventListener("click", (e) => {
      if (!this.editMode) {
        e.stopPropagation();
        this.editMode = true;
        // 立即隐藏编辑提示
        editHint.style.opacity = "0";
        editHint.style.pointerEvents = "none";
        this.toggleEditPreviewMode();
        setTimeout(() => textarea.focus(), 10);
      }
    });
  }

  /**
   * 设置文本区域相关事件
   * @param {HTMLElement} textarea - 文本区域元素
   */
  setupTextareaEvents(textarea) {
    // 添加文本区域事件监听
    textarea.addEventListener("input", () => {
      this.text = textarea.value;

      // 防抖处理预览更新
      clearTimeout(this.updateTimer);
      this.updateTimer = setTimeout(() => {
        const preview = this.element?.querySelector(".markdown-preview");
        if (preview) {
          preview.innerHTML = renderMarkdown(this.text);
        }

        const scrollbarThumb = this.element?.querySelector(".scrollbar-thumb");
        if (scrollbarThumb) {
          updateScrollbar(textarea, scrollbarThumb);
        }
      }, 300);
    });

    // 文本区域失去焦点时，如果有内容则切换到预览模式
    textarea.addEventListener("blur", () => {
      this.text = textarea.value;
      dispatchCustomEvent("note-updated", { id: this.id });

      if (this.text.trim() !== "") {
        this.editMode = false;
        this.toggleEditPreviewMode();
      }
    });

    // 添加焦点事件，聚焦时切换到编辑模式
    textarea.addEventListener("focus", () => {
      this.editMode = true;

      // 确保在获得焦点时隐藏编辑提示
      if (this.element) {
        const editHint = this.element.querySelector(".edit-hint");
        if (editHint) {
          editHint.style.opacity = "0";
          editHint.style.pointerEvents = "none";
        }
      }
    });
  }

  /**
   * 设置滚动相关事件
   * @param {HTMLElement} textarea - 文本区域元素
   * @param {HTMLElement} markdownPreview - Markdown预览区域元素
   */
  setupScrollEvents(textarea, markdownPreview) {
    // 添加滚动事件处理函数
    const handleScroll = (element) => {
      const scrollbarThumb = this.element?.querySelector(".scrollbar-thumb");
      if (scrollbarThumb) {
        updateScrollbar(element, scrollbarThumb);
      }
    };

    // 添加滚动事件
    textarea.addEventListener("scroll", () => handleScroll(textarea));
    markdownPreview.addEventListener("scroll", () =>
      handleScroll(markdownPreview)
    );
  }

  /**
   * 设置悬停相关事件
   */
  setupHoverEvents() {
    // 确保元素存在后再添加事件监听
    if (!this.element) return;

    // 添加悬停事件显示编辑提示
    this.element.addEventListener("mouseenter", () => {
      // 只有在非编辑模式下才显示"双击编辑"提示
      if (!this.editMode && this.element) {
        const editHint = this.element.querySelector(".edit-hint");
        if (editHint) {
          editHint.style.opacity = "1";
          editHint.style.pointerEvents = "auto";
        }
      } else {
        // 在编辑模式下确保提示隐藏
        const editHint = this.element.querySelector(".edit-hint");
        if (editHint) {
          editHint.style.opacity = "0";
          editHint.style.pointerEvents = "none";
        }
      }
    });

    this.element.addEventListener("mouseleave", () => {
      // 离开时无条件隐藏提示
      const editHint = this.element.querySelector(".edit-hint");
      if (editHint) {
        editHint.style.opacity = "0";
        editHint.style.pointerEvents = "none";
      }
    });
  }

  /**
   * 设置窗口调整大小事件
   */
  setupResizeEvents() {
    // 使用可选链操作符访问元素属性
    window.addEventListener("resize", () => {
      if (!this.editMode && this.element) {
        updateEditHintVisibility(this.element, this.editMode);
      }
    });
  }

  /**
   * 设置便签点击事件
   * @param {HTMLElement} note - 便签元素
   */
  setupNoteClickEvent(note) {
    note.addEventListener("mousedown", (e) => {
      // 如果点击的是便签本身而不是其内部的可编辑元素
      if (
        e.target.closest(".note") &&
        !e.target.matches("textarea, input, [contenteditable='true']") &&
        !e.target.classList.contains("note-node-button") // 排除节点按钮
      ) {
        note.style.zIndex = getHighestZIndex() + 1;

        // 触发层级变化事件
        dispatchCustomEvent("note-zindex-changed", { id: this.id });

        // 选中便签
        nodeConnectionManager.selectNote(this);
      }
    });
  }

  /**
   * 切换便签连接状态
   */
  toggleConnection() {
    if (nodeConnectionManager.isNoteConnected(this)) {
      // 如果已连接，断开连接
      nodeConnectionManager.disconnectNote(this);
      this.isConnected = false;

      // 更新节点按钮样式
      if (this.element) {
        const nodeButton = this.element.querySelector(".note-node-button");
        if (nodeButton) {
          nodeButton.classList.remove("connected");
        }
      }
    } else {
      // 如果未连接，建立连接
      nodeConnectionManager.connectNote(this);
      this.isConnected = true;

      // 更新节点按钮样式
      if (this.element) {
        const nodeButton = this.element.querySelector(".note-node-button");
        if (nodeButton) {
          nodeButton.classList.add("connected");
        }
      }
    }
  }

  /**
   * 切换编辑/预览模式
   */
  toggleEditPreviewMode() {
    toggleEditPreviewMode(this.element, this.editMode, this.text);
  }

  /**
   * 编辑便签标题
   * @param {HTMLElement} titleElement - 标题元素
   */
  editNoteTitle(titleElement) {
    editTitle(titleElement, this.title, this.id, (newTitle) => {
      this.title = newTitle;
    });
  }

  /**
   * 获取随机颜色类名
   * @returns {string} 随机颜色类名
   */
  getRandomColorClass() {
    return this.colorClasses[
      Math.floor(Math.random() * this.colorClasses.length)
    ];
  }

  /**
   * 移除便签
   */
  remove() {
    if (this.element) {
      // 停止观察大小变化
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }

      this.element.remove();
      dispatchCustomEvent("note-removed", { id: this.id });
    }
  }

  /**
   * 更新便签内容
   * @param {string} text - 便签文本内容
   */
  update(text) {
    this.text = text;

    // 更新DOM元素
    this.updateDOMElements(text);

    // 更新滚动条
    this.updateScrollbar();

    // 根据内容决定是否切换模式
    this.updateEditMode(text);

    // 发送更新事件
    dispatchCustomEvent("note-updated", { id: this.id });
  }

  /**
   * 更新DOM元素内容
   * @param {string} text - 便签文本内容
   */
  updateDOMElements(text) {
    // 更新文本区域
    const textarea = this.element?.querySelector(".note-content");
    if (textarea) {
      textarea.value = text;
    }

    // 立即更新预览（如果处于预览模式）
    if (!this.editMode) {
      const preview = this.element?.querySelector(".markdown-preview");
      if (preview) {
        preview.innerHTML = renderMarkdown(text);
      }
    }
  }

  /**
   * 更新滚动条
   */
  updateScrollbar() {
    const scrollbarThumb = this.element?.querySelector(".scrollbar-thumb");
    if (!scrollbarThumb) return;

    // 确定当前活动元素
    const textarea = this.element?.querySelector(".note-content");
    const preview = this.element?.querySelector(".markdown-preview");
    const currentElement = this.editMode ? textarea : preview;

    if (currentElement) {
      updateScrollbar(currentElement, scrollbarThumb);
    }
  }

  /**
   * 根据内容更新编辑模式
   * @param {string} text - 便签文本内容
   */
  updateEditMode(text) {
    const isEmpty = text.trim() === "";

    // 只有当内容为空且当前不在编辑模式时，才切换到编辑模式
    if (isEmpty && !this.editMode) {
      this.editMode = true;
      this.toggleEditPreviewMode();
    }

    // 注意：有内容且在编辑模式的情况，在失焦时处理，这里不需要额外处理
  }
}

export default Note;
