import express from "express";
import aiService from "./ai_service.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getApiConfig, saveApiConfig } from "./api_config_store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据文件路径 - 使用相对路径，确保跨系统兼容性
const dataDir = path.join(__dirname, "../data");
const notesFilePath = path.join(dataDir, "notes.json");

console.log("数据目录:", dataDir);
console.log("便签文件路径:", notesFilePath);

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log("创建数据目录:", dataDir);
}

// 如果数据文件不存在，创建一个空的数据文件
if (!fs.existsSync(notesFilePath)) {
  fs.writeFileSync(notesFilePath, JSON.stringify({ notes: [], nextId: 1 }));
  console.log("创建初始数据文件:", notesFilePath);
}

const router = express.Router();

// 数据读写辅助函数 - 添加错误处理和异步支持
/**
 * 读取便签数据
 * @returns {Promise<Object>} 便签数据对象
 */
const readNotesData = () => {
  return new Promise((resolve, reject) => {
    try {
      // 使用同步方法读取文件
      if (!fs.existsSync(notesFilePath)) {
        // 如果文件不存在，创建一个空的数据文件
        const initialData = { notes: [], nextId: 1 };
        // 使用Buffer作为路径参数，解决中文路径问题
        fs.writeFileSync(notesFilePath, JSON.stringify(initialData, null, 2), {
          encoding: "utf8",
        });
        resolve(initialData);
        return;
      }

      // 使用Buffer作为路径参数，解决中文路径问题
      const data = fs.readFileSync(notesFilePath, { encoding: "utf8" });
      try {
        const jsonData = JSON.parse(data);
        resolve(jsonData);
      } catch (parseError) {
        console.error("解析便签数据失败:", parseError);
        // 如果解析失败，创建新的空数据
        const initialData = { notes: [], nextId: 1 };
        fs.writeFileSync(notesFilePath, JSON.stringify(initialData, null, 2), {
          encoding: "utf8",
        });
        resolve(initialData);
      }
    } catch (error) {
      console.error("读取便签数据失败:", error);
      // 如果读取失败，返回空数据
      resolve({ notes: [], nextId: 1 });
    }
  });
};

/**
 * 写入便签数据
 * @param {Object} data - 要写入的数据对象
 * @returns {Promise<void>}
 */
const writeNotesData = (data) => {
  return new Promise((resolve, reject) => {
    try {
      // 确保data目录存在
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // 将对象转换为JSON字符串
      const jsonData = JSON.stringify(data, null, 2);

      // 使用指定的编码写入文件，处理中文路径
      fs.writeFileSync(notesFilePath, jsonData, {
        encoding: "utf8",
        flag: "w",
      });
      resolve();
    } catch (error) {
      console.error("写入便签数据失败:", error);
      // 尝试以不同方式写入
      try {
        const tempPath = path.join(dataDir, "notes_temp.json");
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf8");

        // 先删除原文件，再重命名临时文件
        if (fs.existsSync(notesFilePath)) {
          fs.unlinkSync(notesFilePath);
        }
        fs.renameSync(tempPath, notesFilePath);

        console.log("使用备用方法写入数据成功");
        resolve();
      } catch (fallbackError) {
        console.error("备用写入方法失败:", fallbackError);
        reject(fallbackError);
      }
    }
  });
};

// 请求参数验证中间件
const validateNoteData = (req, res, next) => {
  const { text, x, y, title, width, height, colorClass, zIndex } = req.body;

  // 验证坐标为数字
  if (
    (x !== undefined && typeof x !== "number") ||
    (y !== undefined && typeof y !== "number")
  ) {
    return res.status(400).json({
      success: false,
      message: "坐标必须是数字",
    });
  }

  // 验证文本、标题类型
  if (
    (text !== undefined && typeof text !== "string") ||
    (title !== undefined && typeof title !== "string")
  ) {
    return res.status(400).json({
      success: false,
      message: "文本和标题必须是字符串",
    });
  }

  // 验证尺寸为数字
  if (
    (width !== undefined && typeof width !== "number") ||
    (height !== undefined && typeof height !== "number")
  ) {
    return res.status(400).json({
      success: false,
      message: "宽度和高度必须是数字",
    });
  }

  next();
};

