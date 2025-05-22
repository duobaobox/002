/**
 * 注册页面入口文件
 * 引入并初始化注册相关模块
 */
import { initRegister } from "./modules/auth/Register.js";
import { createPasswordInput } from "./modules/ui/PasswordInput.js";

// 当文档加载完成后初始化注册功能和密码切换功能
document.addEventListener("DOMContentLoaded", () => {
  // 初始化密码输入组件
  const passwordInput = createPasswordInput({
    containerId: "password-container",
    inputId: "password",
    inputName: "password",
    label: "密码",
    placeholder: "请输入密码",
  });

  // 初始化确认密码输入组件
  const confirmPasswordInput = createPasswordInput({
    containerId: "confirm-password-container",
    inputId: "confirm-password",
    inputName: "confirm-password",
    label: "确认密码",
    placeholder: "请再次输入密码",
  });

  // 初始化注册功能
  initRegister();
});
