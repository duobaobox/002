class App {
  constructor() {
    this.notes = [];
    this.canvas = new Canvas();
    this.nextId = 1;

    this.initEventListeners();
  }

  initEventListeners() {
    // AI生成便签按钮
    document.getElementById("ai-generate").addEventListener("click", () => {
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
    const generateButton = document.getElementById("ai-generate");
    const originalText = generateButton.textContent;

    if (!prompt.trim()) {
      alert("请输入内容!");
      return;
    }

    try {
      // 禁用按钮并显示加载状态
      generateButton.disabled = true;
      generateButton.textContent = "生成中...";

      console.log("发送AI生成请求，提示:", prompt);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("服务器响应错误:", data);
        throw new Error(data.message || `服务器响应错误: ${response.status}`);
      }

      if (data.success && data.text) {
        // 随机位置
        const x = 100 + Math.random() * 200;
        const y = 100 + Math.random() * 200;
        this.addNote(data.text, x, y);
        console.log("便签已添加");
      } else {
        throw new Error("服务器返回了无效的数据");
      }
    } catch (error) {
      console.error("生成AI便签出错:", error);
      alert(`生成便签失败: ${error.message}`);
    } finally {
      // 恢复按钮状态
      generateButton.disabled = false;
      generateButton.textContent = originalText;
    }
  }
}

// 当文档加载完成后初始化应用
document.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});
