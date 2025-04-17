/**
 * 密码可见性切换功能工具模块
 */

/**
 * 初始化密码可见性切换功能
 * @param {string} toggleBtnId - 切换按钮的ID
 * @param {string} passwordInputId - 密码输入框的ID
 */
export function initPasswordToggle(
  toggleBtnId = "toggle-password",
  passwordInputId = "password"
) {
  const togglePasswordBtn = document.getElementById(toggleBtnId);
  const passwordInput = document.getElementById(passwordInputId);

  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener("click", function () {
      // 切换密码可见性
      const type =
        passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);

      // 切换按钮样式
      togglePasswordBtn.classList.toggle("show-password");

      // 更新辅助功能标签
      const ariaLabel = type === "password" ? "显示密码" : "隐藏密码";
      togglePasswordBtn.setAttribute("aria-label", ariaLabel);
    });
  }
}

export default { initPasswordToggle };
