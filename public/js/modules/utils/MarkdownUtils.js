/**
 * Markdown 工具模块
 * 提供 Markdown 渲染和处理相关功能
 */

// 添加节流函数
const throttle = (func, limit) => {
  let inThrottle;
  let lastResult;
  return function (...args) {
    if (!inThrottle) {
      lastResult = func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
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
const MAX_CACHE_SIZE = 50; // 最大缓存条目数

/**
 * 更新便签内容 - 优化版本
 * @param {HTMLElement} noteElement - 便签元素
 * @param {string} content - Markdown 内容
 */
export function updateNoteContent(noteElement, content) {
  const contentElement = noteElement.querySelector(".note-content");
  const previewElement = noteElement.querySelector(".markdown-preview");

  // 如果内容是Markdown格式，则解析它并更新预览区域
  if (previewElement && contentElement.classList.contains("markdown")) {
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

    // 更新预览区域显示解析后的HTML
    previewElement.innerHTML = renderedHTML;

    // 使用 requestAnimationFrame 优化代码高亮
    if (typeof hljs !== "undefined") {
      requestAnimationFrame(() => {
        previewElement.querySelectorAll("pre code").forEach((block) => {
          hljs.highlightElement(block);
        });
      });
    }

    // 确保预览区域可见，文本区域隐藏
    previewElement.style.display = "block";
    contentElement.style.display = "none";

    // 使用 requestAnimationFrame 优化滚动条更新
    requestAnimationFrame(() => {
      updateScrollbar(
        previewElement,
        noteElement.querySelector(".scrollbar-thumb")
      );
    });
  } else {
    // 非 markdown 模式：更新文本区域
    contentElement.value = content;
    previewElement.style.display = "none";
    contentElement.style.display = "block";
  }
}

// 创建节流版本的更新函数，每50ms最多更新一次
export const updateNoteContentThrottled = throttle(updateNoteContent, 50);

/**
 * 更新自定义滚动条
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
    scrollbarThumb.style.display = "none";
    return;
  }

  // 显示滚动条
  scrollbarThumb.style.display = "block";

  // 计算滚动条高度
  const scrollRatio = clientHeight / scrollHeight;
  const thumbHeight = Math.max(30, scrollRatio * clientHeight); // 最小高度30px
  scrollbarThumb.style.height = `${thumbHeight}px`;

  // 计算滚动条位置
  const scrollableDistance = scrollHeight - clientHeight;
  const scrollPosition = element.scrollTop;
  const scrollPercentage = scrollPosition / scrollableDistance;
  const thumbPosition = scrollPercentage * (clientHeight - thumbHeight);
  scrollbarThumb.style.top = `${thumbPosition}px`;
}
