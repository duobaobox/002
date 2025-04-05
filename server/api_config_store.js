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
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 保存配置
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), {
      encoding: "utf8",
    });

    console.log("API配置已保存");
    return true;
  } catch (error) {
    console.error("保存API配置失败:", error);
    return false;
  }
}

// 将配置加载到环境变量
export function loadConfigToEnv() {
  const config = getApiConfig();

  if (config.apiKey) process.env.AI_API_KEY = config.apiKey;
  if (config.baseURL) process.env.AI_BASE_URL = config.baseURL;
  if (config.model) process.env.AI_MODEL = config.model;
  if (config.maxTokens) process.env.AI_MAX_TOKENS = config.maxTokens.toString();
  if (config.temperature)
    process.env.AI_TEMPERATURE = config.temperature.toString();

  console.log("已从文件加载API配置到环境变量");
  return config;
}
