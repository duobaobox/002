/**
 * 密码输入组件
 * 提供安全的密码输入功能，处理浏览器兼容性问题，并提供显示/隐藏密码切换
 */

/**
 * 创建密码输入组件
 * @param {Object} options - 配置选项
 * @param {string} options.containerId - 容器元素的ID
 * @param {string} options.inputId - 密码输入框的ID
 * @param {string} options.inputName - 密码输入框的name属性
 * @param {string} options.label - 密码输入框的标签文本
 * @param {string} options.placeholder - 密码输入框的占位符文本
 * @param {Function} options.onVisibilityChange - 密码可见性变化时的回调函数
 * @returns {Object} 包含组件公共方法的对象
 */
export function createPasswordInput(options = {}) {
  const {
    containerId,
    inputId = "password",
    inputName = "password",
    label = "密码",
    placeholder = "请输入密码",
    onVisibilityChange = null,
  } = options;

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`找不到ID为${containerId}的容器元素`);
    return;
  }

  // 创建组件HTML
  const componentHtml = `
    <div class="form-group">
      <label for="${inputId}">${label}</label>
      <div class="password-input-wrapper">
        <input 
          type="password" 
          id="${inputId}" 
          name="${inputName}" 
          placeholder="${placeholder}" 
          autocomplete="new-password"
          data-lpignore="true" 
          data-disable-reveal="true"
        >
        <button 
          type="button" 
          id="${inputId}-toggle" 
          class="toggle-password" 
          aria-label="显示密码"
        >
          <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <svg class="eye-off-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <path
                  d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24">
              </path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        </button>
      </div>
    </div>
  `;
  container.innerHTML = componentHtml;

  // 注入防止浏览器控件的CSS样式
  const injectStyles = () => {
    const styleId = `${inputId}-custom-styles`;
    // 如果已经存在同ID的样式，则不重复添加
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      input#${inputId}::-ms-reveal,
      input#${inputId}::-ms-clear,
      input#${inputId}::-webkit-contacts-auto-fill-button,
      input#${inputId}::-webkit-credentials-auto-fill-button {
        visibility: hidden;
        display: none !important;
        pointer-events: none;
        height: 0;
        width: 0;
        margin: 0;
      }
    `;
    document.head.appendChild(style);
  };

  // 初始化组件
  const init = () => {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = document.getElementById(`${inputId}-toggle`);

    if (!passwordInput || !toggleButton) {
      console.error("初始化密码输入组件失败：找不到所需元素");
      return;
    }

    // 注入样式
    injectStyles();

    // 添加事件监听
    toggleButton.addEventListener("click", function () {
      // 切换密码可见性
      const type =
        passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);

      // 切换按钮样式
      toggleButton.classList.toggle("show-password");

      // 更新辅助功能标签
      const ariaLabel = type === "password" ? "显示密码" : "隐藏密码";
      toggleButton.setAttribute("aria-label", ariaLabel);

      // 调用回调函数
      if (typeof onVisibilityChange === "function") {
        onVisibilityChange(type === "text");
      }
    });
  };

  // 初始化组件
  init();

  // 返回公共API
  return {
    /**
     * 获取密码值
     * @returns {string} 当前密码值
     */
    getValue: () => document.getElementById(inputId)?.value || "",

    /**
     * 设置密码值
     * @param {string} value - 要设置的密码值
     */
    setValue: (value) => {
      const input = document.getElementById(inputId);
      if (input) input.value = value;
    },

    /**
     * 清空密码输入框
     */
    clear: () => {
      const input = document.getElementById(inputId);
      if (input) input.value = "";
    },

    /**
     * 获取输入框DOM元素
     * @returns {HTMLElement} 密码输入框元素
     */
    getInputElement: () => document.getElementById(inputId),

    /**
     * 聚焦到密码输入框
     */
    focus: () => {
      const input = document.getElementById(inputId);
      if (input) input.focus();
    },
  };
}

export default { createPasswordInput };
