class App {
  constructor() {
    this.notes = [];
    this.canvas = new Canvas();
    this.nextId = 1;

    this.initEventListeners();
  }

  initEventListeners() {
    // 添加便签按钮
    document.getElementById("add-note").addEventListener("click", () => {
      this.addNote();
    });

    // AI生成便签按钮
    document
      .getElementById("generate-ai-note")
      .addEventListener("click", () => {
        this.generateAiNote();
      });

    // 监听便签删除事件
    document.addEventListener("note-removed", (e) => {
      this.removeNote(e.detail.id);
    });
  }

  addNote(text = "", x = 50, y = 50) {
    const note = new Note(this.nextId++, text, x, y);
    this.notes.push(note);
    return note;
  }

  removeNote(id) {
    this.notes = this.notes.filter((note) => note.id !== id);
  }

  async generateAiNote() {
    const prompt = document.getElementById("ai-prompt").value;

    if (!prompt.trim()) {
      alert("请输入AI提示!");
      return;
    }

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error("服务器响应错误");
      }

      const data = await response.json();

      if (data.text) {
        // 随机位置
        const x = 100 + Math.random() * 200;
        const y = 100 + Math.random() * 200;
        this.addNote(data.text, x, y);
      }
    } catch (error) {
      console.error("生成AI便签出错:", error);
      alert("生成便签失败: " + error.message);
    }
  }
}

// 当文档加载完成后初始化应用
document.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});
