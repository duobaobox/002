/**
 * 应用程序入口文件
 * 引入 App 模块并初始化应用实例
 */
import App from "./modules/app/App.js";

// 当文档加载完成后初始化应用
document.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});
