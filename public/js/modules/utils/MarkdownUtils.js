/**
 * Markdown 工具模块
 * 提供 Markdown 渲染和处理相关功能
 */

/**
 * 高级节流函数，支持延迟执行和最新值保证
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 节流时间间隔（毫秒）
 * @param {boolean} trailing - 是否在节流结束后执行最后一次调用
 * @returns {Function} 节流后的函数
 */
const throttle = (func, limit, trailing = true) => {
  let lastFunc;
  let lastRan;
  let lastArgs;
  let lastResult;

  return function (...args) {
    const context = this;

    // 如果是第一次调用或者超过了节流时间，立即执行
    if (!lastRan || Date.now() - lastRan >= limit) {
      lastResult = func.apply(context, args);
      lastRan = Date.now();
      // 清除可能存在的延迟执行
      if (lastFunc) clearTimeout(lastFunc);
      lastFunc = null;
    } else {
      // 在节流期间内，存储最新的参数
      lastArgs = args;

      // 如果需要尾部执行，设置定时器
      if (trailing && !lastFunc) {
        lastFunc = setTimeout(() => {
          // 计算下一次可执行的时间
          const nextTime = limit - (Date.now() - lastRan);
          if (nextTime <= 0) {
            lastResult = func.apply(context, lastArgs);
            lastRan = Date.now();
            lastFunc = null;
          } else {
            // 如果还没到时间，重新调整定时器
            lastFunc = setTimeout(() => {
              lastResult = func.apply(context, lastArgs);
              lastRan = Date.now();
              lastFunc = null;
            }, nextTime);
          }
        }, limit);
      }
    }

    return lastResult;
  };
};

/**
 * 渲染 Markdown 文本为 HTML
 * @param {string} text - Markdown 文本
 * @returns {string} 渲染后的 HTML
 */
export function renderMarkdown(text) {
  if (!text) return "";
  try {
    // 配置 marked 选项
    marked.setOptions({
      breaks: true, // 启用换行符
      gfm: true, // 启用 GitHub 风格的 Markdown
      highlight: highlightCode,
    });

    // 渲染 Markdown
    return marked.parse(text);
  } catch (error) {
    console.error("Markdown 渲染错误:", error);
    return "<p>渲染错误</p>";
  }
}

/**
 * 高亮代码块
 * @param {string} code - 代码内容
 * @param {string} lang - 代码语言
 * @returns {string} 高亮后的代码 HTML
 */
function highlightCode(code, lang) {
  // 如果已经加载了 highlight.js，则使用它来高亮代码
  if (typeof hljs !== "undefined") {
    const language = hljs.getLanguage(lang) ? lang : "plaintext";
    return hljs.highlight(code, { language }).value;
  }
  return code;
}

// 创建一个缓存对象，用于存储已渲染的内容
const renderCache = new Map();
const MAX_CACHE_SIZE = 100; // 增加缓存大小以减少重复渲染

// 创建一个内容块缓存，用于流式生成时的增量渲染
const chunkCache = new Map();

/**
 * 更新便签内容 - 高效版本
 * @param {HTMLElement} noteElement - 便签元素
 * @param {string} content - Markdown 内容
 */
export function updateNoteContent(noteElement, content) {
  if (!noteElement) return;

  const contentElement = noteElement.querySelector(".note-content");
  const previewElement = noteElement.querySelector(".markdown-preview");

  if (!contentElement || !previewElement) return;

  // 如果内容是Markdown格式，则解析它并更新预览区域
  if (contentElement.classList.contains("markdown")) {
    // 使用缓存减少重复渲染
    let renderedHTML;
    if (renderCache.has(content)) {
      renderedHTML = renderCache.get(content);
    } else {
      renderedHTML = renderMarkdown(content);

      // 更新缓存，如果缓存过大则清除最早的条目
      if (renderCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = renderCache.keys().next().value;
        renderCache.delete(oldestKey);
      }
      renderCache.set(content, renderedHTML);
    }

    // 使用内容对比避免不必要的DOM更新
    if (previewElement.innerHTML !== renderedHTML) {
      previewElement.innerHTML = renderedHTML;

      // 使用 requestIdleCallback 进行代码高亮，优先级较低
      if (typeof hljs !== "undefined") {
        if (window.requestIdleCallback) {
          window.requestIdleCallback(
            () => {
              previewElement.querySelectorAll("pre code").forEach((block) => {
                hljs.highlightElement(block);
              });
            },
            { timeout: 500 }
          );
        } else {
          // 降级方案
          requestAnimationFrame(() => {
            previewElement.querySelectorAll("pre code").forEach((block) => {
              hljs.highlightElement(block);
            });
          });
        }
      }
    }

    // 确保预览区域可见，文本区域隐藏
    if (previewElement.style.display !== "block") {
      previewElement.style.display = "block";
      contentElement.style.display = "none";
    }

    // 使用 requestAnimationFrame 优化滚动条更新
    const scrollbarThumb = noteElement.querySelector(".scrollbar-thumb");
    if (scrollbarThumb) {
      requestAnimationFrame(() => {
        updateScrollbar(previewElement, scrollbarThumb);
      });
    }
  } else {
    // 非 markdown 模式：更新文本区域
    if (contentElement.value !== content) {
      contentElement.value = content;
    }

    if (previewElement.style.display !== "none") {
      previewElement.style.display = "none";
      contentElement.style.display = "block";
    }
  }
}

