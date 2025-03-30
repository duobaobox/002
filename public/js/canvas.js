class Canvas {
  constructor() {
    this.canvas = document.getElementById("note-canvas");
    this.isPanning = false;
    this.startPoint = { x: 0, y: 0 };
    this.currentPoint = { x: 0, y: 0 };
    this.offset = { x: 0, y: 0 };

    this.setupEvents();
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
}