// 获取所有便签 - 使用异步函数和错误处理
router.get("/notes", async (req, res) => {
  try {
    const data = await readNotesData();
    res.json({ success: true, notes: data.notes, nextId: data.nextId });
  } catch (error) {
    console.error("读取便签数据失败:", error);
    res.status(500).json({
      success: false,
      message: "无法获取便签数据",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 创建新便签 - 添加验证和异步处理
router.post("/notes", validateNoteData, async (req, res) => {
  try {
    const { text, x, y, title, colorClass, zIndex } = req.body;

    // 读取现有数据
    const data = await readNotesData();

    // 创建新便签
    const newNote = {
      id: data.nextId,
      text: text || "",
      x: x || 100,
      y: y || 100,
      title: title || `便签 ${data.nextId}`,
      colorClass: colorClass, // 保存颜色类
      zIndex: zIndex || 1, // 添加zIndex属性，默认为1
      createdAt: new Date().toISOString(),
    };

    // 更新数据
    data.notes.push(newNote);
    data.nextId += 1;

    // 保存数据
    await writeNotesData(data);

    res.json({ success: true, note: newNote });
  } catch (error) {
    console.error("创建便签失败:", error);
    res.status(500).json({
      success: false,
      message: "无法创建新便签",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 更新便签 - 添加验证和异步处理
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
    console.log(`更新便签 ID=${noteId}, x=${x}, y=${y}`);

    try {
      // 读取现有数据
      const data = await readNotesData();

      // 查找便签
      const noteIndex = data.notes.findIndex((note) => note.id === noteId);

      if (noteIndex === -1) {
        return res.status(404).json({
          success: false,
          message: `ID为${noteId}的便签不存在`,
        });
      }

      // 更新便签
      const updatedNote = { ...data.notes[noteIndex] };
      if (text !== undefined) updatedNote.text = text;
      if (x !== undefined) updatedNote.x = x;
      if (y !== undefined) updatedNote.y = y;
      if (title !== undefined) updatedNote.title = title;
      if (width !== undefined) updatedNote.width = width;
      if (height !== undefined) updatedNote.height = height;
      if (colorClass !== undefined) updatedNote.colorClass = colorClass;
      if (zIndex !== undefined) updatedNote.zIndex = zIndex;
      updatedNote.updatedAt = new Date().toISOString();

      // 将更新后的便签放回数组
      data.notes[noteIndex] = updatedNote;

      // 保存数据
      await writeNotesData(data);

      console.log(`便签 ID=${noteId} 更新成功`);
      res.json({ success: true, note: updatedNote });
    } catch (dataError) {
      console.error("数据处理错误:", dataError);

      // 尝试直接更新便签，不依赖当前数据文件
      const fallbackData = {
        notes: [
          {
            id: noteId,
            text: text || "",
            x: x || 0,
            y: y || 0,
            title: title || `便签 ${noteId}`,
            width: width,
            height: height,
            colorClass: colorClass,
            zIndex: zIndex || 1,
            updatedAt: new Date().toISOString(),
          },
        ],
        nextId: noteId + 1,
      };

      try {
        await writeNotesData(fallbackData);
        console.log(`使用备用方法更新便签 ID=${noteId}`);
        res.json({ success: true, note: fallbackData.notes[0] });
      } catch (fallbackError) {
        console.error("备用更新方法失败:", fallbackError);
        throw fallbackError;
      }
    }
  } catch (error) {
    console.error("更新便签失败:", error);
    res.status(500).json({
      success: false,
      message: "无法更新便签",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 删除便签 - 添加异步处理
router.delete("/notes/:id", async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    if (isNaN(noteId)) {
      return res.status(400).json({
        success: false,
        message: "便签ID必须是数字",
      });
    }

    // 读取现有数据
    const data = await readNotesData();

    // 查找并删除便签
    const initialLength = data.notes.length;
    data.notes = data.notes.filter((note) => note.id !== noteId);

    if (data.notes.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: `ID为${noteId}的便签不存在`,
      });
    }

    // 保存数据
    await writeNotesData(data);

    res.json({ success: true, message: "便签已删除" });
  } catch (error) {
    console.error("删除便签失败:", error);
    res.status(500).json({
      success: false,
      message: "无法删除便签",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 生成便签内容的API - 添加请求验证和超时控制
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

// 添加新的API端点 - 获取AI设置
router.get("/settings/ai", async (req, res) => {
  try {
    // 从配置文件中读取设置
    const aiSettings = getApiConfig();

    // 处理API密钥 - 出于安全考虑，返回一个掩码版本
    if (aiSettings.apiKey) {
      // 仅显示前四位和后四位
      const prefix = aiSettings.apiKey.substring(0, 4);
      const suffix = aiSettings.apiKey.substring(aiSettings.apiKey.length - 4);
      aiSettings.apiKey = `${prefix}${"*".repeat(10)}${suffix}`;
      aiSettings.hasApiKey = true; // 添加标志表示已设置密钥
    } else {
      aiSettings.hasApiKey = false;
    }

    res.json({ success: true, settings: aiSettings });
  } catch (error) {
    console.error("获取AI设置失败:", error);
    res.status(500).json({
      success: false,
      message: "无法获取AI设置",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 添加新的API端点 - 获取AI设置
router.get("/ai-settings", async (req, res) => {
  try {
    // 从配置文件中读取设置
    const aiSettings = getApiConfig();

    // 检查设置是否为空 - 如果全部配置都为空，则真正返回空值，而不是默认值
    const isEmptyConfig =
      !aiSettings.apiKey && !aiSettings.baseURL && !aiSettings.model;

    // 如果是空配置，则返回所有字段为空
    if (isEmptyConfig) {
      return res.json({
        success: true,
        settings: {
          apiKey: "",
          baseURL: "",
          model: "",
          maxTokens: 800,
          temperature: 0.7,
          isEmpty: true, // 添加标志表示这是一个空配置
        },
      });
    }

    // 处理API密钥 - 出于安全考虑，返回一个掩码版本
    if (aiSettings.apiKey) {
      // 仅显示前四位和后四位
      const prefix = aiSettings.apiKey.substring(0, 4);
      const suffix = aiSettings.apiKey.substring(aiSettings.apiKey.length - 4);
      aiSettings.apiKey = `${prefix}${"*".repeat(10)}${suffix}`;
      aiSettings.hasApiKey = true; // 添加标志表示已设置密钥
    } else {
      aiSettings.hasApiKey = false;
    }

    res.json({ success: true, settings: aiSettings });
  } catch (error) {
    console.error("获取AI设置失败:", error);
    res.status(500).json({
      success: false,
      message: "无法获取AI设置",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 添加新的API端点 - 保存AI设置
router.post("/settings/ai", async (req, res) => {
  try {
    const { apiKey, baseURL, model, maxTokens, temperature } = req.body;

    // 验证必填字段
    if (!baseURL || !model) {
      return res.status(400).json({
        success: false,
        message: "请提供所有必要的设置",
      });
    }

    // 验证数值类型
    if (
      (maxTokens !== undefined && (isNaN(maxTokens) || maxTokens < 1)) ||
      (temperature !== undefined &&
        (isNaN(temperature) || temperature < 0 || temperature > 1))
    ) {
      return res.status(400).json({
        success: false,
        message: "无效的数值设置",
      });
    }

    // 获取当前配置，保留可能存在的任何密钥
    const currentConfig = getApiConfig();

    // 创建新的配置对象
    const newConfig = {
      apiKey: apiKey || currentConfig.apiKey, // 如果新密钥为空，保留旧密钥
      baseURL,
      model,
      maxTokens: parseInt(maxTokens),
      temperature: parseFloat(temperature),
    };

    // 保存到文件
    if (saveApiConfig(newConfig)) {
      // 同时也更新环境变量以便当前会话使用
      process.env.AI_API_KEY = newConfig.apiKey;
      process.env.AI_BASE_URL = newConfig.baseURL;
      process.env.AI_MODEL = newConfig.model;
      process.env.AI_MAX_TOKENS = newConfig.maxTokens.toString();
      process.env.AI_TEMPERATURE = newConfig.temperature.toString();

      // 发出配置更新事件
      if (
        global.aiConfigUpdated &&
        typeof global.aiConfigUpdated === "function"
      ) {
        global.aiConfigUpdated();
      }

      res.json({
        success: true,
        message: "AI设置已保存",
      });
    } else {
      throw new Error("保存配置文件失败");
    }
  } catch (error) {
    console.error("保存AI设置失败:", error);
    res.status(500).json({
      success: false,
      message: "无法保存AI设置",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 添加清除AI设置的端点
router.post("/settings/ai/clear", async (req, res) => {
  try {
    // 创建空的配置对象 - 确保所有字段真正清空
    const emptyConfig = {
      apiKey: "",
      baseURL: "", // 确保完全清空
      model: "", // 确保完全清空
      maxTokens: 800,
      temperature: 0.7,
    };

    // 保存空配置
    if (saveApiConfig(emptyConfig)) {
      // 同时也清空环境变量
      process.env.AI_API_KEY = "";
      process.env.AI_BASE_URL = "";
      process.env.AI_MODEL = "";
      process.env.AI_MAX_TOKENS = "800";
      process.env.AI_TEMPERATURE = "0.7";

      // 发出配置更新事件
      if (
        global.aiConfigUpdated &&
        typeof global.aiConfigUpdated === "function"
      ) {
        global.aiConfigUpdated();
      }

      res.json({
        success: true,
        message: "AI设置已清除",
        clearedSettings: true, // 添加标志，表示设置已被清除
      });
    } else {
      throw new Error("保存配置文件失败");
    }
  } catch (error) {
    console.error("清除AI设置失败:", error);
    res.status(500).json({
      success: false,
      message: "无法清除AI设置",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 添加测试端点，用于检查API连接
router.get("/test", (req, res) => {
  // 检查AI配置是否存在
  const hasAIConfig =
    process.env.AI_API_KEY && process.env.AI_BASE_URL && process.env.AI_MODEL;

  if (!hasAIConfig) {
    // 提供更详细的配置状态
    return res.json({
      success: false,
      message: "AI服务尚未配置，请先在设置中配置API密钥、URL和模型",
      configStatus: {
        hasApiKey: !!process.env.AI_API_KEY,
        hasBaseUrl: !!process.env.AI_BASE_URL,
        hasModel: !!process.env.AI_MODEL,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // 检查配置文件是否存在
  const configFilePath = path.join(__dirname, "../data/api_config.json");
  const fileExists = fs.existsSync(configFilePath);

  res.json({
    success: true,
    message: "API服务正常工作",
    timestamp: new Date().toISOString(),
    configFile: {
      exists: fileExists,
      path: configFilePath,
    },
  });
});

// 添加测试AI连接的新接口
router.get("/test-ai-connection", async (req, res) => {
  try {
    // 首先检查是否有必要的配置
    if (
      !process.env.AI_API_KEY ||
      !process.env.AI_BASE_URL ||
      !process.env.AI_MODEL
    ) {
      return res.json({
        success: false,
        message: "缺少必要的AI配置，请先完成配置",
        details: {
          missingApiKey: !process.env.AI_API_KEY,
          missingBaseUrl: !process.env.AI_BASE_URL,
          missingModel: !process.env.AI_MODEL,
        },
      });
    }

    // 使用AI服务的验证方法测试连接
    const isValid = await aiService.verifyApiKey();

    if (isValid) {
      // 连接成功
      return res.json({
        success: true,
        message: "API密钥验证成功，连接正常",
        model: process.env.AI_MODEL,
      });
    } else {
      // 连接失败，返回详细错误信息
      return res.json({
        success: false,
        message: aiService.authError || "API密钥验证失败，请检查您的配置",
      });
    }
  } catch (error) {
    console.error("测试AI连接出错:", error);
    return res.json({
      success: false,
      message: `测试连接时发生错误: ${error.message}`,
    });
  }
});

// 健康检查端点，用于监控
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// 导入便签数据
router.post("/notes/import", async (req, res) => {
  try {
    // 验证请求体中是否有便签数据
    const { notes } = req.body;

    if (!notes || !Array.isArray(notes)) {
      return res.status(400).json({
        success: false,
        message: "无效的导入数据",
      });
    }

    // 读取当前数据
    const currentData = await readNotesData();

    // 查找最大ID，确保新导入的便签ID不冲突
    let maxId = currentData.nextId - 1;
    notes.forEach((note) => {
      if (note.id > maxId) maxId = note.id;
    });

    // 清除现有便签，用导入的便签替换
    const newData = {
      notes: notes.map((note) => ({
        ...note,
        // 确保每个便签都有所需的字段
        id: note.id,
        text: note.text || "",
        x: note.x || 100,
        y: note.y || 100,
        title: note.title || `便签 ${note.id}`,
        colorClass: note.colorClass || null,
        zIndex: note.zIndex || 1,
        createdAt: note.createdAt || new Date().toISOString(),
        updatedAt: note.updatedAt || new Date().toISOString(),
      })),
      nextId: maxId + 1,
    };

    // 保存新数据
    await writeNotesData(newData);

    res.json({
      success: true,
      message: "便签数据导入成功",
      importedCount: notes.length,
    });
  } catch (error) {
    console.error("导入便签数据失败:", error);
    res.status(500).json({
      success: false,
      message: "导入便签数据失败",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 重置便签数据API端点
router.post("/notes/reset", async (req, res) => {
  try {
    // 创建空的便签数据结构
    const emptyData = {
      notes: [],
      nextId: 1,
    };

    // 保存空数据到文件
    await writeNotesData(emptyData);

    res.json({
      success: true,
      message: "便签数据已重置",
    });
  } catch (error) {
    console.error("重置便签数据失败:", error);
    res.status(500).json({
      success: false,
      message: "重置便签数据失败",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

export default router;
