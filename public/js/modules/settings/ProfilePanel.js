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

  // 初始化邀请码管理
  initInviteCodeManager(
    document.getElementById("invite-code-manager-container")
  );

  // 加载用户信息
  loadUserInfo();

  /**
   * 创建个人中心面板UI
   * @param {HTMLElement} container - 个人中心面板容器元素
   */
  function createProfilePanelUI(container) {
    container.innerHTML = `
      <div class="settings-panel-content">
        <h3>个人中心</h3>
        <div class="profile-container">
        <!-- 个人信息卡片 -->
        <div class="profile-card">
          <div id="user-info-container" class="user-info-container">
            <div class="loading-indicator">加载中...</div>
          </div>
        </div>

        <!-- 安全设置卡片 -->
        <div class="profile-card">
          <div class="profile-card-header">
            <h4>安全设置</h4>
          </div>
          <div class="password-form">
            <div class="form-group">
              <label for="current-password">当前密码</label>
              <input type="password" id="current-password" placeholder="请输入当前密码">
            </div>
            <div class="form-group">
              <label for="new-password">新密码</label>
              <input type="password" id="new-password" placeholder="请输入新密码">
            </div>
            <div class="form-group">
              <label for="confirm-password">确认新密码</label>
              <input type="password" id="confirm-password" placeholder="请再次输入新密码">
            </div>
            <div class="form-actions">
              <button id="change-password-button" class="btn btn-primary">更新密码</button>
            </div>
            <div id="password-message" class="message-container"></div>
          </div>
        </div>

        <!-- 邀请码管理卡片 -->
        <div class="profile-card">
          <div class="profile-card-header">
            <h4>邀请码管理</h4>
          </div>
          <div id="invite-code-manager-container"></div>
        </div>
      </div>
    </div>
    `;

    // 添加修改密码事件监听器
    document
      .getElementById("change-password-button")
      .addEventListener("click", changePassword);
  }

  /**
   * 加载用户信息
   */
  async function loadUserInfo() {
    const userInfoContainer = document.getElementById("user-info-container");

    try {
      const response = await fetch("/api/session");
      const data = await response.json();

      if (data.success && data.isLoggedIn) {
        userInfoContainer.innerHTML = `
          <div class="profile-header">
            <div class="profile-avatar">
              <i class="icon-user">${data.user.username
                .charAt(0)
                .toUpperCase()}</i>
            </div>
            <div class="profile-info">
              <h2 class="profile-name">${data.user.username}</h2>
              <span class="profile-badge">${
                data.user.username === "admin" ? "管理员" : "用户"
              }</span>
            </div>
          </div>
          <div class="profile-actions">
            <button id="settings-logout-button" class="profile-action-button logout-button">
              <i class="icon-logout">⏎</i>
              <span>退出登录</span>
            </button>
          </div>
        `;
      } else {
        userInfoContainer.innerHTML = `<div class="error-message">未登录或会话已过期</div>`;
      }
    } catch (error) {
      console.error("加载用户信息失败:", error);
      userInfoContainer.innerHTML = `<div class="error-message">加载用户信息失败，请稍后重试</div>`;
    }
  }

  /**
   * 修改密码
   */
  async function changePassword() {
    const currentPassword = document.getElementById("current-password").value;
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const messageContainer = document.getElementById("password-message");
    const changePasswordButton = document.getElementById(
      "change-password-button"
    );

    // 清除之前的消息
    messageContainer.textContent = "";
    messageContainer.className = "message-container";

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
      changePasswordButton.textContent = "修改密码";
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
    container.className = `message-container ${type}`;
    container.style.display = "block";

    // 自动隐藏成功消息
    if (type === "success") {
      setTimeout(() => {
        container.style.display = "none";
      }, 5000);
    }
  }
}
