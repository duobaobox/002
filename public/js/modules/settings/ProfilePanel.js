/**
 * 个人中心面板模块
 * 处理用户个人信息和邀请码管理
 */
import { initInviteCodeManager } from "./InviteCodeManager.js";

/**
 * 初始化个人中心面板
 * @param {HTMLElement} container - 个人中心面板容器元素
 */
export function initProfilePanel(container) {
  if (!container) return;

  // 创建个人中心面板UI
  createProfilePanelUI(container);

  // 加载用户信息，并在用户是管理员时初始化邀请码管理
  loadUserInfo();

  /**
   * 创建个人中心面板UI
   * @param {HTMLElement} container - 个人中心面板容器元素
   */
  function createProfilePanelUI(container) {
    // 不需要重新创建整个面板，因为已经在index.html中定义了统一结构
    // 只需要替换用户信息容器的内容
    const userInfoContainer = container.querySelector(".profile-header");
    if (userInfoContainer) {
      userInfoContainer.innerHTML = `
        <div class="profile-avatar">
          <i class="icon-user">👤</i>
        </div>
        <div class="profile-info">
          <h2 class="profile-name">加载中...</h2>
          <span class="profile-badge">加载中...</span>
        </div>
      `;
    }

    // 添加修改密码事件监听器
    document
      .getElementById("change-password-button")
      .addEventListener("click", changePassword);
  }

  /**
   * 加载用户信息
   */
  async function loadUserInfo() {
    const profileHeader = document.querySelector(".profile-header");
    const profileAvatar = document.querySelector(".profile-avatar i");
    const profileName = document.querySelector(".profile-name");
    const profileBadge = document.querySelector(".profile-badge");

    if (!profileHeader || !profileAvatar || !profileName || !profileBadge) {
      console.error("找不到用户信息元素");
      return;
    }

    try {
      const response = await fetch("/api/session");
      const data = await response.json();

      if (data.success && data.isLoggedIn) {
        // 更新用户信息
        profileAvatar.textContent = data.user.username.charAt(0).toUpperCase();
        profileName.textContent = data.user.username;

        // 检查是否是管理员
        const isAdmin = data.user.username === "admin";
        profileBadge.textContent = isAdmin ? "管理员" : "用户";

        // 只有管理员才初始化邀请码管理器
        if (isAdmin) {
          // 初始化邀请码管理
          initInviteCodeManager(
            document.getElementById("invite-code-manager-container")
          );
        }
      } else {
        profileName.textContent = "未登录";
        profileBadge.textContent = "未知";
        profileBadge.style.backgroundColor = "#f8d7da";
        profileBadge.style.color = "#721c24";
      }
    } catch (error) {
      console.error("加载用户信息失败:", error);
      profileName.textContent = "加载失败";
      profileBadge.textContent = "错误";
      profileBadge.style.backgroundColor = "#f8d7da";
      profileBadge.style.color = "#721c24";
    }
  }

  /**
   * 修改密码
   */
  async function changePassword() {
    const currentPassword = document.getElementById("current-password").value;
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const changePasswordButton = document.getElementById(
      "change-password-button"
    );

    // 创建或获取状态消息区域
    let messageContainer = document.querySelector(
      ".password-form .settings-status"
    );
    if (!messageContainer) {
      messageContainer = document.createElement("div");
      messageContainer.className = "settings-status";
      document
        .querySelector(".password-form .settings-actions")
        .after(messageContainer);
    }

    // 清除之前的消息
    messageContainer.textContent = "";
    messageContainer.className = "settings-status";

    // 基础验证
    if (!currentPassword) {
      showMessage(messageContainer, "请输入当前密码", "error");
      return;
    }

    if (!newPassword) {
      showMessage(messageContainer, "请输入新密码", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage(messageContainer, "两次输入的新密码不一致", "error");
      return;
    }

    // 禁用按钮，防止重复提交
    changePasswordButton.disabled = true;
    changePasswordButton.textContent = "修改中...";

    try {
      const response = await fetch("/api/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (data.success) {
        showMessage(messageContainer, "密码修改成功", "success");
        // 清空输入框
        document.getElementById("current-password").value = "";
        document.getElementById("new-password").value = "";
        document.getElementById("confirm-password").value = "";
      } else {
        showMessage(messageContainer, data.message || "密码修改失败", "error");
      }
    } catch (error) {
      console.error("修改密码失败:", error);
      showMessage(messageContainer, "网络错误，请稍后重试", "error");
    } finally {
      // 恢复按钮状态
      changePasswordButton.disabled = false;
      changePasswordButton.textContent = "更新密码";
    }
  }

  /**
   * 显示消息
   * @param {HTMLElement} container - 消息容器
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型 (success/error)
   */
  function showMessage(container, message, type) {
    container.textContent = message;
    container.className = `settings-status ${type}`;
    container.classList.add("show");

    // 自动隐藏成功消息
    if (type === "success") {
      setTimeout(() => {
        container.classList.remove("show");
      }, 5000);
    }
  }
}
