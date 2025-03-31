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

    // 添加背景元素容器
    this.createBackgroundElements();

    // 初始化缩放控制器
    this.createZoomControls();

    this.setupEvents();
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

  createBackgroundElements() {
    // 创建背景容器
    this.bgContainer = document.createElement("div");
    this.bgContainer.className = "canvas-background";
    this.canvas.appendChild(this.bgContainer);

    // 创建随机点阵背景
    this.createDotPattern();

    // 创建渐变气泡
    this.createGradientBubbles();
  }

  createDotPattern() {
    // 创建点阵图案 - 每隔80px放置一个点
    const dotCount = 120; // 点的总数

    for (let i = 0; i < dotCount; i++) {
      const dot = document.createElement("div");
      dot.className = "bg-dots";

      // 随机位置
      const x =
        Math.floor(Math.random() * window.innerWidth * 2) -
        window.innerWidth / 2;
      const y =
        Math.floor(Math.random() * window.innerHeight * 2) -
        window.innerHeight / 2;

      // 随机大小 (3-8px)
      const size = 3 + Math.random() * 5;

      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.opacity = 0.1 + Math.random() * 0.3;

      this.bgContainer.appendChild(dot);
    }
  }

  createGradientBubbles() {
    // 创建几个大型渐变气泡
    const bubbleCount = 5;
    const colors = [
      "rgba(26, 115, 232, 0.4)", // 蓝色
      "rgba(52, 168, 83, 0.4)", // 绿色
      "rgba(251, 188, 5, 0.4)", // 黄色
      "rgba(234, 67, 53, 0.4)", // 红色
      "rgba(103, 58, 183, 0.4)", // 紫色
    ];

    for (let i = 0; i < bubbleCount; i++) {
      const bubble = document.createElement("div");
      bubble.className = "bg-gradient-bubble";

      // 随机位置 - 覆盖更大范围
      const x =
        Math.floor(Math.random() * window.innerWidth * 3) - window.innerWidth;
      const y =
        Math.floor(Math.random() * window.innerHeight * 3) - window.innerHeight;

      // 随机大小 (200-500px)
      const size = 200 + Math.random() * 300;

      bubble.style.left = `${x}px`;
      bubble.style.top = `${y}px`;
      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.backgroundColor = colors[i % colors.length];

      this.bgContainer.appendChild(bubble);
    }
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

  setupEvents() {
    // 鼠标按下事件 - 开始平移画布
    this.canvas.addEventListener("mousedown", (e) => {
      // 只有当点击画布空白处时才触发平移
      if (e.target === this.canvas) {
        this.isPanning = true;
        this.startPoint = { x: e.clientX, y: e.clientY };
        this.canvas.style.cursor = "grabbing";
      }
    });

    // 鼠标移动事件 - 平移画布
    document.addEventListener("mousemove", (e) => {
      if (!this.isPanning) return;

      this.currentPoint = { x: e.clientX, y: e.clientY };

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

      // 同时移动背景元素，创造视差效果
      this.moveBackgroundElements(deltaX, deltaY);

      // 更新起始点为当前点
      this.startPoint = { x: this.currentPoint.x, y: this.currentPoint.y };
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

    // 阻止右键菜单
    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
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

  // 添加背景元素移动方法 - 创造视差效果
  moveBackgroundElements(deltaX, deltaY) {
    // 移动点阵图案，使用较慢的移动速度产生视差
    const dots = document.querySelectorAll(".bg-dots");
    dots.forEach((dot) => {
      const left = parseInt(dot.style.left || 0) + deltaX * 0.3;
      const top = parseInt(dot.style.top || 0) + deltaY * 0.3;

      dot.style.left = `${left}px`;
      dot.style.top = `${top}px`;
    });

    // 移动渐变气泡，速度更慢
    const bubbles = document.querySelectorAll(".bg-gradient-bubble");
    bubbles.forEach((bubble) => {
      const left = parseInt(bubble.style.left || 0) + deltaX * 0.1;
      const top = parseInt(bubble.style.top || 0) + deltaY * 0.1;

      bubble.style.left = `${left}px`;
      bubble.style.top = `${top}px`;
    });
  }
}
