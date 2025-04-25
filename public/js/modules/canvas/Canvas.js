/**
 * Canvas 类模块
 * 负责管理画布和便签容器的缩放、平移等操作
 */

import ReadingMode from "../ui/ReadingMode.js";

export class Canvas {
  constructor() {
    this.canvas = document.getElementById("note-canvas");
    this.isPanning = false;
    this.isRightPanning = false; // 添加右键拖动状态跟踪
    this.startPoint = { x: 0, y: 0 };
    this.currentPoint = { x: 0, y: 0 };
    this.offset = { x: 0, y: 0 }; // 平移偏移量

    // 添加画布缩放相关属性
    this.scale = 1.0; // 默认缩放比例为100%
    this.minScale = 0.3; // 最小缩放比例30%
    this.maxScale = 2.0; // 最大缩放比例200%

    // 添加分享状态跟踪
    this.activeShare = null; // 当前活跃的分享信息，如果没有则为 null

    // 创建便签容器元素
    this.createNoteContainer();

    // 添加简单的网格背景
    this.createGridBackground();

    // 初始化缩放控制器
    this.createZoomControls();

    // 初始化性能优化的事件处理
    this.setupEvents();

    // 初始化阅读模式
    this.readingMode = new ReadingMode();

    // 从本地存储恢复画布状态
    this.restoreCanvasState();

    // 检查用户分享状态
    this.checkShareStatus();

    // 将Canvas实例存储为全局变量，便于其他模块访问
    window.canvasInstance = this;
  }

  // 创建便签容器
  createNoteContainer() {
    // 创建一个新的便签容器，作为画布的子元素
    this.noteContainer = document.createElement("div");
    this.noteContainer.id = "note-container";
    this.noteContainer.className = "note-container";
    this.canvas.appendChild(this.noteContainer);

    // 应用初始样式 - 确保没有过渡效果
    this.noteContainer.style.position = "absolute";
    this.noteContainer.style.width = "100%";
    this.noteContainer.style.height = "100%";
    this.noteContainer.style.top = "0";
    this.noteContainer.style.left = "0";
    this.noteContainer.style.transformOrigin = "0 0"; // 变换原点为左上角
    this.noteContainer.style.transition = "none"; // 禁用过渡效果，确保即时响应
  }

  // 创建网格背景和装饰元素
  createGridBackground() {
    // 创建网格容器
    const gridContainer = document.createElement("div");
    gridContainer.className = "grid-background";

    // 添加实际网格元素
    const grid = document.createElement("div");
    grid.className = "grid";
    grid.style.transition = "none"; // 禁用过渡效果
    gridContainer.appendChild(grid);

    // 将网格添加到画布
    this.canvas.insertBefore(gridContainer, this.canvas.firstChild);

    // 保存网格引用
    this.gridElement = grid;

    // 创建装饰性背景元素
    this.createDecorativeBackground();
  }

  // 创建装饰性背景元素
  createDecorativeBackground() {
    // 创建装饰性背景容器
    const bgContainer = document.createElement("div");
    bgContainer.className = "canvas-background";

    // 添加点阵装饰
    this.addDots(bgContainer, 40); // 增加到40个点

    // 添加渐变气泡
    this.addGradientBubbles(bgContainer, 6); // 增加到6个渐变气泡

    // 添加装饰线条
    this.addDecorativeLines(bgContainer, 8); // 添加8条装饰线

    // 将装饰性背景容器添加到画布
    this.canvas.insertBefore(bgContainer, this.canvas.firstChild);
  }

