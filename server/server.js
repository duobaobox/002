import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import routes from "./routes.js"; // No longer need readSettingsData here
import fs from "fs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { initializeDatabase, getAllAiSettings } from "./database.js"; // Import getAllAiSettings
import aiService from "./ai_service.js"; // Import the service instance
import { loadConfigToEnv } from "./api_config_store.js";

// 尝试加载.env文件 (如果存在)
try {
  const dotenv = await import("dotenv");
  dotenv.config();
} catch (error) {
  console.log(".env模块不可用或.env文件不存在，使用默认环境变量");
}

// 从存储文件加载API配置到环境变量
loadConfigToEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 确保日志目录存在
const logDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
  console.log("创建日志目录:", logDir);
}

// 使用Helmet增强安全性
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:"],
        // 动态允许API连接
        connectSrc: ["'self'", process.env.AI_BASE_URL || ""],
        frameSrc: ["'self'", "https://kimi.moonshot.cn"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// 添加速率限制
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP在windowMs时间内最多请求100次
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "请求过于频繁，请稍后再试" },
});

// 给API路由添加速率限制保护
app.use("/api/", apiLimiter);

// AI生成特殊限制
const aiGenerateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10分钟
  max: 10, // 每个IP在windowMs时间内最多请求10次
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "AI生成请求过于频繁，请稍后再试" },
});

// 给AI生成接口添加更严格的速率限制
app.use("/api/generate", aiGenerateLimiter);

// 简单日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const log = `[${new Date().toISOString()}] ${req.method} ${req.url} - ${
      res.statusCode
    } ${duration}ms\n`;

    // 异步写入日志文件
    fs.appendFile(
      path.join(logDir, `${new Date().toISOString().split("T")[0]}.log`),
      log,
      (err) => {
        if (err) console.error("写入日志失败:", err);
      }
    );

    // 同时输出到控制台
    console.log(log);
  });
  next();
});

// 安全相关中间件
app.use((req, res, next) => {
  // 设置安全相关HTTP头
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

// JSON解析中间件 - 添加大小限制
app.use(bodyParser.json({ limit: "1mb" }));

// 静态文件服务
app.use(express.static(path.join(__dirname, "../public")));

// 设置路由
app.use("/api", routes);

// 捕获所有其他路由，提供前端应用
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  // 记录详细错误信息到日志
  const errorLog = `[${new Date().toISOString()}] ERROR: ${err.stack}\n`;
  fs.appendFile(
    path.join(logDir, `errors-${new Date().toISOString().split("T")[0]}.log`),
    errorLog,
    (logErr) => {
      if (logErr) console.error("写入错误日志失败:", logErr);
    }
  );

  console.error(err.stack);

  // 向客户端返回友好的错误消息
  res.status(500).json({
    success: false,
    message: "服务器内部错误",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// 优雅退出处理
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

function gracefulShutdown() {
  console.log("正在关闭服务器...");
  server.close(() => {
    console.log("服务器已关闭");
    process.exit(0);
  });

  // 如果5秒后还未关闭，强制退出
  setTimeout(() => {
    console.error("强制关闭服务器");
    process.exit(1);
  }, 5000);
}

// 异步启动函数
async function startServer() {
  try {
    // 初始化数据库
    await initializeDatabase();
    console.log("[Server Start] Database initialized.");

    // 读取初始 AI 设置
    const initialSettings = await getAllAiSettings(); // Fetch from DB
    console.log(
      "[Server Start] Loaded initial AI settings from DB:",
      initialSettings
    );

    // 配置 AI 服务
    aiService.updateConfiguration(initialSettings);
    console.log("[Server Start] AI Service configured with initial settings.");

    // 启动服务器
    const server = app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`环境: ${process.env.NODE_ENV || "development"}`);

      // 服务器启动后，主动触发AI服务初始化
      if (
        global.aiConfigUpdated &&
        typeof global.aiConfigUpdated === "function"
      ) {
        console.log("服务器启动完成，主动触发AI服务初始化...");
        global.aiConfigUpdated();
      }
    });
  } catch (error) {
    console.error("服务器启动失败:", error);
    process.exit(1);
  }
}

// 调用启动函数
startServer();
