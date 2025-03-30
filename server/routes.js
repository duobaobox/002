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

// 获取所有便签
router.get("/notes", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(notesFilePath));
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

// 创建新便签
router.post("/notes", (req, res) => {
  try {
    const { text, x, y, title, colorClass } = req.body;

    // 读取现有数据
    const data = JSON.parse(fs.readFileSync(notesFilePath));

    // 创建新便签
    const newNote = {
      id: data.nextId,
      text: text || "",
      x: x || 100,
      y: y || 100,
      title: title || `便签 ${data.nextId}`,
      colorClass: colorClass, // 保存颜色类
      createdAt: new Date().toISOString(),
    };

    // 更新数据
    data.notes.push(newNote);
    data.nextId += 1;

    // 保存数据
    fs.writeFileSync(notesFilePath, JSON.stringify(data, null, 2));

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

// 更新便签
router.put("/notes/:id", (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    const { text, x, y, title, width, height, colorClass } = req.body;

    // 读取现有数据
    const data = JSON.parse(fs.readFileSync(notesFilePath));

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
    data.notes[noteIndex].updatedAt = new Date().toISOString();

    // 保存数据
    fs.writeFileSync(notesFilePath, JSON.stringify(data, null, 2));

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

// 删除便签
router.delete("/notes/:id", (req, res) => {
  try {
    const noteId = parseInt(req.params.id);

    // 读取现有数据
    const data = JSON.parse(fs.readFileSync(notesFilePath));

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
    fs.writeFileSync(notesFilePath, JSON.stringify(data, null, 2));

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

// 生成便签内容的API
router.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    console.log("收到生成请求，提示:", prompt);

    if (!prompt) {
      console.log("提示为空，返回400");
      return res.status(400).json({
        success: false,
        message: "提示不能为空",
      });
    }

    console.log("调用AI服务生成文本...");
    try {
      const text = await aiService.generateText(prompt);
      console.log("生成成功，返回文本长度:", text.length);
      console.log("生成的文本前30个字符:", text.substring(0, 30) + "...");

      return res.json({
        success: true,
        text,
      });
    } catch (aiError) {
      console.error("AI服务调用失败:", aiError);
      return res.status(500).json({
        success: false,
        message: `AI调用错误: ${aiError.message || "未知AI服务错误"}`,
        error:
          process.env.NODE_ENV === "development" ? aiError.stack : undefined,
      });
    }
  } catch (error) {
    console.error("处理请求时发生错误:", error);
    res.status(500).json({
      success: false,
      message: error.message || "服务器内部错误",
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

export default router;
