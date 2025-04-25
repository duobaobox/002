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
    this.filteredUsers = []; // 过滤后的用户列表
    this.isAdmin = false;
    this.isLoading = false;

    // 分页相关
    this.pageSize = options.pageSize || 10;
    this.currentPage = 1;
    this.totalPages = 1;

    // 排序相关
    this.sortField = "username";
    this.sortDirection = "asc";

    // DOM 元素
    this.usersList = document.getElementById("users-list");
    this.noUsersElement = document.getElementById("no-users");
    this.refreshButton = document.getElementById("refresh-users-list");
    this.searchInput = document.getElementById("users-search");

    // 分页元素
    this.paginationStart = document.getElementById("pagination-start");
    this.paginationEnd = document.getElementById("pagination-end");
    this.paginationTotal = document.getElementById("pagination-total");
    this.paginationPrev = document.getElementById("pagination-prev");
    this.paginationNext = document.getElementById("pagination-next");

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

    // 搜索框输入事件
    if (this.searchInput) {
      this.searchInput.addEventListener("input", () => {
        this._filterUsers();
      });
    }

    // 表格排序事件 - 使用事件委托
    const tableHeaders = document.querySelectorAll(".users-table th.sortable");
    tableHeaders.forEach((header) => {
      header.addEventListener("click", () => {
        const field = header.dataset.sort;
        this._sortUsers(field);
      });
    });

    // 分页按钮事件
    if (this.paginationPrev) {
      this.paginationPrev.addEventListener("click", () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this._renderPage();
        }
      });
    }

    if (this.paginationNext) {
      this.paginationNext.addEventListener("click", () => {
        if (this.currentPage < this.totalPages) {
          this.currentPage++;
          this._renderPage();
        }
      });
    }

    // 用户列表点击事件委托 - 处理操作按钮
    if (this.usersList) {
      this.usersList.addEventListener("click", (e) => {
        const target = e.target;

        // 重置密码按钮
        if (target.classList.contains("reset-password")) {
          const userId = target.dataset.userId;
          this._handleResetPassword(userId);
        }

        // 删除用户按钮
        if (target.classList.contains("delete-user")) {
          const userId = target.dataset.userId;
          this._handleDeleteUser(userId);
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
        this.filteredUsers = [...this.users]; // 初始化过滤后的用户列表
        this._sortUsers(this.sortField); // 应用默认排序
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
   * 过滤用户列表
   * @private
   */
  _filterUsers() {
    const searchTerm = this.searchInput.value.toLowerCase().trim();

    if (searchTerm === "") {
      // 如果搜索框为空，显示所有用户
      this.filteredUsers = [...this.users];
    } else {
      // 否则过滤用户列表
      this.filteredUsers = this.users.filter((user) =>
        user.username.toLowerCase().includes(searchTerm)
      );
    }

    // 重置到第一页
    this.currentPage = 1;

    // 重新排序和渲染
    this._sortUsers(this.sortField, true); // 保持当前排序，但不切换方向
  }

  /**
   * 排序用户列表
   * @param {string} field - 排序字段
   * @param {boolean} keepDirection - 是否保持当前排序方向
   * @private
   */
  _sortUsers(field, keepDirection = false) {
    // 如果点击当前排序字段，则切换排序方向
    if (field === this.sortField && !keepDirection) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortField = field;
      if (!keepDirection) {
        this.sortDirection = "asc"; // 默认升序
      }
    }

    // 更新排序图标
    this._updateSortIndicators();

    // 排序用户列表
    this.filteredUsers.sort((a, b) => {
      let valueA, valueB;

      // 根据字段获取值
      switch (field) {
        case "username":
          valueA = a.username.toLowerCase();
          valueB = b.username.toLowerCase();
          break;
        case "createdAt":
          valueA = new Date(a.createdAt).getTime();
          valueB = new Date(b.createdAt).getTime();
          break;
        default:
          valueA = a[field];
          valueB = b[field];
      }

      // 比较值
      if (valueA < valueB) {
        return this.sortDirection === "asc" ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });

    // 渲染当前页
    this._renderPage();
  }

  /**
   * 更新排序指示器
   * @private
   */
  _updateSortIndicators() {
    // 移除所有排序类
    document.querySelectorAll(".users-table th.sortable").forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
    });

    // 添加当前排序类
    const currentHeader = document.querySelector(
      `.users-table th[data-sort="${this.sortField}"]`
    );
    if (currentHeader) {
      currentHeader.classList.add(
        this.sortDirection === "asc" ? "sort-asc" : "sort-desc"
      );
    }
  }

  /**
   * 渲染当前页
   * @private
   */
  _renderPage() {
    // 计算总页数
    this.totalPages = Math.max(
      1,
      Math.ceil(this.filteredUsers.length / this.pageSize)
    );

    // 确保当前页在有效范围内
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    // 计算当前页的起始和结束索引
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(
      startIndex + this.pageSize,
      this.filteredUsers.length
    );

    // 获取当前页的用户
    const currentPageUsers = this.filteredUsers.slice(startIndex, endIndex);

    // 更新分页信息
    this._updatePagination(startIndex, endIndex);

    // 渲染用户列表
    this._renderUsers(currentPageUsers);
  }

  /**
   * 渲染用户列表
   * @param {Array} users - 要渲染的用户列表，默认使用过滤后的用户
   * @private
   */
  _renderUsers(users = null) {
    if (!this.usersList) return;

    // 清空列表
    while (this.usersList.firstChild) {
      this.usersList.removeChild(this.usersList.firstChild);
    }

    // 使用传入的用户列表或过滤后的用户列表
    const usersToRender = users || this.filteredUsers;

    // 如果没有用户，显示空状态
    if (usersToRender.length === 0) {
      this.noUsersElement.style.display = "flex";
      this.noUsersElement.innerHTML = "<p>没有找到匹配的用户</p>";
      return;
    }

    // 隐藏空状态
    this.noUsersElement.style.display = "none";

    // 渲染用户列表
    usersToRender.forEach((user) => {
      const userRow = document.createElement("tr");
      userRow.dataset.userId = user.id;

      // 用户名单元格
      const nameCell = document.createElement("td");
      nameCell.textContent = user.username;

      // 创建时间单元格
      const createdCell = document.createElement("td");
      createdCell.textContent = this._formatDate(user.createdAt);

      // 操作单元格
      const actionsCell = document.createElement("td");
      actionsCell.className = "user-actions";

      // 不允许对管理员执行操作
      if (user.username !== "admin") {
        // 重置密码按钮
        const resetButton = document.createElement("button");
        resetButton.className = "user-action-button reset-password";
        resetButton.textContent = "重置密码";
        resetButton.dataset.userId = user.id;

        // 删除用户按钮
        const deleteButton = document.createElement("button");
        deleteButton.className = "user-action-button delete-user";
        deleteButton.textContent = "删除";
        deleteButton.dataset.userId = user.id;

        actionsCell.appendChild(resetButton);
        actionsCell.appendChild(deleteButton);
      }

      // 添加所有单元格到行
      userRow.appendChild(nameCell);
      userRow.appendChild(createdCell);
      userRow.appendChild(actionsCell);

      // 添加行到表格
      this.usersList.appendChild(userRow);
    });
  }

  /**
   * 更新分页信息
   * @param {number} startIndex - 当前页起始索引
   * @param {number} endIndex - 当前页结束索引
   * @private
   */
  _updatePagination(startIndex, endIndex) {
    // 更新分页信息
    if (this.paginationStart && this.paginationEnd && this.paginationTotal) {
      // 如果没有用户，显示0-0
      if (this.filteredUsers.length === 0) {
        this.paginationStart.textContent = "0";
        this.paginationEnd.textContent = "0";
      } else {
        // 否则显示当前页范围
        this.paginationStart.textContent = startIndex + 1;
        this.paginationEnd.textContent = endIndex;
      }

      // 更新总数
      this.paginationTotal.textContent = this.filteredUsers.length;
    }

    // 更新分页按钮状态
    if (this.paginationPrev && this.paginationNext) {
      this.paginationPrev.disabled = this.currentPage <= 1;
      this.paginationNext.disabled = this.currentPage >= this.totalPages;
    }
  }

  /**
   * 更新用户统计信息
   * @private
   */
  _updateStats() {
    if (!this.totalUsersCount || !this.newUsersToday) return;

    // 总用户数
    this.totalUsersCount.textContent = this.users.length;

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
   * 处理删除用户
   * @param {string} userId - 用户ID
   * @private
   */
  async _handleDeleteUser(userId) {
    // 获取用户信息
    const userRow = document.querySelector(`tr[data-user-id="${userId}"]`);
    const username = userRow
      ? userRow.querySelector("td:first-child").textContent
      : "未知用户";

    // 使用自定义确认对话框
    const confirmResult = this._showDeleteConfirmDialog(username);

    if (!confirmResult) return;

    try {
      // 显示加载状态
      this._showDeleteLoadingState(userRow);

      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        // 显示成功消息
        this._showSuccessMessage(
          `用户 ${data.deletedUser?.username || username} 已成功删除`
        );

        // 添加详细信息
        const notificationMethod = data.notifiedViaWebSocket
          ? "已通过WebSocket实时通知用户"
          : "用户将在下次操作时被通知";

        this._showInfoMessage(`${notificationMethod}，用户会话已被立即终止`);

        // 重新加载用户列表
        this.loadUsers();

        // 记录删除信息到控制台
        console.log("用户删除成功:", data.deletedUser);
      } else {
        this._showErrorMessage(data.message || "删除用户失败");
      }
    } catch (error) {
      console.error("删除用户失败:", error);
      this._showErrorMessage("删除用户失败，请检查网络连接");
    }
  }

  /**
   * 显示删除确认对话框
   * @param {string} username - 用户名
   * @returns {boolean} 是否确认删除
   * @private
   */
  _showDeleteConfirmDialog(username) {
    // 创建模态对话框
    const modal = document.createElement("div");
    modal.className = "delete-confirm-modal";
    modal.innerHTML = `
      <div class="delete-confirm-content">
        <div class="delete-confirm-header">
          <div class="delete-confirm-icon">⚠️</div>
          <h3>删除用户确认</h3>
        </div>
        <div class="delete-confirm-body">
          <p>您确定要删除用户 <strong>${username}</strong> 吗？</p>
          <p class="delete-confirm-warning">此操作不可恢复！用户将立即被强制登出系统。</p>
        </div>
        <div class="delete-confirm-footer">
          <button class="delete-confirm-cancel">取消</button>
          <button class="delete-confirm-delete">删除</button>
        </div>
      </div>
    `;

    // 添加样式
    const style = document.createElement("style");
    style.textContent = `
      .delete-confirm-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }
      .delete-confirm-content {
        background-color: white;
        border-radius: 8px;
        padding: 20px;
        width: 400px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      }
      .delete-confirm-header {
        display: flex;
        align-items: center;
        margin-bottom: 15px;
      }
      .delete-confirm-icon {
        font-size: 24px;
        margin-right: 10px;
      }
      .delete-confirm-header h3 {
        margin: 0;
        color: #d32f2f;
      }
      .delete-confirm-body {
        margin-bottom: 20px;
      }
      .delete-confirm-warning {
        color: #d32f2f;
        font-weight: bold;
      }
      .delete-confirm-footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      .delete-confirm-cancel {
        padding: 8px 16px;
        background-color: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
      }
      .delete-confirm-delete {
        padding: 8px 16px;
        background-color: #d32f2f;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(modal);

    // 返回Promise，等待用户操作
    return new Promise((resolve) => {
      const cancelButton = modal.querySelector(".delete-confirm-cancel");
      const deleteButton = modal.querySelector(".delete-confirm-delete");

      cancelButton.addEventListener("click", () => {
        document.body.removeChild(modal);
        resolve(false);
      });

      deleteButton.addEventListener("click", () => {
        document.body.removeChild(modal);
        resolve(true);
      });
    });
  }

  /**
   * 显示删除加载状态
   * @param {HTMLElement} userRow - 用户行元素
   * @private
   */
  _showDeleteLoadingState(userRow) {
    if (!userRow) return;

    // 添加加载状态类
    userRow.classList.add("deleting");

    // 禁用操作按钮
    const buttons = userRow.querySelectorAll("button");
    buttons.forEach((button) => {
      button.disabled = true;
    });

    // 添加加载指示器
    const actionsCell = userRow.querySelector(".user-actions");
    if (actionsCell) {
      const loadingIndicator = document.createElement("div");
      loadingIndicator.className = "loading-indicator";
      loadingIndicator.innerHTML = "删除中...";
      actionsCell.appendChild(loadingIndicator);
    }
  }

  /**
   * 显示成功消息
   * @param {string} message - 消息内容
   * @private
   */
  _showSuccessMessage(message) {
    this._showToast(message, "success");
  }

  /**
   * 显示错误消息
   * @param {string} message - 消息内容
   * @private
   */
  _showErrorMessage(message) {
    this._showToast(message, "error");
  }

  /**
   * 显示信息消息
   * @param {string} message - 消息内容
   * @private
   */
  _showInfoMessage(message) {
    this._showToast(message, "info");
  }

  /**
   * 显示Toast消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型 (success, error, info)
   * @private
   */
  _showToast(message, type = "info") {
    // 检查是否已存在Toast容器
    let toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.className = "toast-container";
      document.body.appendChild(toastContainer);

      // 添加样式
      const style = document.createElement("style");
      style.textContent = `
        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .toast {
          padding: 12px 20px;
          border-radius: 4px;
          color: white;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
          animation: toast-in 0.3s ease-out;
          max-width: 300px;
        }
        .toast-success {
          background-color: #4caf50;
        }
        .toast-error {
          background-color: #f44336;
        }
        .toast-info {
          background-color: #2196f3;
        }
        @keyframes toast-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // 创建Toast元素
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    // 3秒后自动移除
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease-out";

      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  /**
   * 显示加载状态
   * @private
   */
  _showLoading() {
    if (!this.noUsersElement) return;

    this.noUsersElement.style.display = "flex";
    this.noUsersElement.innerHTML = `
      <div class="loading-spinner"></div>
      <p>正在加载用户列表...</p>
    `;
  }

  /**
   * 显示错误信息
   * @param {string} message - 错误信息
   * @private
   */
  _showError(message) {
    if (!this.noUsersElement) return;

    this.noUsersElement.style.display = "flex";
    this.noUsersElement.innerHTML = `
      <div class="error-icon">❌</div>
      <p>${message}</p>
      <button class="retry-button" onclick="document.getElementById('refresh-users-list').click()">
        重试
      </button>
    `;
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
