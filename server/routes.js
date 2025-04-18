import express from "express";
import aiService from "./ai_service.js";
import {
  // Notes functions
  getAllNotes,
  addNote,
  updateNote,
  deleteNote,
  importNotes,
  resetNotes,
  // Settings functions
  getAllAiSettings,
  setSetting,
  // API 历史记录函数
  addOrUpdateApiKeyHistory,
  addOrUpdateBaseUrlHistory,
  addOrUpdateModelHistory,
  getApiKeyHistory,
  getBaseUrlHistory,
  getModelHistory,
  deleteApiKeyHistory,
  deleteBaseUrlHistory,
  deleteModelHistory,
  // User functions
  validateUserLogin,
  updateUserPassword,
  // Import dbFilePath
  dbFilePath,
} from "./database.js";
import { validateNoteData, requireAuth } from "./middleware.js";
// Need path for basename
import path from "path";

const router = express.Router();

// --- 认证路由 ---

// 登录
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // 基础验证
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "请输入用户名和密码",
      });
    }

    // 验证登录
    const user = await validateUserLogin(username, password);

    if (user) {
      // 存储用户信息到会话（不包含密码）
      req.session.user = user;
      res.json({
        success: true,
        message: "登录成功",
        user: {
          id: user.id,
          username: user.username,
        },
      });
    } else {
      res.status(401).json({
        success: false,
        message: "用户名或密码错误",
      });
    }
  } catch (error) {
    console.error("登录失败:", error);
    res.status(500).json({
      success: false,
      message: "登录发生错误",
    });
  }
});

// 登出
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "登出失败",
      });
    }
    res.json({
      success: true,
      message: "已成功登出",
    });
  });
});

// 检查登录状态
router.get("/session", (req, res) => {
  if (req.session && req.session.user) {
    res.json({
      success: true,
      isLoggedIn: true,
      user: {
        id: req.session.user.id,
        username: req.session.user.username,
      },
    });
  } else {
    res.json({
      success: true,
      isLoggedIn: false,
    });
  }
});

// 修改密码
router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user.id;
    const username = req.session.user.username;

    // 基础验证
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "当前密码和新密码都必须提供",
      });
    }

    // 验证当前密码 - 使用更新后的validateUserLogin函数
    const user = await validateUserLogin(username, currentPassword);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "当前密码不正确",
      });
    }

    // 更新密码 - updateUserPassword已经会处理密码哈希
    await updateUserPassword(userId, newPassword);

    res.json({
      success: true,
      message: "密码已成功更新",
    });
  } catch (error) {
    console.error("更新密码失败:", error);
    res.status(500).json({
      success: false,
      message: "密码更新失败，请稍后重试",
    });
  }
});

// --- 所有需要认证的 API 路由 ---

// 为所有便签和设置相关的API添加认证中间件
router.use("/notes", requireAuth);
router.use("/generate", requireAuth);
router.use("/ai-settings", requireAuth);
router.use("/settings", requireAuth);
router.use("/database", requireAuth);
router.use("/test-ai-connection", requireAuth);

// --- Note Routes ---

// 获取所有便签 - 从数据库获取
router.get("/notes", async (req, res) => {
  try {
    const notes = await getAllNotes();
    // 注意：不再需要 nextId，数据库会自动处理
    res.json({ success: true, notes: notes });
  } catch (error) {
    console.error("获取便签失败:", error);
    res.status(500).json({ success: false, message: "无法获取便签" });
  }
});

