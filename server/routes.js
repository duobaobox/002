const express = require("express");
const router = express.Router();
const aiService = require("./ai_service");

// 生成便签内容的API
router.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: "提示不能为空",
      });
    }

    const text = await aiService.generateText(prompt);

    res.json({
      success: true,
      text,
    });
  } catch (error) {
    console.error("生成文本失败:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
