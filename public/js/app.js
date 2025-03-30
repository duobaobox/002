class App {
  constructor() {
    this.notes = [];
    this.canvas = new Canvas();
    this.nextId = 1;

    // 从服务器加载便签数据
    this.loadNotes();

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

    // 监听便签更新事件
    document.addEventListener("note-updated", (e) => {
      this.updateNoteOnServer(e.detail.id);
    });

    // 监听便签移动事件
    document.addEventListener("note-moved", (e) => {
      this.updateNoteOnServer(e.detail.id);
    });

    // 监听便签调整大小事件
    document.addEventListener("note-resized", (e) => {
      this.updateNoteOnServer(e.detail.id);
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
  async addEmptyNote() {
    try {
      // 随机位置
      const x = 100 + Math.random() * 200;
      const y = 100 + Math.random() * 200;

      // 获取随机颜色类 (与Note类中定义保持一致)
      const colorClasses = [
        "note-yellow",
        "note-blue",
        "note-green",
        "note-pink",
        "note-purple",
      ];
      const colorClass =
        colorClasses[Math.floor(Math.random() * colorClasses.length)];

      const response = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ x, y, colorClass }),
      });

      const data = await response.json();

      if (data.success && data.note) {
        const note = new Note(
          data.note.id,
          data.note.text,
          data.note.x,
          data.note.y,
          data.note.title
        );
        this.notes.push(note);
        console.log("空白便签已添加，ID:", data.note.id);
      } else {
        console.error("创建便签失败:", data);
      }
    } catch (error) {
      console.error("添加便签出错:", error);
    }
  }

  addNote(text = "", x = 50, y = 50, title = "") {
    // 添加默认标题参数
    const note = new Note(this.nextId++, text, x, y, title);
    this.notes.push(note);
    return note;
  }

  // 从服务器加载便签
  async loadNotes() {
    try {
      const response = await fetch("/api/notes");
      const data = await response.json();

      if (data.success && Array.isArray(data.notes)) {
        console.log(`正在从服务器加载 ${data.notes.length} 个便签...`);

        // 设置下一个ID
        this.nextId = data.nextId || 1;

        // 创建便签
        data.notes.forEach((noteData) => {
          const note = new Note(
            noteData.id,
            noteData.text || "",
            noteData.x || 50,
            noteData.y || 50,
            noteData.title || `便签 ${noteData.id}`,
            noteData.colorClass // 传递保存的颜色类
          );

          // 设置自定义尺寸
          if (noteData.width && noteData.height && note.element) {
            note.element.style.width = `${noteData.width}px`;
            note.element.style.height = `${noteData.height}px`;

            // 更新滚动条
            const textarea = note.element.querySelector(".note-content");
            const scrollbarThumb =
              note.element.querySelector(".scrollbar-thumb");
            if (textarea && scrollbarThumb) {
              note.updateScrollbar(textarea, scrollbarThumb);
            }
          }

          this.notes.push(note);
        });

        console.log(`成功加载了 ${this.notes.length} 个便签`);
      } else {
        console.error("无法加载便签:", data);
      }
    } catch (error) {
      console.error("加载便签时出错:", error);
    }
  }

  // 在服务器上更新便签
  async updateNoteOnServer(id) {
    try {
      const note = this.notes.find((n) => n.id === id);
      if (!note || !note.element) return;

      const noteData = {
        text: note.text,
        x: parseInt(note.element.style.left),
        y: parseInt(note.element.style.top),
        title: note.title,
        width: note.element.offsetWidth,
        height: note.element.offsetHeight,
        colorClass: note.colorClass, // 添加颜色类
      };

      const response = await fetch(`/api/notes/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(noteData),
      });

      const data = await response.json();

      if (!data.success) {
        console.error("更新便签失败:", data);
      }
    } catch (error) {
      console.error("更新便签时出错:", error);
    }
  }

  // 从服务器删除便签
  async removeNote(id) {
    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        this.notes = this.notes.filter((note) => note.id !== id);
        console.log(`便签 ${id} 已删除`);
      } else {
        console.error("删除便签失败:", data);
      }
    } catch (error) {
      console.error("删除便签时出错:", error);
    }
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

        // 随机选择颜色
        const colorClasses = [
          "note-yellow",
          "note-blue",
          "note-green",
          "note-pink",
          "note-purple",
        ];
        const colorClass =
          colorClasses[Math.floor(Math.random() * colorClasses.length)];

        // 创建便签到服务器
        const noteResponse = await fetch("/api/notes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: data.text,
            x,
            y,
            title: `AI: ${aiTitle}`,
            colorClass: colorClass, // 添加颜色类
          }),
        });

        const noteData = await noteResponse.json();

        if (noteData.success && noteData.note) {
          const note = new Note(
            noteData.note.id,
            noteData.note.text,
            noteData.note.x,
            noteData.note.y,
            noteData.note.title
          );
          this.notes.push(note);
          console.log("AI便签已添加，ID:", noteData.note.id);
        } else {
          console.error("创建AI便签失败:", noteData);
          throw new Error("无法创建AI便签");
        }

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
