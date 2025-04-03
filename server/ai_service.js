import OpenAI from "openai";
import config from "../config/ai_config.js";

class AIService {
  constructor() {
    this.openai = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
    this.config = config;
    this.cache = new Map(); // 缓存已生成的文本
  }

  /**
   * 生成AI文本
   * @param {string} prompt - 用户提示语
   * @returns {Promise<string>} - 生成的文本
   */
  async generateText(prompt) {
    try {
      // 检查缓存
      const cacheKey = this._generateCacheKey(prompt);
      if (this.cache.has(cacheKey)) {
        console.log("从缓存返回结果");
        return this.cache.get(cacheKey);
      }

      console.log("使用OpenAI SDK发送请求");
      console.log("基础URL:", this.config.baseURL);
      console.log("使用模型:", this.config.model);

      // 使用重试机制
      let retries = 0;
      const maxRetries = this.config.fallbackConfig?.maxRetries || 3;
      const retryDelay = this.config.fallbackConfig?.retryDelay || 1000;

      while (true) {
        try {
          const completion = await this.openai.chat.completions.create({
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
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
          });

          console.log("API响应成功");

          if (completion.choices && completion.choices.length > 0) {
            const generatedText = completion.choices[0].message.content.trim();
            console.log(
              "生成的文本预览:",
              generatedText.substring(0, 50) + "..."
            );

            // 存入缓存
            this.cache.set(cacheKey, generatedText);

            return generatedText;
          } else {
            console.error("API响应格式异常:", completion);
            throw new Error("API响应格式无效");
          }
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            throw error; // 重试次数用尽，抛出错误
          }
          console.log(`请求失败，${retries}/${maxRetries} 次重试...`);
          await this._sleep(retryDelay * retries); // 指数退避
        }
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

  /**
   * 生成缓存键
   * @private
   * @param {string} prompt - 用户提示语
   * @returns {string} - 缓存键
   */
  _generateCacheKey(prompt) {
    // 简单的缓存键生成，实际可使用更复杂的哈希函数
    return `${prompt.trim().toLowerCase()}_${this.config.model}_${
      this.config.temperature
    }`;
  }

  /**
   * 等待指定时间
   * @private
   * @param {number} ms - 等待毫秒数
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default new AIService();
