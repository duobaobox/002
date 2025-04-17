/**
 * 登录页面入口文件
 * 引入并初始化登录相关模块
 */
import { initLogin } from "./modules/auth/Login.js";
import { initPasswordToggle } from "./modules/utils/PasswordToggle.js";

// 当文档加载完成后初始化登录功能和密码切换功能
document.addEventListener("DOMContentLoaded", () => {
  initLogin();
  initPasswordToggle();
});
