import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import routes from "./routes.js";
import fs from "fs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
import {
  initializeDatabase,
  getAllAiSettings,
  closeDatabase,
} from "./database.js";
import aiService from "./ai_service.js";

// 尝试加载.env文件 (如果存在)
try {
  const dotenv = await import("dotenv");
  dotenv.config();
} catch (error) {
  console.log(".env模块不可用或.env文件不存在，使用默认环境变量");
}

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

// 添加速率限制 - 使用更宽松的设置
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 500, // 每个IP在windowMs时间内最多请求500次
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "请求过于频繁，请稍后再试" },
  // 添加跳过限流的函数，对于本地请求不进行限制
  skip: (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress;
    return (
      clientIp === "127.0.0.1" ||
      clientIp === "::1" ||
      clientIp.includes("::ffff:127.0.0.1")
    );
  },
});

// 给API路由添加速率限制保护
app.use("/api/", apiLimiter);

// AI生成特殊限制 - 使用更宽松的设置
const aiGenerateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10分钟
  max: 50, // 每个IP在windowMs时间内最多请求50次
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "AI生成请求过于频繁，请稍后再试" },
  // 添加跳过限流的函数，对于本地请求不进行限制
  skip: (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress;
    return (
      clientIp === "127.0.0.1" ||
      clientIp === "::1" ||
      clientIp.includes("::ffff:127.0.0.1")
    );
  },
});

// 给AI生成接口添加速率限制
app.use("/api/generate", aiGenerateLimiter);

// 会话配置
app.use(
  session({
    secret: "infinity-notes-secret", // 在生产环境中，这应该是一个环境变量
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 1天
    },
  })
);

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

// 确保登录页面和分享页面可访问
app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/login.html"));
});

// 分享页面不需要登录即可访问
app.get("/share.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/share.html"));
});

// 分享关闭页面不需要登录即可访问
app.get("/share-closed.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/share-closed.html"));
});

// 主页重定向到登录页（如果未登录）
app.get("/", (req, res, next) => {
  if (req.session && req.session.user) {
    next(); // 已登录，继续到下一个处理程序
  } else {
    res.redirect("/login.html"); // 未登录，重定向到登录页
  }
});

// 捕获所有其他路由，提供前端应用
app.get("*", (req, res) => {
  // 允许分享相关的路由和页面无需登录即可访问
  if (req.path.startsWith("/share") || req.path === "/share.html") {
    res.sendFile(path.join(__dirname, "../public/share.html"));
    return;
  }

  // 允许分享关闭页面无需登录即可访问
  if (req.path === "/share-closed.html") {
    res.sendFile(path.join(__dirname, "../public/share-closed.html"));
    return;
  }

  // 其他路由需要登录
  if (req.path !== "/login.html" && !(req.session && req.session.user)) {
    res.redirect("/login.html"); // 未登录时重定向到登录页
  } else {
    res.sendFile(path.join(__dirname, "../public/index.html"));
  }
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

async function gracefulShutdown() {
  console.log("正在关闭应用...");

  try {
    // 1. 关闭数据库连接
    console.log("正在关闭数据库连接...");
    await closeDatabase();
    console.log("数据库连接已关闭");

    // 2. 关闭服务器
    console.log("正在关闭服务器...");
    server.close(() => {
      console.log("服务器已关闭");
      process.exit(0);
    });
  } catch (error) {
    console.error("关闭过程中出错:", error);
    process.exit(1);
  }

  // 如果10秒后还未关闭，强制退出
  setTimeout(() => {
    console.error("关闭超时，强制退出");
    process.exit(1);
  }, 10000);
}

// 定义全局服务器变量
let server;

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
    server = app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`环境: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("服务器启动失败:", error);
    process.exit(1);
  }
}

// 调用启动函数
startServer();
