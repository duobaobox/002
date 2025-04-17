/**
 * Note 事件处理模块
 * 提供便签相关的事件处理函数
 */

import { getHighestZIndex, dispatchCustomEvent } from "../utils/DOMUtils.js";
import { updateScrollbar } from "../utils/MarkdownUtils.js";

/**
 * 设置便签拖动事件
 * @param {HTMLElement} note - 便签元素
 * @param {HTMLElement} header - 便签头部元素
 * @param {Object} context - 便签实例的上下文
 */
export function setupDragEvents(note, header, context) {
  header.addEventListener("mousedown", (e) => {
    if (e.target === header) {
      context.isDragging = true;
      context.dragOffsetX = e.clientX - note.offsetLeft;
      context.dragOffsetY = e.clientY - note.offsetTop;
      note.style.zIndex = getHighestZIndex() + 1;

      // 触发便签层级变化事件
      dispatchCustomEvent("note-zindex-changed", { id: context.id });
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!context.isDragging) return;

    const x = e.clientX - context.dragOffsetX;
    const y = e.clientY - context.dragOffsetY;

    // 检查底部控制栏位置，防止便签移动到底部控制栏下方
    const bottomBar = document.querySelector(".bottom-bar");
    const bottomBarRect = bottomBar.getBoundingClientRect();

    // 避免便签头部与底部控制栏重叠
    const noteHeight = note.offsetHeight;
    const headerHeight = 30; // 便签头部高度
    const safeBottomPosition = window.innerHeight - bottomBarRect.height - 40; // 保留安全间距

    const finalY = Math.min(y, safeBottomPosition - headerHeight);

    note.style.left = `${x}px`;
    note.style.top = `${finalY}px`;
  });

  window.addEventListener("mouseup", () => {
    if (context.isDragging) {
      // 便签移动完成后触发事件，通知服务器更新数据
      dispatchCustomEvent("note-moved", { id: context.id });
    }
    context.isDragging = false;
  });
}

/**
 * 设置便签大小调整事件
 * @param {HTMLElement} note - 便签元素
 * @param {HTMLElement} resizeHandle - 调整大小的控件元素
 * @param {Object} context - 便签实例的上下文
 */
export function setupResizeEvents(note, resizeHandle, context) {
  resizeHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();

    context.isResizing = true;
    context.resizeStartWidth = note.offsetWidth;
    context.resizeStartHeight = note.offsetHeight;
    context.resizeStartX = e.clientX;
    context.resizeStartY = e.clientY;

    note.style.zIndex = getHighestZIndex() + 1;
  });

  window.addEventListener("mousemove", (e) => {
    if (!context.isResizing) return;

    // 计算新的宽度和高度
    const newWidth =
      context.resizeStartWidth + (e.clientX - context.resizeStartX);
    const newHeight =
      context.resizeStartHeight + (e.clientY - context.resizeStartY);

    // 只应用最小尺寸限制，移除最大尺寸限制
    const minWidth = 150;
    const minHeight = 150;

    if (newWidth >= minWidth) {
      note.style.width = `${newWidth}px`;
    }

    if (newHeight >= minHeight) {
      note.style.height = `${newHeight}px`;
    }

    // 调整大小后更新滚动条
    const textarea = note.querySelector(".note-content");
    const scrollbarThumb = note.querySelector(".scrollbar-thumb");
    updateScrollbar(textarea, scrollbarThumb);
  });

  window.addEventListener("mouseup", () => {
    if (context.isResizing) {
      // 便签调整大小完成后触发事件，通知服务器更新数据
      dispatchCustomEvent("note-resized", { id: context.id });
    }
    context.isResizing = false;
  });
}

/**
 * 设置 ResizeObserver 监听便签大小变化
 * @param {HTMLElement} note - 便签元素
 * @param {Object} context - 便签实例的上下文
 */
export function setupResizeObserver(note, context) {
  // 检查浏览器是否支持 ResizeObserver
  if (typeof ResizeObserver === "undefined") {
    console.warn("浏览器不支持ResizeObserver，便签大小调整可能不会保存");
    return;
  }

  // 记录初始尺寸
  context.lastWidth = note.offsetWidth;
  context.lastHeight = note.offsetHeight;

  // 创建一个观察器实例
  const resizeObserver = new ResizeObserver((entries) => {
    if (context.isResizing) return; // 如果是通过自定义控件调整大小，不重复触发

    const entry = entries[0];
    const newWidth = entry.contentRect.width;
    const newHeight = entry.contentRect.height;

    // 检查是否有真实的尺寸变化
    if (newWidth !== context.lastWidth || newHeight !== context.lastHeight) {
      // 使用防抖，避免频繁触发更新
      clearTimeout(context.resizeTimer);
      context.resizeTimer = setTimeout(() => {
        // 更新记录的尺寸
        context.lastWidth = newWidth;
        context.lastHeight = newHeight;

        // 触发更新事件
        dispatchCustomEvent("note-resized", { id: context.id });
      }, 300); // 300ms防抖延迟
    }
  });

  // 开始观察便签元素
  resizeObserver.observe(note);

  // 保存观察器引用以便后续可能的清理
  context.resizeObserver = resizeObserver;
}
