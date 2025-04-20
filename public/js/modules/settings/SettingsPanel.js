/**
 * 设置面板模块
 * 处理设置面板的初始化和功能
 */
import { initProfilePanel } from "./ProfilePanel.js";

/**
 * 初始化设置面板
 */
export function initSettingsPanel() {
  // 获取设置面板元素
  const settingsModal = document.getElementById("settings-modal");
  const closeSettings = document.getElementById("close-settings");
  const navItems = document.querySelectorAll(".settings-nav .nav-item");
  const logoutButton = document.getElementById("settings-logout-button");

  // 初始化个人中心面板
  initProfilePanel(document.getElementById("profile-panel"));

  // 添加关闭设置面板事件
  if (closeSettings) {
    closeSettings.addEventListener("click", () => {
      settingsModal.classList.remove("visible");
    });
  }

  // 添加导航切换事件
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      // 移除所有导航项的active类
      navItems.forEach((nav) => nav.classList.remove("active"));

      // 添加当前导航项的active类
      item.classList.add("active");

      // 隐藏所有面板
      document.querySelectorAll(".settings-panel").forEach((panel) => {
        panel.classList.remove("active");
      });

      // 显示当前面板
      const tabId = item.getAttribute("data-tab");
      const panel = document.getElementById(`${tabId}-panel`);
      if (panel) {
        panel.classList.add("active");
      }
    });
  });

  // 添加退出登录事件
  if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout);
  }

  /**
   * 处理退出登录
   */
  async function handleLogout() {
    if (confirm("确定要退出登录吗？")) {
      try {
        const response = await fetch("/api/logout", {
          method: "POST",
        });

        const data = await response.json();

        if (data.success) {
          // 退出成功，重定向到登录页
          window.location.href = "/login.html";
        } else {
          alert("退出登录失败: " + (data.message || "未知错误"));
        }
      } catch (error) {
        console.error("退出登录请求失败:", error);
        alert("退出登录失败，请稍后重试");
      }
    }
  }
}
