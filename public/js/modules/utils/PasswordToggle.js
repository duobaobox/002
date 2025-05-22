/**
 * 密码可见性切换功能工具模块
 * @deprecated 此模块已废弃，请使用 modules/ui/PasswordInput.js 中的密码输入组件
 */

console.warn("PasswordToggle 模块已废弃，请使用 PasswordInput 组件替代");

/**
 * 初始化密码可见性切换功能
 * @param {string} toggleBtnId - 切换按钮的ID
 * @param {string} passwordInputId - 密码输入框的ID
 * @deprecated 此函数已废弃，请使用 createPasswordInput 函数替代
 */
export function initPasswordToggle(
  toggleBtnId = "toggle-password",
  passwordInputId = "password"
) {
  console.warn(
    "initPasswordToggle 函数已废弃，请使用 createPasswordInput 函数替代"
  );

  // 为了向后兼容，保留原有功能
  const togglePasswordBtn = document.getElementById(toggleBtnId);
  const passwordInput = document.getElementById(passwordInputId);

  if (togglePasswordBtn && passwordInput) {
    // 不再添加额外样式，使用简化版本
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
