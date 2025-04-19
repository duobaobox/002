/**
 * 连接状态指示器模块
 * 提供管理和更新AI连接状态指示器的功能
 */

/**
 * 连接状态类型
 * @enum {string}
 */
export const ConnectionStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  GENERATING: 'generating',
  ERROR: 'error'
};

/**
 * 连接状态指示器类
 */
export class ConnectionStatusIndicator {
  /**
   * 创建连接状态指示器
   */
  constructor() {
    this.indicator = document.querySelector('.connection-status-indicator');
    this.statusText = this.indicator.querySelector('.status-text');
    this.currentStatus = ConnectionStatus.DISCONNECTED;
    
    // 初始化状态
    this.updateStatus(ConnectionStatus.DISCONNECTED);
  }

  /**
   * 更新连接状态
   * @param {ConnectionStatus} status - 连接状态
   */
  updateStatus(status) {
    if (!this.indicator) return;
    
    // 保存当前状态
    this.currentStatus = status;
    
    // 移除所有状态类
    this.indicator.classList.remove(
      'status-connecting', 
      'status-connected', 
      'status-generating', 
      'status-error'
    );
    
    // 根据状态设置类和文本
    switch(status) {
      case ConnectionStatus.CONNECTING:
        this.indicator.classList.add('status-connecting');
        this.statusText.textContent = '连接中';
        this.indicator.title = 'AI服务连接中...';
        break;
      case ConnectionStatus.CONNECTED:
        this.indicator.classList.add('status-connected');
        this.statusText.textContent = '已连接';
        this.indicator.title = 'AI服务已连接，可以生成内容';
        break;
      case ConnectionStatus.GENERATING:
        this.indicator.classList.add('status-generating');
        this.statusText.textContent = '生成中';
        this.indicator.title = 'AI正在生成内容';
        break;
      case ConnectionStatus.ERROR:
        this.indicator.classList.add('status-error');
        this.statusText.textContent = '连接错误';
        this.indicator.title = 'AI服务连接出错，请检查设置';
        break;
      default:
        this.statusText.textContent = '未连接';
        this.indicator.title = 'AI服务未连接';
    }
  }

  /**
   * 获取当前连接状态
   * @returns {ConnectionStatus} 当前连接状态
   */
  getCurrentStatus() {
    return this.currentStatus;
  }
}

// 创建单例实例
const connectionStatusIndicator = new ConnectionStatusIndicator();

export default connectionStatusIndicator;
