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
    this.resizeTimer = null; // 用于resize操作的防抖
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

    // 设置便签默认大小
    const DEFAULT_NOTE_SIZE = {
      width: 320,
      height: 350,
    };

    note.style.width = `${DEFAULT_NOTE_SIZE.width}px`;
    note.style.height = `${DEFAULT_NOTE_SIZE.height}px`;

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
      this.toggleEditPreviewMode();
      setTimeout(() => textarea.focus(), 10); // 聚焦到文本区域
    });

    // 为编辑提示也添加点击事件（可选，提高可用性）
    editHint.addEventListener("click", (e) => {
      if (!this.editMode) {
        e.stopPropagation();
        this.editMode = true;
        this.toggleEditPreviewMode();
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
      // Save changes before switching mode
      this.text = textarea.value;
      document.dispatchEvent(
        new CustomEvent("note-updated", { detail: { id: this.id } })
      );

      if (this.text.trim() !== "") {
        this.editMode = false;
        this.toggleEditPreviewMode();
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

    // 添加ResizeObserver监听便签大小变化
    this.setupResizeObserver(note);

    // 初始切换模式 - 有内容的便签默认显示预览模式
    this.toggleEditPreviewMode();

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
      // 只有在非编辑模式下才显示"双击编辑"提示
      const editHint = this.element.querySelector(".edit-hint");
      if (!this.editMode && editHint) {
        editHint.style.opacity = "1";
        editHint.style.pointerEvents = "auto";
      }
    });
    note.addEventListener("mouseleave", () => {
      // 离开时无条件隐藏提示
      const editHint = this.element.querySelector(".edit-hint");
      if (editHint) {
        editHint.style.opacity = "0";
      }
    });

    // 监听窗口调整大小事件，更新提示位置
    window.addEventListener("resize", () => {
      if (!this.editMode && this.element) {
        this.updateEditHintVisibility();
      }
    });

    // 添加点击便签本身的事件，确保点击时将便签置于最前
    note.addEventListener("mousedown", (e) => {
      // 如果点击的是便签本身而不是其内部的可编辑元素
      if (
        e.target.closest(".note") &&
        !e.target.matches("textarea, input, [contenteditable='true']")
      ) {
        note.style.zIndex = getHighestZIndex() + 1;

        // 触发层级变化事件
        document.dispatchEvent(
          new CustomEvent("note-zindex-changed", { detail: { id: this.id } })
        );
      }
    });

    return note;
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

  // 切换编辑/预览模式 - Simplified
  toggleEditPreviewMode() {
    const textarea = this.element.querySelector(".note-content");
    const preview = this.element.querySelector(".markdown-preview");
    const scrollbarThumb = this.element.querySelector(".scrollbar-thumb");

    if (this.editMode) {
      textarea.style.display = "block";
      preview.style.display = "none";
      this.updateScrollbar(textarea, scrollbarThumb);
    } else {
      textarea.style.display = "none";
      preview.style.display = "block";
      preview.innerHTML = this.renderMarkdown(this.text); // Render on switch
      this.updateScrollbar(preview, scrollbarThumb);
    }

    // 调用更新方法确保提示状态始终与编辑模式同步
    this.updateEditHintVisibility();
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

        // 触发便签层级变化事件
        document.dispatchEvent(
          new CustomEvent("note-zindex-changed", { detail: { id: this.id } })
        );
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

      // 只应用最小尺寸限制，移除最大尺寸限制
      const minWidth = 150;
      const minHeight = 150;

      if (newWidth >= minWidth) {
        note.style.width = `${newWidth}px`;
      }

      if (newHeight >= minHeight) {
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

  // 添加新方法：设置ResizeObserver监听便签大小变化
  setupResizeObserver(note) {
    // 检查浏览器是否支持ResizeObserver
    if (typeof ResizeObserver !== "undefined") {
      // 记录初始尺寸
      this.lastWidth = note.offsetWidth;
      this.lastHeight = note.offsetHeight;

      // 创建一个观察器实例
      const resizeObserver = new ResizeObserver((entries) => {
        if (this.isResizing) return; // 如果是通过自定义控件调整大小，不重复触发

        const entry = entries[0];
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;

        // 检查是否有真实的尺寸变化
        if (newWidth !== this.lastWidth || newHeight !== this.lastHeight) {
          // 使用防抖，避免频繁触发更新
          clearTimeout(this.resizeTimer);
          this.resizeTimer = setTimeout(() => {
            // 更新记录的尺寸
            this.lastWidth = newWidth;
            this.lastHeight = newHeight;

            // 触发更新事件
            document.dispatchEvent(
              new CustomEvent("note-resized", { detail: { id: this.id } })
            );
          }, 300); // 300ms防抖延迟
        }
      });

      // 开始观察便签元素
      resizeObserver.observe(note);

      // 保存观察器引用以便后续可能的清理
      this.resizeObserver = resizeObserver;
    } else {
      console.warn("浏览器不支持ResizeObserver，便签大小调整可能不会保存");
    }
  }

  remove() {
    if (this.element) {
      // 停止观察大小变化
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }

      this.element.remove();
      document.dispatchEvent(
        new CustomEvent("note-removed", { detail: { id: this.id } })
      );
    }
  }

  update(text) {
    this.text = text;
    const textarea = this.element.querySelector(".note-content");
    if (textarea) {
      textarea.value = text;
    }
    // Update preview immediately if not in edit mode
    if (!this.editMode) {
      const preview = this.element.querySelector(".markdown-preview");
      if (preview) {
        preview.innerHTML = this.renderMarkdown(text);
      }
    }

    // Update scrollbar based on current mode
    const scrollbarThumb = this.element.querySelector(".scrollbar-thumb");
    const currentElement = this.editMode
      ? textarea
      : this.element.querySelector(".markdown-preview");
    if (currentElement) {
      this.updateScrollbar(currentElement, scrollbarThumb);
    }

    // Decide whether to switch mode based on content
    if (text.trim() !== "" && this.editMode) {
      // If content added in edit mode, consider switching to preview on blur
    } else if (text.trim() === "" && !this.editMode) {
      // If content removed, switch back to edit mode
      this.editMode = true;
      this.toggleEditPreviewMode();
    }

    // 发送更新事件 (debounced or immediate based on needs)
    // Debounce might be better handled in the event listener in app.js
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

  // 更新编辑提示的可见性
  updateEditHintVisibility() {
    if (!this.element) return;
    const editHint = this.element.querySelector(".edit-hint");
    if (!editHint) return;

    if (this.editMode) {
      editHint.style.opacity = "0";
      editHint.style.pointerEvents = "none";
    } else {
      editHint.style.opacity = "1"; // 在预览模式下显示提示
      editHint.style.pointerEvents = "auto"; // 预览模式下可点击
    }
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

// --- Restored Helper Functions ---

// 修改更新便签内容的方法 (恢复)
function updateNoteContent(noteElement, content) {
  const contentElement = noteElement.querySelector(".note-content");
  const previewElement = noteElement.querySelector(".markdown-preview");

  // 如果内容是Markdown格式，则解析它并更新预览区域
  // Check if markdown class exists or determine based on content
  if (previewElement && contentElement.classList.contains("markdown")) {
    // 保存原始文本到文本区域 (optional, maybe not needed for temp note)
    // contentElement.value = content;

    // 更新预览区域显示解析后的HTML
    previewElement.innerHTML = marked.parse(content); // Assuming 'marked' is globally available

    // 如果有代码块且hljs已定义，才应用高亮
    previewElement.querySelectorAll("pre code").forEach((block) => {
      if (typeof hljs !== "undefined") {
        hljs.highlightElement(block);
      }
    });

    // 确保预览区域可见，文本区域隐藏 (during typing effect)
    previewElement.style.display = "block";
    contentElement.style.display = "none";

    // Update scrollbar for preview element
    const scrollbarThumb = noteElement.querySelector(".scrollbar-thumb");
    if (scrollbarThumb) {
      const scrollHeight = previewElement.scrollHeight;
      const clientHeight = previewElement.clientHeight;
      if (scrollHeight <= clientHeight) {
        scrollbarThumb.style.display = "none";
      } else {
        scrollbarThumb.style.display = "block";
        const scrollRatio = clientHeight / scrollHeight;
        const thumbHeight = Math.max(30, scrollRatio * clientHeight);
        scrollbarThumb.style.height = `${thumbHeight}px`;
        const scrollableDistance = scrollHeight - clientHeight;
        const scrollPosition = previewElement.scrollTop;
        const scrollPercentage = scrollPosition / scrollableDistance;
        const thumbPosition = scrollPercentage * (clientHeight - thumbHeight);
        scrollbarThumb.style.top = `${thumbPosition}px`;
      }
    }
  } else {
    // Fallback or non-markdown mode: update textarea
    contentElement.value = content;
    previewElement.style.display = "none";
    contentElement.style.display = "block";
  }
}

// 修复 createEmptyAiNote 函数 (恢复)
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
  const noteId = "temp-ai-note-" + Date.now(); // Use a distinct ID format
  note.id = noteId;
  note.className = `note ${colorClass}`;
  note.style.left = `${x}px`;
  note.style.top = `${y}px`;

  // 设置最高层级，确保新便签显示在最上层
  note.style.zIndex = getHighestZIndex() + 10; // Use a higher z-index temporarily

  // 设置便签默认大小
  const DEFAULT_NOTE_SIZE = {
    width: 320,
    height: 350,
  };

  note.style.width = `${DEFAULT_NOTE_SIZE.width}px`;
  note.style.height = `${DEFAULT_NOTE_SIZE.height}px`;

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
  // Close button should remove the temp note
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    note.remove();
    // Optionally, signal cancellation to app.js if needed
  });

  header.appendChild(title);
  header.appendChild(closeBtn);
  note.appendChild(header);

  // 创建便签内容区域
  const body = document.createElement("div");
  body.className = "note-body";

  // 创建文本区域 (hidden during typing)
  const textarea = document.createElement("textarea");
  textarea.className = "note-content";
  textarea.placeholder = "AI 正在生成内容...";
  textarea.style.display = "none"; // Hide initially
  body.appendChild(textarea);

  // 创建预览区域 (visible during typing)
  const preview = document.createElement("div");
  preview.className = "markdown-preview";
  preview.style.display = "block"; // Show initially
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
  note.appendChild(loader); // Add loader initially

  // 添加到DOM (添加到 note-container)
  document.getElementById("note-container").appendChild(note);

  // 使便签可拖动 (Use the restored specific drag handler)
  setupDragEventsForTemp(note, header);

  // 为临时AI便签添加大小调整监控
  setupResizeObserverForTemp(note, noteId);

  // 添加点击事件，确保便签点击时提升到最上层
  note.addEventListener("mousedown", () => {
    note.style.zIndex = getHighestZIndex() + 1;
    // No need to dispatch z-index change for temp note
  });

  return { noteElement: note, noteId };
}

// 为临时AI便签添加ResizeObserver (恢复)
function setupResizeObserverForTemp(note, noteId) {
  if (typeof ResizeObserver !== "undefined") {
    let lastWidth = note.offsetWidth;
    let lastHeight = note.offsetHeight;
    let resizeTimer = null;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      const newWidth = entry.contentRect.width;
      const newHeight = entry.contentRect.height;

      if (newWidth !== lastWidth || newHeight !== lastHeight) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          lastWidth = newWidth;
          lastHeight = newHeight;
          // 临时便签的大小变化我们不需要保存到服务器
          console.log(
            `临时AI便签 ${noteId} 大小已调整: ${newWidth}x${newHeight}`
          );
          // Update scrollbar on resize
          const preview = note.querySelector(".markdown-preview");
          const scrollbarThumb = note.querySelector(".scrollbar-thumb");
          if (preview && scrollbarThumb) {
            const scrollHeight = preview.scrollHeight;
            const clientHeight = preview.clientHeight;
            if (scrollHeight <= clientHeight) {
              scrollbarThumb.style.display = "none";
            } else {
              scrollbarThumb.style.display = "block";
              const scrollRatio = clientHeight / scrollHeight;
              const thumbHeight = Math.max(30, scrollRatio * clientHeight);
              scrollbarThumb.style.height = `${thumbHeight}px`;
              // Position update happens in updateNoteContent or scroll event
            }
          }
        }, 300);
      }
    });

    resizeObserver.observe(note);

    // 在note上存储observer引用，以便后续可能的清理
    note._resizeObserver = resizeObserver;
  }
}

