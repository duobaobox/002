/**
 * 账户删除通知模块
 * 用于显示友好的账户删除通知并处理重定向
 */

import webSocketManager from '../utils/WebSocketManager.js';

/**
 * 初始化账户删除通知器
 * @param {string} username - 当前用户名
 */
export function initAccountDeletedNotifier(username) {
  if (!username) {
    console.error('无法初始化账户删除通知器：未提供用户名');
    return;
  }

  console.log(`初始化账户删除通知器，用户名: ${username}`);

  // 连接WebSocket
  webSocketManager.connect(username);

  // 监听账户删除事件
  webSocketManager.on('account_deleted', handleAccountDeleted);

  // 检查会话存储中是否有账户删除标记
  checkSessionStorageForAccountDeleted();
}

/**
 * 处理账户删除事件
 * @param {Object} data - 事件数据
 */
function handleAccountDeleted(data) {
  console.log('收到账户删除通知:', data);
  
  // 显示账户删除通知
  showAccountDeletedNotification();
  
  // 存储账户删除状态，以便登录页面显示相应消息
  sessionStorage.setItem('accountDeleted', 'true');
  
  // 3秒后重定向到登录页面
  setTimeout(() => {
    window.location.href = '/login.html';
  }, 3000);
}

/**
 * 显示账户删除通知
 */
function showAccountDeletedNotification() {
  // 创建通知容器
  const container = document.createElement('div');
  container.className = 'account-deleted-notification';
  
  // 设置通知内容
  container.innerHTML = `
    <div class="account-deleted-content">
      <div class="account-deleted-icon">⚠️</div>
      <div class="account-deleted-title">您的账户已被删除</div>
      <div class="account-deleted-message">您的账户已被管理员删除，即将返回登录页面</div>
      <div class="account-deleted-timer">3</div>
    </div>
  `;
  
  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .account-deleted-notification {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      animation: fade-in 0.3s ease-out;
    }
    
    .account-deleted-content {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }
    
    .account-deleted-icon {
      font-size: 48px;
      margin-bottom: 20px;
    }
    
    .account-deleted-title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 15px;
      color: #f44336;
    }
    
    .account-deleted-message {
      font-size: 16px;
      margin-bottom: 20px;
      color: #333;
      line-height: 1.5;
    }
    
    .account-deleted-timer {
      font-size: 20px;
      font-weight: bold;
      color: #f44336;
      background-color: #ffebee;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0 auto;
    }
    
    @keyframes fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `;
  
  // 添加到文档
  document.head.appendChild(style);
  document.body.appendChild(container);
  
  // 更新倒计时
  const timerElement = container.querySelector('.account-deleted-timer');
  let seconds = 3;
  
  const interval = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      clearInterval(interval);
    } else {
      timerElement.textContent = seconds;
    }
  }, 1000);
}

/**
 * 检查会话存储中是否有账户删除标记
 */
function checkSessionStorageForAccountDeleted() {
  const accountDeleted = sessionStorage.getItem('accountDeleted');
  if (accountDeleted === 'true') {
    // 清除标记，避免重复显示
    sessionStorage.removeItem('accountDeleted');
    
    // 显示登录页面的账户删除消息
    const messageContainer = document.getElementById('login-message');
    if (messageContainer) {
      messageContainer.className = 'message-container error';
      messageContainer.textContent = '您的账户已被管理员删除，请联系管理员获取更多信息';
      messageContainer.style.display = 'block';
    }
  }
}

export default {
  initAccountDeletedNotifier
};
