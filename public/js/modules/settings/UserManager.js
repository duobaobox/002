/**
 * 用户管理模块
 * 处理用户列表、用户操作等功能
 */
export default class UserManager {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   */
  constructor(options = {}) {
    // 初始化属性
    this.users = [];
    this.isAdmin = false;
    this.isLoading = false;

    // DOM 元素
    this.usersList = document.getElementById("users-list");
    this.noUsersElement = document.getElementById("no-users");
    this.refreshButton = document.getElementById("refresh-users-list");

    // 统计元素
    this.totalUsersCount = document.getElementById("total-users-count");
    this.activeUsersCount = document.getElementById("active-users-count");
    this.newUsersToday = document.getElementById("new-users-today");

    // 绑定事件处理器
    this._bindEvents();

    // 检查是否为管理员
    this._checkAdminStatus();
  }

  /**
   * 初始化用户管理功能
   */
  async init() {
    // 如果是管理员，加载用户列表
    if (this.isAdmin) {
      await this.loadUsers();
    }
  }

  /**
   * 绑定事件处理器
   * @private
   */
  _bindEvents() {
    // 刷新按钮点击事件
    if (this.refreshButton) {
      this.refreshButton.addEventListener("click", () => {
        this.loadUsers();
      });
    }

    // 用户列表点击事件委托
    if (this.usersList) {
      this.usersList.addEventListener("click", (e) => {
        const target = e.target;

        // 重置密码按钮
        if (target.classList.contains("reset-password")) {
          const userId = target.dataset.userId;
          this._handleResetPassword(userId);
        }

        // 禁用/启用用户按钮
        if (
          target.classList.contains("disable-user") ||
          target.classList.contains("enable-user")
        ) {
          const userId = target.dataset.userId;
          const action = target.classList.contains("disable-user")
            ? "disable"
            : "enable";
          this._handleToggleUserStatus(userId, action);
        }
      });
    }
  }

  /**
   * 检查当前用户是否为管理员
   * @private
   */
  async _checkAdminStatus() {
    try {
      const response = await fetch("/api/session");
      const data = await response.json();

      if (data.success && data.isLoggedIn) {
        this.isAdmin = data.user.username === "admin";
      }
    } catch (error) {
      console.error("检查管理员状态失败:", error);
    }
  }

