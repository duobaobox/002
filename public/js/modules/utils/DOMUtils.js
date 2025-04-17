/**
 * DOM 工具模块
 * 提供常用的 DOM 操作工具函数
 */

/**
 * 获取当前文档中最高的 z-index 值
 * @param {string} selector - 元素选择器
 * @returns {number} 最高的 z-index 值
 */
export function getHighestZIndex(selector = ".note") {
  const elements = document.querySelectorAll(selector);
  let highest = 0;

  elements.forEach((element) => {
    const zIndex = parseInt(window.getComputedStyle(element).zIndex, 10) || 0;
    if (zIndex > highest) {
      highest = zIndex;
    }
  });

  return highest;
}

/**
 * 创建并分发自定义事件
 * @param {string} eventName - 事件名称
 * @param {Object} detail - 事件详情
 */
export function dispatchCustomEvent(eventName, detail) {
  document.dispatchEvent(new CustomEvent(eventName, { detail }));
}

/**
 * 防抖函数
 * @param {Function} func - 需要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * 节流函数
 * @param {Function} func - 需要节流的函数
 * @param {number} limit - 限制时间（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 创建 DOM 元素并设置属性
 * @param {string} tag - 标签名称
 * @param {Object} attributes - 属性对象
 * @param {string|Node} [content] - 内容
 * @returns {HTMLElement} 创建的 DOM 元素
 */
export function createElement(tag, attributes = {}, content = "") {
  const element = document.createElement(tag);

  // 设置属性
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === "className") {
      element.className = value;
    } else if (key === "style" && typeof value === "object") {
      Object.entries(value).forEach(([prop, val]) => {
        element.style[prop] = val;
      });
    } else {
      element.setAttribute(key, value);
    }
  });

  // 设置内容
  if (typeof content === "string") {
    element.textContent = content;
  } else if (content instanceof Node) {
    element.appendChild(content);
  }

  return element;
}
