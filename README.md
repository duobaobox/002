# AI 便签画布

这是一个基于 Node.js 的 Web 应用项目，允许用户创建、编辑和管理便签，并且支持使用 AI 生成便签内容。所有数据（便签和 AI 设置）都存储在本地 SQLite 数据库中。

## 功能特性

- 创建和编辑带有 Markdown 支持的便签
- 支持自由拖动和调整便签大小
- 通过 AI 生成便签内容（需要配置 API）
- 可调整画布缩放和平移
- 内置网页快捷访问功能
- **数据存储:** 所有便签和 AI 配置存储在本地 SQLite 数据库 (`data/notes.db`)
- **数据管理:**
  - 通过 UI 配置 AI API (密钥、URL、模型等)
  - 导出便签数据为 JSON 文件
  - 导入 JSON 文件以恢复便签数据 (会覆盖现有便签)
  - 导出完整的数据库文件 (`.db`) 作为备份
  - 重置所有便签和设置

## 项目结构

- `/public` - 静态资源文件 (HTML, CSS, 前端 JS)
- `/server` - 服务器端 Node.js 代码 (Express, API 路由, 数据库交互, AI 服务)
- `/data` - 数据存储目录，包含 `notes.db` SQLite 数据库文件
- `/logs` - 日志文件目录 (自动创建)

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
   _注意: `sqlite3` 是原生模块，可能需要在目标系统上编译或下载预编译包。确保安装了 Node.js (>=16) 和 npm。_
3. 数据库和配置：
   - 数据库文件 (`data/notes.db`) 会在首次启动时自动创建。
   - AI API 配置通过应用程序的设置界面进行管理，并存储在数据库中。不再需要 `.env` 文件进行核心配置。

## 运行

开发模式 (使用 nodemon 自动重启):

```bash
npm run dev
```

生产模式:

```bash
npm start
```

应用启动后，访问 `http://localhost:3000` (或指定的端口)。

## 安全说明

- **AI API 密钥:** 通过应用的设置界面输入，存储在本地数据库中。请确保运行服务器的环境安全。
- **数据备份:**
  - **便签备份 (JSON):** 可通过设置界面导出，用于在应用内恢复便签列表。
  - **完整备份 (.db):** 可通过设置界面导出 `notes.db` 文件。此文件包含所有便签和设置，主要用于手动恢复或迁移，**无法通过应用界面直接导入**。请定期备份此文件。
- **访问控制:** 应用目前没有用户认证系统，任何能访问服务器端口的人都可以使用。请勿在不受信任的网络中暴露服务。
- **依赖安全:** 定期运行 `npm audit` 检查并修复依赖项中的安全漏洞。

## 技术栈

- **前端:** 原生 JavaScript, HTML5, CSS3, Marked.js (Markdown 解析)
- **后端:** Node.js, Express.js
- **数据库:** SQLite (使用 `sqlite3` 包)
- **AI API:** OpenAI compatible (通过用户配置连接)

## 贡献

欢迎提交 PR 或 Issue。在开始任何重大工作之前，请先在 Issue 中讨论你想要做的改变。
