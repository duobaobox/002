class Note {
  constructor(id, text = "", x = 50, y = 50, title = "", colorClass = null) {
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
    // 如果文本不为空，默认设置为预览模式
    this.editMode = text.trim() === "";
    this.updateTimer = null; // 用于防抖渲染
    // 保存便签的颜色类名
    this.colorClass = colorClass;

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

    // 使用保存的颜色类或随机生成一个
    const colorClass = this.colorClass || this.getRandomColorClass();
    // 保存选择的颜色类
    this.colorClass = colorClass;

    note.className = "note " + colorClass;
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

    // 创建独立的编辑提示元素（注意：之前这里有重复定义）
    const editHint = document.createElement("div");
    editHint.className = "edit-hint";
    editHint.textContent = "双击编辑";
    editHint.style.position = "absolute";
    editHint.style.right = "10px";
    editHint.style.bottom = "10px";
    editHint.style.fontSize = "11px";
    editHint.style.color = "rgba(0, 0, 0, 0.3)";
    editHint.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
    editHint.style.padding = "2px 5px";
    editHint.style.borderRadius = "3px";
    editHint.style.opacity = "0";
    editHint.style.transition = "opacity 0.3s";
    editHint.style.pointerEvents = "none";
    editHint.style.zIndex = "100";

    // 为预览区域添加双击事件，切换回编辑模式
    markdownPreview.addEventListener("dblclick", () => {
      this.editMode = true;
      this.toggleEditPreviewMode(textarea, markdownPreview);
      setTimeout(() => textarea.focus(), 10); // 聚焦到文本区域
    });

    // 为编辑提示也添加点击事件（可选，提高可用性）
    editHint.addEventListener("click", (e) => {
      if (!this.editMode) {
        e.stopPropagation();
        this.editMode = true;
        this.toggleEditPreviewMode(textarea, markdownPreview);
        setTimeout(() => textarea.focus(), 10);
      }
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
    // 添加编辑提示到便签主体，而不是预览区域内部
    body.appendChild(editHint);
    note.appendChild(header);
    note.appendChild(body);
    note.appendChild(resizeHandle);

    // 设置拖动事件
    this.setupDragEvents(note, header);

    // 设置调整大小事件
    this.setupResizeEvents(note, resizeHandle);

    // 添加到DOM - 修改为添加到便签容器而不是画布
    this.element = note;
    document.getElementById("note-container").appendChild(note);

    // 设置初始z-index
    note.style.zIndex = getHighestZIndex() + 1;

    // 初始切换模式 - 有内容的便签默认显示预览模式
    this.toggleEditPreviewMode(textarea, markdownPreview);

    // 初始化滚动条
    this.updateScrollbar(
      this.editMode ? textarea : markdownPreview,
      scrollbarThumb
    );

    // 聚焦到文本区域 (仅对空白便签)
    if (this.text === "") {
      setTimeout(() => textarea.focus(), 0);
    }

    // 添加悬停事件显示编辑提示
    note.addEventListener("mouseenter", () => {
      editHint.style.opacity = "1";
    });
    note.addEventListener("mouseleave", () => {
      editHint.style.opacity = "0";
    });

    // 预览模式下应该更新编辑提示的位置
    this.updateEditHintVisibility = () => {
      if (this.editMode) {
        editHint.style.opacity = "0";
        editHint.style.pointerEvents = "none";
      } else {
        editHint.style.pointerEvents = "auto"; // 预览模式下可点击
      }
    };

    // 监听窗口调整大小事件，更新提示位置
    window.addEventListener("resize", () => {
      if (!this.editMode && this.element) {
        this.updateEditHintVisibility();
      }
    });
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

      // 确保预览内容是最新的
      preview.innerHTML = this.renderMarkdown(this.text);

      // 更新滚动条
      const scrollbarThumb = this.element.querySelector(".scrollbar-thumb");
      this.updateScrollbar(preview, scrollbarThumb);
    }

    // 更新编辑提示可见性
    if (this.updateEditHintVisibility) {
      this.updateEditHintVisibility();
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

      // 检查底部控制栏位置，防止便签移动到底部控制栏下方
      const bottomBar = document.querySelector(".bottom-bar");
      const bottomBarRect = bottomBar.getBoundingClientRect();

      // 避免便签头部与底部控制栏重叠
      const noteHeight = note.offsetHeight;
      const headerHeight = 30; // 便签头部高度
      const safeBottomPosition = window.innerHeight - bottomBarRect.height - 40; // 保留安全间距

      const finalY = Math.min(y, safeBottomPosition - headerHeight);

      note.style.left = `${x}px`;
      note.style.top = `${finalY}px`;
    });

    window.addEventListener("mouseup", () => {
      if (this.isDragging) {
        // 便签移动完成后触发事件，通知服务器更新数据
        document.dispatchEvent(
          new CustomEvent("note-moved", { detail: { id: this.id } })
        );
      }
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
      if (this.isResizing) {
        // 便签调整大小完成后触发事件，通知服务器更新数据
        document.dispatchEvent(
          new CustomEvent("note-resized", { detail: { id: this.id } })
        );
      }
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

    // 发送更新事件
    document.dispatchEvent(
      new CustomEvent("note-updated", { detail: { id: this.id } })
    );
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

      // 触发标题更新事件
      document.dispatchEvent(
        new CustomEvent("note-updated", { detail: { id: this.id } })
      );
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

// 修改更新便签内容的方法
function updateNoteContent(noteElement, content) {
  const contentElement = noteElement.querySelector(".note-content");
  const previewElement = noteElement.querySelector(".markdown-preview");

  // 如果内容是Markdown格式，则解析它并更新预览区域
  if (contentElement.classList.contains("markdown")) {
    // 保存原始文本到文本区域
    contentElement.value = content;

    // 更新预览区域显示解析后的HTML
    if (previewElement) {
      previewElement.innerHTML = marked.parse(content);

      // 如果有代码块，应用高亮
      previewElement.querySelectorAll("pre code").forEach((block) => {
        hljs.highlightElement(block);
      });

      // 确保预览区域可见，文本区域隐藏
      previewElement.style.display = "block";
      contentElement.style.display = "none";
    }
  } else {
    // 普通文本模式，直接更新文本区域
    contentElement.value = content;
  }
}

// 修复 createEmptyAiNote 函数
function createEmptyAiNote() {
  // 随机位置
  const x = 100 + Math.random() * 200;
  const y = 100 + Math.random() * 200;

  // 随机颜色
  const colorClasses = [
    "note-yellow",
    "note-blue",
    "note-green",
    "note-pink",
    "note-purple",
  ];
  const colorClass =
    colorClasses[Math.floor(Math.random() * colorClasses.length)];

  // 创建便签元素
  const note = document.createElement("div");
  const noteId = "note-" + Date.now();
  note.id = noteId;
  note.className = `note ${colorClass}`;
  note.style.left = `${x}px`;
  note.style.top = `${y}px`;

  // 设置最高层级，确保新便签显示在最上层
  note.style.zIndex = getHighestZIndex() + 10;

  // 创建便签头部
  const header = document.createElement("div");
  header.className = "note-header";

  // 添加标题和关闭按钮，与Note类结构相同
  const title = document.createElement("div");
  title.className = "note-title";
  title.textContent = "AI生成中...";
  title.setAttribute("title", "双击编辑标题"); // 添加与Note类相同的tooltip

  const closeBtn = document.createElement("div");
  closeBtn.className = "note-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", () => note.remove());

  header.appendChild(title);
  header.appendChild(closeBtn);
  note.appendChild(header);

  // 创建便签内容区域
  const body = document.createElement("div");
  body.className = "note-body";

  // 创建文本区域
  const textarea = document.createElement("textarea");
  textarea.className = "note-content";
  textarea.placeholder = "AI 正在生成内容...";
  body.appendChild(textarea);

  // 创建预览区域
  const preview = document.createElement("div");
  preview.className = "markdown-preview";
  body.appendChild(preview);

  // 创建自定义滚动条容器和滑块，与Note类结构相同
  const scrollbarContainer = document.createElement("div");
  scrollbarContainer.className = "custom-scrollbar";

  const scrollbarThumb = document.createElement("div");
  scrollbarThumb.className = "scrollbar-thumb";
  scrollbarContainer.appendChild(scrollbarThumb);
  body.appendChild(scrollbarContainer);

  // 添加调整大小的控件
  const resizeHandle = document.createElement("div");
  resizeHandle.className = "note-resize-handle";

  // 添加等待指示器
  const loader = document.createElement("div");
  loader.className = "ai-typing-indicator";
  loader.innerHTML = "<span></span><span></span><span></span>";

  // 组装便签
  note.appendChild(body);
  note.appendChild(resizeHandle);
  note.appendChild(loader);

  // 添加到DOM
  document.getElementById("note-canvas").appendChild(note);

  // 使便签可拖动
  setupDragEvents(note, header);

  // 添加点击事件，确保便签点击时提升到最上层
  note.addEventListener("mousedown", () => {
    note.style.zIndex = getHighestZIndex() + 1;
  });

  return { noteElement: note, noteId };
}

// 添加一个单独的拖动事件处理函数，供createEmptyAiNote使用
function setupDragEvents(note, header) {
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  header.addEventListener("mousedown", (e) => {
    if (e.target === header) {
      isDragging = true;
      dragOffsetX = e.clientX - note.offsetLeft;
      dragOffsetY = e.clientY - note.offsetTop;
      note.style.zIndex = getHighestZIndex() + 1;
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const x = e.clientX - dragOffsetX;
    const y = e.clientY - dragOffsetY;

    // 检查底部控制栏位置
    const bottomBar = document.querySelector(".bottom-bar");
    const bottomBarRect = bottomBar.getBoundingClientRect();

    const noteHeight = note.offsetHeight;
    const headerHeight = 30; // 便签头部高度
    const safeBottomPosition = window.innerHeight - bottomBarRect.height - 40;

    const finalY = Math.min(y, safeBottomPosition - headerHeight);

    note.style.left = `${x}px`;
    note.style.top = `${finalY}px`;
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
  });
}
