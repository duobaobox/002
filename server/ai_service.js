import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config(); // Load .env variables

class AIService {
  constructor() {
    // Initialize with default empty config. Actual config loaded later.
    this.config = {
      apiKey: "",
      baseURL: "",
      model: "",
      maxTokens: 800,
      temperature: 0.7,
      isEmpty: true,
      // 添加应用信息，用于OpenRouter排名统计
      appName: "AI便签画布",
      appUrl: "https://ai-note-canvas.app", // 可根据实际情况修改
    };
    this.openai = null;
    this.isConfigured = false; // Start as not configured
    console.log("[AI Service] Instance created. Waiting for configuration.");
  }

  // 检查是否使用OpenRouter
  isOpenRouter() {
    return this.config.baseURL && this.config.baseURL.includes("openrouter.ai");
  }

  // 检测模型是否为OpenRouter格式 (provider/model:variant)
  isOpenRouterModelFormat() {
    return (
      this.config.model &&
      (this.config.model.includes("/") || this.config.model.includes(":"))
    );
  }

  /**
   * Updates the service configuration and re-initializes the OpenAI client.
   * Expected input keys: apiKey, baseURL, model, maxTokens (number), temperature (number), isEmpty (boolean)
   */
  updateConfiguration(newConfig) {
    console.log("[AI Service] Updating configuration with:", newConfig);

    if (typeof newConfig !== "object" || newConfig === null) {
      console.error("[AI Service] Invalid configuration object received.");
      // Optionally reset to default empty state or just return
      this.config = {
        apiKey: "",
        baseURL: "",
        model: "",
        maxTokens: 800,
        temperature: 0.7,
        isEmpty: true,
        appName: "AI便签画布",
        appUrl: "https://ai-note-canvas.app",
      };
      this.isConfigured = false;
      this.openai = null;
      return;
    }

    // Update internal config state, ensuring correct types
    this.config = {
      apiKey:
        typeof newConfig.apiKey === "string" ? newConfig.apiKey.trim() : "",
      baseURL:
        typeof newConfig.baseURL === "string" ? newConfig.baseURL.trim() : "",
      model: typeof newConfig.model === "string" ? newConfig.model.trim() : "",
      maxTokens: !isNaN(parseInt(newConfig.maxTokens, 10))
        ? parseInt(newConfig.maxTokens, 10)
        : 800,
      temperature: !isNaN(parseFloat(newConfig.temperature))
        ? parseFloat(newConfig.temperature)
        : 0.7,
      // Determine isEmpty based on essential fields, unless explicitly passed as false
      isEmpty:
        newConfig.isEmpty === true ||
        !(newConfig.apiKey && newConfig.baseURL && newConfig.model),
      // 保留应用信息
      appName: this.config.appName || "AI便签画布",
      appUrl: this.config.appUrl || "https://ai-note-canvas.app",
    };

    console.log(
      "[AI Service] Internal config state after update:",
      this.config
    );

    // Attempt to re-initialize the OpenAI client
    this._initializeOpenAI();

    console.log(
      `[AI Service] Configuration update finished. Service is now ${
        this.isConfigured ? "CONFIGURED" : "NOT CONFIGURED"
      }.`
    );

    // Log if using OpenRouter
    if (this.isOpenRouter()) {
      console.log("[AI Service] Using OpenRouter as API provider");
      console.log(
        `[AI Service] Model format: ${
          this.isOpenRouterModelFormat()
            ? "OpenRouter format"
            : "Standard format"
        }`
      );
    }
  }

  // Internal method to initialize/re-initialize the OpenAI client based on current this.config
  _initializeOpenAI() {
    console.log("[AI Service] Attempting to initialize OpenAI client...");

    // Reset state before attempting initialization
    this.openai = null;
    this.isConfigured = false;

    // Check if essential configuration parts are present and non-empty strings
    const canInitialize =
      this.config.apiKey && this.config.baseURL && this.config.model;

    console.log(
      `[AI Service] Checking config validity for init: apiKey=${!!this.config
        .apiKey}, baseURL=${!!this.config.baseURL}, model=${!!this.config
        .model}. CanInitialize=${canInitialize}`
    );

    if (canInitialize) {
      try {
        this.openai = new OpenAI({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseURL,
        });
        this.isConfigured = true; // Mark as configured ONLY if constructor doesn't throw
        console.log("[AI Service] OpenAI client initialized successfully.");
      } catch (error) {
        console.error(
          "[AI Service] Failed to initialize OpenAI client:",
          error.message
        );
        // Keep openai=null and isConfigured=false
      }
    } else {
      console.warn(
        "[AI Service] Initialization skipped: Essential configuration (apiKey, baseURL, model) is missing or empty."
      );
    }
    console.log(
      `[AI Service] _initializeOpenAI finished. isConfigured=${this.isConfigured}`
    );
  }

