import express from "express";
import aiService from "./ai_service.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据文件路径
const dataDir = path.join(__dirname, "../data");
const notesFilePath = path.join(dataDir, "notes.json");

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 如果数据文件不存在，创建一个空的数据文件
if (!fs.existsSync(notesFilePath)) {
  fs.writeFileSync(notesFilePath, JSON.stringify({ notes: [], nextId: 1 }));
}

const router = express.Router();

// 数据读写辅助函数 - 添加错误处理和异步支持
/**
 * 读取便签数据
 * @returns {Promise<Object>} 便签数据对象
 */
const readNotesData = () => {
  return new Promise((resolve, reject) => {
    fs.readFile(notesFilePath, "utf8", (err, data) => {
      if (err) {
        console.error("读取便签数据失败:", err);
        reject(err);
        return;
      }

      try {
        const jsonData = JSON.parse(data);
        resolve(jsonData);
      } catch (parseError) {
        console.error("解析便签数据失败:", parseError);
        reject(parseError);
      }
    });
  });
};

/**
 * 写入便签数据
 * @param {Object} data - 要写入的数据对象
 * @returns {Promise<void>}
 */
const writeNotesData = (data) => {
  return new Promise((resolve, reject) => {
    // 先写入临时文件，成功后再重命名，避免数据损坏
    const tempFilePath = `${notesFilePath}.temp`;
    fs.writeFile(tempFilePath, JSON.stringify(data, null, 2), "utf8", (err) => {
      if (err) {
        console.error("写入临时文件失败:", err);
        reject(err);
        return;
      }

      fs.rename(tempFilePath, notesFilePath, (renameErr) => {
        if (renameErr) {
          console.error("重命名文件失败:", renameErr);
          reject(renameErr);
          return;
        }
        resolve();
      });
    });
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
    if (text !== undefined) data.notes[noteIndex].text = text;
    if (x !== undefined) data.notes[noteIndex].x = x;
    if (y !== undefined) data.notes[noteIndex].y = y;
    if (title !== undefined) data.notes[noteIndex].title = title;
    if (width !== undefined) data.notes[noteIndex].width = width;
    if (height !== undefined) data.notes[noteIndex].height = height;
    if (colorClass !== undefined) data.notes[noteIndex].colorClass = colorClass;
    if (zIndex !== undefined) data.notes[noteIndex].zIndex = zIndex; // 添加zIndex处理
    data.notes[noteIndex].updatedAt = new Date().toISOString();

    // 保存数据
    await writeNotesData(data);

    res.json({ success: true, note: data.notes[noteIndex] });
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
    // 使用Promise.race添加超时控制
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("AI生成请求超时")), 30000);
    });

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
    return res.status(500).json({
      success: false,
      message: `AI调用错误: ${error.message || "未知AI服务错误"}`,
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// 添加测试端点，用于检查API连接
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "API服务正常工作",
    timestamp: new Date().toISOString(),
  });
});

// 健康检查端点，用于监控
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
