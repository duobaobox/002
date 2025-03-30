class Note {
  constructor(id, text = "", x = 50, y = 50, title = "") {
    this.id = id;
    this.text = text;
    this.x = x;
    this.y = y;
    this.title = title || `便签 ${id}`; // 默认标题为"便签+id"
    this.element = null;
    this.isDragging = false;
    this.isResizing = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.resizeStartWidth = 0;
    this.resizeStartHeight = 0;
    this.resizeStartX = 0;
    this.resizeStartY = 0;
    this.editMode = true; // 默认为编辑模式
    this.updateTimer = null; // 用于防抖渲染

    // 便签颜色类名
    this.colorClasses = [
      "note-yellow",
      "note-blue",
      "note-green",
      "note-pink",
      "note-purple",
    ];

    this.create();
  }

  create() {
    // 创建便签元素
    const note = document.createElement("div");
    note.className = "note " + this.getRandomColorClass();
    note.style.left = `${this.x}px`;
    note.style.top = `${this.y}px`;

    // 创建便签头部
    const header = document.createElement("div");
    header.className = "note-header";

    // 创建便签标题
    const title = document.createElement("div");
    title.className = "note-title";
    title.textContent = this.title;
    title.setAttribute("title", "双击编辑标题");

    // 添加双击编辑标题功能
    title.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this.editTitle(title);
    });

    // 创建关闭按钮
    const closeBtn = document.createElement("div");
    closeBtn.className = "note-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.remove();
    });

    // 组装头部
    header.appendChild(title);
    header.appendChild(closeBtn);

    // 创建内容容器
    const body = document.createElement("div");
    body.className = "note-body";

    // 创建文本区域
    const textarea = document.createElement("textarea");
    textarea.className = "note-content";
    textarea.value = this.text;
    textarea.placeholder = "支持 Markdown 语法...";

    // 创建 Markdown 预览区域
    const markdownPreview = document.createElement("div");
    markdownPreview.className = "markdown-preview";
    markdownPreview.innerHTML = this.renderMarkdown(this.text);

    // 为预览区域添加双击事件，切换回编辑模式
    markdownPreview.addEventListener("dblclick", () => {
      this.editMode = true;
      this.toggleEditPreviewMode(textarea, markdownPreview);
    });

    // 添加文本区域事件监听
    textarea.addEventListener("input", () => {
      this.text = textarea.value;

      // 清除之前的定时器
      if (this.updateTimer) {
        clearTimeout(this.updateTimer);
      }

      // 设置新的定时器，实现输入防抖
      this.updateTimer = setTimeout(() => {
        // 更新预览内容
        markdownPreview.innerHTML = this.renderMarkdown(this.text);
      }, 300);

      this.updateScrollbar(textarea, scrollbarThumb);
    });

    // 文本区域失去焦点时，如果有内容则切换到预览模式
    textarea.addEventListener("blur", () => {
      if (this.text.trim() !== "") {
        this.editMode = false;
        this.toggleEditPreviewMode(textarea, markdownPreview);
      }
    });

    // 添加焦点事件，聚焦时切换到编辑模式
    textarea.addEventListener("focus", () => {
      this.editMode = true;
    });

    textarea.addEventListener("scroll", () => {
      this.updateScrollbar(textarea, scrollbarThumb);
    });

    // 给预览区域添加滚动事件
    markdownPreview.addEventListener("scroll", () => {
      this.updateScrollbar(markdownPreview, scrollbarThumb);
    });

    // 创建自定义滚动条容器
    const scrollbarContainer = document.createElement("div");
    scrollbarContainer.className = "custom-scrollbar";

    // 创建滚动条滑块
    const scrollbarThumb = document.createElement("div");
    scrollbarThumb.className = "scrollbar-thumb";
    scrollbarContainer.appendChild(scrollbarThumb);

    // 创建调整大小控件
    const resizeHandle = document.createElement("div");
    resizeHandle.className = "note-resize-handle";

    // 组装便签
    body.appendChild(textarea);
    body.appendChild(markdownPreview);
    body.appendChild(scrollbarContainer);
    note.appendChild(header);
    note.appendChild(body);
    note.appendChild(resizeHandle);

    // 设置拖动事件
    this.setupDragEvents(note, header);

    // 设置调整大小事件
    this.setupResizeEvents(note, resizeHandle);

    // 添加到DOM
    this.element = note;
    document.getElementById("note-canvas").appendChild(note);

    // 设置初始z-index
    note.style.zIndex = getHighestZIndex() + 1;

    // 初始切换模式
    this.toggleEditPreviewMode(textarea, markdownPreview);

    // 初始化滚动条
    this.updateScrollbar(textarea, scrollbarThumb);

    // 聚焦到文本区域
    if (this.text === "") {
      setTimeout(() => textarea.focus(), 0);
    }
  }

  // 渲染 Markdown
  renderMarkdown(text) {
    if (!text) return "";
    try {
      // 配置 marked 选项
      marked.setOptions({
        breaks: true, // 启用换行符
        gfm: true, // 启用 GitHub 风格的 Markdown
        highlight: function (code, lang) {
          // 如果已经加载了 highlight.js，则使用它来高亮代码
          if (typeof hljs !== "undefined") {
            const language = hljs.getLanguage(lang) ? lang : "plaintext";
            return hljs.highlight(code, { language }).value;
          }
          return code;
        },
      });

      // 渲染 Markdown
      return marked.parse(text);
    } catch (error) {
      console.error("Markdown 渲染错误:", error);
      return "<p>渲染错误</p>";
    }
  }

  // 切换编辑/预览模式
  toggleEditPreviewMode(textarea, preview) {
    if (this.editMode) {
      // 切换到编辑模式
      textarea.style.display = "block";
      preview.style.display = "none";

      // 更新滚动条
      const scrollbarThumb = this.element.querySelector(".scrollbar-thumb");
      this.updateScrollbar(textarea, scrollbarThumb);
    } else {
      // 切换到预览模式
      textarea.style.display = "none";
      preview.style.display = "block";

      // 更新预览内容
      preview.innerHTML = this.renderMarkdown(this.text);

      // 更新滚动条
      const scrollbarThumb = this.element.querySelector(".scrollbar-thumb");
      this.updateScrollbar(preview, scrollbarThumb);
    }
  }

  // 更新自定义滚动条
  updateScrollbar(element, scrollbarThumb) {
    // 检查内容是否可以滚动
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;

    if (scrollHeight <= clientHeight) {
      // 无需滚动，隐藏滚动条
      scrollbarThumb.style.display = "none";
      return;
    }

    // 显示滚动条
    scrollbarThumb.style.display = "block";

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

  getRandomColorClass() {
    return this.colorClasses[
      Math.floor(Math.random() * this.colorClasses.length)
    ];
  }

  setupDragEvents(note, header) {
    header.addEventListener("mousedown", (e) => {
      if (e.target === header) {
        this.isDragging = true;
        this.dragOffsetX = e.clientX - note.offsetLeft;
        this.dragOffsetY = e.clientY - note.offsetTop;
        note.style.zIndex = getHighestZIndex() + 1;
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;

      const x = e.clientX - this.dragOffsetX;
      const y = e.clientY - this.dragOffsetY;

      note.style.left = `${x}px`;
      note.style.top = `${y}px`;
    });

    window.addEventListener("mouseup", () => {
      this.isDragging = false;
    });
  }

  setupResizeEvents(note, resizeHandle) {
    resizeHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();

      this.isResizing = true;
      this.resizeStartWidth = note.offsetWidth;
      this.resizeStartHeight = note.offsetHeight;
      this.resizeStartX = e.clientX;
      this.resizeStartY = e.clientY;

      note.style.zIndex = getHighestZIndex() + 1;
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isResizing) return;

      // 计算新的宽度和高度
      const newWidth = this.resizeStartWidth + (e.clientX - this.resizeStartX);
      const newHeight =
        this.resizeStartHeight + (e.clientY - this.resizeStartY);

      // 应用最小和最大尺寸限制
      const minWidth = 150;
      const minHeight = 150;
      const maxWidth = 500;
      const maxHeight = 500;

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        note.style.width = `${newWidth}px`;
      }

      if (newHeight >= minHeight && newHeight <= maxHeight) {
        note.style.height = `${newHeight}px`;
      }

      // 调整大小后更新滚动条
      const textarea = note.querySelector(".note-content");
      const scrollbarThumb = note.querySelector(".scrollbar-thumb");
      this.updateScrollbar(textarea, scrollbarThumb);
    });

    window.addEventListener("mouseup", () => {
      this.isResizing = false;
    });
  }

  remove() {
    if (this.element) {
      this.element.remove();
      document.dispatchEvent(
        new CustomEvent("note-removed", { detail: { id: this.id } })
      );
    }
  }

  update(text) {
    this.text = text;
    const textarea = this.element.querySelector(".note-content");
    const preview = this.element.querySelector(".markdown-preview");
    if (textarea) {
      textarea.value = text;

      // 更新预览内容
      if (preview) {
        preview.innerHTML = this.renderMarkdown(text);
      }

      // 更新滚动条
      const scrollbarThumb = this.element.querySelector(".scrollbar-thumb");
      this.updateScrollbar(textarea, scrollbarThumb);

      // 有内容时默认显示预览
      if (text.trim() !== "") {
        this.editMode = false;
        this.toggleEditPreviewMode(textarea, preview);
      }
    }
  }

  // 编辑标题方法
  editTitle(titleElement) {
    // 保存原始标题，以便取消时恢复
    const originalTitle = this.title;

    // 使标题元素可编辑
    titleElement.setAttribute("contenteditable", "true");
    titleElement.classList.add("editing");
    titleElement.focus();

    // 选中所有文本以便用户直接输入
    document.execCommand("selectAll", false, null);

    // 处理失焦事件，保存修改
    const saveTitle = () => {
      titleElement.removeAttribute("contenteditable");
      titleElement.classList.remove("editing");

      // 获取并清理标题文本
      let newTitle = titleElement.textContent.trim();

      // 如果标题为空，恢复默认标题
      if (!newTitle) {
        newTitle = `便签 ${this.id}`;
      }

      this.title = newTitle;
      titleElement.textContent = this.title;
    };

    // 处理按键事件
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault(); // 阻止换行
        saveTitle();
        titleElement.blur(); // 移除焦点
      } else if (e.key === "Escape") {
        // 取消编辑，恢复原标题
        titleElement.textContent = originalTitle;
        titleElement.blur();
      }
    };

    // 添加事件监听器
    titleElement.addEventListener("blur", saveTitle, { once: true });
    titleElement.addEventListener("keydown", handleKeyDown);
  }
}

// 辅助函数：获取最高的z-index
function getHighestZIndex() {
  const notes = document.querySelectorAll(".note");
  let highest = 0;

  notes.forEach((note) => {
    const zIndex = parseInt(window.getComputedStyle(note).zIndex, 10) || 0;
    if (zIndex > highest) {
      highest = zIndex;
    }
  });

  return highest;
}