  // Checks if the service has a valid, initialized OpenAI client
  isReady() {
    // isConfigured is set only if _initializeOpenAI succeeds
    return this.isConfigured;
  }

  // Method to get current configuration (useful for testing connection)
  getCurrentConfig() {
    return { ...this.config };
  }

  // Method to generate text using the configured client
  async generateText(prompt) {
    if (!this.isReady()) {
      throw new Error("AI服务未配置或初始化失败");
    }

    try {
      // 基础请求参数
      const requestParams = {
        model: this.config.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      };

      // 为OpenRouter添加特有的参数
      if (this.isOpenRouter()) {
        // 添加额外的头部信息，用于OpenRouter统计
        const extraHeaders = {
          "HTTP-Referer": this.config.appUrl,
          "X-Title": this.config.appName,
        };

        console.log(
          "[AI Service] Adding OpenRouter specific headers:",
          extraHeaders
        );

        const completion = await this.openai.chat.completions.create(
          requestParams,
          { headers: extraHeaders }
        );

        // 检查响应格式
        if (completion?.choices?.[0]?.message) {
          return completion.choices[0].message.content.trim();
        } else {
          throw new Error("OpenRouter响应格式异常");
        }
      } else {
        // 标准OpenAI兼容API调用（如DeepSeek等）
        const completion = await this.openai.chat.completions.create(
          requestParams
        );

        // 检查响应格式
        if (completion?.choices?.[0]?.message) {
          return completion.choices[0].message.content.trim();
        } else {
          throw new Error("AI响应格式异常");
        }
      }
    } catch (error) {
      console.error("AI生成文本时出错:", error);
      // Provide more specific error messages if possible
      if (error.response) {
        // Error from OpenAI API (e.g., auth error, rate limit)
        console.error("OpenAI API错误详情:", error.response.data);
        throw new Error(
          `AI服务API错误: ${error.response.status} ${
            error.response.data?.error?.message || error.message
          }`
        );
      } else if (error.request) {
        // Request was made but no response received
        throw new Error("无法连接到AI服务，请检查网络或API地址");
      } else {
        // Other errors (e.g., setup error)
        throw new Error(`AI生成失败: ${error.message}`);
      }
    }
  }

  // Method to test connection
  async testConnection() {
    console.log("[AI Service] Testing AI connection...");
    if (!this.isReady()) {
      // If not ready, determine missing parts from the current config state
      const missing = {};
      if (!this.config.apiKey) missing.apiKey = true;
      if (!this.config.baseURL) missing.baseURL = true;
      if (!this.config.model) missing.model = true;
      console.warn("[AI Service] Test failed: Service not ready/configured.");
      // Return the specific message format expected by the frontend
      return { success: false, message: "AI服务未配置", details: missing };
    }

    // If ready, attempt the actual API call
    try {
      console.log(
        "[AI Service] Attempting simple chat completion for connection test..."
      );

      const testParams = {
        model: this.config.model,
        messages: [{ role: "user", content: "Test connection" }],
        max_tokens: 1,
      };

      // 为OpenRouter添加特有的参数
      if (this.isOpenRouter()) {
        const extraHeaders = {
          "HTTP-Referer": this.config.appUrl,
          "X-Title": this.config.appName,
        };

        await this.openai.chat.completions.create(testParams, {
          headers: extraHeaders,
        });
      } else {
        await this.openai.chat.completions.create(testParams);
      }

      console.log(
        "[AI Service] Test successful: Simple chat completion succeeded."
      );
      return {
        success: true,
        message: "连接成功",
        model: this.config.model,
        provider: this.isOpenRouter() ? "OpenRouter" : "标准API",
      };
    } catch (error) {
      console.error("[AI Service] Test failed during API call:", error);
      let message = `连接测试失败: ${error.message}`;
      if (error instanceof OpenAI.APIError) {
        message = `连接测试失败: ${error.status} ${error.name} - ${error.message}`;
        console.error("[AI Service] OpenAI API Error Details:", {
          status: error.status,
          error: error.error,
        });
      } else if (error.code) {
        message += ` (Code: ${error.code})`;
      }

      // 为OpenRouter模型添加建议
      if (
        this.isOpenRouter() &&
        message.includes("404") &&
        this.isOpenRouterModelFormat()
      ) {
        message +=
          "\n\n建议: 尝试其他可用的OpenRouter免费模型，例如:\n- anthropic/claude-3-haiku:free\n- mistralai/mistral-7b-instruct:free\n- google/gemini-1.5-pro:free";
      }

      // Return the specific message format expected by the frontend
      return { success: false, message: message };
    }
  }

  // 后台验证方法
  async backgroundVerify() {
    // 实现从以前的代码中移动过来
    return await this.testConnection();
  }
}

const aiServiceInstance = new AIService();
export default aiServiceInstance;
