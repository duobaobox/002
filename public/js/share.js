/**
 * 分享页面的主要脚本
 * 负责从服务器获取分享的便签数据并展示
 */

import { ShareCanvas } from "./modules/share/ShareCanvas.js";

// 全局变量保存画布实例
let shareCanvas = null;

document.addEventListener("DOMContentLoaded", () => {
  // 从URL获取分享ID
  const urlParams = new URLSearchParams(window.location.search);
  const shareId = urlParams.get("id");

  if (!shareId) {
    showError("无效的分享链接");
    return;
  }

  // 显示分享ID
  document.getElementById("share-id-display").textContent = shareId;

  // 加载分享数据
  loadSharedCanvas(shareId);

  // 添加刷新按钮事件
  const refreshButton = document.getElementById("refresh-button");
  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      loadSharedCanvas(shareId);
    });
  }
});

/**
 * 加载分享的画布数据
 * @param {string} shareId - 分享ID
 * @param {boolean} silent - 是否静默刷新（不显示加载提示）
 */
async function loadSharedCanvas(shareId, silent = false) {
  try {
    if (!silent) {
      // 显示加载中提示
      const canvas = document.getElementById("note-canvas");
      const loadingEl = document.createElement("div");
      loadingEl.className = "loading-indicator";
      loadingEl.textContent = "加载中...";
      canvas.appendChild(loadingEl);
    }

    // 获取分享数据
    const response = await fetch(`/api/share/${shareId}`);

    if (!response.ok) {
      throw new Error("获取分享数据失败");
    }

    const data = await response.json();
    console.log("从服务器获取的分享数据:", data);

    if (!data.success) {
      throw new Error(data.message || "获取分享数据失败");
    }

    // 更新最后更新时间
    document.getElementById("last-updated").textContent = new Date(
      data.lastUpdated
    ).toLocaleString();

    // 如果是静默刷新且没有变化，则不重新渲染
    if (silent && data.noChanges) {
      return;
    }

    // 渲染便签
    renderNotes(data.notes);

    // 初始化画布移动和缩放功能
    if (!shareCanvas) {
      // 等待便签容器创建完成
      setTimeout(() => {
        // 创建画布实例
        shareCanvas = new ShareCanvas();

        // 如果服务器返回了画布状态，应用到分享页面
        if (data.canvasState) {
          shareCanvas.applyInitialState(data.canvasState);
        }

        console.log("画布移动和缩放功能已初始化");
      }, 100);
    }
  } catch (error) {
    console.error("加载分享数据出错:", error);
    if (!silent) {
      showError(error.message);
    }
  } finally {
    // 移除加载提示
    if (!silent) {
      const loadingEl = document.querySelector(".loading-indicator");
      if (loadingEl) loadingEl.remove();
    }
  }
}

/**
 * 渲染便签到画布
 * @param {Array} notes - 便签数据数组
 */
function renderNotes(notes) {
  const canvas = document.getElementById("note-canvas");

  // 清空现有便签
  const existingNotes = canvas.querySelectorAll(".note");
  existingNotes.forEach((note) => note.remove());

  // 创建便签容器
  let noteContainer = document.getElementById("note-container");
  if (!noteContainer) {
    noteContainer = document.createElement("div");
    noteContainer.id = "note-container";
    noteContainer.className = "note-container";
    noteContainer.style.position = "absolute";
    noteContainer.style.width = "100%";
    noteContainer.style.height = "100%";
    noteContainer.style.top = "0";
    noteContainer.style.left = "0";
    noteContainer.style.transformOrigin = "0 0";
    canvas.appendChild(noteContainer);
  }

  console.log("开始渲染便签，数量:", notes.length);

  // 渲染每个便签
  notes.forEach((noteData, index) => {
    console.log(`渲染便签 ${index + 1}:`, noteData);
    createReadOnlyNote(noteData, noteContainer);
  });
}

/**
 * 创建只读便签
 * @param {Object} noteData - 便签数据
 * @param {HTMLElement} container - 便签容器
 */
