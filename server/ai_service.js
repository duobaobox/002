import OpenAI from "openai";
import config from "../config/ai_config.js";

class AIService {
  constructor() {
    this.initializeService();
    this.cache = new Map(); // 缓存已生成的文本
    this.isVerified = false; // 验证状态
    this.lastVerifiedTime = 0; // 上次验证时间
    this.verificationCacheTime = 30 * 60 * 1000; // 验证结果缓存时间（30分钟）
    this.isVerifying = false; // 是否正在验证中
    this.authError = null; // 保存验证错误信息

    // 注册全局配置更新函数
    global.aiConfigUpdated = () => {
      console.log("检测到AI配置更新，重新初始化服务...");
      this.initializeService();
      // 配置更改时，触发后台验证
      this.backgroundVerify();
    };

    // 服务启动后立即在后台验证API密钥
    setTimeout(() => this.backgroundVerify(), 1000);
  }

  // 初始化OpenAI服务
  initializeService() {
    // 保存之前的验证状态
    const prevVerified = this.isVerified;

    // 从环境变量获取最新配置
    this.config = {
      apiKey: process.env.AI_API_KEY || config.apiKey,
      baseURL: process.env.AI_BASE_URL || config.baseURL,
      model: process.env.AI_MODEL || config.model,
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || config.maxTokens),
      temperature: parseFloat(process.env.AI_TEMPERATURE || config.temperature),
      fallbackConfig: config.fallbackConfig,
    };

    // 详细记录当前配置状态以便调试
    console.log("AI服务初始化配置详情:");
    console.log(
      "环境变量中的AI_API_KEY:",
      process.env.AI_API_KEY ? "已设置" : "未设置"
    );
    console.log("环境变量中的AI_BASE_URL:", process.env.AI_BASE_URL);
    console.log("环境变量中的AI_MODEL:", process.env.AI_MODEL);
    console.log("最终使用的apiKey:", this.config.apiKey ? "已设置" : "未设置");
    console.log("最终使用的baseURL:", this.config.baseURL);
    console.log("最终使用的model:", this.config.model);

    // 检查是否存在必要的配置
    const hasRequiredConfig =
      this.config.apiKey && this.config.baseURL && this.config.model;

