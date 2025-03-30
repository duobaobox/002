class Note {
  constructor(id, text = "", x = 50, y = 50) {
    this.id = id;
    this.text = text;
    this.x = x;
    this.y = y;
    this.element = null;
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    this.colors = [
      "#f1c40f", // 黄色
      "#e74c3c", // 红色
      "#2ecc71", // 绿色
      "#3498db", // 蓝色
      "#9b59b6", // 紫色
    ];

    this.create();
  }

  create() {
    // 创建便签元素
    const note = document.createElement("div");
    note.className = "note";
    note.style.left = `${this.x}px`;
    note.style.top = `${this.y}px`;
    note.style.backgroundColor =
      this.colors[Math.floor(Math.random() * this.colors.length)];

    // 创建便签头部
    const header = document.createElement("div");
    header.className = "note-header";

    // 创建关闭按钮
    const closeBtn = document.createElement("span");
    closeBtn.className = "note-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => this.remove());

    // 创建便签内容
    const content = document.createElement("textarea");
    content.className = "note-content";
    content.value = this.text;
    content.addEventListener("input", (e) => {
      this.text = e.target.value;
    });

    // 组装便签
    header.appendChild(closeBtn);
    note.appendChild(header);
    note.appendChild(content);

    // 设置拖动事件
    this.setupDragEvents(note, header);

    this.element = note;
    document.getElementById("note-canvas").appendChild(note);
  }

  setupDragEvents(note, header) {
    header.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.dragOffsetX = e.clientX - note.offsetLeft;
      this.dragOffsetY = e.clientY - note.offsetTop;
      note.style.zIndex = getHighestZIndex() + 1;
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;

      const x = e.clientX - this.dragOffsetX;
      const y = e.clientY - this.dragOffsetY;

      note.style.left = `${x}px`;
      note.style.top = `${y}px`;
    });

    document.addEventListener("mouseup", () => {
      this.isDragging = false;
    });
  }

  remove() {
    this.element.remove();
    // 触发删除事件，让App类可以从数组中移除此便签
    document.dispatchEvent(
      new CustomEvent("note-removed", { detail: { id: this.id } })
    );
  }

  update(text) {
    this.text = text;
    const contentElem = this.element.querySelector(".note-content");
    if (contentElem) {
      contentElem.value = text;
    }
  }
}

// 获取最高的z-index
function getHighestZIndex() {
  let highestZ = 0;
  const notes = document.querySelectorAll(".note");
  notes.forEach((note) => {
    const zIndex = parseInt(window.getComputedStyle(note).zIndex);
    if (zIndex > highestZ) {
      highestZ = zIndex;
    }
  });
  return highestZ;
}