  /**
   * 创建装饰元素的通用函数
   * @param {HTMLElement} container - 容器元素
   * @param {number} count - 元素数量
   * @param {Object} options - 配置选项
   */
  createDecorativeElements(container, count, options) {
    const {
      className, // 元素的CSS类名
      sizeRange, // 尺寸范围 [min, max]
      opacityRange, // 透明度范围 [min, max]
      colors, // 颜色数组
      positionMultiplier, // 位置乘数 [x, y]
      positionOffset, // 位置偏移 [x, y]
      useAnimation = false, // 是否使用动画
      useRotation = false, // 是否使用旋转
      isGradient = false, // 是否使用渐变色
      widthHeightRatio = 1, // 宽高比例
    } = options;

    const canvasWidth = this.canvas.clientWidth;
    const canvasHeight = this.canvas.clientHeight;

    for (let i = 0; i < count; i++) {
      const element = document.createElement("div");
      element.className = className;

      // 随机位置
      const x =
        Math.random() * canvasWidth * positionMultiplier[0] -
        canvasWidth * positionOffset[0];
      const y =
        Math.random() * canvasHeight * positionMultiplier[1] -
        canvasHeight * positionOffset[1];

      // 随机大小
      const size = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);

      // 随机颜色
      const color = colors[Math.floor(Math.random() * colors.length)];

      // 设置样式
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;

      if (widthHeightRatio === 1) {
        // 正方形元素
        element.style.width = `${size}px`;
        element.style.height = `${size}px`;
      } else {
        // 非正方形元素（如线条）
        element.style.width = `${size}px`;
        element.style.height = `${size / widthHeightRatio}px`;
      }

      // 设置颜色
      if (isGradient) {
        element.style.background = color;
      } else {
        element.style.backgroundColor = color;
      }

      // 设置透明度
      element.style.opacity = (
        opacityRange[0] +
        Math.random() * (opacityRange[1] - opacityRange[0])
      ).toFixed(2);

      // 添加旋转（如果需要）
      if (useRotation) {
        const rotation = Math.random() * 180;
        element.style.transform = `rotate(${rotation}deg)`;
      }

      // 添加动画延迟（如果需要）
      if (useAnimation) {
        element.style.animationDelay = `${Math.random() * 5}s`;
      }

      container.appendChild(element);
    }
  }

  // 添加点阵装饰
  addDots(container, count) {
    const colors = [
      "rgba(26, 115, 232, 0.1)", // 蓝色
      "rgba(52, 168, 83, 0.1)", // 绿色
      "rgba(251, 188, 5, 0.1)", // 黄色
      "rgba(234, 67, 53, 0.1)", // 红色
      "rgba(103, 58, 183, 0.1)", // 紫色
    ];

    this.createDecorativeElements(container, count, {
      className: "bg-dots",
      sizeRange: [3, 8],
      opacityRange: [0.3, 1.0],
      colors: colors,
      positionMultiplier: [2, 2],
      positionOffset: [0.5, 0.5],
    });
  }

  // 添加渐变气泡
  addGradientBubbles(container, count) {
    const colors = [
      "linear-gradient(45deg, rgba(26, 115, 232, 0.3), rgba(26, 115, 232, 0.1))", // 蓝色
      "linear-gradient(45deg, rgba(52, 168, 83, 0.3), rgba(52, 168, 83, 0.1))", // 绿色
      "linear-gradient(45deg, rgba(251, 188, 5, 0.3), rgba(251, 188, 5, 0.1))", // 黄色
      "linear-gradient(45deg, rgba(234, 67, 53, 0.3), rgba(234, 67, 53, 0.1))", // 红色
      "linear-gradient(45deg, rgba(103, 58, 183, 0.3), rgba(103, 58, 183, 0.1))", // 紫色
    ];

    this.createDecorativeElements(container, count, {
      className: "bg-gradient-bubble",
      sizeRange: [100, 300],
      opacityRange: [0.05, 0.15],
      colors: colors,
      positionMultiplier: [2, 2],
      positionOffset: [0.5, 0.5],
      useAnimation: true,
      isGradient: true,
    });
  }

  // 添加装饰线条
  addDecorativeLines(container, count) {
    const colors = [
      "rgba(26, 115, 232, 0.1)", // 蓝色
      "rgba(52, 168, 83, 0.1)", // 绿色
      "rgba(251, 188, 5, 0.1)", // 黄色
      "rgba(234, 67, 53, 0.1)", // 红色
      "rgba(103, 58, 183, 0.1)", // 紫色
    ];

    this.createDecorativeElements(container, count, {
      className: "bg-line",
      sizeRange: [50, 200],
      opacityRange: [0.1, 0.4],
      colors: colors,
      positionMultiplier: [1.5, 1.5],
      positionOffset: [0.25, 0.25],
      useAnimation: true,
      useRotation: true,
      widthHeightRatio: 100, // 线条的宽高比例，使高度很小
    });
  }

  // 创建缩放控制器
  createZoomControls() {
    // 创建缩放控制器容器
    const zoomControls = document.createElement("div");
    zoomControls.className = "zoom-controls";

    // 创建设置按钮 - 放在最上面
    const settingsBtn = document.createElement("button");
    settingsBtn.className = "zoom-btn settings-btn";
    // 使用SVG图标替代文本字符
    settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
    settingsBtn.title = "设置";
    settingsBtn.addEventListener("click", () => {
      // 获取设置弹窗并显示
      const settingsModal = document.getElementById("settings-modal");
      if (settingsModal) {
        settingsModal.classList.add("visible");
      }
    });

    // 创建放大按钮 - 使用SVG图标
    const zoomInBtn = document.createElement("button");
    zoomInBtn.className = "zoom-btn zoom-in modern-btn";
    zoomInBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>`;
    zoomInBtn.title = "放大画布";
    zoomInBtn.addEventListener("click", () => this.zoomIn());

    // 创建缩放显示 - 在中间
    const zoomDisplay = document.createElement("div");
    zoomDisplay.className = "zoom-display";
    zoomDisplay.id = "zoom-level";
    zoomDisplay.textContent = "100%";

    // 创建缩小按钮 - 使用SVG图标
    const zoomOutBtn = document.createElement("button");
    zoomOutBtn.className = "zoom-btn zoom-out modern-btn";
    zoomOutBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>`;
    zoomOutBtn.title = "缩小画布";
    zoomOutBtn.addEventListener("click", () => this.zoomOut());

    // 创建重置按钮 - 使用SVG图标
    const zoomResetBtn = document.createElement("button");
    zoomResetBtn.className = "zoom-btn zoom-reset modern-btn";
    zoomResetBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>`;
    zoomResetBtn.title = "重置缩放";
    zoomResetBtn.addEventListener("click", () => this.resetZoom());

    // 创建阅读模式按钮 - 放在重置按钮下方
    const readModeBtn = document.createElement("button");
    readModeBtn.className = "zoom-btn read-mode-btn modern-btn"; // 添加现代风格类
    // 使用SVG图标替代emoji
    readModeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`;
    readModeBtn.title = "切换阅读模式";
    readModeBtn.addEventListener("click", () => this.openReadingMode());

    // 创建分享按钮 - 放在阅读模式按钮下方
    const shareBtn = document.createElement("button");
    shareBtn.className = "zoom-btn share-btn modern-btn"; // 添加现代风格类
    // 使用SVG图标替代emoji
    shareBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`;
    shareBtn.title = "分享画布";
    shareBtn.addEventListener("click", () => this.shareCanvas());

    // 组装控制器 - 调整顺序为从上到下
    zoomControls.appendChild(settingsBtn);
    zoomControls.appendChild(zoomInBtn);
    zoomControls.appendChild(zoomDisplay);
    zoomControls.appendChild(zoomOutBtn);
    zoomControls.appendChild(zoomResetBtn);
    zoomControls.appendChild(readModeBtn); // 添加阅读模式按钮
    zoomControls.appendChild(shareBtn); // 添加分享按钮

    // 添加到DOM
    document.querySelector(".canvas-container").appendChild(zoomControls);
  }

  // 缩小画布
  zoomOut() {
    if (this.scale > this.minScale) {
      this.scale = Math.max(this.scale - 0.1, this.minScale);
      this.applyTransform();
    }
  }

  // 放大画布
  zoomIn() {
    if (this.scale < this.maxScale) {
      this.scale = Math.min(this.scale + 0.1, this.maxScale);
      this.applyTransform();
    }
  }

  // 重置缩放
  resetZoom() {
    this.scale = 1.0;
    this.applyTransform();
  }

  // 应用变换（统一处理缩放和平移）
  applyTransform() {
    // 更新显示
    document.getElementById("zoom-level").textContent = `${Math.round(
      this.scale * 100
    )}%`;

    // 应用变换：使用硬件加速并移除过渡效果
    this.noteContainer.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;

    // 强制使用硬件加速
    this.noteContainer.style.willChange = "transform";

    // 更新所有便签的z-index以防止缩放时层级问题
    const notes = document.querySelectorAll(".note");
    notes.forEach((note) => {
      note.style.zIndex = parseInt(note.style.zIndex || 1);
    });

    // 保存当前画布状态到本地存储
    this.saveCanvasState();

    // 触发自定义事件，通知应用画布变换已更新
    const event = new CustomEvent("canvas-transform-updated", {
      detail: {
        scale: this.scale,
        offsetX: this.offset.x,
        offsetY: this.offset.y,
      },
    });
    document.dispatchEvent(event);
  }

  // 事件处理 - 重命名并简化，移除不必要的性能限制
  setupEvents() {
    // 阻止右键菜单，以便可以使用右键拖动
    document.addEventListener("contextmenu", (e) => {
      // 阻止默认的右键菜单
      e.preventDefault();
    });

    // 鼠标按下事件 - 开始平移画布
    this.canvas.addEventListener("mousedown", (e) => {
      // 右键点击 - 在任何位置都可以拖动画布
      if (e.button === 2) {
        this.isRightPanning = true;
        this.startPoint = { x: e.clientX, y: e.clientY };
        this.canvas.style.cursor = "grabbing";
        e.preventDefault(); // 防止默认行为
        e.stopPropagation(); // 阻止事件冒泡
      }
      // 左键点击 - 只有在画布空白处或网格背景时才触发平移
      else if (
        e.button === 0 &&
        (e.target === this.canvas ||
          e.target.classList.contains("grid") ||
          e.target.classList.contains("grid-background"))
      ) {
        this.isPanning = true;
        this.startPoint = { x: e.clientX, y: e.clientY };
        this.canvas.style.cursor = "grabbing";
      }
    });

    // 鼠标移动事件 - 平移画布 (直接响应，不使用requestAnimationFrame或时间限制)
    document.addEventListener("mousemove", (e) => {
      if (!this.isPanning && !this.isRightPanning) return;

      // 直接移动画布，不进行任何限流或延迟
      this.moveCanvas(e.clientX, e.clientY);
    });

    // 鼠标松开事件 - 停止平移
    document.addEventListener("mouseup", (e) => {
      if (e.button === 2) {
        this.isRightPanning = false;
      } else {
        this.isPanning = false;
      }
      this.canvas.style.cursor = "default";
    });

    // 鼠标离开事件 - 停止平移
    document.addEventListener("mouseleave", () => {
      this.isPanning = false;
      this.isRightPanning = false;
      this.canvas.style.cursor = "default";
    });

    // 添加鼠标滚轮缩放事件
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        // 只在按住Ctrl键时进行缩放
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault(); // 防止页面滚动

          // 获取当前鼠标在画布上的位置
          const rect = this.canvas.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          // 缩放前的值
          const oldScale = this.scale;

          if (e.deltaY < 0) {
            // 向上滚动，放大
            this.zoomIn();
          } else {
            // 向下滚动，缩小
            this.zoomOut();
          }

          // 缩放比例变化
          const scaleFactor = this.scale / oldScale;

          // 调整偏移量以保持鼠标指向的点不变
          this.offset.x = mouseX - (mouseX - this.offset.x) * scaleFactor;
          this.offset.y = mouseY - (mouseY - this.offset.y) * scaleFactor;

          // 应用变换
          this.applyTransform();
        }
      },
      { passive: false }
    );
  }

  // 移动画布的方法 - 使用 requestAnimationFrame 优化性能
  moveCanvas(clientX, clientY) {
    this.currentPoint = { x: clientX, y: clientY };

    // 计算鼠标移动距离
    const deltaX = this.currentPoint.x - this.startPoint.x;
    const deltaY = this.currentPoint.y - this.startPoint.y;

    // 更新偏移量
    this.offset.x += deltaX;
    this.offset.y += deltaY;

    // 更新起始点为当前点
    this.startPoint = { x: this.currentPoint.x, y: this.currentPoint.y };

    // 如果已经有一个动画帧请求，不再创建新的
    if (!this._animationFrameId) {
      // 使用 requestAnimationFrame 优化渲染性能
      this._animationFrameId = requestAnimationFrame(() => {
        this._animationFrameId = null;

        // 应用变换：先平移后缩放
        this.noteContainer.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;

        // 更新网格背景 - 使用与便签容器相同的变换，但只保留平移部分
        if (this.gridElement) {
          // 直接使用偏移量，但对网格图案应用循环效果
          const gridSize = 30; // 更新为跟新的CSS网格大小一致
          const offsetX = this.offset.x % gridSize;
          const offsetY = this.offset.y % gridSize;

          // 为网格应用平移变换
          this.gridElement.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        }

        // 触发变换更新事件，但不调用完整的applyTransform以提高性能
        const event = new CustomEvent("canvas-transform-updated", {
          detail: {
            scale: this.scale,
            offsetX: this.offset.x,
            offsetY: this.offset.y,
          },
        });
        document.dispatchEvent(event);
      });
    }

    // 使用节流函数保存画布状态，避免频繁保存
    // 这个操作不需要在动画帧中执行，可以独立节流
    this.throttledSaveCanvasState();
  }

  /**
   * 将屏幕坐标转换为画布坐标
   * @param {number} screenX - 屏幕X坐标
   * @param {number} screenY - 屏幕Y坐标
   * @returns {Object} 画布坐标 {x, y}
   */
  screenToCanvasPosition(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = (screenX - rect.left - this.offset.x) / this.scale;
    const canvasY = (screenY - rect.top - this.offset.y) / this.scale;
    return { x: canvasX, y: canvasY };
  }

  /**
   * 将画布坐标转换为屏幕坐标
   * @param {number} canvasX - 画布X坐标
   * @param {number} canvasY - 画布Y坐标
   * @returns {Object} 屏幕坐标 {x, y}
   */
  canvasToScreenPosition(canvasX, canvasY) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = canvasX * this.scale + this.offset.x + rect.left;
    const screenY = canvasY * this.scale + this.offset.y + rect.top;
    return { x: screenX, y: screenY };
  }

  /**
   * 获取当前缩放比例
   * @returns {number} 当前缩放比例
   */
  getScale() {
    return this.scale;
  }

  /**
   * 获取当前偏移量
   * @returns {Object} 当前偏移量 {x, y}
   */
  getOffset() {
    return { x: this.offset.x, y: this.offset.y };
  }

  /**
   * 打开阅读模式弹窗
   */
  openReadingMode() {
    // 获取所有便签
    const notes = document.querySelectorAll(".note");

    // 使用阅读模式组件打开弹窗
    this.readingMode.open(notes);
  }

  /**
   * 分享画布
   * 打开分享配置弹窗，允许用户开启或关闭分享
   */
  async shareCanvas() {
    try {
      // 先检查当前分享状态
      console.log("发送请求到 /api/share/status");
      const response = await fetch("/api/share/status", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
      });

      console.log("收到响应:", response.status, response.statusText);

      if (!response.ok) {
        // 如果请求失败，可能是未登录
        if (response.status === 401) {
          this.showMessage("请先登录再进行分享", "error");
          return;
        } else if (response.status === 404) {
          this.showMessage("分享功能未完全配置，请联系管理员", "error");
          return;
        }
        throw new Error(
          `获取分享状态失败: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      // 更新分享状态
      if (data.success && data.shareStatus) {
        this.activeShare = {
          id: data.shareId,
          url: data.shareLink,
          canvasName: data.canvasName,
        };
        // 如果已有活跃分享，直接显示分享链接弹窗
        this.showShareLinkDialog(
          this.activeShare.url,
          this.activeShare.id,
          this.activeShare.canvasName
        );
      } else {
        // 如果没有活跃分享，打开分享配置弹窗
        this.showShareConfigDialog();
      }
    } catch (error) {
      console.error("获取分享状态失败:", error);
      this.showMessage(`获取分享状态失败: ${error.message}`, "error");
      // 出错时仍然尝试打开分享配置弹窗
      this.showShareConfigDialog();
    }
  }

  /**
   * 创建通用对话框
   * @param {Object} options - 对话框配置选项
   * @returns {HTMLElement} 创建的对话框元素
   */
  createDialog(options) {
    const {
      className = "share-dialog", // 对话框CSS类名
      title, // 对话框标题
      content, // 对话框内容HTML
      buttons = [], // 按钮配置数组 [{text, className, onClick, primary}]
      closeOnOutsideClick = true, // 点击外部是否关闭
      onClose, // 关闭回调
    } = options;

    // 移除同类现有对话框
    const existingDialog = document.querySelector(`.${className}`);
    if (existingDialog) {
      existingDialog.remove();
    }

    // 创建对话框
    const dialog = document.createElement("div");
    dialog.className = className;

    // 构建对话框内容
    let dialogHTML = `
      <div class="${className}-content">
        ${title ? `<h3>${title}</h3>` : ""}
        ${content}
    `;

    // 添加按钮区域
    if (buttons.length > 0) {
      dialogHTML += `<div class="${className}-actions">`;
      buttons.forEach((button) => {
        const btnClass =
          button.className || (button.primary ? "primary-btn" : "");
        dialogHTML += `<button class="${btnClass}">${button.text}</button>`;
      });
      dialogHTML += `</div>`;
    }

    dialogHTML += `</div>`;
    dialog.innerHTML = dialogHTML;

    // 添加到文档
    document.body.appendChild(dialog);

    // 绑定按钮事件
    if (buttons.length > 0) {
      const buttonElements = dialog.querySelectorAll(
        `.${className}-actions button`
      );
      buttons.forEach((button, index) => {
        if (button.onClick && buttonElements[index]) {
          buttonElements[index].addEventListener("click", (e) => {
            button.onClick(e, dialog);
          });
        }
      });
    }

    // 点击对话框外部关闭
    if (closeOnOutsideClick) {
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) {
          dialog.remove();
          if (onClose) onClose();
        }
      });
    }

    return dialog;
  }

  /**
   * 显示分享配置弹窗
   */
  showShareConfigDialog() {
    // 获取应用名称作为默认画布名称
    const defaultCanvasName = "InfinityNotes"; // 默认软件名称

    // 创建对话框内容
    const content = `
      <!-- 添加画布名称输入框 -->
      <div class="canvas-name-container">
        <label for="canvas-name">画布名称:</label>
        <input type="text" id="canvas-name" class="canvas-name" value="${defaultCanvasName}" placeholder="输入画布名称" />
      </div>

      <p class="share-description">开启分享后，其他人可以通过链接查看您的画布内容。</p>
    `;

    // 创建对话框
    const dialog = this.createDialog({
      title: "分享画布",
      content: content,
      buttons: [
        {
          text: "开启分享",
          className: "start-share-btn primary-btn",
          primary: true,
          onClick: async (e, dialog) => {
            const startShareBtn = e.target;
            const canvasNameInput = dialog.querySelector("#canvas-name");

            try {
              startShareBtn.disabled = true;
              startShareBtn.textContent = "正在创建分享...";

              // 获取画布名称
              const canvasName =
                canvasNameInput.value.trim() || defaultCanvasName;

              // 发送请求创建分享
              const response = await fetch("/api/share", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                credentials: "same-origin",
                body: JSON.stringify({
                  canvasState: {
                    scale: this.scale,
                    offsetX: this.offset.x,
                    offsetY: this.offset.y,
                  },
                  canvasName: canvasName,
                }),
              });

              const data = await response.json();

              if (!data.success) {
                throw new Error(data.message || "创建分享失败");
              }

              // 创建分享链接
              const shareUrl = `${window.location.origin}/share.html?id=${
                data.shareId
              }&name=${encodeURIComponent(canvasName)}`;

              // 保存当前活跃的分享信息
              this.activeShare = {
                id: data.shareId,
                url: shareUrl,
                canvasName: canvasName,
                createdAt: new Date().toISOString(),
              };

              // 关闭当前对话框
              dialog.remove();

              // 显示分享链接对话框
              this.showShareLinkDialog(shareUrl, data.shareId, canvasName);
            } catch (error) {
              console.error("分享画布出错:", error);
              startShareBtn.disabled = false;
              startShareBtn.textContent = "开启分享";
              this.showMessage(`分享失败: ${error.message}`, "error");
            }
          },
        },
        {
          text: "取消",
          className: "close-btn",
          onClick: (e, dialog) => {
            dialog.remove();
          },
        },
      ],
    });
  }

  /**
   * 显示分享链接对话框
   * @param {string} shareUrl - 分享链接
   * @param {string} shareId - 分享 ID
   * @param {string} canvasName - 画布名称
   */
  showShareLinkDialog(shareUrl, shareId, canvasName) {
    // 创建对话框内容
    const content = `
      <p class="share-status">分享状态: <span class="share-status-active">已开启</span></p>
      <p>使用以下链接分享您的画布：</p>
      <div class="share-url-container">
        <input type="text" class="share-url" value="${shareUrl}" readonly />
        <button class="copy-btn">复制</button>
      </div>
      <p class="share-info">分享 ID: <span class="share-id">${shareId}</span></p>
      <p class="share-info">画布名称: <span class="canvas-name-display">${canvasName}</span></p>

      <div class="share-options">
        <div class="share-option-buttons">
          <button class="refresh-share-btn">刷新分享内容</button>
          <button class="close-share-btn">关闭分享</button>
        </div>
        <p class="share-info-text">刷新分享内容可以将当前画布的最新状态同步到分享页面</p>
        <p class="close-share-info">关闭后分享链接将无法访问</p>
      </div>
    `;

    // 创建对话框
    const dialog = this.createDialog({
      title: "画布分享已开启",
      content: content,
      buttons: [
        {
          text: "在新标签页打开",
          className: "open-btn",
          onClick: () => {
            window.open(shareUrl, "_blank");
          },
        },
        {
          text: "关闭窗口",
          className: "close-btn",
          onClick: (e, dialog) => {
            dialog.remove();
          },
        },
      ],
    });

    // 添加复制按钮事件
    const copyBtn = dialog.querySelector(".copy-btn");
    const urlInput = dialog.querySelector(".share-url");

    copyBtn.addEventListener("click", () => {
      urlInput.select();
      // 使用现代剪贴板 API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(urlInput.value)
          .then(() => {
            copyBtn.textContent = "已复制";
            setTimeout(() => {
              copyBtn.textContent = "复制";
            }, 2000);
          })
          .catch((err) => {
            console.error("复制失败:", err);
            // 如果现代API失败，回退到旧方法
            urlInput.select();
            document.execCommand("copy");
            copyBtn.textContent = "已复制";
            setTimeout(() => {
              copyBtn.textContent = "复制";
            }, 2000);
          });
      } else {
        // 旧方法兼容
        document.execCommand("copy");
        copyBtn.textContent = "已复制";
        setTimeout(() => {
          copyBtn.textContent = "复制";
        }, 2000);
      }
    });

    // 刷新分享内容按钮事件
    const refreshShareBtn = dialog.querySelector(".refresh-share-btn");
    refreshShareBtn.addEventListener("click", async () => {
      try {
        refreshShareBtn.disabled = true;
        refreshShareBtn.textContent = "正在刷新...";

        // 发送请求刷新分享
        const response = await fetch(`/api/share/refresh/${shareId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            canvasState: {
              scale: this.scale,
              offsetX: this.offset.x,
              offsetY: this.offset.y,
            },
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "刷新分享失败");
        }

        // 刷新成功
        this.showMessage("分享内容已更新", "success");
        refreshShareBtn.textContent = "刷新分享内容";
        refreshShareBtn.disabled = false;
      } catch (error) {
        console.error("刷新分享出错:", error);
        refreshShareBtn.textContent = "刷新失败";
        setTimeout(() => {
          refreshShareBtn.disabled = false;
          refreshShareBtn.textContent = "刷新分享内容";
        }, 2000);
        this.showMessage(`刷新分享失败: ${error.message}`, "error");
      }
    });

    // 关闭分享按钮事件
    const closeShareBtn = dialog.querySelector(".close-share-btn");
    closeShareBtn.addEventListener("click", async () => {
      if (!confirm("确定要关闭此分享吗？\n关闭后分享链接将无法访问。")) {
        return;
      }

      try {
        // 发送关闭分享请求
        closeShareBtn.disabled = true;
        closeShareBtn.textContent = "正在关闭...";

        const response = await fetch(`/api/share/close/${shareId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "关闭分享失败");
        }

        // 关闭成功
        this.showMessage("分享已关闭", "success");

        // 清除活跃分享信息
        this.activeShare = null;

        dialog.remove();
      } catch (error) {
        console.error("关闭分享出错:", error);
        closeShareBtn.textContent = "关闭失败";
        setTimeout(() => {
          closeShareBtn.disabled = false;
          closeShareBtn.textContent = "关闭分享";
        }, 2000);
        this.showMessage(`关闭分享失败: ${error.message}`, "error");
      }
    });
  }

  /**
   * 显示消息提示
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型（info, success, warning, error）
   */
  showMessage(message, type = "info") {
    // 移除现有的消息
    const existingMessages = document.querySelectorAll(".canvas-message");
    existingMessages.forEach((msg) => {
      msg.remove();
    });

    // 创建消息元素
    const messageEl = document.createElement("div");
    messageEl.className = `canvas-message ${type}`;
    messageEl.textContent = message;

    // 添加到文档
    document.body.appendChild(messageEl);

    // 添加动画效果
    setTimeout(() => {
      messageEl.classList.add("show");
    }, 10);

    // 自动移除
    setTimeout(() => {
      messageEl.classList.remove("show");
      setTimeout(() => {
        messageEl.remove();
      }, 300);
    }, 3000);
  }

  /**
   * 保存画布状态到本地存储
   */
  saveCanvasState() {
    const canvasState = {
      scale: this.scale,
      offsetX: this.offset.x,
      offsetY: this.offset.y,
      timestamp: Date.now(),
    };
    localStorage.setItem("canvas_state", JSON.stringify(canvasState));
  }

  /**
   * 节流函数 - 限制保存画布状态的频率
   */
  throttledSaveCanvasState() {
    if (!this.saveTimeout) {
      this.saveTimeout = setTimeout(() => {
        this.saveCanvasState();
        this.saveTimeout = null;
      }, 500); // 500毫秒节流
    }
  }

  /**
   * 从本地存储恢复画布状态
   */
  restoreCanvasState() {
    try {
      const savedState = localStorage.getItem("canvas_state");
      if (savedState) {
        const state = JSON.parse(savedState);

        // 确保值在有效范围内
        if (state.scale >= this.minScale && state.scale <= this.maxScale) {
          this.scale = state.scale;
        }

        // 恢复偏移量
        if (
          typeof state.offsetX === "number" &&
          typeof state.offsetY === "number"
        ) {
          this.offset.x = state.offsetX;
          this.offset.y = state.offsetY;
        }

        // 应用恢复的状态
        this.applyTransform();

        console.log("已恢复画布状态:", state);
      }
    } catch (error) {
      console.error("恢复画布状态失败:", error);
    }
  }

  /**
   * 检查用户分享状态
   * 从服务器获取当前用户的分享状态
   */
  async checkShareStatus() {
    try {
      // 发送请求获取用户分享状态
      console.log("初始化时检查分享状态...");
      const response = await fetch("/api/share/status", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin", // 确保发送认证信息
      });

      console.log("分享状态响应:", response.status, response.statusText);

      // 如果请求失败，可能是未登录或其他原因，直接返回
      if (!response.ok) {
        if (response.status !== 401) {
          // 401是未登录，这是正常的
          console.warn(
            `检查分享状态失败: ${response.status} ${response.statusText}`
          );
        }
        return;
      }

      const data = await response.json();

      // 如果有活跃的分享，更新分享状态
      if (data.success && data.shareStatus) {
        this.activeShare = {
          id: data.shareId,
          url: data.shareLink,
          canvasName: data.canvasName,
          createdAt: new Date().toISOString(),
        };
        console.log("已恢复分享状态:", this.activeShare);
      }
    } catch (error) {
      console.error("检查分享状态失败:", error);
    }
  }
}

export default Canvas;
