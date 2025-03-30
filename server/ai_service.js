const axios = require("axios");
const config = require("../config/ai_config");

class AIService {
  constructor() {
    this.config = config;
  }

  async generateText(prompt) {
    try {
      const response = await axios.post(
        this.config.api_url,
        {
          model: this.config.model,
          messages: [
            {
              role: "system",
              content:
                "你是一个便签生成助手，根据用户的提示生成简短、有帮助的便签内容。",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: this.config.max_tokens,
          temperature: 0.7,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.api_key}`,
          },
        }
      );

      // 从响应中提取生成的文本
      if (
        response.data &&
        response.data.choices &&
        response.data.choices.length > 0 &&
        response.data.choices[0].message
      ) {
        return response.data.choices[0].message.content.trim();
      }

      throw new Error("AI响应格式无效");
    } catch (error) {
      console.error("调用AI API出错:", error);
      if (error.response) {
        console.error("API响应:", error.response.data);
      }
      throw new Error(`AI生成失败: ${error.message}`);
    }
  }
}

module.exports = new AIService();
