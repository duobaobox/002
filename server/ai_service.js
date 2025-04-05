import OpenAI from "openai";
import config from "../config/ai_config.js";

class AIService {
  constructor() {
    this.initializeService();
    this.cache = new Map(); // 缓存已生成的文本

    // 注册全局配置更新函数
    global.aiConfigUpdated = () => {
      console.log("检测到AI配置更新，重新初始化服务...");
      this.initializeService();
    };
  }

  // 初始化OpenAI服务
  initializeService() {
    // 从环境变量获取最新配置
    this.config = {
      apiKey: process.env.AI_API_KEY || config.apiKey,
      baseURL: process.env.AI_BASE_URL || config.baseURL,
      model: process.env.AI_MODEL || config.model,
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || config.maxTokens),
      temperature: parseFloat(process.env.AI_TEMPERATURE || config.temperature),
      fallbackConfig: config.fallbackConfig,
    };

    // 检查是否存在必要的配置
    const hasRequiredConfig =
      this.config.apiKey && this.config.baseURL && this.config.model;

    if (hasRequiredConfig) {
      // 重新创建OpenAI客户端
      this.openai = new OpenAI({
        baseURL: this.config.baseURL,
        apiKey: this.config.apiKey,
      });
      console.log("AI服务已初始化，使用模型:", this.config.model);
    } else {
      console.log("AI服务尚未配置，请在设置中完成配置");
      this.openai = null;
    }
  }

  /**
   * 生成AI文本
   * @param {string} prompt - 用户提示语
   * @returns {Promise<string>} - 生成的文本
   */
  async generateText(prompt) {
    try {
      // 首先检查是否已配置AI服务
      if (!this.openai) {
        throw new Error("AI服务尚未配置，请在设置中配置API密钥、URL和模型");
      }

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
