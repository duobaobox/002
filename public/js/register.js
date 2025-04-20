/**
 * 注册页面入口文件
 * 引入并初始化注册相关模块
 */
import { initRegister } from "./modules/auth/Register.js";
import { initPasswordToggle } from "./modules/utils/PasswordToggle.js";

// 当文档加载完成后初始化注册功能和密码切换功能
document.addEventListener("DOMContentLoaded", () => {
  initRegister();
  initPasswordToggle();
});
