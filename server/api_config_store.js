import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置文件路径
const dataDir = path.join(__dirname, "../data");
const configFilePath = path.join(dataDir, "api_config.json");

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log("创建数据目录:", dataDir);
}

// 如果配置文件不存在，创建一个空的配置文件
if (!fs.existsSync(configFilePath)) {
  const initialConfig = {
    apiKey: "",
    baseURL: "",
    model: "",
    maxTokens: 300,
    temperature: 0.7,
  };

  fs.writeFileSync(configFilePath, JSON.stringify(initialConfig, null, 2));
  console.log("创建初始API配置文件:", configFilePath);
}

/**
 * 读取API配置
 * @returns {Object} API配置对象
 */
export function getApiConfig() {
  try {
    const data = fs.readFileSync(configFilePath, { encoding: "utf8" });
    try {
      return JSON.parse(data);
    } catch (parseError) {
      console.error("解析API配置失败:", parseError);
      return {
        apiKey: "",
        baseURL: "",
        model: "",
        maxTokens: 300,
        temperature: 0.7,
      };
    }
  } catch (error) {
    console.error("读取API配置失败:", error);
    return {
      apiKey: "",
      baseURL: "",
      model: "",
      maxTokens: 300,
      temperature: 0.7,
    };
  }
}

/**
 * 保存API配置
 * @param {Object} config - 要保存的配置对象
 * @returns {boolean} 是否保存成功
 */
export function saveApiConfig(config) {
  try {
    // 确保目录存在
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true, mode: 0o755 });
    }

    // 保存配置
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), {
      encoding: "utf8",
      mode: 0o644, // 确保文件有适当的权限
    });

    console.log("API配置已保存到:", configFilePath);

    // 验证文件被正确写入
    if (fs.existsSync(configFilePath)) {
      const savedSize = fs.statSync(configFilePath).size;
      console.log(`配置文件大小: ${savedSize} 字节`);

      if (savedSize > 10) {
        // 基本检查，确保写入了某些内容
        return true;
      } else {
        console.error("配置文件似乎为空或过小");
        return false;
      }
    } else {
      console.error("保存后无法找到配置文件");
      return false;
    }
  } catch (error) {
    console.error("保存API配置失败:", error);
    return false;
  }
}

// 将配置加载到环境变量
export function loadConfigToEnv() {
  try {
    console.log("尝试从以下位置加载API配置:", configFilePath);

    if (!fs.existsSync(configFilePath)) {
      console.log("配置文件不存在，创建默认配置");
      const initialConfig = {
        apiKey: "",
        baseURL: "",
        model: "",
        maxTokens: 300,
        temperature: 0.7,
      };

      fs.writeFileSync(configFilePath, JSON.stringify(initialConfig, null, 2), {
        encoding: "utf8",
      });
      return initialConfig;
    }

    const config = getApiConfig();

    console.log("已加载的API配置:", {
      apiKey: config.apiKey ? "已设置" : "未设置",
      baseURL: config.baseURL,
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    });

    // 强制设置环境变量，确保即使值为空也会覆盖
    process.env.AI_API_KEY = config.apiKey || "";
    process.env.AI_BASE_URL = config.baseURL || "";
    process.env.AI_MODEL = config.model || "";
    process.env.AI_MAX_TOKENS = (config.maxTokens || 300).toString();
    process.env.AI_TEMPERATURE = (config.temperature || 0.7).toString();

    // 输出最终设置的环境变量，用于调试
    console.log("环境变量设置完成:", {
      AI_API_KEY: process.env.AI_API_KEY ? "已设置" : "未设置",
      AI_BASE_URL: process.env.AI_BASE_URL,
      AI_MODEL: process.env.AI_MODEL,
      AI_MAX_TOKENS: process.env.AI_MAX_TOKENS,
      AI_TEMPERATURE: process.env.AI_TEMPERATURE,
    });

    return config;
  } catch (error) {
    console.error("加载配置到环境变量失败:", error);
    return {
      apiKey: "",
      baseURL: "",
      model: "",
      maxTokens: 300,
      temperature: 0.7,
    };
  }
}
