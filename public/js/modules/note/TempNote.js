/**
 * 临时便签模块
 * 用于管理临时便签，如 AI 生成的便签
 */

import { getHighestZIndex } from "../utils/DOMUtils.js";
import { updateScrollbar } from "../utils/MarkdownUtils.js";

/**
 * 创建一个临时的 AI 便签
 * @returns {{noteElement: HTMLElement, noteId: string}} 创建的便签元素和 ID
 */
export function createEmptyAiNote() {
  // 随机位置
  const x = 100 + Math.random() * 200;
  const y = 100 + Math.random() * 200;

  // 随机颜色
  const colorClasses = [
    "note-yellow",
    "note-blue",
    "note-green",
    "note-pink",
    "note-purple",
  ];
  const colorClass =
    colorClasses[Math.floor(Math.random() * colorClasses.length)];

  // 创建便签元素
  const note = document.createElement("div");
  const noteId = "temp-ai-note-" + Date.now();
  note.id = noteId;
  note.className = `note ${colorClass}`;
  note.style.left = `${x}px`;
  note.style.top = `${y}px`;

  // 设置最高层级，确保新便签显示在最上层
  note.style.zIndex = getHighestZIndex() + 10;

  // 设置便签默认大小
  const DEFAULT_NOTE_SIZE = {
    width: 320,
    height: 350,
  };

  note.style.width = `${DEFAULT_NOTE_SIZE.width}px`;
  note.style.height = `${DEFAULT_NOTE_SIZE.height}px`;

  // 创建便签内容（标题、正文等）
  createTempNoteContent(note, noteId);

  return { noteElement: note, noteId };
}

/**
 * 创建临时便签的内容
 * @param {HTMLElement} note - 便签元素
 * @param {string} noteId - 便签 ID
 */
function createTempNoteContent(note, noteId) {
  // 创建便签头部
  const header = document.createElement("div");
  header.className = "note-header";

  // 添加标题和关闭按钮
  const title = document.createElement("div");
  title.className = "note-title";
  title.textContent = "AI生成中...";
  title.setAttribute("title", "双击编辑标题");

  const closeBtn = document.createElement("div");
  closeBtn.className = "note-close";
  closeBtn.innerHTML = "&times;";
  // 关闭按钮应该移除临时便签
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    note.remove();
  });

  header.appendChild(title);
  header.appendChild(closeBtn);
  note.appendChild(header);

  // 创建便签内容区域
  const body = document.createElement("div");
  body.className = "note-body";

  // 创建文本区域 (隐藏在生成过程中)
  const textarea = document.createElement("textarea");
  textarea.className = "note-content";
  textarea.placeholder = "AI 正在生成内容...";
  textarea.style.display = "none";
  body.appendChild(textarea);

  // 创建预览区域 (在生成过程中可见)
  const preview = document.createElement("div");
  preview.className = "markdown-preview";
  preview.style.display = "block";
  body.appendChild(preview);

  // 创建自定义滚动条
  const scrollbarContainer = document.createElement("div");
  scrollbarContainer.className = "custom-scrollbar";

  const scrollbarThumb = document.createElement("div");
  scrollbarThumb.className = "scrollbar-thumb";
  scrollbarContainer.appendChild(scrollbarThumb);
  body.appendChild(scrollbarContainer);

  // 添加调整大小的控件
  const resizeHandle = document.createElement("div");
  resizeHandle.className = "note-resize-handle";

  // 添加等待指示器
  const loader = document.createElement("div");
  loader.className = "ai-typing-indicator";
  loader.innerHTML = "<span></span><span></span><span></span>";

  // 组装便签
  note.appendChild(body);
  note.appendChild(resizeHandle);
  note.appendChild(loader);

  // 添加到DOM
  document.getElementById("note-container").appendChild(note);

  // 设置事件处理
  setupDragEventsForTemp(note, header);
  setupResizeObserverForTemp(note, noteId);

  // 添加点击事件，确保便签点击时提升到最上层
  note.addEventListener("mousedown", () => {
    note.style.zIndex = getHighestZIndex() + 1;
  });
}

/**
 * 为临时便签设置拖动事件
 * @param {HTMLElement} note - 便签元素
 * @param {HTMLElement} header - 便签头部元素
 */
function setupDragEventsForTemp(note, header) {
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  header.addEventListener("mousedown", (e) => {
    // 仅当点击头部本身而非内部按钮时拖动
    if (e.target === header) {
      isDragging = true;
      dragOffsetX = e.clientX - note.offsetLeft;
      dragOffsetY = e.clientY - note.offsetTop;
      note.style.zIndex = getHighestZIndex() + 1;
    }
  });

  // 使用 window 监听 mousemove 和 mouseup，以获得更好的拖动体验
  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const x = e.clientX - dragOffsetX;
    const y = e.clientY - dragOffsetY;

    note.style.left = `${x}px`;
    note.style.top = `${y}px`;
  };

  const handleMouseUp = () => {
    isDragging = false;
  };

  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);

  // 存储处理程序引用，以便后续可能的清理
  note._tempDragHandlers = { handleMouseMove, handleMouseUp };
}

/**
 * 为临时便签添加大小调整观察器
 * @param {HTMLElement} note - 便签元素
 * @param {string} noteId - 便签 ID
 */
function setupResizeObserverForTemp(note, noteId) {
  if (typeof ResizeObserver === "undefined") return;

  let lastWidth = note.offsetWidth;
  let lastHeight = note.offsetHeight;
  let resizeTimer = null;

  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    const newWidth = entry.contentRect.width;
    const newHeight = entry.contentRect.height;

    if (newWidth !== lastWidth || newHeight !== lastHeight) {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        lastWidth = newWidth;
        lastHeight = newHeight;

        // 更新滚动条
        const preview = note.querySelector(".markdown-preview");
        const scrollbarThumb = note.querySelector(".scrollbar-thumb");
        if (preview && scrollbarThumb) {
          updateScrollbar(preview, scrollbarThumb);
        }
      }, 300);
    }
  });

  resizeObserver.observe(note);

  // 存储观察器引用，以便后续可能的清理
  note._resizeObserver = resizeObserver;
}
