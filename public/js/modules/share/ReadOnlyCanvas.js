/**
 * ReadOnlyCanvas 类
 * 继承自Canvas类，为分享页面提供只读版本的画布功能
 * 复用主画布的代码，但禁用编辑、删除等功能
 */

import Canvas from "../canvas/Canvas.js";

export class ReadOnlyCanvas extends Canvas {
  constructor() {
    super(); // 调用父类构造函数

    // 移除不需要的功能按钮
    this.removeUnnecessaryControls();

    // 标记为只读模式
    this.isReadOnly = true;

    // 禁用便签调整大小功能
    this.disableNoteResizing();

    console.log("ReadOnlyCanvas 初始化完成");
  }

  /**
   * 移除不需要的控制按钮
   * 只保留缩放相关的按钮
   */
  removeUnnecessaryControls() {
    // 获取缩放控制器
    const zoomControls = document.querySelector(".zoom-controls");
    if (!zoomControls) return;

    // 移除设置按钮
    const settingsBtn = zoomControls.querySelector(".settings-btn");
    if (settingsBtn) settingsBtn.remove();

    // 移除阅读模式按钮
    const readModeBtn = zoomControls.querySelector(".read-mode-btn");
    if (readModeBtn) readModeBtn.remove();

    // 移除分享按钮
    const shareBtn = zoomControls.querySelector(".share-btn");
    if (shareBtn) shareBtn.remove();
  }

  /**
   * 重写父类方法，禁用分享功能
   */
  shareCanvas() {
    console.log("分享页面不支持分享功能");
    return;
  }

  /**
   * 重写父类方法，禁用阅读模式
   */
  openReadingMode() {
    console.log("分享页面不支持阅读模式");
    return;
  }

  /**
   * 应用初始画布状态
   * @param {Object} canvasState - 画布状态对象
   */
  applyInitialState(canvasState) {
    if (!canvasState) return;

    // 应用缩放
    if (canvasState.scale !== undefined) {
      this.scale = Math.min(
        Math.max(canvasState.scale, this.minScale),
        this.maxScale
      );
    }

    // 应用偏移
    if (
      canvasState.offsetX !== undefined &&
      canvasState.offsetY !== undefined
    ) {
      this.offset.x = canvasState.offsetX;
      this.offset.y = canvasState.offsetY;
    }

    // 应用变换
    this.applyTransform();

    console.log("应用初始画布状态:", canvasState);
  }

  /**
   * 重写父类方法，禁用保存画布状态到本地存储
   */
  saveCanvasState() {
    // 分享页面不需要保存画布状态
    return;
  }

  /**
   * 重写父类方法，禁用从本地存储恢复画布状态
   */
  restoreCanvasState() {
    // 分享页面不需要从本地存储恢复画布状态
    return;
  }

  /**
   * 重写父类方法，禁用检查用户分享状态
   */
  checkShareStatus() {
    // 分享页面不需要检查用户分享状态
    return;
  }

  /**
   * 禁用便签调整大小功能
   * 通过CSS和JS方式同时禁用
   */
  disableNoteResizing() {
    // 监听便签创建事件，确保新创建的便签也被禁用调整大小
    document.addEventListener("DOMNodeInserted", (event) => {
      if (event.target.classList && event.target.classList.contains("note")) {
        // 禁用resize属性
        event.target.style.resize = "none";

        // 添加read-only类
        event.target.classList.add("read-only");

        // 移除调整大小控件（如果存在）
        const resizeHandle = event.target.querySelector(".note-resize-handle");
        if (resizeHandle) {
          resizeHandle.remove();
        }
      }
    });

    // 立即处理现有便签
    const notes = document.querySelectorAll(".note");
    notes.forEach((note) => {
      // 禁用resize属性
      note.style.resize = "none";

      // 添加read-only类
      note.classList.add("read-only");

      // 移除调整大小控件（如果存在）
      const resizeHandle = note.querySelector(".note-resize-handle");
      if (resizeHandle) {
        resizeHandle.remove();
      }
    });
  }
}

export default ReadOnlyCanvas;
