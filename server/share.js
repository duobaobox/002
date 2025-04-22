/**
 * 分享功能路由
 * 处理画布分享相关的API请求
 */

import express from "express";
import { v4 as uuidv4 } from "uuid";
import { getAllNotes } from "./database.js";
import { requireAuth } from "./middleware.js";

console.log("初始化分享路由模块");

const router = express.Router();

// 存储分享数据的内存缓存
// 在实际生产环境中，应该使用数据库或Redis等持久化存储
const shareCache = new Map();

/**
 * 创建新的分享
 * POST /api/share
 * 不需要身份验证，便于测试
 */
router.post("/", async (req, res) => {
  try {
    // 获取用户ID（如果有），否则使用默认值
    const userId = req.session && req.session.user ? req.session.user.id : 1;

    console.log("创建分享，用户ID:", userId);

    // 生成唯一的分享ID
    const shareId = uuidv4();

    // 获取用户的所有便签
    const notes = await getAllNotes();

    // 获取画布名称（如果有）
    const canvasName = req.body.canvasName || "InfinityNotes";

    // 创建分享记录
    const shareData = {
      id: shareId,
      userId,
      notes,
      canvasName, // 添加画布名称
      canvasState: req.body.canvasState || {},
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      isActive: true, // 添加标记表示分享是否活跃
    };

    // 存储到缓存
    shareCache.set(shareId, shareData);

    // 返回分享ID
    res.json({
      success: true,
      shareId,
      message: "分享创建成功",
    });
  } catch (error) {
    console.error("创建分享出错:", error);
    res.status(500).json({
      success: false,
      message: "创建分享失败",
      error: error.message,
    });
  }
});

/**
 * 获取分享数据
 * GET /api/share/:id
 * 公开访问，不需要身份验证
 */
router.get("/:id", async (req, res) => {
  try {
    const shareId = req.params.id;

    // 从缓存获取分享数据
    const shareData = shareCache.get(shareId);

    if (!shareData) {
      return res.status(404).json({
        success: false,
        message: "分享不存在或已过期",
      });
    }

    // 检查分享是否已关闭
    if (shareData.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "分享已关闭",
        shareId: shareId,
        isClosed: true,
      });
    }

    // 如果请求包含lastUpdated参数，检查是否有更新
    if (
      req.query.lastUpdated &&
      req.query.lastUpdated === shareData.lastUpdated
    ) {
      return res.json({
        success: true,
        noChanges: true,
        lastUpdated: shareData.lastUpdated,
      });
    }

    // 不自动更新分享数据，只在用户主动刷新时更新
    // 这样可以避免每次访问分享页面时都要查询数据库

    // 返回分享数据
    res.json({
      success: true,
      notes: shareData.notes,
      canvasName: shareData.canvasName || "InfinityNotes", // 返回画布名称
      canvasState: shareData.canvasState,
      lastUpdated: shareData.lastUpdated,
    });
  } catch (error) {
    console.error("获取分享数据出错:", error);
    res.status(500).json({
      success: false,
      message: "获取分享数据失败",
      error: error.message,
    });
  }
});

/**
 * 刷新分享内容
 * POST /api/share/refresh/:id
 * 不需要身份验证，便于测试
 */
router.post("/refresh/:id", async (req, res) => {
  try {
    const shareId = req.params.id;
    // 获取用户ID（如果有），否则使用默认值
    const userId = req.session && req.session.user ? req.session.user.id : 1;

    console.log("刷新分享内容，用户ID:", userId);

    // 从缓存获取分享数据
    const shareData = shareCache.get(shareId);

    if (!shareData) {
      return res.status(404).json({
        success: false,
        message: "分享不存在或已过期",
      });
    }

    // 检查是否是分享的创建者
    if (shareData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "无权刷新此分享",
      });
    }

    // 检查分享是否已关闭
    if (shareData.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "分享已关闭",
      });
    }

    // 获取最新的便签数据
    const notes = await getAllNotes();

    // 更新缓存中的数据
    shareData.notes = notes;
    shareData.lastUpdated = new Date().toISOString();

    // 更新画布状态（如果提供了）
    if (req.body.canvasState) {
      shareData.canvasState = req.body.canvasState;
    }

    shareCache.set(shareId, shareData);

    res.json({
      success: true,
      message: "分享内容已更新",
    });
  } catch (error) {
    console.error("刷新分享出错:", error);
    res.status(500).json({
      success: false,
      message: "刷新分享失败",
      error: error.message,
    });
  }
});

/**
 * 关闭分享
 * POST /api/share/close/:id
 * 不需要身份验证，便于测试
 */
router.post("/close/:id", (req, res) => {
  try {
    const shareId = req.params.id;
    // 获取用户ID（如果有），否则使用默认值
    const userId = req.session && req.session.user ? req.session.user.id : 1;

    console.log("关闭分享，用户ID:", userId);

    // 从缓存获取分享数据
    const shareData = shareCache.get(shareId);

    if (!shareData) {
      return res.status(404).json({
        success: false,
        message: "分享不存在或已过期",
      });
    }

    // 检查是否是分享的创建者
    if (shareData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "无权关闭此分享",
      });
    }

    // 将分享标记为关闭
    shareData.isActive = false;
    shareData.closedAt = new Date().toISOString();
    shareCache.set(shareId, shareData);

    res.json({
      success: true,
      message: "分享已关闭",
    });
  } catch (error) {
    console.error("关闭分享出错:", error);
    res.status(500).json({
      success: false,
      message: "关闭分享失败",
      error: error.message,
    });
  }
});

/**
 * 删除分享
 * DELETE /api/share/:id
 * 不需要身份验证，便于测试
 */
router.delete("/:id", (req, res) => {
  try {
    const shareId = req.params.id;
    // 获取用户ID（如果有），否则使用默认值
    const userId = req.session && req.session.user ? req.session.user.id : 1;

    console.log("删除分享，用户ID:", userId);

    // 从缓存获取分享数据
    const shareData = shareCache.get(shareId);

    if (!shareData) {
      return res.status(404).json({
        success: false,
        message: "分享不存在或已过期",
      });
    }

    // 检查是否是分享的创建者
    if (shareData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "无权删除此分享",
      });
    }

    // 从缓存中删除分享
    shareCache.delete(shareId);

    res.json({
      success: true,
      message: "分享已删除",
    });
  } catch (error) {
    console.error("删除分享出错:", error);
    res.status(500).json({
      success: false,
      message: "删除分享失败",
      error: error.message,
    });
  }
});

export default router;
