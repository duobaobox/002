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
  // Import dbFilePath
  dbFilePath,
} from "./database.js";
import { validateNoteData } from "./middleware.js";
// Need path for basename
import path from "path";

const router = express.Router();

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
    // 使用更短的超时时间，提高用户体验
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("AI生成请求超时")), 20000);
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

// Export only the router (readSettingsData is no longer needed externally)
export default router;
