class Canvas {
  constructor() {
    this.canvas = document.getElementById("note-canvas");
    this.isPanning = false;
    this.startPoint = { x: 0, y: 0 };
    this.currentPoint = { x: 0, y: 0 };
    this.offset = { x: 0, y: 0 };

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
    this.setupOptimizedEvents();
  }

  // 创建便签容器
  createNoteContainer() {
    // 创建一个新的便签容器，作为画布的子元素
    this.noteContainer = document.createElement("div");
    this.noteContainer.id = "note-container";
    this.noteContainer.className = "note-container";
    this.canvas.appendChild(this.noteContainer);

    // 应用初始样式
    this.noteContainer.style.position = "absolute";
    this.noteContainer.style.width = "100%";
    this.noteContainer.style.height = "100%";
    this.noteContainer.style.top = "0";
    this.noteContainer.style.left = "0";
    this.noteContainer.style.transformOrigin = "center center";
  }

  // 创建简单网格背景
  createGridBackground() {
    // 创建网格容器
    const gridContainer = document.createElement("div");
    gridContainer.className = "grid-background";

    // 添加实际网格元素
    const grid = document.createElement("div");
    grid.className = "grid";
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

    // 创建缩小按钮
    const zoomOutBtn = document.createElement("button");
    zoomOutBtn.className = "zoom-btn zoom-out";
    zoomOutBtn.innerHTML = "−";
    zoomOutBtn.title = "缩小画布";
    zoomOutBtn.addEventListener("click", () => this.zoomOut());

    // 创建缩放显示
    const zoomDisplay = document.createElement("div");
    zoomDisplay.className = "zoom-display";
    zoomDisplay.id = "zoom-level";
    zoomDisplay.textContent = "100%";

    // 创建放大按钮
    const zoomInBtn = document.createElement("button");
    zoomInBtn.className = "zoom-btn zoom-in";
    zoomInBtn.innerHTML = "+";
    zoomInBtn.title = "放大画布";
    zoomInBtn.addEventListener("click", () => this.zoomIn());

    // 创建重置按钮
    const zoomResetBtn = document.createElement("button");
    zoomResetBtn.className = "zoom-btn zoom-reset";
    zoomResetBtn.innerHTML = "↻";
    zoomResetBtn.title = "重置缩放";
    zoomResetBtn.addEventListener("click", () => this.resetZoom());

    // 组装控制器
    zoomControls.appendChild(zoomOutBtn);
    zoomControls.appendChild(zoomDisplay);
    zoomControls.appendChild(zoomInBtn);
    zoomControls.appendChild(zoomResetBtn);

    // 添加到DOM
    document.querySelector(".canvas-container").appendChild(zoomControls);
  }

  // 缩小画布
  zoomOut() {
    if (this.scale > this.minScale) {
      this.scale = Math.max(this.scale - 0.1, this.minScale);
      this.applyZoom();
    }
  }

  // 放大画布
  zoomIn() {
    if (this.scale < this.maxScale) {
      this.scale = Math.min(this.scale + 0.1, this.maxScale);
      this.applyZoom();
    }
  }

  // 重置缩放
  resetZoom() {
    this.scale = 1.0;
    this.applyZoom();
  }

  // 应用缩放
  applyZoom() {
    // 更新显示
    document.getElementById("zoom-level").textContent = `${Math.round(
      this.scale * 100
    )}%`;

    // 只缩放便签容器，不缩放背景网格
    this.noteContainer.style.transform = `scale(${this.scale})`;

    // 更新所有便签的z-index以防止缩放时层级问题
    const notes = document.querySelectorAll(".note");
    notes.forEach((note) => {
      note.style.zIndex = parseInt(note.style.zIndex || 1);
    });
  }

  // 性能优化的事件处理
  setupOptimizedEvents() {
    let animationFrameId = null;
    let lastMoveTime = 0;

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

    // 鼠标移动事件 - 平移画布 (使用requestAnimationFrame优化)
    document.addEventListener("mousemove", (e) => {
      if (!this.isPanning) return;

      // 使用requestAnimationFrame和时间限制来优化性能
      const now = Date.now();
      if (now - lastMoveTime < 16) {
        // 限制大约60fps
        if (!animationFrameId) {
          animationFrameId = requestAnimationFrame(() => {
            this.moveCanvas(e.clientX, e.clientY);
            animationFrameId = null;
            lastMoveTime = Date.now();
          });
        }
        return;
      }

      lastMoveTime = now;
      this.moveCanvas(e.clientX, e.clientY);
    });

    // 鼠标松开事件 - 停止平移
    document.addEventListener("mouseup", () => {
      this.isPanning = false;
      this.canvas.style.cursor = "default";

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    });

    // 鼠标离开事件 - 停止平移
    document.addEventListener("mouseleave", () => {
      this.isPanning = false;
      this.canvas.style.cursor = "default";

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    });

    // 添加鼠标滚轮缩放事件
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        // 只在按住Ctrl键时进行缩放
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault(); // 防止页面滚动

          if (e.deltaY < 0) {
            // 向上滚动，放大
            this.zoomIn();
          } else {
            // 向下滚动，缩小
            this.zoomOut();
          }
        }
      },
      { passive: false }
    );
  }

  // 移动画布的方法 (移动便签和网格)
  moveCanvas(clientX, clientY) {
    this.currentPoint = { x: clientX, y: clientY };

    // 计算鼠标移动距离
    const deltaX = this.currentPoint.x - this.startPoint.x;
    const deltaY = this.currentPoint.y - this.startPoint.y;

    // 更新所有便签的位置
    const notes = document.querySelectorAll(".note");
    notes.forEach((note) => {
      const left = parseInt(note.style.left || 0) + deltaX;
      const top = parseInt(note.style.top || 0) + deltaY;

      note.style.left = `${left}px`;
      note.style.top = `${top}px`;
    });

    // 只移动网格背景 (使用transform以获得更好性能)
    if (this.gridElement) {
      // 跟踪网格偏移量
      this.offset.x = (this.offset.x || 0) + deltaX;
      this.offset.y = (this.offset.y || 0) + deltaY;

      // 只移动网格模式，保持网格在可见区域内循环
      const gridSize = 30; // 标准网格大小
      const offsetX = this.offset.x % gridSize;
      const offsetY = this.offset.y % gridSize;

      this.gridElement.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }

    // 更新起始点为当前点
    this.startPoint = { x: this.currentPoint.x, y: this.currentPoint.y };
  }
}
