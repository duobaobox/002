// AI API配置文件
// 使用环境变量或从.env文件加载API密钥
export default {
  apiKey: process.env.AI_API_KEY || "", // 从环境变量获取API密钥
  baseURL: process.env.AI_BASE_URL || "", // 从环境变量获取API基础URL
  model: process.env.AI_MODEL || "", // 使用的AI模型
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || "300"), // 生成文本的最大长度
  temperature: parseFloat(process.env.AI_TEMPERATURE || "0.7"), // 温度参数
  fallbackConfig: {
    // 当API调用失败时的后备配置
    maxRetries: 3, // 最大重试次数
    retryDelay: 1000, // 重试间隔（毫秒）
  },
};