  /**
   * 加载用户列表
   */
  async loadUsers() {
    if (this.isLoading) return;

    this.isLoading = true;
    this._showLoading();

    try {
      const response = await fetch("/api/users");

      // 检查响应状态
      if (!response.ok) {
        throw new Error(`服务器返回错误状态码: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        this.users = data.users;
        this._renderUsers();
        this._updateStats();
      } else {
        this._showError(data.message || "加载用户列表失败");
      }
    } catch (error) {
      console.error("加载用户列表失败:", error);
      this._showError("加载用户列表失败，请检查网络连接");
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 渲染用户列表
   * @private
   */
  _renderUsers() {
    if (!this.usersList) return;

    // 清空列表
    while (this.usersList.firstChild) {
      this.usersList.removeChild(this.usersList.firstChild);
    }

    // 如果没有用户，显示空状态
    if (this.users.length === 0) {
      this.noUsersElement.style.display = "block";
      return;
    }

    // 隐藏空状态
    this.noUsersElement.style.display = "none";

    // 渲染用户列表
    this.users.forEach((user) => {
      const userRow = document.createElement("div");
      userRow.className = "user-row";
      userRow.dataset.userId = user.id;

      // 用户名列
      const nameColumn = document.createElement("div");
      nameColumn.className = "user-column user-name";
      nameColumn.textContent = user.username;

      // 创建时间列
      const createdColumn = document.createElement("div");
      createdColumn.className = "user-column user-created";
      createdColumn.textContent = this._formatDate(user.createdAt);

      // 状态列
      const statusColumn = document.createElement("div");
      statusColumn.className = "user-column user-status";

      const statusBadge = document.createElement("span");
      statusBadge.className = "user-status-badge";

      if (user.username === "admin") {
        statusBadge.classList.add("status-admin");
        statusBadge.textContent = "管理员";
      } else if (user.isActive) {
        statusBadge.classList.add("status-active");
        statusBadge.textContent = "活跃";
      } else {
        statusBadge.classList.add("status-inactive");
        statusBadge.textContent = "禁用";
      }

      statusColumn.appendChild(statusBadge);

      // 操作列
      const actionsColumn = document.createElement("div");
      actionsColumn.className = "user-column user-actions";

      // 不允许对管理员执行操作
      if (user.username !== "admin") {
        // 重置密码按钮
        const resetButton = document.createElement("button");
        resetButton.className = "user-action-button reset-password";
        resetButton.textContent = "重置密码";
        resetButton.dataset.userId = user.id;

        // 禁用/启用按钮
        const toggleButton = document.createElement("button");
        toggleButton.className = user.isActive
          ? "user-action-button disable-user"
          : "user-action-button enable-user";
        toggleButton.textContent = user.isActive ? "禁用" : "启用";
        toggleButton.dataset.userId = user.id;

        actionsColumn.appendChild(resetButton);
        actionsColumn.appendChild(toggleButton);
      }

      // 添加所有列到行
      userRow.appendChild(nameColumn);
      userRow.appendChild(createdColumn);
      userRow.appendChild(statusColumn);
      userRow.appendChild(actionsColumn);

      // 添加行到列表
      this.usersList.appendChild(userRow);
    });
  }

  /**
   * 更新用户统计信息
   * @private
   */
  _updateStats() {
    if (!this.totalUsersCount || !this.activeUsersCount || !this.newUsersToday)
      return;

    // 总用户数
    this.totalUsersCount.textContent = this.users.length;

    // 活跃用户数
    const activeUsers = this.users.filter((user) => user.isActive);
    this.activeUsersCount.textContent = activeUsers.length;

    // 今日新增用户
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newUsers = this.users.filter((user) => {
      const createdDate = new Date(user.createdAt);
      return createdDate >= today;
    });

    this.newUsersToday.textContent = newUsers.length;
  }

  /**
   * 处理重置密码
   * @param {string} userId - 用户ID
   * @private
   */
  async _handleResetPassword(userId) {
    if (!confirm("确定要重置该用户的密码吗？")) return;

    try {
      const response = await fetch(`/api/users/${userId}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        alert(`密码已重置为: ${data.newPassword}`);
      } else {
        alert(data.message || "重置密码失败");
      }
    } catch (error) {
      console.error("重置密码失败:", error);
      alert("重置密码失败，请检查网络连接");
    }
  }

  /**
   * 处理禁用/启用用户
   * @param {string} userId - 用户ID
   * @param {string} action - 操作类型 (disable/enable)
   * @private
   */
  async _handleToggleUserStatus(userId, action) {
    const message = action === "disable" ? "禁用" : "启用";
    if (!confirm(`确定要${message}该用户吗？`)) return;

    try {
      const response = await fetch(`/api/users/${userId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`用户已${message}`);
        // 重新加载用户列表
        this.loadUsers();
      } else {
        alert(data.message || `${message}用户失败`);
      }
    } catch (error) {
      console.error(`${message}用户失败:`, error);
      alert(`${message}用户失败，请检查网络连接`);
    }
  }

  /**
   * 显示加载状态
   * @private
   */
  _showLoading() {
    if (!this.noUsersElement) return;

    this.noUsersElement.style.display = "block";
    this.noUsersElement.innerHTML = "<p>正在加载用户列表...</p>";
  }

  /**
   * 显示错误信息
   * @param {string} message - 错误信息
   * @private
   */
  _showError(message) {
    if (!this.noUsersElement) return;

    this.noUsersElement.style.display = "block";
    this.noUsersElement.innerHTML = `<p>${message}</p>`;
  }

  /**
   * 格式化日期
   * @param {string} dateString - 日期字符串
   * @returns {string} 格式化后的日期
   * @private
   */
  _formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
