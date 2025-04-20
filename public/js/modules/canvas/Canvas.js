/**
 * Canvas 类模块
 * 负责管理画布和便签容器的缩放、平移等操作
 */

export class Canvas {
  constructor() {
    this.canvas = document.getElementById("note-canvas");
    this.isPanning = false;
    this.startPoint = { x: 0, y: 0 };
    this.currentPoint = { x: 0, y: 0 };
    this.offset = { x: 0, y: 0 }; // 平移偏移量

    // 添加画布缩放相关属性
    this.scale = 1.0; // 默认缩放比例为100%
    this.minScale = 0.3; // 最小缩放比例30%
    this.maxScale = 2.0; // 最大缩放比例200%

    // 创建便签容器元素
    this.createNoteContainer();

    // 添加简单的网格背景
    this.createGridBackground();

    // 初始化缩放控制器
    this.createZoomControls();

    // 初始化性能优化的事件处理
    this.setupEvents();

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

  // 创建简单网格背景
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
  }

  // 创建缩放控制器
  createZoomControls() {
    // 创建缩放控制器容器
    const zoomControls = document.createElement("div");
    zoomControls.className = "zoom-controls";

    // 创建设置按钮 - 放在最上面
    const settingsBtn = document.createElement("button");
    settingsBtn.className = "zoom-btn settings-btn";
    settingsBtn.innerHTML = "⚙"; // 齿轮图标
    settingsBtn.title = "设置";
    settingsBtn.addEventListener("click", () => {
      // 获取设置弹窗并显示
      const settingsModal = document.getElementById("settings-modal");
      if (settingsModal) {
        settingsModal.classList.add("visible");
      }
    });

    // 创建放大按钮 - 放在最上面
    const zoomInBtn = document.createElement("button");
    zoomInBtn.className = "zoom-btn zoom-in";
    zoomInBtn.innerHTML = "+";
    zoomInBtn.title = "放大画布";
    zoomInBtn.addEventListener("click", () => this.zoomIn());

    // 创建缩放显示 - 在中间
    const zoomDisplay = document.createElement("div");
    zoomDisplay.className = "zoom-display";
    zoomDisplay.id = "zoom-level";
    zoomDisplay.textContent = "100%";

    // 创建缩小按钮 - 放在下面
    const zoomOutBtn = document.createElement("button");
    zoomOutBtn.className = "zoom-btn zoom-out";
    zoomOutBtn.innerHTML = "−";
    zoomOutBtn.title = "缩小画布";
    zoomOutBtn.addEventListener("click", () => this.zoomOut());

    // 创建重置按钮 - 放在最下面
    const zoomResetBtn = document.createElement("button");
    zoomResetBtn.className = "zoom-btn zoom-reset";
    zoomResetBtn.innerHTML = "↻";
    zoomResetBtn.title = "重置缩放";
    zoomResetBtn.addEventListener("click", () => this.resetZoom());

    // 组装控制器 - 调整顺序为从上到下
    zoomControls.appendChild(settingsBtn);
    zoomControls.appendChild(zoomInBtn);
    zoomControls.appendChild(zoomDisplay);
    zoomControls.appendChild(zoomOutBtn);
    zoomControls.appendChild(zoomResetBtn);

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
    // 鼠标按下事件 - 开始平移画布
    this.canvas.addEventListener("mousedown", (e) => {
      // 只有当点击画布空白处或网格背景时才触发平移
      if (
        e.target === this.canvas ||
        e.target.classList.contains("grid") ||
        e.target.classList.contains("grid-background")
      ) {
        this.isPanning = true;
        this.startPoint = { x: e.clientX, y: e.clientY };
        this.canvas.style.cursor = "grabbing";
      }
    });

    // 鼠标移动事件 - 平移画布 (直接响应，不使用requestAnimationFrame或时间限制)
    document.addEventListener("mousemove", (e) => {
      if (!this.isPanning) return;

      // 直接移动画布，不进行任何限流或延迟
      this.moveCanvas(e.clientX, e.clientY);
    });

    // 鼠标松开事件 - 停止平移
    document.addEventListener("mouseup", () => {
      this.isPanning = false;
      this.canvas.style.cursor = "default";
    });

    // 鼠标离开事件 - 停止平移
    document.addEventListener("mouseleave", () => {
      this.isPanning = false;
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

  // 移动画布的方法 - 优化直接性能
  moveCanvas(clientX, clientY) {
    this.currentPoint = { x: clientX, y: clientY };

    // 计算鼠标移动距离
    const deltaX = this.currentPoint.x - this.startPoint.x;
    const deltaY = this.currentPoint.y - this.startPoint.y;

    // 更新偏移量
    this.offset.x += deltaX;
    this.offset.y += deltaY;

    // 直接应用变换，不使用requestAnimationFrame
    // 应用变换：先平移后缩放
    this.noteContainer.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;

    // 更新网格背景 - 使用与便签容器相同的变换，但只保留平移部分
    if (this.gridElement) {
      // 直接使用偏移量，但对网格图案应用循环效果
      const gridSize = 30; // 标准网格大小
      const offsetX = this.offset.x % gridSize;
      const offsetY = this.offset.y % gridSize;

      // 为网格应用平移变换
      this.gridElement.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }

    // 更新起始点为当前点
    this.startPoint = { x: this.currentPoint.x, y: this.currentPoint.y };

    // 触发变换更新事件，但不调用完整的applyTransform以提高性能
    const event = new CustomEvent("canvas-transform-updated", {
      detail: {
        scale: this.scale,
        offsetX: this.offset.x,
        offsetY: this.offset.y,
      },
    });
    document.dispatchEvent(event);
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
}

export default Canvas;
