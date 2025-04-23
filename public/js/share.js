/**
 * 分享页面的主要脚本
 * 负责从服务器获取分享的便签数据并展示
 */

import { ShareCanvas } from "./modules/share/ShareCanvas.js";

// 全局变量保存画布实例
let shareCanvas = null;

document.addEventListener("DOMContentLoaded", () => {
  // 从URL获取分享ID和画布名称
  const urlParams = new URLSearchParams(window.location.search);
  const shareId = urlParams.get("id");
  const canvasName = urlParams.get("name") || "InfinityNotes"; // 获取画布名称，如果没有则使用默认名称

  if (!shareId) {
    showError("无效的分享链接");
    return;
  }

  // 显示分享ID
  document.getElementById("share-id-display").textContent = shareId;

  // 初始显示画布名称（从 URL 参数获取）
  const canvasTitleElement = document.getElementById("canvas-title");
  if (canvasTitleElement) {
    // 解码URL编码的名称
    const decodedName = decodeURIComponent(canvasName);
    canvasTitleElement.textContent = decodedName;
    // 更新页面标题
    document.title = `${decodedName} - 分享页面`;
  }

  // 加载分享数据
  loadSharedCanvas(shareId);

  // 添加刷新按钮事件
  const refreshButton = document.getElementById("refresh-button");
  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      loadSharedCanvas(shareId);
    });
  }

  // 处理悬浮提示
  setupFloatingTip();
});

/**
 * 加载分享的画布数据
 * @param {string} shareId - 分享ID
 * @param {boolean} silent - 是否静默刷新（不显示加载提示）
 */
async function loadSharedCanvas(shareId, silent = false) {
  // 添加加载状态跟踪，避免重复加载
  if (window.isLoading) {
    console.log("正在加载中，请稍后...");
    return;
  }

  window.isLoading = true;

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

    const data = await response.json();
    console.log("从服务器获取的分享数据:", data);

    // 检查是否是分享已关闭
    if (!data.success && data.isClosed) {
      console.log("分享已关闭，显示关闭提示");
      // 直接显示关闭提示，而不是重定向
      showError("分享已关闭");
      return;
    }

    if (!response.ok) {
      throw new Error("获取分享数据失败");
    }

    if (!data.success) {
      throw new Error(data.message || "获取分享数据失败");
    }

    // 更新最后更新时间
    document.getElementById("last-updated").textContent = new Date(
      data.lastUpdated
    ).toLocaleString();

    // 更新画布名称（使用服务器返回的名称）
    const canvasTitleElement = document.getElementById("canvas-title");
    if (canvasTitleElement && data.canvasName) {
      canvasTitleElement.textContent = data.canvasName;
      // 更新页面标题
      document.title = `${data.canvasName} - 分享页面`;
    }

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

    // 重置加载状态
    window.isLoading = false;
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

  // 创建网格背景（如果不存在）
  let gridBackground = canvas.querySelector(".grid-background");
  if (!gridBackground) {
    gridBackground = document.createElement("div");
    gridBackground.className = "grid-background";
    canvas.appendChild(gridBackground);
  }

  // 确保便签容器存在
  let noteContainer = document.getElementById("note-container");
  if (!noteContainer) {
    noteContainer = document.createElement("div");
    noteContainer.id = "note-container";
    noteContainer.className = "note-container";
    canvas.appendChild(noteContainer);
  }

  console.log("开始渲染便签，数量:", notes.length);

  // 使用文档片段批量创建便签，提高性能
  const fragment = document.createDocumentFragment();

  // 渲染每个便签
  notes.forEach((noteData, index) => {
    const note = createReadOnlyNote(noteData);
    if (note) fragment.appendChild(note);
  });

  // 一次性添加所有便签到DOM
  noteContainer.appendChild(fragment);
}

/**
 * 创建只读便签
 * @param {Object} noteData - 便签数据
 * @returns {HTMLElement} 创建的便签元素
 */
