// 此脚本用于将自定义样式应用到AI设置页面

(function () {
  // 创建样式元素
  const styleEl = document.createElement("link");
  styleEl.setAttribute("rel", "stylesheet");
  styleEl.setAttribute("href", "css/custom-styles.css");
  document.head.appendChild(styleEl);

  // 调整内容区布局
  function adjustLayout() {
    const contentArea = document.querySelector(".ai-content-area");
    if (contentArea) {
      // 确保内容区域占满高度
      contentArea.style.display = "flex";
      contentArea.style.flexDirection = "column";

      // 包装内容使滚动更流畅
      const contentElements = Array.from(contentArea.children);
      if (contentElements.length > 0) {
        const wrapper = document.createElement("div");
        wrapper.className = "ai-content-wrapper";
        contentElements.forEach((el) => wrapper.appendChild(el));
        contentArea.appendChild(wrapper);
      }
    }
  }

  // 页面加载完成后执行
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", adjustLayout);
  } else {
    adjustLayout();
  }
})();
