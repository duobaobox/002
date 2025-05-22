/**
 * 登录页面入口文件
 * 引入并初始化登录相关模块
 */
import { initLogin } from "./modules/auth/Login.js";
import { initAccountDeletedNotifier } from "./modules/auth/AccountDeletedNotifier.js";
import { createPasswordInput } from "./modules/ui/PasswordInput.js";

// 当文档加载完成后初始化登录功能和密码切换功能
document.addEventListener("DOMContentLoaded", () => {
  // 初始化账户删除通知器（不需要用户名，只检查sessionStorage）
  initAccountDeletedNotifier();
  console.log("登录页面：账户删除通知器已初始化");

  // 初始化密码输入组件
  const passwordInput = createPasswordInput({
    containerId: "password-container",
    inputId: "password",
    inputName: "password",
    label: "密码",
    placeholder: "请输入密码",
  });

  // 初始化登录功能
  initLogin();
});
