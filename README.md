# AI 便签画布

这是一个基于 Node.js 的 Web 应用项目，允许用户创建、编辑和管理便签，并且支持使用 AI 生成便签内容。

## 功能特性

- 创建和编辑带有 Markdown 支持的便签
- 支持自由拖动和调整便签大小
- 通过 AI 生成便签内容
- 可调整画布缩放和平移
- 内置网页快捷访问功能

## 项目结构

- `/config` - 配置文件
- `/public` - 静态资源文件
- `/server` - 服务器端代码
- `/data` - 数据存储目录
- `/logs` - 日志文件目录

## 安装

1. 克隆代码库：

```bash
git clone <repository-url>
cd ai-note-canvas
```

2. 安装依赖：

```bash
npm install
```

3. 创建环境配置文件：

```bash
cp .env.example .env
```

然后编辑 `.env` 文件，填入你的 API 密钥和其他必要配置。

## 运行

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm start
```

## 安全说明

- 请确保在生产环境中通过环境变量设置敏感信息，而不是硬编码
- 默认的示例 API 密钥仅用于开发，生产环境一定要更改
- 数据保存在本地的`data`目录，请定期备份

## 技术栈

- 前端：原生 JavaScript, HTML5, CSS3
- 后端：Node.js, Express
- AI API：DeepSeek API

## 贡献

欢迎提交 PR 或 Issue。在开始任何重大工作之前，请先讨论你想要做的改变。
