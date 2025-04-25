/**
 * 用户管理路由模块
 * 处理用户管理相关的API请求
 */

import express from "express";
import bcrypt from "bcrypt";
import { requireAuth, requireAdmin } from "./middleware.js";
import { dbAll, dbGet, dbRun } from "./database.js";

const router = express.Router();

// 所有用户管理路由都需要认证
router.use(requireAuth);

/**
 * 获取所有用户列表 (仅管理员)
 * GET /api/users
 */
router.get("/", requireAdmin, async (req, res) => {
  try {
    // 检查 is_active 字段是否存在
    let hasIsActiveField = false;
    try {
      const tableInfo = await dbAll("PRAGMA table_info(users)");
      hasIsActiveField = tableInfo.some(
        (column) => column.name === "is_active"
      );
    } catch (error) {
      console.error("检查 is_active 字段失败:", error);
    }

    // 根据 is_active 字段是否存在构建查询
    const query = hasIsActiveField
      ? `SELECT id, username, createdAt,
         CASE WHEN username = 'admin' THEN 1 ELSE is_active END as is_active
         FROM users ORDER BY id ASC`
      : `SELECT id, username, createdAt,
         CASE WHEN username = 'admin' THEN 1 ELSE 1 END as is_active
         FROM users ORDER BY id ASC`;

    const users = await dbAll(query);

    res.json({
      success: true,
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
        isActive: user.is_active === 1,
      })),
    });
  } catch (error) {
    console.error("获取用户列表失败:", error);
    res.status(500).json({
      success: false,
      message: "获取用户列表失败",
    });
  }
});

/**
 * 获取用户详情 (仅管理员)
 * GET /api/users/:id
 */
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // 检查 is_active 字段是否存在
    let hasIsActiveField = false;
    try {
      const tableInfo = await dbAll("PRAGMA table_info(users)");
      hasIsActiveField = tableInfo.some(
        (column) => column.name === "is_active"
      );
    } catch (error) {
      console.error("检查 is_active 字段失败:", error);
    }

    // 根据 is_active 字段是否存在构建查询
    const query = hasIsActiveField
      ? `SELECT id, username, createdAt,
         CASE WHEN username = 'admin' THEN 1 ELSE is_active END as is_active
         FROM users WHERE id = ?`
      : `SELECT id, username, createdAt,
         CASE WHEN username = 'admin' THEN 1 ELSE 1 END as is_active
         FROM users WHERE id = ?`;

    const user = await dbGet(query, [userId]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "用户不存在",
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
        isActive: user.is_active === 1,
      },
    });
  } catch (error) {
    console.error("获取用户详情失败:", error);
    res.status(500).json({
      success: false,
      message: "获取用户详情失败",
    });
  }
});

/**
 * 重置用户密码 (仅管理员)
 * POST /api/users/:id/reset-password
 */
router.post("/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // 检查用户是否存在
    const user = await dbGet("SELECT username FROM users WHERE id = ?", [
      userId,
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "用户不存在",
      });
    }

    // 不允许重置管理员密码
    if (user.username === "admin") {
      return res.status(403).json({
        success: false,
        message: "不允许重置管理员密码",
      });
    }

    // 生成随机密码
    const newPassword = generateRandomPassword(8);

    // 哈希新密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 更新用户密码
    await dbRun("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      userId,
    ]);

    res.json({
      success: true,
      message: "密码已重置",
      newPassword: newPassword,
    });
  } catch (error) {
    console.error("重置用户密码失败:", error);
    res.status(500).json({
      success: false,
      message: "重置用户密码失败",
    });
  }
});

/**
 * 删除用户 (仅管理员)
 * DELETE /api/users/:id
 */
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // 检查用户是否存在
    const user = await dbGet("SELECT username FROM users WHERE id = ?", [
      userId,
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "用户不存在",
      });
    }

    // 不允许删除管理员
    if (user.username === "admin") {
      return res.status(403).json({
        success: false,
        message: "不允许删除管理员账户",
      });
    }

    // 获取被删除用户的用户名，用于后续会话清理
    const deletedUsername = user.username;

    // 删除用户
    await dbRun("DELETE FROM users WHERE id = ?", [userId]);

    // 将被删除的用户信息添加到响应中，以便前端可以使用
    res.json({
      success: true,
      message: "用户已成功删除",
      deletedUser: {
        id: userId,
        username: deletedUsername,
      },
    });

    // 通知会话管理器，该用户已被删除
    // 这将在下一次请求时使该用户的会话失效
    if (req.app.locals.deletedUsers === undefined) {
      req.app.locals.deletedUsers = new Set();
    }
    req.app.locals.deletedUsers.add(deletedUsername);

    console.log(
      `用户 ${deletedUsername} (ID: ${userId}) 已被删除，其会话将在下次请求时失效`
    );
  } catch (error) {
    console.error("删除用户失败:", error);
    res.status(500).json({
      success: false,
      message: "删除用户失败",
    });
  }
});

/**
 * 生成随机密码
 * @param {number} length - 密码长度
 * @returns {string} 随机密码
 */
function generateRandomPassword(length) {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }

  return password;
}

export default router;
