/**
 * 连接工具模块
 * 提供连接状态管理功能
 */

/**
 * 更新连接状态
 * 空实现，不再向用户显示连接状态
 * @param {string} status - 连接状态：'connecting', 'connected', 'generating', 'error', 'disconnected'
 */
export function updateConnectionStatus(status) {
  // 空实现，不再显示连接状态
  // 仅在控制台记录状态变化，便于调试
  console.debug(`AI连接状态变化: ${status}`);
}