// 添加新便签 - 保存到数据库
router.post("/notes", validateNoteData, async (req, res) => {
  try {
    const { text, x, y, title, colorClass, width, height, zIndex } = req.body;

    // 让数据库处理 ID 和时间戳
    const newNoteData = {
      text,
      x,
      y,
      title,
      colorClass,
      width,
      height,
      zIndex,
    };

    const createdNote = await addNote(newNoteData);

    console.log("新便签已添加到数据库，ID:", createdNote.id);
    res.status(201).json({ success: true, note: createdNote });
  } catch (error) {
    console.error("添加便签失败:", error);
    res.status(500).json({
      success: false,
      message: "无法添加便签",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 更新便签 - 更新数据库记录
router.put("/notes/:id", validateNoteData, async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    if (isNaN(noteId)) {
      return res.status(400).json({
        success: false,
        message: "便签ID必须是数字",
      });
    }

    const { text, x, y, title, width, height, colorClass, zIndex } = req.body;
    console.log(`更新便签 ID=${noteId}`);

    const updatedNoteData = {
      text,
      x,
      y,
      title,
      width,
      height,
      colorClass,
      zIndex,
    };

    const updatedNote = await updateNote(noteId, updatedNoteData);

    if (!updatedNote) {
      return res.status(404).json({
        success: false,
        message: `ID为 ${noteId} 的便签不存在`,
      });
    }

    console.log(`便签 ID=${noteId} 更新成功`);
    res.json({ success: true, note: updatedNote });
  } catch (error) {
    console.error("更新便签失败:", error);
    res.status(500).json({
      success: false,
      message: "无法更新便签",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 删除便签 - 从数据库删除
router.delete("/notes/:id", async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    if (isNaN(noteId)) {
      return res.status(400).json({
        success: false,
        message: "便签ID必须是数字",
      });
    }

    const success = await deleteNote(noteId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: `ID为 ${noteId} 的便签不存在`,
      });
    }

    console.log(`便签 ID=${noteId} 已从数据库删除`);
    res.json({ success: true, message: `便签 ${noteId} 已删除` });
  } catch (error) {
    console.error("删除便签失败:", error);
    res.status(500).json({
      success: false,
      message: "无法删除便签",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 导入便签数据 - 导入到数据库
router.post("/notes/import", async (req, res) => {
  console.log("[API /notes/import] Received import request."); // Log request received
  const { notes } = req.body;

  if (!Array.isArray(notes)) {
    console.error(
      "[API /notes/import] Invalid data format: 'notes' is not an array.",
      req.body
    ); // Log error
    return res.status(400).json({
      success: false,
      message: "无效的导入数据格式，'notes' 必须是数组",
    });
  }
  console.log(`[API /notes/import] Received ${notes.length} notes to import.`); // Log note count

  try {
    console.log("[API /notes/import] Calling database importNotes function..."); // Log before DB call
    const importedCount = await importNotes(notes);
    console.log(
      `[API /notes/import] Database import successful. Count: ${importedCount}`
    ); // Log DB success
    res.json({ success: true, importedCount });
  } catch (error) {
    console.error("[API /notes/import] Import failed:", error); // Log failure
    res.status(500).json({
      success: false,
      message: "导入便签数据失败",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 重置便签数据 - 清空数据库表
router.post("/notes/reset", async (req, res) => {
  try {
    await resetNotes();
    console.log("所有便签数据已从数据库重置");
    res.json({ success: true, message: "所有便签数据已重置" });
  } catch (error) {
    console.error("重置便签数据失败:", error);
    res.status(500).json({
      success: false,
      message: "重置便签数据失败",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// --- AI and Settings Routes ---

// GET AI Settings - Fetch from DB (No change needed)
router.get("/ai-settings", async (req, res) => {
  try {
    const settings = await getAllAiSettings();
    console.log("[API /ai-settings] Returning settings from DB:", settings); // Add log
    res.json({ success: true, settings });
  } catch (error) {
    console.error("获取AI设置时发生错误:", error);
    res.status(500).json({ success: false, message: "无法获取AI设置" });
  }
});

// POST AI Settings - Save to DB and Update Service
router.post("/settings/ai", async (req, res) => {
  try {
    const { apiKey, baseURL, model, maxTokens, temperature } = req.body;

    // Basic validation
    if (!baseURL || !model) {
      return res
        .status(400)
        .json({ success: false, message: "API地址和模型名称是必填项" });
    }
    const parsedMaxTokens = parseInt(maxTokens, 10);
    const parsedTemperature = parseFloat(temperature);

    // Prepare settings for DB (strings)
    const settingsToSaveInDb = {
      apiKey: typeof apiKey === "string" ? apiKey.trim() : "",
      baseURL: typeof baseURL === "string" ? baseURL.trim() : "",
      model: typeof model === "string" ? model.trim() : "",
      maxTokens: !isNaN(parsedMaxTokens) ? String(parsedMaxTokens) : "800",
      temperature: !isNaN(parsedTemperature)
        ? String(parsedTemperature)
        : "0.7",
    };

    // Save each setting to the database
    await setSetting("apiKey", settingsToSaveInDb.apiKey);
    await setSetting("baseURL", settingsToSaveInDb.baseURL);
    await setSetting("model", settingsToSaveInDb.model);
    await setSetting("maxTokens", settingsToSaveInDb.maxTokens);
    await setSetting("temperature", settingsToSaveInDb.temperature);
    console.log("AI设置已保存到数据库:", settingsToSaveInDb);

    // 将设置添加到历史记录
    if (settingsToSaveInDb.apiKey) {
      await addOrUpdateApiKeyHistory(settingsToSaveInDb.apiKey);
    }
    if (settingsToSaveInDb.baseURL) {
      await addOrUpdateBaseUrlHistory(settingsToSaveInDb.baseURL);
    }
    if (settingsToSaveInDb.model) {
      await addOrUpdateModelHistory(settingsToSaveInDb.model);
    }
    console.log("AI设置已添加到历史记录");

    // Prepare settings for aiService (correct types)
    const settingsForService = {
      apiKey: settingsToSaveInDb.apiKey,
      baseURL: settingsToSaveInDb.baseURL,
      model: settingsToSaveInDb.model,
      maxTokens: parseInt(settingsToSaveInDb.maxTokens, 10), // Convert back to number
      temperature: parseFloat(settingsToSaveInDb.temperature), // Convert back to number
      isEmpty: !(
        settingsToSaveInDb.apiKey &&
        settingsToSaveInDb.baseURL &&
        settingsToSaveInDb.model
      ),
    };

    // Update the in-memory configuration in aiService
    aiService.updateConfiguration(settingsForService);

    res.json({ success: true, message: "AI设置已保存" });
  } catch (error) {
    console.error("保存AI设置失败:", error);
    res.status(500).json({ success: false, message: "无法保存AI设置" });
  }
});

// POST Clear AI Settings - Update DB and Service
router.post("/settings/ai/clear", async (req, res) => {
  try {
    const defaultDbSettings = {
      apiKey: "",
      baseURL: "",
      model: "",
      maxTokens: "800",
      temperature: "0.7",
    };
    const defaultServiceSettings = {
      apiKey: "",
      baseURL: "",
      model: "",
      maxTokens: 800,
      temperature: 0.7,
      isEmpty: true,
    };

    // Update database with default values
    await setSetting("apiKey", defaultDbSettings.apiKey);
    await setSetting("baseURL", defaultDbSettings.baseURL);
    await setSetting("model", defaultDbSettings.model);
    await setSetting("maxTokens", defaultDbSettings.maxTokens);
    await setSetting("temperature", defaultDbSettings.temperature);
    console.log("AI设置已在数据库中清除");

    // Update the in-memory configuration in aiService
    aiService.updateConfiguration(defaultServiceSettings);

    res.json({ success: true, message: "AI设置已清除" });
  } catch (error) {
    console.error("清除AI设置失败:", error);
    res.status(500).json({ success: false, message: "无法清除AI设置" });
  }
});

// AI 相关路由 (保持不变)
router.post("/generate", async (req, res) => {
  const { prompt } = req.body;

  // 输入验证
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({
      success: false,
      message: "提示不能为空且必须是字符串",
    });
  }

  // 限制提示长度
  if (prompt.length > 500) {
    return res.status(400).json({
      success: false,
      message: "提示文本过长，请限制在500字符以内",
    });
  }

  console.log("收到生成请求，提示:", prompt);

  try {
    // 使用更长的超时时间
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("AI生成请求超时")), 60000); // 增加到60秒
    });

    // 快速检查是否已验证过API密钥
    if (!aiService.isVerified && aiService.lastVerifiedTime === 0) {
      // 如果从未验证过，返回需要验证的提示，但同时在后台进行验证
      setTimeout(() => {
        aiService
          .backgroundVerify()
          .catch((e) => console.error("后台验证出错:", e));
      }, 0);

      return res.status(202).json({
        success: false,
        needVerification: true,
        message: "正在验证API密钥，请稍后再试",
      });
    }

    const generationPromise = aiService.generateText(prompt);
    const text = await Promise.race([generationPromise, timeoutPromise]);

    console.log("生成成功，返回文本长度:", text.length);
    console.log("生成的文本前30个字符:", text.substring(0, 30) + "...");

    return res.json({
      success: true,
      text,
    });
  } catch (error) {
    console.error("AI服务调用失败:", error);

    // 如果是网络或验证错误，在后台重新触发验证
    if (
      error.message.includes("network") ||
      error.message.includes("API密钥") ||
      error.message.includes("验证失败")
    ) {
      setTimeout(() => {
        aiService.lastVerifiedTime = 0; // 强制重新验证
        aiService
          .backgroundVerify()
          .catch((e) => console.error("后台验证出错:", e));
      }, 0);
    }

    return res.status(500).json({
      success: false,
      message: `AI调用错误: ${error.message || "未知AI服务错误"}`,
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// 新增：流式生成 API 路由
router.post("/generate-stream", requireAuth, async (req, res) => {
  const { prompt } = req.body;

  // 输入验证
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({
      success: false,
      message: "提示不能为空且必须是字符串",
    });
  }

  // 限制提示长度
  if (prompt.length > 500) {
    return res.status(400).json({
      success: false,
      message: "提示文本过长，请限制在500字符以内",
    });
  }

  console.log("收到流式生成请求，提示:", prompt);

  try {
    // 快速检查是否已验证过API密钥
    if (!aiService.isVerified && aiService.lastVerifiedTime === 0) {
      setTimeout(() => {
        aiService
          .backgroundVerify()
          .catch((e) => console.error("后台验证出错:", e));
      }, 0);

      return res.status(202).json({
        success: false,
        needVerification: true,
        message: "正在验证API密钥，请稍后再试",
      });
    }

    // 设置SSE响应头
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    // 确保不缓存响应
    res.setHeader("X-Accel-Buffering", "no");

    // 发送初始事件
    res.write(`data: ${JSON.stringify({ event: "start" })}\n\n`);

    // 开始流式生成
    try {
      await aiService.generateTextStream(prompt, (chunk, fullText) => {
        // 发送每个文本块作为SSE事件
        res.write(
          `data: ${JSON.stringify({
            event: "chunk",
            chunk: chunk,
            fullText: fullText,
          })}\n\n`
        );
      });

      // 发送完成事件
      res.write(`data: ${JSON.stringify({ event: "end" })}\n\n`);
      res.end();
    } catch (error) {
      // 发送错误事件并结束流
      res.write(
        `data: ${JSON.stringify({
          event: "error",
          message: error.message || "生成过程中发生错误",
        })}\n\n`
      );
      res.end();
      console.error("流式生成过程中出错:", error);
    }
  } catch (error) {
    console.error("启动AI流式生成失败:", error);
    // 如果还没发送任何响应头，发送JSON错误
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: `AI流式生成错误: ${error.message || "未知AI服务错误"}`,
      });
    } else {
      // 已经开始发送流，发送错误事件
      res.write(
        `data: ${JSON.stringify({
          event: "error",
          message: error.message || "启动生成过程失败",
        })}\n\n`
      );
      res.end();
    }
  }
});

// 存储活跃的 SSE 连接及其关联的提示
const sseConnections = new Map();

// 初始化 SSE 连接路由 - 使用 GET 请求
router.get("/stream-connection/:sessionId", requireAuth, (req, res) => {
  const sessionId = req.params.sessionId;

  console.log(`建立 SSE 连接, 会话 ID: ${sessionId}`);

  // 设置 SSE 头部
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  // 保持连接活跃
  const keepAliveInterval = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 30000);

  // 发送初始连接事件
  res.write(`data: ${JSON.stringify({ event: "connected", sessionId })}\n\n`);

  // 存储 SSE 响应对象和清理函数
  sseConnections.set(sessionId, {
    res,
    prompt: null,
    cleanup: () => {
      clearInterval(keepAliveInterval);
      sseConnections.delete(sessionId);
    },
  });

  // 客户端断开连接时清理
  req.on("close", () => {
    console.log(`SSE 连接关闭, 会话 ID: ${sessionId}`);
    const connection = sseConnections.get(sessionId);
    if (connection) {
      connection.cleanup();
    }
  });
});

// 发送提示到指定的 SSE 连接 - 使用 POST 请求
router.post("/process-stream/:sessionId", requireAuth, async (req, res) => {
  const sessionId = req.params.sessionId;
  const { prompt } = req.body;

  console.log(`收到流式生成请求, 会话 ID: ${sessionId}, 提示: ${prompt}`);

  // 验证参数
  if (!sessionId || !prompt) {
    return res.status(400).json({
      success: false,
      message: "缺少会话ID或提示内容",
    });
  }

  // 检查 SSE 连接是否存在
  const connection = sseConnections.get(sessionId);
  if (!connection) {
    return res.status(404).json({
      success: false,
      message: "找不到指定的 SSE 连接，请先建立连接",
    });
  }

  // 立即返回成功响应，表示已接收请求
  res.json({ success: true, message: "请求已接收，开始处理" });

  try {
    // 发送开始生成事件
    connection.res.write(`data: ${JSON.stringify({ event: "start" })}\n\n`);

    // 使用 AI 服务生成内容
    await aiService.generateTextStream(prompt, (chunk, fullText) => {
      // 发送内容块
      connection.res.write(
        `data: ${JSON.stringify({
          event: "chunk",
          chunk,
          fullText,
        })}\n\n`
      );
    });

    // 发送完成事件
    connection.res.write(`data: ${JSON.stringify({ event: "end" })}\n\n`);
  } catch (error) {
    console.error("流式生成出错:", error);
    // 发送错误事件
    connection.res.write(
      `data: ${JSON.stringify({
        event: "error",
        message: error.message || "生成过程中发生错误",
      })}\n\n`
    );
  }
});

// ... 其他 AI 设置、测试、健康检查路由保持不变 ...
router.get("/test-ai-connection", async (req, res) => {
  console.log("[API /test-ai-connection] Received request."); // Add log
  try {
    // Directly call the service's test method
    const result = await aiService.testConnection();
    console.log("[API /test-ai-connection] Test result:", result); // Add log
    // Return the result from the service directly
    res.json(result);
  } catch (error) {
    // Catch unexpected errors during the test call itself
    console.error("测试AI连接时发生意外错误:", error);
    res.status(500).json({
      success: false,
      message: `测试连接时发生服务器错误: ${error.message}`,
    });
  }
});
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// --- 邀请码路由 ---

// 获取所有可用邀请码
router.get("/invite-codes", requireAuth, async (req, res) => {
  // 确保只有admin用户可以管理邀请码
  if (req.session.user.username !== "admin") {
    return res.status(403).json({
      success: false,
      message: "只有管理员可以管理邀请码",
    });
  }

  try {
    const inviteCodes = await getAvailableInviteCodes();
    res.json({
      success: true,
      inviteCodes,
    });
  } catch (error) {
    console.error("获取邀请码失败:", error);
    res.status(500).json({
      success: false,
      message: "获取邀请码失败",
    });
  }
});

// 创建新邀请码
router.post("/invite-codes", requireAuth, async (req, res) => {
  // 确保只有admin用户可以创建邀请码
  if (req.session.user.username !== "admin") {
    return res.status(403).json({
      success: false,
      message: "只有管理员可以创建邀请码",
    });
  }

  try {
    const inviteCode = await createInviteCode(req.session.user.id);
    res.json({
      success: true,
      inviteCode,
    });
  } catch (error) {
    console.error("创建邀请码失败:", error);
    res.status(500).json({
      success: false,
      message: "创建邀请码失败",
    });
  }
});

// 删除邀请码
router.delete("/invite-codes/:code", requireAuth, async (req, res) => {
  // 确保只有admin用户可以删除邀请码
  if (req.session.user.username !== "admin") {
    return res.status(403).json({
      success: false,
      message: "只有管理员可以删除邀请码",
    });
  }

  try {
    const success = await deleteInviteCode(req.params.code);

    if (success) {
      res.json({
        success: true,
        message: "邀请码已成功删除",
      });
    } else {
      res.status(404).json({
        success: false,
        message: "邀请码不存在或已使用",
      });
    }
  } catch (error) {
    console.error("删除邀请码失败:", error);
    res.status(500).json({
      success: false,
      message: "删除邀请码失败",
    });
  }
});

// --- Database Export Route ---
router.get("/database/export", (req, res) => {
  try {
    const filename = path.basename(dbFilePath);
    // Use res.download to send the file as an attachment
    res.download(dbFilePath, filename, (err) => {
      if (err) {
        // Handle errors, e.g., file not found, permissions
        console.error("导出数据库文件失败:", err);
        // Avoid sending another response if headers already sent
        if (!res.headersSent) {
          res
            .status(500)
            .json({ success: false, message: "无法导出数据库文件" });
        }
      } else {
        console.log("数据库文件已成功发送:", filename);
      }
    });
  } catch (error) {
    // Catch unexpected errors before starting download
    console.error("准备导出数据库文件时出错:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ success: false, message: "准备导出数据库文件时出错" });
    }
  }
});

// --- API 配置历史记录路由 ---

// 为所有API历史记录相关API添加认证中间件
router.use("/api-history", requireAuth);

// 获取 API 密钥历史记录
router.get("/api-history/key", async (req, res) => {
  try {
    const apiKeys = await getApiKeyHistory();
    res.json({ success: true, history: apiKeys });
  } catch (error) {
    console.error("获取API密钥历史记录失败:", error);
    res
      .status(500)
      .json({ success: false, message: "获取API密钥历史记录失败" });
  }
});

// 获取基础 URL 历史记录
router.get("/api-history/url", async (req, res) => {
  try {
    const urls = await getBaseUrlHistory();
    res.json({ success: true, history: urls });
  } catch (error) {
    console.error("获取基础URL历史记录失败:", error);
    res
      .status(500)
      .json({ success: false, message: "获取基础URL历史记录失败" });
  }
});

// 获取模型名称历史记录
router.get("/api-history/model", async (req, res) => {
  try {
    const models = await getModelHistory();
    res.json({ success: true, history: models });
  } catch (error) {
    console.error("获取模型历史记录失败:", error);
    res.status(500).json({ success: false, message: "获取模型历史记录失败" });
  }
});

// 删除 API 密钥历史记录
router.delete("/api-history/key/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "无效的ID格式" });
    }

    const success = await deleteApiKeyHistory(id);
    if (success) {
      res.json({ success: true, message: "API密钥历史记录已删除" });
    } else {
      res
        .status(404)
        .json({ success: false, message: "未找到指定的API密钥历史记录" });
    }
  } catch (error) {
    console.error("删除API密钥历史记录失败:", error);
    res
      .status(500)
      .json({ success: false, message: "删除API密钥历史记录失败" });
  }
});

// 删除基础 URL 历史记录
router.delete("/api-history/url/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "无效的ID格式" });
    }

    const success = await deleteBaseUrlHistory(id);
    if (success) {
      res.json({ success: true, message: "基础URL历史记录已删除" });
    } else {
      res
        .status(404)
        .json({ success: false, message: "未找到指定的基础URL历史记录" });
    }
  } catch (error) {
    console.error("删除基础URL历史记录失败:", error);
    res
      .status(500)
      .json({ success: false, message: "删除基础URL历史记录失败" });
  }
});

// 删除模型名称历史记录
router.delete("/api-history/model/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "无效的ID格式" });
    }

    const success = await deleteModelHistory(id);
    if (success) {
      res.json({ success: true, message: "模型历史记录已删除" });
    } else {
      res
        .status(404)
        .json({ success: false, message: "未找到指定的模型历史记录" });
    }
  } catch (error) {
    console.error("删除模型历史记录失败:", error);
    res.status(500).json({ success: false, message: "删除模型历史记录失败" });
  }
});

// Export only the router (readSettingsData is no longer needed externally)
export default router;
