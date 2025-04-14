/**
 * 密码可见性切换功能
 */
document.addEventListener("DOMContentLoaded", function () {
  const togglePasswordBtn = document.getElementById("toggle-password");
  const passwordInput = document.getElementById("password");

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
});