    if (hasRequiredConfig) {
      try {
        // 重新创建OpenAI客户端
        this.openai = new OpenAI({
          baseURL: this.config.baseURL,
          apiKey: this.config.apiKey,
        });

        // 记录API密钥部分信息以便调试但不泄露完整密钥
        const apiKeyPreview =
          this.config.apiKey.length > 8
            ? `${this.config.apiKey.substring(
                0,
                4
              )}...${this.config.apiKey.substring(
                this.config.apiKey.length - 4
              )}`
            : "密钥过短";

        console.log("AI服务已初始化，使用模型:", this.config.model);
        console.log("API密钥预览:", apiKeyPreview);

        // 如果配置与上次不同，重置验证状态
        const configChanged =
          this.lastConfig &&
          (this.lastConfig.apiKey !== this.config.apiKey ||
            this.lastConfig.baseURL !== this.config.baseURL ||
            this.lastConfig.model !== this.config.model);

        if (configChanged) {
          console.log("检测到配置变更，重置验证状态");
          this.isVerified = false;
          this.lastVerifiedTime = 0;
        } else if (prevVerified) {
          // 如果配置未变且之前已验证通过，保持验证状态
          console.log(
            "配置未变更，保持验证状态:",
            prevVerified ? "已验证" : "未验证"
          );
          this.isVerified = prevVerified;
        } else {
          // 配置未变但之前未验证通过，设为未验证
          this.isVerified = false;
        }

        // 保存当前配置用于下次比较
        this.lastConfig = { ...this.config };
      } catch (error) {
        console.error("初始化OpenAI客户端失败:", error.message);
        this.openai = null;
        this.isVerified = false;
        this.lastVerifiedTime = 0;
      }
    } else {
      console.log("AI服务尚未配置，请在设置中完成配置");
      console.log("缺少的配置项:", {
        apiKey: !this.config.apiKey,
        baseURL: !this.config.baseURL,
        model: !this.config.model,
      });
      this.openai = null;
      this.isVerified = false;
      this.lastVerifiedTime = 0;
    }
  }

  /**
   * 后台验证API密钥
   * 不阻塞用户操作，提前完成验证
   */
  async backgroundVerify() {
    try {
      // 如果已经在验证中，或配置不完整，则跳过
      if (this.isVerifying || !this.openai) {
        return;
      }

      this.isVerifying = true;
      console.log("后台验证API密钥...");

      // 执行实际验证
      await this.verifyApiKey();

      console.log("后台验证完成, 结果:", this.isVerified ? "成功" : "失败");
    } catch (error) {
      console.error("后台验证出错:", error);
    } finally {
      this.isVerifying = false;
    }
  }

  /**
   * 验证API密钥是否有效
   * @param {boolean} force - 是否强制重新验证，忽略缓存
   * @returns {Promise<boolean>} 验证结果
   */
  async verifyApiKey(force = false) {
    if (!this.openai) {
      this.isVerified = false;
      this.authError = "AI服务未初始化或配置不完整";
      return false;
    }

    const now = Date.now();
    // 如果不强制刷新，并且在缓存时间内，直接返回缓存的结果
    if (
      !force &&
      this.lastVerifiedTime > 0 &&
      now - this.lastVerifiedTime < this.verificationCacheTime
    ) {
      console.log("使用缓存的验证结果:", this.isVerified ? "有效" : "无效");
      return this.isVerified;
    }

    // 防止并发验证
    if (this.isVerifying) {
      console.log("验证已在进行中，等待结果...");
      // 等待正在进行的验证完成
      await new Promise((resolve) => {
        const interval = setInterval(() => {
          if (!this.isVerifying) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
      // 返回最新的验证结果
      return this.isVerified;
    }

    this.isVerifying = true;
    this.authError = null; // 清除旧错误
    console.log("正在验证API密钥...");

    try {
      // 使用更轻量的请求验证API密钥
      await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1,
        temperature: 0,
      });

      this.isVerified = true;
      console.log("API密钥验证成功");
      return true;
    } catch (error) {
      console.error("API密钥验证失败:", error.message);
      this.isVerified = false;

      // 根据错误类型设置更友好的错误消息
      if (error.response) {
        if (error.response.status === 401) {
          this.authError = "API密钥无效或已过期，请更新您的API密钥";
        } else if (error.response.status === 403) {
          this.authError = "API密钥权限不足，请检查您的账户权限";
        } else {
          this.authError = `API服务返回错误: ${error.response.status} ${
            error.response.statusText || ""
          }`;
        }
      } else if (error.request) {
        this.authError = "无法连接到API服务，请检查网络连接和API地址";
      } else {
        this.authError = `验证请求设置出错: ${error.message}`;
      }
      return false;
    } finally {
      this.lastVerifiedTime = Date.now(); // 记录验证时间
      this.isVerifying = false;
    }
  }

  /**
   * 生成AI文本
   * @param {string} prompt - 用户提示语
   * @returns {Promise<string>} - 生成的文本
   */
  async generateText(prompt) {
    // 首先检查是否已配置AI服务
    if (!this.openai) {
      throw new Error("AI服务尚未配置，请在设置中配置API密钥、URL和模型");
    }

    // 验证API密钥（如果需要）
    if (!this.isVerified) {
      const isValid = await this.verifyApiKey();
      if (!isValid) {
        throw new Error(this.authError || "API密钥验证失败，请检查您的配置");
      }
    }

    // 检查缓存 (保持简单缓存逻辑)
    const cacheKey = this._generateCacheKey(prompt);
    if (this.cache.has(cacheKey)) {
      console.log("从缓存返回结果");
      return this.cache.get(cacheKey);
    }

    console.log("使用OpenAI SDK发送请求");
    console.log("基础URL:", this.config.baseURL);
    console.log("使用模型:", this.config.model);

    // 使用重试机制 (保持现有逻辑)
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

        if (
          completion.choices &&
          completion.choices.length > 0 &&
          completion.choices[0].message?.content
        ) {
          const generatedText = completion.choices[0].message.content.trim();
          console.log(
            "生成的文本预览:",
            generatedText.substring(0, 50) + "..."
          );
          // 存入缓存
          this.cache.set(cacheKey, generatedText);
          return generatedText;
        } else {
          console.error("API响应格式异常或内容为空:", completion);
          throw new Error("API响应格式无效或内容为空");
        }
      } catch (error) {
        console.error(
          `AI API 调用失败 (尝试 ${retries + 1}/${maxRetries}):`,
          error.message
        );
        retries++;
        if (retries >= maxRetries) {
          // 如果是认证错误，则标记为未验证
          if (
            error.response &&
            (error.response.status === 401 || error.response.status === 403)
          ) {
            this.isVerified = false;
            this.lastVerifiedTime = 0; // 强制下次重新验证
            this.authError = `API认证失败 (${error.response.status})，请检查密钥或权限`;
            throw new Error(this.authError);
          }
          throw error; // 重试次数用尽，抛出原始错误
        }
        console.log(`等待 ${retryDelay * retries}ms 后重试...`);
        await this._sleep(retryDelay * retries); // 指数退避
      }
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
