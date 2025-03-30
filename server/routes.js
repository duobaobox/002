import express from "express";
import aiService from "./ai_service.js";

const router = express.Router();

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