function createReadOnlyNote(noteData, container) {
  // 创建便签元素
  const note = document.createElement("div");
  note.className = `note ${noteData.colorClass || "note-yellow"}`;
  note.style.left = `${noteData.x}px`;
  note.style.top = `${noteData.y}px`;
  note.style.zIndex = noteData.zIndex || 1;
  note.setAttribute("data-id", noteData.id);

  if (noteData.width) {
    note.style.width = `${noteData.width}px`;
  }
  if (noteData.height) {
    note.style.height = `${noteData.height}px`;
  }

  // 创建便签头部
  const header = document.createElement("div");
  header.className = "note-header";

  // 添加标题
  const title = document.createElement("div");
  title.className = "note-title";
  title.textContent = noteData.title || `便签 ${noteData.id}`;
  header.appendChild(title);

  // 创建便签内容区域
  const body = document.createElement("div");
  body.className = "note-body";

  // 创建预览区域
  const preview = document.createElement("div");
  preview.className = "markdown-preview";

  // 获取便签文本
  const noteText = noteData.text || "";
  console.log(
    `便签内容: ${noteText.substring(0, 50)}${noteText.length > 50 ? "..." : ""}`
  );

  // 使用marked.js渲染Markdown
  const renderedHtml = renderMarkdown(noteText);
  console.log(
    `渲染后的HTML: ${renderedHtml.substring(0, 50)}${
      renderedHtml.length > 50 ? "..." : ""
    }`
  );
  preview.innerHTML = renderedHtml;

  // 确保预览区域可见
  preview.style.display = "block";

  // 处理图片响应式
  const images = preview.querySelectorAll("img");
  console.log(`找到图片: ${images.length}个`);
  images.forEach((img) => {
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.addEventListener("load", () => {
      // 图片加载完成后可能需要调整布局
      img.style.display = "block";
      img.style.margin = "10px 0";
    });
  });

  // 处理代码块
  const codeBlocks = preview.querySelectorAll("pre code");
  console.log(`找到代码块: ${codeBlocks.length}个`);
  if (window.hljs) {
    codeBlocks.forEach((block) => {
      hljs.highlightBlock(block);
    });
  }

  body.appendChild(preview);

  // 组装便签
  note.appendChild(header);
  note.appendChild(body);

  // 添加到容器
  container.appendChild(note);

  return note;
}

/**
 * 使用marked.js渲染Markdown文本
 * @param {string} text - Markdown文本
 * @returns {string} - 渲染后的HTML
 */
function renderMarkdown(text) {
  if (!text) return "";

  try {
    // 使用marked库渲染Markdown
    const html = marked.parse(text, {
      breaks: true, // 允许换行
      gfm: true, // 启用GitHub风格Markdown
      headerIds: false, // 不生成标题ID
      mangle: false, // 不对邮件地址进行混淆
      sanitize: false, // 不进行安全过滤（因为我们信任内容）
      smartLists: true, // 使用智能列表
      smartypants: true, // 使用智能标点
      xhtml: false, // 不生成XHTML兼容标签
    });

    // 如果有highlight.js，尝试高亮代码
    if (window.hljs) {
      // 延迟执行代码高亮，确保内容已渲染
      setTimeout(() => {
        document.querySelectorAll("pre code").forEach((block) => {
          hljs.highlightBlock(block);
        });
      }, 0);
    }

    return html;
  } catch (error) {
    console.error("渲染Markdown出错:", error);
    // 出错时返回原始文本，但进行转义
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  }
}

/**
 * 显示错误信息
 * @param {string} message - 错误信息
 */
function showError(message) {
  const canvas = document.getElementById("note-canvas");
  canvas.innerHTML = "";

  const errorEl = document.createElement("div");
  errorEl.className = "error-message";
  errorEl.innerHTML = `
    <h2>出错了</h2>
    <p>${message}</p>
    <p>请检查分享链接是否正确，或者稍后再试。</p>
  `;

  canvas.appendChild(errorEl);
}
