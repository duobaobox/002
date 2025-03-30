import OpenAI from "openai";
import config from "../config/ai_config.js";

class AIService {
  constructor() {
    this.openai = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
    this.config = config;
  }

  async generateText(prompt) {
    try {
      console.log("使用OpenAI SDK发送请求");
      console.log("基础URL:", config.baseURL);
      console.log("使用模型:", config.model);

      const completion = await this.openai.chat.completions.create({
        model: config.model,
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
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      });

      console.log("API响应成功");

      if (completion.choices && completion.choices.length > 0) {
        const generatedText = completion.choices[0].message.content.trim();
        console.log("生成的文本预览:", generatedText.substring(0, 50) + "...");
        return generatedText;
      } else {
        console.error("API响应格式异常:", completion);
        throw new Error("API响应格式无效");
      }
    } catch (error) {
      console.error("调用AI API出错:");

      if (error.response) {
        console.error("状态码:", error.response.status);
        console.error("错误信息:", error.response.data);
      } else {
        console.error("错误详情:", error.message);
      }

      throw new Error(`AI生成失败: ${error.message || "未知错误"}`);
    }
  }
}

export default new AIService();
