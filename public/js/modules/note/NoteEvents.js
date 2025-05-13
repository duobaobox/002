/**
 * Note 事件处理模块
 * 提供便签相关的事件处理函数
 */

import { getHighestZIndex, dispatchCustomEvent } from "../utils/DOMUtils.js";
import { updateScrollbar } from "../utils/MarkdownUtils.js";

/**
 * 获取当前画布实例
 * @returns {Object|null} 画布实例或null
 */
function getCanvasInstance() {
  return window.canvasInstance || null;
}

/**
 * 获取当前画布缩放比例
 * @returns {number} 当前缩放比例
 */
function getCanvasScale() {
  // 获取Canvas实例的缩放比例
  const canvasElement = document.getElementById("note-container");
  if (!canvasElement) return 1.0;

  // 从transform属性中提取缩放比例
  const transform = getComputedStyle(canvasElement).transform;
  if (transform === "none") return 1.0;

  // 解析matrix变换，获取缩放值
  try {
    const matrixValues = transform.match(/matrix.*\((.+)\)/)[1].split(", ");
    if (matrixValues.length >= 4) {
      // scale值在matrix中的a和d位置
      return parseFloat(matrixValues[0]);
    }
  } catch (e) {
    console.warn("无法解析画布缩放比例", e);
  }

  return 1.0;
}

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

      const canvas = getCanvasInstance();
      if (canvas) {
        // 保存鼠标点击位置相对于画布坐标系中便签位置的偏移量
        const rect = note.getBoundingClientRect();
        const noteLeft = parseInt(note.style.left) || 0;
        const noteTop = parseInt(note.style.top) || 0;

        // 计算鼠标在画布坐标系中的位置
        const mouseCanvasPos = canvas.screenToCanvasPosition(
          e.clientX,
          e.clientY
        );

        // 保存拖动偏移量
        context.dragOffsetX = mouseCanvasPos.x - noteLeft;
        context.dragOffsetY = mouseCanvasPos.y - noteTop;
      } else {
        // 后备方案：直接使用屏幕坐标
        context.dragOffsetX = e.clientX - note.offsetLeft;
        context.dragOffsetY = e.clientY - note.offsetTop;
      }

      note.style.zIndex = getHighestZIndex() + 1;

      // 触发便签层级变化事件
      dispatchCustomEvent("note-zindex-changed", { id: context.id });

      // 触发便签移动开始事件，用于预测性连接线更新
      dispatchCustomEvent("note-movement-start", {
        id: context.id,
        note: context,
      });
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!context.isDragging) return;

    const canvas = getCanvasInstance();
    let x, y;

    if (canvas) {
      // 计算鼠标在画布坐标系中的位置
      const mouseCanvasPos = canvas.screenToCanvasPosition(
        e.clientX,
        e.clientY
      );

      // 减去拖动偏移量，得到便签应该放置的位置
      x = mouseCanvasPos.x - context.dragOffsetX;
      y = mouseCanvasPos.y - context.dragOffsetY;
    } else {
      // 后备方案：直接使用屏幕坐标
      x = e.clientX - context.dragOffsetX;
      y = e.clientY - context.dragOffsetY;
    }

    // 检查底部控制栏位置，防止便签移动到底部控制栏下方
    const bottomBar = document.querySelector(".bottom-bar");
    if (bottomBar) {
      const bottomBarRect = bottomBar.getBoundingClientRect();

      // 获取便签在屏幕上的位置来检查是否超出安全区域
      const noteRect = note.getBoundingClientRect();
      const headerHeight = 30; // 便签头部高度
      const safeBottomPosition = window.innerHeight - bottomBarRect.height - 40; // 保留安全间距

      if (canvas) {
        // 将安全位置转换为画布坐标
        const safePos = canvas.screenToCanvasPosition(
          0,
          safeBottomPosition - headerHeight
        );
        y = Math.min(y, safePos.y);
      } else {
        // 后备方案
        y = Math.min(y, safeBottomPosition - headerHeight - note.offsetTop);
      }
    }

    // 计算当前移动的偏移量，用于预测性更新
    const currentX = parseInt(note.style.left) || 0;
    const currentY = parseInt(note.style.top) || 0;
    const deltaX = x - currentX;
    const deltaY = y - currentY;

    // 设置便签位置
    note.style.left = `${x}px`;
    note.style.top = `${y}px`;

    // 在拖动过程中触发便签移动事件，用于实时更新连接线
    // 使用 Event.isTrusted 区分真实鼠标事件和程序触发的事件
    if (e.isTrusted) {
      dispatchCustomEvent("note-moving", {
        id: context.id,
        note: context, // 传递便签实例，避免在NodeConnectionManager中再次查找
        immediate: true, // 标记为立即更新
        deltaX: deltaX, // 添加移动偏移量，用于实时更新
        deltaY: deltaY,
      });
    }
  });

  window.addEventListener("mouseup", () => {
    if (context.isDragging) {
      // 便签移动完成后触发事件，通知服务器更新数据
      dispatchCustomEvent("note-moved", { id: context.id });

      // 触发便签移动结束事件
      dispatchCustomEvent("note-movement-end", {
        id: context.id,
        note: context,
      });
    }
    context.isDragging = false;
  });

  // 监听画布变换更新事件
  document.addEventListener("canvas-transform-updated", () => {
    // 当画布变换时，如果正在拖动便签，需要重新计算拖动偏移量
    if (context.isDragging) {
      const canvas = getCanvasInstance();
      if (!canvas) return;

      // 获取当前便签位置
      const noteLeft = parseInt(note.style.left) || 0;
      const noteTop = parseInt(note.style.top) || 0;

      // 更新拖动偏移量，以保持便签相对于鼠标的正确位置
      const mouseCanvasPos = canvas.screenToCanvasPosition(
        context.lastMouseX || 0,
        context.lastMouseY || 0
      );

      context.dragOffsetX = mouseCanvasPos.x - noteLeft;
      context.dragOffsetY = mouseCanvasPos.y - noteTop;
    }
  });

  // 记录最后的鼠标位置，用于画布变换更新时重新计算便签位置
  window.addEventListener("mousemove", (e) => {
    context.lastMouseX = e.clientX;
    context.lastMouseY = e.clientY;
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
    // 添加调整大小时的活跃状态类
    note.classList.add("resizing");
    context.resizeStartWidth = note.offsetWidth;
    context.resizeStartHeight = note.offsetHeight;

    const canvas = getCanvasInstance();
    if (canvas) {
      // 在画布坐标系中记录起始点位置
      const mouseCanvasPos = canvas.screenToCanvasPosition(
        e.clientX,
        e.clientY
      );
      context.resizeStartX = mouseCanvasPos.x;
      context.resizeStartY = mouseCanvasPos.y;
    } else {
      // 后备方案
      context.resizeStartX = e.clientX;
      context.resizeStartY = e.clientY;
    }

    note.style.zIndex = getHighestZIndex() + 1;
  });

  window.addEventListener("mousemove", (e) => {
    if (!context.isResizing) return;

    const canvas = getCanvasInstance();
    let deltaX, deltaY;

    if (canvas) {
      // 计算在画布坐标系中的位置变化
      const mouseCanvasPos = canvas.screenToCanvasPosition(
        e.clientX,
        e.clientY
      );
      deltaX = mouseCanvasPos.x - context.resizeStartX;
      deltaY = mouseCanvasPos.y - context.resizeStartY;
    } else {
      // 后备方案
      deltaX = e.clientX - context.resizeStartX;
      deltaY = e.clientY - context.resizeStartY;
    }

    const newWidth = context.resizeStartWidth + deltaX;
    const newHeight = context.resizeStartHeight + deltaY;

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

    // 在调整大小过程中触发事件，用于实时更新连接线
    // 直接触发事件，不使用requestAnimationFrame，确保立即更新
    dispatchCustomEvent("note-resizing", {
      id: context.id,
      note: context, // 传递便签实例，避免在NodeConnectionManager中再次查找
      immediate: true, // 标记为立即更新
    });
  });

  window.addEventListener("mouseup", () => {
    if (context.isResizing) {
      // 便签调整大小完成后触发事件，通知服务器更新数据
      dispatchCustomEvent("note-resized", { id: context.id });
      // 移除调整大小时的活跃状态类
      note.classList.remove("resizing");
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
