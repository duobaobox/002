/**
 * WebSocket服务模块
 * 用于实时通知客户端重要事件，如账户删除
 */
import { WebSocketServer } from "ws";

// 存储所有活跃的WebSocket连接
const activeConnections = new Map();
// WebSocket常量
const OPEN = 1; // WebSocket.OPEN 的值

/**
 * 初始化WebSocket服务
 * @param {Object} server - HTTP服务器实例
 */
export function initWebSocketService(server) {
  const wss = new WebSocketServer({ server });

  console.log("WebSocket服务已初始化");

  wss.on("connection", (ws, req) => {
    // 从URL中获取用户名
    const url = new URL(req.url, `http://${req.headers.host}`);
    const username = url.searchParams.get("username");

    if (!username) {
      console.log("WebSocket连接尝试没有提供用户名，关闭连接");
      ws.close();
      return;
    }

    console.log(`用户 ${username} 的WebSocket连接已建立`);

    // 存储连接
    if (!activeConnections.has(username)) {
      activeConnections.set(username, []);
    }
    activeConnections.get(username).push(ws);

    // 发送连接成功消息
    ws.send(
      JSON.stringify({
        type: "connection",
        message: "连接成功",
      })
    );

    // 处理连接关闭
    ws.on("close", () => {
      console.log(`用户 ${username} 的WebSocket连接已关闭`);

      // 从活跃连接中移除
      if (activeConnections.has(username)) {
        const connections = activeConnections.get(username);
        const index = connections.indexOf(ws);
        if (index !== -1) {
          connections.splice(index, 1);
        }

        // 如果没有更多连接，删除用户条目
        if (connections.length === 0) {
          activeConnections.delete(username);
        }
      }
    });

    // 处理错误
    ws.on("error", (error) => {
      console.error(`WebSocket错误 (${username}):`, error);
    });
  });

  return wss;
}

/**
 * 向指定用户发送账户删除通知
 * @param {string} username - 用户名
 */
export function notifyAccountDeleted(username) {
  if (!activeConnections.has(username)) {
    console.log(
      `用户 ${username} 没有活跃的WebSocket连接，无法发送账户删除通知`
    );
    return false;
  }

  const connections = activeConnections.get(username);
  console.log(
    `向用户 ${username} 的 ${connections.length} 个连接发送账户删除通知`
  );

  // 向所有连接发送通知
  connections.forEach((ws) => {
    if (ws.readyState === OPEN) {
      ws.send(
        JSON.stringify({
          type: "account_deleted",
          message: "您的账户已被管理员删除",
        })
      );
    }
  });

  return true;
}

export default {
  initWebSocketService,
  notifyAccountDeleted,
};
