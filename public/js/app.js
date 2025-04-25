/**
 * 应用程序入口文件
 * 引入 App 模块并初始化应用实例
 */
import App from "./modules/app/App.js";
import { initAccountDeletedHandler } from "./modules/auth/AccountDeletedHandler.js";

// 当文档加载完成后初始化应用
document.addEventListener("DOMContentLoaded", () => {
  // 初始化账户删除处理器
  initAccountDeletedHandler();
  console.log("账户删除处理器已初始化");

  // 初始化应用
  window.app = new App();
});
