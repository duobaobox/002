/**
 * 登录页面入口文件
 * 引入并初始化登录相关模块
 */
import { initLogin } from "./modules/auth/Login.js";
import { initPasswordToggle } from "./modules/utils/PasswordToggle.js";
import { initAccountDeletedHandler } from "./modules/auth/AccountDeletedHandler.js";

// 当文档加载完成后初始化登录功能和密码切换功能
document.addEventListener("DOMContentLoaded", () => {
  // 初始化账户删除处理器
  initAccountDeletedHandler();
  console.log("登录页面：账户删除处理器已初始化");

  // 初始化登录功能
  initLogin();
  initPasswordToggle();
});
