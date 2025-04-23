/**
 * 分享功能路由
 * 处理画布分享相关的API请求
 */

import express from "express";
import { v4 as uuidv4 } from "uuid";
import {
  getAllNotes,
  getUserShareInfo,
  updateUserShareInfo,
  closeUserShare,
  getUserByShareId,
} from "./database.js";
import { requireAuth } from "./middleware.js";

console.log("初始化分享路由模块");
console.log("注册分享状态路由: /status");

const router = express.Router();

/**
 * 获取当前用户的分享状态
 * GET /api/share/status
 * 需要身份验证
 */
router.get("/status", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // 获取用户的分享信息
    const shareInfo = await getUserShareInfo(userId);

    if (!shareInfo || !shareInfo.shareStatus) {
      return res.json({
        success: true,
        shareStatus: false,
        message: "没有活跃的分享",
      });
    }

    // 返回分享状态
    res.json({
      success: true,
      shareStatus: true,
      shareId: shareInfo.shareId,
      shareLink: shareInfo.shareLink,
      canvasName: shareInfo.canvasName,
      shareNotes: shareInfo.shareNotes,
      canvasState: shareInfo.canvasState,
      message: "已获取分享状态",
    });
  } catch (error) {
    console.error("获取分享状态出错:", error);
    res.status(500).json({
      success: false,
      message: "获取分享状态失败",
      error: error.message,
    });
  }
});

/**
 * 创建新的分享
 * POST /api/share
 * 需要身份验证
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    // 获取用户ID
    const userId = req.session.user.id;

    console.log("创建分享，用户ID:", userId);

    // 检查用户是否已有分享
    const existingShare = await getUserShareInfo(userId);
    if (existingShare && existingShare.shareStatus) {
      // 如果已有活跃的分享，返回现有分享ID
      return res.json({
        success: true,
        shareId: existingShare.shareId,
        message: "分享已存在",
        existing: true,
      });
    }

    // 生成唯一的分享ID
    const shareId = uuidv4();

    // 获取画布名称（如果有）
    const canvasName = req.body.canvasName || "InfinityNotes";

    // 生成分享链接
    const shareLink = `${req.protocol}://${req.get(
      "host"
    )}/share.html?id=${shareId}&name=${encodeURIComponent(canvasName)}`;

    // 获取画布状态（如果有）
    const canvasState = req.body.canvasState || null;

    // 更新用户的分享信息
    await updateUserShareInfo(userId, {
      shareId,
      shareLink,
      shareStatus: true,
      canvasName,
      shareNotes: true, // 默认分享便签
      canvasState, // 保存画布状态
    });

    // 返回分享ID和链接
    res.json({
      success: true,
      shareId,
      shareLink,
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

    // 从数据库获取分享用户信息
    const userData = await getUserByShareId(shareId);

    if (userData.notFound) {
      return res.status(404).json({
        success: false,
        message: "分享不存在",
      });
    }

    if (userData.closed) {
      return res.json({
        success: false,
        isClosed: true,
        message: "分享已关闭",
        canvasName: userData.canvasName || "InfinityNotes",
      });
    }

    // 获取用户的所有便签
    const notes = await getAllNotes();

    // 获取当前时间作为最后更新时间
    const lastUpdated = new Date().toISOString();

    // 返回分享数据
    res.json({
      success: true,
      notes: userData.shareNotes ? notes : [], // 如果用户选择不分享便签，则返回空数组
      canvasName: userData.canvasName || "InfinityNotes", // 返回画布名称
      canvasState: userData.canvasState, // 返回画布状态
      lastUpdated: lastUpdated,
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
 * 需要身份验证
 */
router.post("/refresh/:id", requireAuth, async (req, res) => {
  try {
    const shareId = req.params.id;
    const userId = req.session.user.id;

    console.log("刷新分享内容，用户ID:", userId);

    // 获取用户的分享信息
    const userShareInfo = await getUserShareInfo(userId);

    if (!userShareInfo || !userShareInfo.shareStatus) {
      return res.status(404).json({
        success: false,
        message: "您没有活跃的分享",
      });
    }

    // 检查是否是该用户的分享
    if (userShareInfo.shareId !== shareId) {
      return res.status(403).json({
        success: false,
        message: "无权刷新此分享",
      });
    }

    // 更新画布状态（如果提供了）
    if (req.body.canvasState) {
      // 更新用户的分享信息，包括新的画布状态
      await updateUserShareInfo(userId, {
        ...userShareInfo,
        canvasState: req.body.canvasState,
      });
    }

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
 * 需要身份验证
 */
router.post("/close/:id", requireAuth, async (req, res) => {
  try {
    const shareId = req.params.id;
    const userId = req.session.user.id;

    console.log("关闭分享，用户ID:", userId);

    // 获取用户的分享信息
    const userShareInfo = await getUserShareInfo(userId);

    if (!userShareInfo || !userShareInfo.shareStatus) {
      return res.status(404).json({
        success: false,
        message: "您没有活跃的分享",
      });
    }

    // 检查是否是该用户的分享
    if (userShareInfo.shareId !== shareId) {
      return res.status(403).json({
        success: false,
        message: "无权关闭此分享",
      });
    }

    // 关闭用户的分享
    await closeUserShare(userId);

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

export default router;
