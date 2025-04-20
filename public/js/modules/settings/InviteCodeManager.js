/**
 * 邀请码管理模块
 * 处理邀请码的创建、显示和删除
 */

/**
 * 初始化邀请码管理功能
 * @param {HTMLElement} container - 邀请码管理容器元素
 */
export function initInviteCodeManager(container) {
  if (!container) return;

  // 创建邀请码管理UI
  createInviteCodeManagerUI(container);

  // 加载邀请码列表
  loadInviteCodes();

  /**
   * 创建邀请码管理UI
   * @param {HTMLElement} container - 邀请码管理容器元素
   */
  function createInviteCodeManagerUI(container) {
    container.innerHTML = `
      <div class="invite-code-manager">
        <div class="invite-code-header">
          <h3>邀请码管理</h3>
          <button id="create-invite-code" class="btn btn-primary">生成新邀请码</button>
        </div>
        <div class="invite-code-list-container">
          <div id="invite-code-list" class="invite-code-list">
            <div class="loading-indicator">加载中...</div>
          </div>
          <div id="no-invite-codes" class="no-invite-codes" style="display: none;">
            <p>暂无可用邀请码</p>
          </div>
        </div>
      </div>
    `;

    // 添加事件监听器
    document.getElementById("create-invite-code").addEventListener("click", createInviteCode);
  }

  /**
   * 加载邀请码列表
   */
  async function loadInviteCodes() {
    const inviteCodeList = document.getElementById("invite-code-list");
    const noInviteCodes = document.getElementById("no-invite-codes");

    try {
      const response = await fetch("/api/invite-codes");
      const data = await response.json();

      if (data.success) {
        inviteCodeList.innerHTML = "";

        if (data.inviteCodes && data.inviteCodes.length > 0) {
          data.inviteCodes.forEach(inviteCode => {
            const inviteCodeElement = createInviteCodeElement(inviteCode);
            inviteCodeList.appendChild(inviteCodeElement);
          });
          inviteCodeList.style.display = "block";
          noInviteCodes.style.display = "none";
        } else {
          inviteCodeList.style.display = "none";
          noInviteCodes.style.display = "block";
        }
      } else {
        inviteCodeList.innerHTML = `<div class="error-message">加载邀请码失败: ${data.message}</div>`;
      }
    } catch (error) {
      console.error("加载邀请码失败:", error);
      inviteCodeList.innerHTML = `<div class="error-message">加载邀请码失败，请稍后重试</div>`;
    }
  }

  /**
   * 创建邀请码元素
   * @param {Object} inviteCode - 邀请码对象
   * @returns {HTMLElement} 邀请码元素
   */
  function createInviteCodeElement(inviteCode) {
    const inviteCodeElement = document.createElement("div");
    inviteCodeElement.className = "invite-code-item";
    inviteCodeElement.dataset.code = inviteCode.code;

    // 格式化创建时间
    const createdAt = new Date(inviteCode.created_at);
    const formattedDate = createdAt.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    inviteCodeElement.innerHTML = `
      <div class="invite-code-info">
        <div class="invite-code-value">${inviteCode.code}</div>
        <div class="invite-code-date">创建于: ${formattedDate}</div>
      </div>
      <div class="invite-code-actions">
        <button class="btn btn-icon copy-invite-code" title="复制邀请码">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="btn btn-icon delete-invite-code" title="删除邀请码">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      </div>
    `;

    // 添加复制按钮事件
    inviteCodeElement.querySelector(".copy-invite-code").addEventListener("click", () => {
      copyInviteCode(inviteCode.code);
    });

    // 添加删除按钮事件
    inviteCodeElement.querySelector(".delete-invite-code").addEventListener("click", () => {
      deleteInviteCode(inviteCode.code);
    });

    return inviteCodeElement;
  }

  /**
   * 创建新邀请码
   */
  async function createInviteCode() {
    const createButton = document.getElementById("create-invite-code");
    createButton.disabled = true;
    createButton.textContent = "生成中...";

    try {
      const response = await fetch("/api/invite-codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.success) {
        // 重新加载邀请码列表
        loadInviteCodes();
        showToast("邀请码创建成功", "success");
      } else {
        showToast(`创建邀请码失败: ${data.message}`, "error");
      }
    } catch (error) {
      console.error("创建邀请码失败:", error);
      showToast("创建邀请码失败，请稍后重试", "error");
    } finally {
      createButton.disabled = false;
      createButton.textContent = "生成新邀请码";
    }
  }

  /**
   * 复制邀请码到剪贴板
   * @param {string} code - 邀请码
   */
  function copyInviteCode(code) {
    navigator.clipboard.writeText(code)
      .then(() => {
        showToast("邀请码已复制到剪贴板", "success");
      })
      .catch(err => {
        console.error("复制邀请码失败:", err);
        showToast("复制邀请码失败", "error");
      });
  }

  /**
   * 删除邀请码
   * @param {string} code - 邀请码
   */
  async function deleteInviteCode(code) {
    if (!confirm("确定要删除这个邀请码吗？")) {
      return;
    }

    try {
      const response = await fetch(`/api/invite-codes/${code}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        // 从DOM中移除邀请码元素
        const inviteCodeElement = document.querySelector(`.invite-code-item[data-code="${code}"]`);
        if (inviteCodeElement) {
          inviteCodeElement.remove();
        }

        // 检查是否还有邀请码
        const inviteCodeList = document.getElementById("invite-code-list");
        const noInviteCodes = document.getElementById("no-invite-codes");
        
        if (inviteCodeList.children.length === 0) {
          inviteCodeList.style.display = "none";
          noInviteCodes.style.display = "block";
        }

        showToast("邀请码已删除", "success");
      } else {
        showToast(`删除邀请码失败: ${data.message}`, "error");
      }
    } catch (error) {
      console.error("删除邀请码失败:", error);
      showToast("删除邀请码失败，请稍后重试", "error");
    }
  }

  /**
   * 显示提示消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型 (success/error)
   */
  function showToast(message, type) {
    // 检查是否已存在toast容器
    let toastContainer = document.querySelector(".toast-container");
    
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.className = "toast-container";
      document.body.appendChild(toastContainer);
    }

    // 创建新的toast
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // 添加到容器
    toastContainer.appendChild(toast);
    
    // 自动移除
    setTimeout(() => {
      toast.classList.add("fade-out");
      setTimeout(() => {
        toast.remove();
        // 如果没有更多toast，移除容器
        if (toastContainer.children.length === 0) {
          toastContainer.remove();
        }
      }, 300);
    }, 3000);
  }
}
