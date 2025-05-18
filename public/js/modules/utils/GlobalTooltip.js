/**
 * 全局Tooltip工具 - GlobalTooltip.js
 *
 * 提供全局tooltip功能，将tooltip显示在body层级，避免被父容器限制
 */

/**
 * 全局Tooltip类
 */
class GlobalTooltip {
  constructor() {
    // 创建全局tooltip元素
    this.tooltipElement = document.createElement("div");
    this.tooltipElement.className = "global-tooltip";
    document.body.appendChild(this.tooltipElement);

    // 初始化事件监听
    this.initEventListeners();
  }

  /**
   * 初始化事件监听
   */
  initEventListeners() {
    // 查找所有带有data-tooltip属性的元素
    const tooltipElements = document.querySelectorAll("[data-tooltip]");

    // 为每个元素添加鼠标事件
    tooltipElements.forEach((element) => {
      element.addEventListener("mouseenter", this.showTooltip.bind(this));
      element.addEventListener("mouseleave", this.hideTooltip.bind(this));
      element.addEventListener(
        "mousemove",
        this.updateTooltipPosition.bind(this)
      );
    });

    // 监听DOM变化，为新添加的元素添加事件
    this.observeDOMChanges();
  }

  /**
   * 监听DOM变化
   */
  observeDOMChanges() {
    // 创建MutationObserver
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          // 检查新添加的节点
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              // 元素节点
              // 检查节点本身
              if (node.hasAttribute("data-tooltip")) {
                node.addEventListener(
                  "mouseenter",
                  this.showTooltip.bind(this)
                );
                node.addEventListener(
                  "mouseleave",
                  this.hideTooltip.bind(this)
                );
                node.addEventListener(
                  "mousemove",
                  this.updateTooltipPosition.bind(this)
                );
              }

              // 检查子节点
              const childTooltips = node.querySelectorAll("[data-tooltip]");
              childTooltips.forEach((element) => {
                element.addEventListener(
                  "mouseenter",
                  this.showTooltip.bind(this)
                );
                element.addEventListener(
                  "mouseleave",
                  this.hideTooltip.bind(this)
                );
                element.addEventListener(
                  "mousemove",
                  this.updateTooltipPosition.bind(this)
                );
              });
            }
          });
        }
      });
    });

    // 开始观察整个文档
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * 显示tooltip
   * @param {Event} event - 鼠标事件
   */
  showTooltip(event) {
    const target = event.currentTarget;
    const tooltipText = target.getAttribute("data-tooltip");

    if (!tooltipText) return;

    // 设置tooltip内容 - 支持HTML内容
    this.tooltipElement.innerHTML = tooltipText;
    this.tooltipElement.style.display = "block";

    // 计算位置
    this.updateTooltipPosition(event);

    // 添加显示动画
    setTimeout(() => {
      this.tooltipElement.classList.add("visible");
    }, 10);
  }

  /**
   * 隐藏tooltip
   */
  hideTooltip() {
    this.tooltipElement.classList.remove("visible");

    // 等待动画完成后隐藏
    setTimeout(() => {
      this.tooltipElement.style.display = "none";
    }, 200);
  }

  /**
   * 刷新元素的tooltip内容
   * @param {HTMLElement} element - 需要刷新tooltip的元素
   */
  refreshElement(element) {
    if (!element || !element.hasAttribute("data-tooltip")) return;

    // 如果元素当前正在显示tooltip，则更新内容
    if (this.tooltipElement.style.display === "block") {
      this.tooltipElement.innerHTML = element.getAttribute("data-tooltip");
      this.updateTooltipPosition({ currentTarget: element });
    }
  }

  /**
   * 更新tooltip位置
   * @param {Event} event - 鼠标事件
   */
  updateTooltipPosition(event) {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();

    // 计算tooltip位置
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    let top = rect.top - tooltipRect.height - 10; // 默认显示在元素上方
    const left = rect.left + rect.width / 2 - tooltipRect.width / 2;

    // 检查是否在视口上方有足够空间，如果没有则显示在元素下方
    if (top < 10) {
      top = rect.bottom + 10; // 显示在元素下方
      this.tooltipElement.classList.add("bottom"); // bottom类表示显示在元素下方
    } else {
      this.tooltipElement.classList.remove("bottom"); // 默认显示在元素上方
    }

    // 确保tooltip不超出视口
    const adjustedTop = Math.max(
      10,
      Math.min(top, window.innerHeight - tooltipRect.height - 10)
    );
    const adjustedLeft = Math.max(
      10,
      Math.min(left, window.innerWidth - tooltipRect.width - 10)
    );

    // 设置位置
    this.tooltipElement.style.top = `${adjustedTop}px`;
    this.tooltipElement.style.left = `${adjustedLeft}px`;
  }
}

// 创建全局实例
let globalTooltip;

/**
 * 初始化全局tooltip
 */
export function initGlobalTooltip() {
  if (!globalTooltip) {
    globalTooltip = new GlobalTooltip();
    // 将实例暴露给window对象，便于其他模块访问
    window.globalTooltip = globalTooltip;
  }
  return globalTooltip;
}
