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

    console.log("便签生成位置(画布坐标):", {
      x,
      y,
      existingNotes,
      offsetX,
      offsetY,
    });
  }

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
  note.className = `note ${colorClass} ai-generating-note`; // 添加AI生成中的标记类

  // 设置便签位置 - 使用画布坐标系
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
  // 创建便签内容
  const body = document.createElement("div");
  body.className = "note-body";

  // 创建标题容器 - 与常规便签结构保持一致
  const titleContainer = document.createElement("div");
  titleContainer.className = "note-title-container";

  // 添加标题
  const title = document.createElement("div");
  title.className = "note-title";
  title.textContent = "AI生成中...";
  title.setAttribute("title", "双击编辑标题");

  // 创建关闭按钮
  const closeBtn = document.createElement("div");
  closeBtn.className = "note-close";
  closeBtn.innerHTML = "&times;";
  // 关闭按钮应该移除临时便签
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    note.remove();
  });

  // 添加标题和关闭按钮到标题容器
  titleContainer.appendChild(title);
  titleContainer.appendChild(closeBtn); // 将关闭按钮也添加到标题容器中

  // 首先添加标题容器到body
  body.appendChild(titleContainer);

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

  // 添加生成控制容器
  const loaderContainer = document.createElement("div");
  loaderContainer.className = "ai-generation-controls";

  // 添加左侧容器，包含指示器和进度
  const leftControls = document.createElement("div");
  leftControls.className = "generation-left-controls";

  // 添加等待指示器
  const loader = document.createElement("div");
  loader.className = "ai-typing-indicator";
  loader.innerHTML = "<span></span><span></span><span></span>";

  // 添加生成进度指示器
  const progressIndicator = document.createElement("div");
  progressIndicator.className = "generation-progress";
  progressIndicator.innerHTML = "<span class='chars-count'>0</span> 字符";

  // 将指示器和进度添加到左侧容器
  leftControls.appendChild(loader);
  leftControls.appendChild(progressIndicator);

  // 将左侧控制容器添加到主容器
  loaderContainer.appendChild(leftControls);

  // 组装便签
  note.appendChild(body);
  note.appendChild(resizeHandle);
  note.appendChild(loaderContainer);

  // 添加到DOM
  document.getElementById("note-container").appendChild(note);

  // 设置事件处理
  setupDragEventsForTemp(note, titleContainer); // 将 titleContainer 作为拖拽句柄
  setupResizeObserverForTemp(note);

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

  // 获取画布缩放比例的函数
  const getCanvasScale = () => {
    // 尝试从全局实例获取
    if (
      window.canvasInstance &&
      typeof window.canvasInstance.getScale === "function"
    ) {
      return window.canvasInstance.getScale();
    }

    // 如果无法获取，尝试从 DOM 元素计算
    const noteContainer = document.getElementById("note-container");
    if (!noteContainer) return 1.0;

    // 从 transform 属性中提取缩放比例
    const transform = getComputedStyle(noteContainer).transform;
    if (transform === "none") return 1.0;

    // 解析 matrix 变换，获取缩放值
    try {
      const matrixValues = transform.match(/matrix.*\((.+)\)/)[1].split(", ");
      if (matrixValues.length >= 4) {
        // scale 值在 matrix 中的 a 和 d 位置
        return parseFloat(matrixValues[0]);
      }
    } catch (e) {
      console.warn("无法解析画布缩放比例", e);
    }

    return 1.0;
  };

  header.addEventListener("mousedown", (e) => {
    // 仅当点击头部本身而非内部按钮时拖动
    if (e.target === header) {
      isDragging = true;

      // 获取当前画布缩放比例
      const scale = getCanvasScale();

      // 考虑画布缩放比例计算偏移量
      dragOffsetX = e.clientX - note.offsetLeft * scale;
      dragOffsetY = e.clientY - note.offsetTop * scale;

      note.style.zIndex = getHighestZIndex() + 1;
    }
  });

  // 使用 window 监听 mousemove 和 mouseup，以获得更好的拖动体验
  const handleMouseMove = (e) => {
    if (!isDragging) return;

    // 获取当前画布缩放比例
    const scale = getCanvasScale();

    // 考虑画布缩放比例计算便签位置
    const x = (e.clientX - dragOffsetX) / scale;
    const y = (e.clientY - dragOffsetY) / scale;

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
 */
function setupResizeObserverForTemp(note) {
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