function createReadOnlyNote(noteData) {
  // 创建便签元素 - 使用与原始便签相同的结构
  const note = document.createElement("div");
  note.className = `note ${noteData.colorClass || "note-yellow"} read-only`; // 添加read-only类标记只读状态
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

  // 添加关闭按钮 - 使用与原始便签相同的结构
  const closeBtn = document.createElement("div");
  closeBtn.className = "note-close"; // 不添加disabled类，使用CSS选择器来处理只读状态
  closeBtn.innerHTML = "&times;";
  header.appendChild(closeBtn);

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

  // 创建自定义滚动条容器 - 与原始便签相同
  const scrollbarContainer = document.createElement("div");
  scrollbarContainer.className = "custom-scrollbar";

  // 创建滚动条滑块
  const scrollbarThumb = document.createElement("div");
  scrollbarThumb.className = "scrollbar-thumb";
  scrollbarContainer.appendChild(scrollbarThumb);

  // 添加滚动事件监听器
  preview.addEventListener("scroll", () => {
    updateScrollbar(preview, scrollbarThumb);
  });

  body.appendChild(preview);
  body.appendChild(scrollbarContainer);

  // 组装便签
  note.appendChild(header);
  note.appendChild(body);

  // 初始化滚动条（延迟处理，避免阻塞渲染）
  requestAnimationFrame(() => {
    const previewElement = note.querySelector(".markdown-preview");
    const scrollbarThumb = note.querySelector(".scrollbar-thumb");
    if (previewElement && scrollbarThumb) {
      updateScrollbar(previewElement, scrollbarThumb);
    }
  });

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

  // 获取画布名称
  const urlParams = new URLSearchParams(window.location.search);
  const canvasName = urlParams.get("name") || "InfinityNotes";
  const decodedName = decodeURIComponent(canvasName);

  // 更新页面标题
  document.title = `${decodedName} - 分享已关闭`;

  // 创建分享关闭样式的错误提示
  const errorEl = document.createElement("div");
  errorEl.className = "closed-container";
  errorEl.innerHTML = `
    <style>
      /* 分享关闭样式 */
      #note-canvas {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: calc(100vh - 60px); /* 减去头部高度 */
      }

      .closed-container {
        max-width: 600px;
        width: 100%;
        background-color: white;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        overflow: hidden;
        text-align: center;
        animation: fadeIn 0.5s ease-out;
      }

      .closed-header {
        background-color: #4a6ee0;
        color: white;
        padding: 30px 20px;
        position: relative;
      }

      .closed-icon {
        font-size: 64px;
        margin-bottom: 15px;
        display: inline-block;
      }

      .closed-title {
        font-size: 24px;
        font-weight: 600;
        margin-bottom: 5px;
      }

      .closed-subtitle {
        font-size: 16px;
        opacity: 0.9;
      }

      .closed-content {
        padding: 30px;
      }

      .closed-message {
        font-size: 16px;
        line-height: 1.6;
        color: #555;
        margin-bottom: 25px;
      }

      .closed-actions {
        margin-top: 20px;
      }

      .home-button {
        display: inline-block;
        background-color: #4a6ee0;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 12px 24px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        text-decoration: none;
        transition: background-color 0.2s, transform 0.2s;
      }

      .home-button:hover {
        background-color: #3a5ecc;
        transform: translateY(-2px);
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    </style>
    <div class="closed-header">
      <div class="closed-icon">🔒</div>
      <h1 class="closed-title">${decodedName}</h1>
      <p class="closed-subtitle">分享已关闭</p>
    </div>

    <div class="closed-content">
      <p class="closed-message">
        抱歉，您尝试访问的画布 <strong>${decodedName}</strong> 已被创建者关闭分享。<br>
        这可能是因为分享已过期或创建者主动关闭了分享。
      </p>

      <div class="closed-actions">
        <a href="/" class="home-button">返回主页</a>
      </div>
    </div>
  `;

  canvas.appendChild(errorEl);

  // 处理页面其他元素
  // 隐藏头部
  const header = document.querySelector(".share-header");
  if (header) header.style.display = "none";

  // 隐藏悬浮提示
  const floatingTip = document.getElementById("share-floating-tip");
  if (floatingTip) floatingTip.style.display = "none";

  // 隐藏刷新按钮
  const refreshButton = document.getElementById("refresh-button");
  if (refreshButton) refreshButton.style.display = "none";

  // 清除页面底部的最后更新时间
  const lastUpdated = document.getElementById("last-updated");
  if (lastUpdated) lastUpdated.textContent = "";
}

/**
 * 更新自定义滚动条
 * @param {HTMLElement} element - 内容元素
 * @param {HTMLElement} scrollbarThumb - 滚动条滑块元素
 */
function updateScrollbar(element, scrollbarThumb) {
  if (!element || !scrollbarThumb) return;

  // 检查内容是否可以滚动
  const scrollHeight = element.scrollHeight;
  const clientHeight = element.clientHeight;

  if (scrollHeight <= clientHeight) {
    // 无需滚动，隐藏滚动条
    if (scrollbarThumb.style.display !== "none") {
      scrollbarThumb.style.display = "none";
    }
    return;
  }

  // 显示滚动条
  if (scrollbarThumb.style.display !== "block") {
    scrollbarThumb.style.display = "block";
  }

  // 计算滚动条高度
  const scrollRatio = clientHeight / scrollHeight;
  const thumbHeight = Math.max(30, scrollRatio * clientHeight); // 最小高度30px
  scrollbarThumb.style.height = `${thumbHeight}px`;

  // 计算滚动条位置
  const scrollableDistance = scrollHeight - clientHeight;
  const scrollPosition = element.scrollTop;
  const scrollPercentage = scrollPosition / scrollableDistance;
  const thumbPosition = scrollPercentage * (clientHeight - thumbHeight);
  scrollbarThumb.style.top = `${thumbPosition}px`;
}

/**
 * 设置悬浮提示
 */
function setupFloatingTip() {
  const floatingTip = document.getElementById("share-floating-tip");
  const closeTipBtn = document.getElementById("close-tip");

  // 检查用户是否已经关闭过提示
  const tipClosed = localStorage.getItem("share_tip_closed");

  // 如果用户已经关闭过提示，则不显示
  if (tipClosed === "true") {
    floatingTip.style.display = "none";
  }

  // 添加关闭按钮事件
  closeTipBtn.addEventListener("click", () => {
    // 添加渐隐动画
    floatingTip.style.opacity = "0";
    floatingTip.style.transform = "translate(-50%, 20px)";
    floatingTip.style.transition = "opacity 0.3s, transform 0.3s";

    // 动画结束后隐藏元素
    setTimeout(() => {
      floatingTip.style.display = "none";
    }, 300);

    // 在本地存储中记录用户已关闭提示
    localStorage.setItem("share_tip_closed", "true");
  });

  // 设置自动隐藏定时器，10秒后自动隐藏
  setTimeout(() => {
    // 如果提示还在显示，则渐隐
    if (floatingTip.style.display !== "none") {
      floatingTip.style.opacity = "0";
      floatingTip.style.transform = "translate(-50%, 20px)";
      floatingTip.style.transition = "opacity 0.3s, transform 0.3s";

      setTimeout(() => {
        floatingTip.style.display = "none";
      }, 300);
    }
  }, 10000);
}