/**
 * 增量更新便签内容 - 专门用于流式生成
 * @param {HTMLElement} noteElement - 便签元素
 * @param {string} chunk - 新增的内容块
 * @param {string} fullText - 完整的内容
 */
export function updateNoteContentIncremental(noteElement, chunk, fullText) {
  if (!noteElement) return;

  const contentElement = noteElement.querySelector(".note-content");
  const previewElement = noteElement.querySelector(".markdown-preview");

  if (!contentElement || !previewElement) return;

  // 存储完整文本到文本区域（隐藏状态）
  if (contentElement.value !== fullText) {
    contentElement.value = fullText;
  }

  // 使用缓存的增量渲染方式
  const noteId = noteElement.id || "temp";

  // 如果有缓存的渲染结果，直接使用
  if (renderCache.has(fullText)) {
    previewElement.innerHTML = renderCache.get(fullText);
  } else {
    // 否则渲染完整内容
    const renderedHTML = renderMarkdown(fullText);
    previewElement.innerHTML = renderedHTML;

    // 更新缓存
    if (renderCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = renderCache.keys().next().value;
      renderCache.delete(oldestKey);
    }
    renderCache.set(fullText, renderedHTML);
  }

  // 确保预览区域可见
  if (previewElement.style.display !== "block") {
    previewElement.style.display = "block";
    contentElement.style.display = "none";
  }

  // 更新滚动条
  const scrollbarThumb = noteElement.querySelector(".scrollbar-thumb");
  if (scrollbarThumb) {
    updateScrollbar(previewElement, scrollbarThumb);
  }
}

// 创建节流版本的更新函数，使用更高级的节流实现
export const updateNoteContentThrottled = throttle(updateNoteContent, 30, true);

// 创建增量更新的节流版本，使用更短的节流时间
export const updateNoteContentIncrementalThrottled = throttle(
  updateNoteContentIncremental,
  20,
  false
);

/**
 * 更新自定义滚动条 - 优化版本
 * @param {HTMLElement} element - 内容元素
 * @param {HTMLElement} scrollbarThumb - 滚动条滑块元素
 */
export function updateScrollbar(element, scrollbarThumb) {
  if (!element || !scrollbarThumb) return;

  // 检查内容是否可以滚动
  const scrollHeight = element.scrollHeight;
  const clientHeight = element.clientHeight;

  if (scrollHeight <= clientHeight) {
    // 无需滚动，隐藏滚动条
    if (scrollbarThumb.style.display !== "none") {
      scrollbarThumb.style.display = "none";
    }
    return;
  }

  // 显示滚动条
  if (scrollbarThumb.style.display !== "block") {
    scrollbarThumb.style.display = "block";
  }

  // 计算滚动条高度
  const scrollRatio = clientHeight / scrollHeight;
  const thumbHeight = Math.max(30, scrollRatio * clientHeight); // 最小高度30px

  // 只在高度变化时更新
  const currentHeight = parseInt(scrollbarThumb.style.height) || 0;
  if (Math.abs(currentHeight - thumbHeight) > 1) {
    scrollbarThumb.style.height = `${thumbHeight}px`;
  }

  // 计算滚动条位置
  const scrollableDistance = scrollHeight - clientHeight;
  const scrollPosition = element.scrollTop;
  const scrollPercentage = scrollPosition / scrollableDistance;
  const thumbPosition = scrollPercentage * (clientHeight - thumbHeight);

  // 只在位置变化超过1px时更新，减少重排
  const currentTop = parseInt(scrollbarThumb.style.top) || 0;
  if (Math.abs(currentTop - thumbPosition) > 1) {
    scrollbarThumb.style.top = `${thumbPosition}px`;
  }
}
