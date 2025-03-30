class Canvas {
  constructor() {
    this.canvas = document.getElementById("note-canvas");
    this.isPanning = false;
    this.startPoint = { x: 0, y: 0 };
    this.currentPoint = { x: 0, y: 0 };
    this.offset = { x: 0, y: 0 };

    // 添加背景元素容器
    this.createBackgroundElements();

    this.setupEvents();
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
