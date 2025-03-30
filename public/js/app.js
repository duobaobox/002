class App {
  constructor() {
    this.notes = [];
    this.canvas = new Canvas();
    this.nextId = 1;

    this.initEventListeners();
    this.updateButtonVisibility();
  }

  initEventListeners() {
    // 添加普通便签按钮
    document.getElementById("add-note").addEventListener("click", () => {
      this.addEmptyNote();
    });

    // AI生成便签按钮
    document.getElementById("ai-generate").addEventListener("click", () => {
      this.generateAiNote();
    });

    // 监听便签删除事件
    document.addEventListener("note-removed", (e) => {
      this.removeNote(e.detail.id);
    });

    // 监听输入框内容变化
    const promptElement = document.getElementById("ai-prompt");
    promptElement.addEventListener("input", () => {
      this.updateButtonVisibility();
    });

    // 监听Enter键提交
    promptElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const hasText = promptElement.value.trim().length > 0;
        if (hasText) {
          this.generateAiNote();
        } else {
          this.addEmptyNote();
        }
      }
    });
  }

  // 根据输入内容更新按钮可见性
  updateButtonVisibility() {
    const promptElement = document.getElementById("ai-prompt");
    const hasText = promptElement.value.trim().length > 0;

    const addButton = document.getElementById("add-note");
    const aiButton = document.getElementById("ai-generate");

    if (hasText) {
      addButton.style.display = "none";
      aiButton.style.display = "block";
    } else {
      addButton.style.display = "block";
      aiButton.style.display = "none";
    }
  }

  // 添加空白便签
  addEmptyNote() {
    // 随机位置
    const x = 100 + Math.random() * 200;
    const y = 100 + Math.random() * 200;
    this.addNote("", x, y);
    console.log("空白便签已添加");
  }

  addNote(text = "", x = 50, y = 50, title = "") {
    // 添加默认标题参数
    const note = new Note(this.nextId++, text, x, y, title);
    this.notes.push(note);
    return note;
  }

  removeNote(id) {
    this.notes = this.notes.filter((note) => note.id !== id);
  }

  async generateAiNote() {
    const promptElement = document.getElementById("ai-prompt");
    const prompt = promptElement.value;
    const generateButton = document.getElementById("ai-generate");
    const originalText = generateButton.textContent;

    if (!prompt.trim()) {
      // 使用更友好的提示方式
      promptElement.focus();
      promptElement.placeholder = "请输入内容后再生成便笺...";
      setTimeout(() => {
        promptElement.placeholder = "请输入文本";
      }, 2000);
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

        // 为AI生成的便签创建特殊标题
        const aiTitle =
          prompt.length > 15 ? prompt.substring(0, 15) + "..." : prompt;
        this.addNote(data.text, x, y, `AI: ${aiTitle}`);

        console.log("便签已添加");

        // 清空输入框
        promptElement.value = "";
        this.updateButtonVisibility(); // 更新按钮状态
      } else {
        throw new Error("服务器返回了无效的数据");
      }
    } catch (error) {
      console.error("生成AI便签出错:", error);
      // 显示更友好的错误提示
      const errorMsg = document.createElement("div");
      errorMsg.className = "error-message";
      errorMsg.textContent = `生成失败: ${error.message}`;
      document.body.appendChild(errorMsg);

      setTimeout(() => {
        errorMsg.classList.add("show");
        setTimeout(() => {
          errorMsg.classList.remove("show");
          setTimeout(() => {
            document.body.removeChild(errorMsg);
          }, 300);
        }, 3000);
      }, 10);
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
