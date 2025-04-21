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

    // 创建分享记录
    const shareData = {
      id: shareId,
      userId,
      notes,
      canvasState: req.body.canvasState || {},
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
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

    // 更新分享数据（如果需要）
    if (shareData.userId) {
      // 获取最新的便签数据
      const notes = await getAllNotes();

      // 更新缓存中的数据
      shareData.notes = notes;
      shareData.lastUpdated = new Date().toISOString();
      shareCache.set(shareId, shareData);
    }

    // 返回分享数据
    res.json({
      success: true,
      notes: shareData.notes,
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