// 添加一个单独的拖动事件处理函数，供createEmptyAiNote使用 (恢复)
// Renamed to avoid conflict with Note class method if it exists globally
function setupDragEventsForTemp(note, header) {
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  header.addEventListener("mousedown", (e) => {
    // Only drag if clicking the header itself, not buttons inside
    if (e.target === header) {
      isDragging = true;
      dragOffsetX = e.clientX - note.offsetLeft;
      dragOffsetY = e.clientY - note.offsetTop;
      note.style.zIndex = getHighestZIndex() + 1; // Bring to front on drag start
    }
  });

  // Use window listeners for mousemove and mouseup for better drag experience
  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const x = e.clientX - dragOffsetX;
    const y = e.clientY - dragOffsetY;

    // Optional: Add boundary checks if needed
    // const canvasRect = document.getElementById('note-canvas').getBoundingClientRect();
    // const noteRect = note.getBoundingClientRect();
    // const finalX = Math.max(0, Math.min(x, canvasRect.width - noteRect.width));
    // const finalY = Math.max(0, Math.min(y, canvasRect.height - noteRect.height));

    note.style.left = `${x}px`;
    note.style.top = `${y}px`;
  };

  const handleMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      // No need to save position for temp note
    }
  };

  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);

  // Store handlers on the note element to remove them later if needed
  note._tempDragHandlers = { handleMouseMove, handleMouseUp };
}

// Removed setupNoteClickEvents as the logic is included in createEmptyAiNote
