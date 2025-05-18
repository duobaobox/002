/**
 * 应用程序入口文件
 * 引入 App 模块并初始化应用实例
 */
import App from "./modules/app/App.js";
import { initAccountDeletedNotifier } from "./modules/auth/AccountDeletedNotifier.js";
import { initGlobalTooltip } from "./modules/utils/GlobalTooltip.js";

// 当文档加载完成后初始化应用
document.addEventListener("DOMContentLoaded", async () => {
  // 初始化应用
  window.app = new App();

  // 初始化全局tooltip
  initGlobalTooltip();

  // 检查用户会话，获取用户名
  try {
    const response = await fetch("/api/session");
    const data = await response.json();

    if (data.success && data.isLoggedIn && data.user) {
      // 初始化账户删除通知器
      initAccountDeletedNotifier(data.user.username);
      console.log(`账户删除通知器已初始化，用户: ${data.user.username}`);
    }
  } catch (error) {
    console.error("获取会话信息失败:", error);
  }
});
