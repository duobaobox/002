/**
 * 邀请码管理模块
 * 处理邀请码的创建、显示和删除
 */
import { showSuccess, showError } from "../utils/NotificationManager.js";

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
          <button id="generate-invite-code" class="settings-button primary-button">生成新邀请码</button>
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

    // 添加事件监听器 - 修改这里，将create-invite-code改为generate-invite-code
    document
      .getElementById("generate-invite-code")
      .addEventListener("click", createInviteCode);
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
          // 添加说明文本
          const infoElement = document.createElement("div");
          infoElement.className = "invite-code-info-text";
          infoElement.innerHTML = `
            <p>所有邀请码均为永久有效，可以重复使用。删除后将无法使用。</p>
          `;
          inviteCodeList.appendChild(infoElement);

          // 显示所有邀请码
          data.inviteCodes.forEach((inviteCode) => {
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
    const createdAt = new Date(inviteCode.createdAt);
    const formattedDate = createdAt.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // 格式化使用时间（如果有）
    let usedInfo = "";
    if (inviteCode.isUsed && inviteCode.usedAt) {
      const usedAt = new Date(inviteCode.usedAt);
      const formattedUsedDate = usedAt.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      usedInfo = `<div class="invite-code-used">已使用过: ${formattedUsedDate}</div>`;
    }

    inviteCodeElement.innerHTML = `
      <div class="invite-code-info">
        <div class="invite-code-value">${inviteCode.code}</div>
        <div class="invite-code-date">创建于: ${formattedDate}</div>
        ${usedInfo}
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
    inviteCodeElement
      .querySelector(".copy-invite-code")
      .addEventListener("click", () => {
        copyInviteCode(inviteCode.code);
      });

    // 添加删除按钮事件
    inviteCodeElement
      .querySelector(".delete-invite-code")
      .addEventListener("click", () => {
        deleteInviteCode(inviteCode.code);
      });

    return inviteCodeElement;
  }

  /**
   * 创建新邀请码
   */
  async function createInviteCode() {
    const createButton = document.getElementById("generate-invite-code");
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
        showSuccess("邀请码创建成功");
      } else {
        showError(`创建邀请码失败: ${data.message}`);
      }
    } catch (error) {
      console.error("创建邀请码失败:", error);
      showError("创建邀请码失败，请稍后重试");
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
    navigator.clipboard
      .writeText(code)
      .then(() => {
        showSuccess("邀请码已复制到剪贴板");
      })
      .catch((err) => {
        console.error("复制邀请码失败:", err);
        showError("复制邀请码失败");
      });
  }

  /**
   * 删除邀请码
   * @param {string} code - 邀请码
   */
  async function deleteInviteCode(code) {
    // 使用自定义确认对话框
    const confirmResult = await showDeleteConfirmDialog(code);
    if (!confirmResult) {
      return;
    }

    /**
     * 显示删除确认对话框
     * @param {string} code - 邀请码
     * @returns {Promise<boolean>} 是否确认删除
     */
    async function showDeleteConfirmDialog(code) {
      // 创建模态对话框
      const modal = document.createElement("div");
      modal.className = "delete-confirm-modal";
      modal.innerHTML = `
        <div class="delete-confirm-content">
          <div class="delete-confirm-header">
            <div class="delete-confirm-icon">⚠️</div>
            <h3>删除邀请码确认</h3>
          </div>
          <div class="delete-confirm-body">
            <p class="delete-confirm-title">您确定要删除邀请码 <strong>${code}</strong> 吗？</p>
            <div class="delete-confirm-info">
              <p class="delete-confirm-warning">⚠️ 请确认此操作</p>
              <ul class="delete-confirm-details">
                <li>删除后，该邀请码将无法用于注册新用户</li>
                <li>此操作不可恢复</li>
              </ul>
            </div>
          </div>
          <div class="delete-confirm-footer">
            <button class="delete-confirm-cancel">取消</button>
            <button class="delete-confirm-delete">确认删除</button>
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
          z-index: 100000; /* 确保显示在所有元素之上，包括通知 */
        }
        .delete-confirm-content {
          background-color: white;
          border-radius: 12px;
          padding: 25px;
          width: 450px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
          animation: modal-in 0.3s ease-out;
          transform: scale(1);
        }

        @keyframes modal-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
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
          margin-bottom: 25px;
        }
        .delete-confirm-title {
          font-size: 16px;
          margin-bottom: 15px;
        }
        .delete-confirm-info {
          background-color: #fff8f8;
          border-radius: 8px;
          padding: 15px;
          border-left: 4px solid #d32f2f;
        }
        .delete-confirm-warning {
          color: #d32f2f;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .delete-confirm-details {
          margin: 0;
          padding-left: 20px;
          color: #555;
        }
        .delete-confirm-details li {
          margin-bottom: 5px;
        }
        .delete-confirm-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .delete-confirm-cancel {
          padding: 10px 20px;
          background-color: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        .delete-confirm-cancel:hover {
          background-color: #e0e0e0;
        }
        .delete-confirm-delete {
          padding: 10px 20px;
          background-color: #d32f2f;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
          box-shadow: 0 2px 5px rgba(211, 47, 47, 0.3);
        }
        .delete-confirm-delete:hover {
          background-color: #b71c1c;
          box-shadow: 0 3px 8px rgba(211, 47, 47, 0.4);
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

    try {
      const response = await fetch(`/api/invite-codes/${code}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        // 从DOM中移除邀请码元素
        const inviteCodeElement = document.querySelector(
          `.invite-code-item[data-code="${code}"]`
        );
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

        showSuccess("邀请码已删除");
      } else {
        showError(`删除邀请码失败: ${data.message}`);
      }
    } catch (error) {
      console.error("删除邀请码失败:", error);
      showError("删除邀请码失败，请稍后重试");
    }
  }

  // 使用统一的通知管理器，移除旧的showToast函数
}
