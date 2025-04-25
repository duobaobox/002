/**
 * 分享页面通知管理器模块
 * 提供与主应用一致的通知显示功能
 * 
 * 所有通知都显示在屏幕顶部居中位置，确保视觉一致性
 */

/**
 * 显示通知消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 (success/error/info/warning)
 * @param {number} duration - 显示时长(毫秒)，默认3000ms
 */
export function showNotification(message, type = "info", duration = 3000) {
  // 查找或创建通知容器
  let notificationContainer = document.querySelector(".notification-container");
  
  if (!notificationContainer) {
    notificationContainer = document.createElement("div");
    notificationContainer.className = "notification-container";
    document.body.appendChild(notificationContainer);
    
    // 添加样式
    if (!document.getElementById("notification-styles")) {
      const style = document.createElement("style");
      style.id = "notification-styles";
      style.textContent = `
        .notification-container {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          z-index: 99999; /* 确保在最上层，但低于确认对话框 */
          pointer-events: none; /* 避免阻挡点击 */
        }
        
        .notification {
          padding: 12px 25px;
          border-radius: 8px;
          background-color: rgba(50, 50, 50, 0.9);
          color: #fff;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
          opacity: 0;
          transform: translateY(-20px);
          transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1),
                      opacity 0.4s ease-out;
          pointer-events: none;
          max-width: 80%;
          text-align: center;
        }
        
        .notification.show {
          opacity: 1;
          transform: translateY(0);
        }
        
        .notification-success {
          background-color: rgba(76, 175, 80, 0.9);
        }
        
        .notification-error {
          background-color: rgba(244, 67, 54, 0.9);
        }
        
        .notification-warning {
          background-color: rgba(255, 152, 0, 0.9);
        }
        
        .notification-info {
          background-color: rgba(33, 150, 243, 0.9);
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  // 创建通知元素
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notificationContainer.appendChild(notification);
  
  // 使用RAF确保DOM更新后再添加show类
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      notification.classList.add("show");
      
      // 自动隐藏
      setTimeout(() => {
        notification.classList.remove("show");
        
        // 移除元素
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
          
          // 如果没有更多通知，移除容器
          if (notificationContainer.children.length === 0) {
            notificationContainer.remove();
          }
        }, 400); // 等待过渡完成
      }, duration);
    });
  });
}

/**
 * 显示成功通知
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长(毫秒)
 */
export function showSuccess(message, duration = 3000) {
  showNotification(message, "success", duration);
}

/**
 * 显示错误通知
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长(毫秒)
 */
export function showError(message, duration = 3000) {
  showNotification(message, "error", duration);
}

/**
 * 显示警告通知
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长(毫秒)
 */
export function showWarning(message, duration = 3000) {
  showNotification(message, "warning", duration);
}

/**
 * 显示信息通知
 * @param {string} message - 消息内容
 * @param {number} duration - 显示时长(毫秒)
 */
export function showInfo(message, duration = 3000) {
  showNotification(message, "info", duration);
}
