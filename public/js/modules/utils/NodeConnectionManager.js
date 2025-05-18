/**
 * 节点连接管理器模块
 * 负责管理便签节点的连接关系和交互
 */

import { dispatchCustomEvent } from "./DOMUtils.js";

// 导入Leader-Line库（支持ESM和CommonJS混合环境）
let LeaderLine;
try {
  // 尝试作为ESM模块导入
  LeaderLine = (await import("leader-line")).default;
} catch (e) {
  // 如果失败，尝试全局变量方式获取
  LeaderLine = window.LeaderLine;
  if (!LeaderLine) {
    console.error("无法加载Leader-Line库，请确保已正确安装并加载");
  }
}

/**
 * 节点连接管理器类
 * 管理便签之间的连接关系和交互
 */
export class NodeConnectionManager {
  /**
   * 创建节点连接管理器
   */
  constructor() {
    // 连接的便签列表
    this.connectedNotes = [];

    // 当前选中的便签
    this.selectedNote = null;

    // 连接线元素（使用Leader-Line实例）
    this.connectionLines = new Map();

    // 插槽容器
    this.slotsContainer = document.getElementById("slots-container");

    // 连接线SVG容器（为兼容原始代码）
    this.svgContainer = document.getElementById("connections-svg");

    // 连接线选项配置
    this.lineOptions = {
      color: "var(--note-connection-color, rgba(110, 150, 190, 0.55))", // 更淡雅的蓝色，降低不透明度
      size: "var(--note-connection-size, 1.5)", // 更细的线条
      path: "fluid", // 流体路径，自动调整为最佳路径
      startSocket: "bottom",
      endSocket: "top",
      startSocketGravity: 25,
      endSocketGravity: 25,
      startPlug: "behind", // 起点没有箭头
      endPlug: "behind", // 终点没有箭头
      dash: { animation: true, len: 7, gap: 4 }, // 更精致的虚线参数
    };

    // 初始化
    this.init();
  }

  /**
   * 初始化连接管理器
   */
  init() {
    // 确保插槽容器存在
    if (!this.slotsContainer) {
      console.error("插槽容器不存在，无法初始化节点连接管理器");
      return;
    }

    // 确保SVG容器存在
    if (!this.svgContainer) {
      console.warn("SVG容器不存在，部分功能可能无法正常工作");
    }

    // 获取插槽列表容器和清除按钮
    this.slotsList = document.getElementById("slots-list");
    this.clearAllButton = document.getElementById("clear-all-connections");

    // 绑定清除所有连接按钮事件
    if (this.clearAllButton) {
      this.clearAllButton.addEventListener("click", () => {
        this.clearAllConnections();
      });
    }

    // 监听窗口大小变化
    window.addEventListener("resize", () => {
      this.refreshAllConnections();
    });

    // 监听画布变换事件 - 增强处理
    document.addEventListener("canvas-transform-updated", (e) => {
      // 强制立即更新所有连接线
      this.forceUpdateAllConnections();

      // 额外监听变换结束事件
      if (e.detail && e.detail.transformed) {
        // 如果是缩放变换，可能需要多次更新以确保正确
        this.scheduleMultipleUpdates(3);
      }
    });

    // 添加动态观察器以处理DOM变化
    try {
      this.setupMutationObserver();
    } catch (error) {
      console.warn("无法设置 MutationObserver:", error);
    }

    // 监听便签移动事件
    document.addEventListener("note-moving", (e) => {
      // 如果指定了特定便签，仅更新该便签的连接线
      if (e.detail && e.detail.note) {
        this.refreshConnection(e.detail.note);
      } else {
        // 否则更新所有连接线
        this.refreshAllConnections();
      }
    });

    // 监听便签移动完成事件
    document.addEventListener("note-moved", () => {
      // 强制立即更新
      this.forceUpdateAllConnections();
    });

    // 监听便签调整大小事件
    document.addEventListener("note-resizing", (e) => {
      if (e.detail && e.detail.note) {
        this.refreshConnection(e.detail.note);
      }
    });

    // 监听便签调整大小完成事件
    document.addEventListener("note-resized", () => {
      this.forceUpdateAllConnections();
    });

    // 监听便签选择事件
    document.addEventListener("note-selected", (e) => {
      this.selectedNote = e.detail.note;
    });

    document.addEventListener("note-deselected", () => {
      this.selectedNote = null;
    });

    // 监听便签删除事件，确保清理连接线
    document.addEventListener("note-removed", (e) => {
      if (e.detail && e.detail.id) {
        // 查找相应的便签对象
        const noteToRemove = this.connectedNotes.find(
          (note) => note.id === e.detail.id
        );
        if (noteToRemove) {
          console.log(`便签 ${e.detail.id} 被删除，清理相关连接线`);
          // 断开连接，移除连接线和插槽
          this.disconnectNote(noteToRemove);
        }
      }
    });

    // 添加页面可见性变化事件处理
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        // 页面变为可见时刷新所有连接线
        console.log("页面变为可见，刷新所有连接线");
        this.forceUpdateAllConnections();

        // 可见性变化时不再触发连接事件，只更新连接线位置
        // 避免触发不必要的事件导致重复生成便签
      }
    });

    // 将管理器实例暴露给全局作用域，方便App类访问
    window.nodeConnectionManager = this;

    console.log("节点连接管理器初始化完成");
  }

  /**
   * 设置DOM变化观察器
   */
  setupMutationObserver() {
    // 观察插槽容器变化，动态更新连接线
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      // 检查是否有相关变化
      for (const mutation of mutations) {
        if (
          mutation.type === "childList" ||
          mutation.type === "attributes" ||
          mutation.attributeName === "style" ||
          mutation.attributeName === "class"
        ) {
          shouldUpdate = true;
          break;
        }
      }

      if (shouldUpdate) {
        // 使用防抖更新连接线，避免频繁更新
        if (this._updateTimeout) clearTimeout(this._updateTimeout);
        this._updateTimeout = setTimeout(() => {
          this.refreshAllConnections();
          this._updateTimeout = null;
        }, 10);
      }
    });

    // 开始观察插槽容器
    observer.observe(this.slotsContainer, {
      childList: true, // 监听子节点变化
      attributes: true, // 监听属性变化
      subtree: true, // 监听所有后代变化
      attributeFilter: ["style", "class", "data-note-id"], // 只关心这些属性变化
    });

    // 保存观察器引用以便将来清理
    this.mutationObserver = observer;
  }

  /**
   * 强制立即更新所有连接线
   * 在DOM变化后立即更新，不依赖于检查目标元素
   */
  forceUpdateAllConnections() {
    // 取消所有等待中的更新
    if (this._updateTimeout) {
      clearTimeout(this._updateTimeout);
      this._updateTimeout = null;
    }

    // 立即位置所有连接线
    this.connectionLines.forEach((line, noteId) => {
      try {
        if (line && typeof line.position === "function") {
          line.position();
        }
      } catch (error) {
        console.error(`强制更新连接线失败 (便签ID: ${noteId}):`, error);
      }
    });

    // 触发连接状态变化事件
    dispatchCustomEvent("connections-changed", {
      detail: { connections: this.connectedNotes },
    });

    // 自动更新界面占位符和按钮显示
    if (typeof window.app !== "undefined") {
      setTimeout(() => {
        try {
          window.app.updatePromptPlaceholder();
          window.app.updateButtonVisibility();
        } catch (e) {
          console.warn("自动更新UI时出错:", e);
        }
      }, 50);
    }

    return this.connectedNotes.length;
  }

  /**
   * 安排多次连续更新
   * 在复杂变换后确保连接线正确显示
   * @param {number} times - 更新次数
   * @param {number} interval - 更新间隔(毫秒)
   */
  scheduleMultipleUpdates(times = 3, interval = 100) {
    let count = 0;

    const performUpdate = () => {
      if (count < times) {
        this.forceUpdateAllConnections();
        count++;
        setTimeout(performUpdate, interval);
      }
    };

    // 开始执行更新
    setTimeout(performUpdate, interval);
  }

  /**
   * 刷新特定便签的连接线
   * @param {Object} note - 便签对象
   */
  refreshConnection(note) {
    if (!note || !note.id) return;

    const line = this.connectionLines.get(note.id);
    if (line && typeof line.position === "function") {
      try {
        line.position();
      } catch (error) {
        console.error("刷新连接线失败:", error);
      }
    }
  }

  /**
   * 添加连接
   * @param {Object} note - 便签对象
   */
  addConnection(note) {
    if (!note || !note.id) return;

    // 如果已存在连接，先移除
    this.removeConnection(note);

    // 将便签添加到已连接列表
    if (!this.connectedNotes.includes(note)) {
      this.connectedNotes.push(note);
    }

    // 先确保创建插槽，然后再创建连接线
    this.createSlot(note);

    // 添加节点按钮连接状态
    const nodeButton = note.element.querySelector(".note-node-button");
    if (nodeButton) {
      nodeButton.classList.add("connected");
    }

    // 只在初始添加时触发一次note-connected事件
    const isInitialConnection = !this.connectionLines.has(note.id);
    if (isInitialConnection) {
      dispatchCustomEvent("note-connected", {
        note: note,
      });
    }

    // 延迟创建连接线，确保插槽已经在DOM中
    setTimeout(() => {
      this.createConnection(note);

      // 触发便签已连接事件 - 这是创建连接线后的特定事件
      dispatchCustomEvent("note-connection-established", {
        note: note,
      });

      // 不再重复触发note-connected事件
    }, 50);
  }

  /**
   * 创建连接线
   * @param {Object} note - 便签对象
   * @param {number} retryCount - 重试计数，默认为0
   * @param {number} maxRetries - 最大重试次数，默认为3
   */
  createConnection(note, retryCount = 0, maxRetries = 3) {
    if (!note || !note.id || !note.element) return;

    // 获取便签节点按钮
    const nodeButton = note.element.querySelector(".note-node-button");
    if (!nodeButton) {
      console.error(`找不到便签ID为${note.id}的节点按钮`);
      return;
    }

    // 获取对应的插槽
    const slot = this.slotsContainer.querySelector(
      `.note-slot[data-note-id="${note.id}"]`
    );

    if (!slot) {
      if (retryCount < maxRetries) {
        console.warn(
          `找不到便签ID为${note.id}的插槽，重试中...(${
            retryCount + 1
          }/${maxRetries})`
        );

        // 尝试再次创建插槽
        this.createSlot(note);

        // 增加重试间隔时间，给DOM更多时间更新
        const retryDelay = 100 * Math.pow(2, retryCount); // 指数退避策略

        setTimeout(() => {
          this.createConnection(note, retryCount + 1, maxRetries);
        }, retryDelay);
      } else {
        console.error(
          `达到最大重试次数，无法为便签ID ${note.id} 创建连接线：找不到插槽元素`
        );
      }
      return;
    }

    try {
      // 移除可能存在的旧连接线
      const existingLine = this.connectionLines.get(note.id);
      if (existingLine) {
        existingLine.remove();
        this.connectionLines.delete(note.id);
      }

      // 创建Leader-Line连接线
      const line = new LeaderLine(nodeButton, slot, this.lineOptions);

      // 存储连接线实例
      this.connectionLines.set(note.id, line);

      // 为连接线元素添加类名，以便可以应用CSS样式
      if (line.element) {
        line.element.classList.add("connection-line-container");

        // 设置连接线的Z-index以确保它在便签下方
        line.element.style.zIndex = "5";

        // 为连接线添加数据属性，用于识别
        line.element.dataset.noteId = note.id;
      }

      // 在DOM更新后，执行一次强制刷新
      setTimeout(() => {
        try {
          if (line && typeof line.position === "function") {
            line.position();
          }
          // 同时刷新所有连接线，确保都正确定位
          this.refreshAllConnections();
        } catch (error) {
          console.error("刷新新建连接线失败:", error);
        }
      }, 20);

      console.log(`成功创建便签ID为${note.id}的连接线`);
    } catch (error) {
      console.error(`创建连接线失败 (便签ID: ${note.id}):`, error, {
        nodeButton: nodeButton,
        slot: slot,
        exists: !!slot,
      });
    }
  }

  /**
   * 移除连接
   * @param {Object} note - 便签对象
   */
  removeConnection(note) {
    if (!note || !note.id) return;

    // 从已连接列表中移除
    this.connectedNotes = this.connectedNotes.filter((n) => n.id !== note.id);

    // 销毁连接线
    const line = this.connectionLines.get(note.id);
    if (line) {
      try {
        line.remove(); // Leader-Line提供的移除方法
      } catch (error) {
        console.warn(`移除连接线失败 (便签ID: ${note.id}):`, error);
      }
      this.connectionLines.delete(note.id);
    }

    // 安全地移除节点按钮连接状态
    try {
      if (note.element) {
        const nodeButton = note.element.querySelector(".note-node-button");
        if (nodeButton) {
          nodeButton.classList.remove("connected");
        }
      }
    } catch (error) {
      console.warn(`移除节点按钮连接状态失败 (便签ID: ${note.id}):`, error);
    }

    // 触发便签连接断开事件
    dispatchCustomEvent("note-connection-removed", {
      note: note,
    });
  }

  /**
   * 刷新所有连接线
   */
  refreshAllConnections() {
    // 使用Leader-Line的position方法刷新所有连接线位置
    this.connectionLines.forEach((line, noteId) => {
      try {
        // 检查连接线和对应元素是否还存在
        if (line && typeof line.position === "function") {
          // 验证起点和终点元素是否仍然存在于DOM中
          const noteElement = this.connectedNotes.find(
            (note) => note.id === noteId
          )?.element;
          const nodeButton = noteElement?.querySelector(".note-node-button");
          const slot = this.slotsContainer.querySelector(
            `.note-slot[data-note-id="${noteId}"]`
          );

          if (nodeButton && slot) {
            // 目标元素都存在，更新位置
            line.position();
          } else {
            // 如果某个目标元素不存在，应该移除这条连接线
            console.warn(`连接线的起点或终点不存在，移除连接线: ${noteId}`);
            if (line.remove) line.remove();
            this.connectionLines.delete(noteId);
          }
        }
      } catch (error) {
        console.error(`刷新连接线失败 (便签ID: ${noteId}):`, error);
      }
    });
  }

  /**
   * 更新连接线的可见性
   * @param {boolean} visible - 是否可见
   */
  setConnectionsVisibility(visible) {
    this.connectionLines.forEach((line) => {
      if (visible) {
        line.show();
      } else {
        line.hide();
      }
    });
  }

  /**
   * 高亮显示连接线
   * @param {Object} note - 便签对象
   */
  highlightConnection(note) {
    if (!note || !note.id) return;

    const line = this.connectionLines.get(note.id);
    if (line) {
      // 保存原始颜色
      if (!line._originalColor) {
        line._originalColor = line.color;
      }

      if (!line._originalSize) {
        line._originalSize = line.size;
      }

      // 设置高亮颜色
      line.color =
        "var(--note-connection-highlight-color, rgba(249, 132, 121, 0.65))";
      line.size = "var(--note-connection-highlight-size, 2)"; // 稍微增加线条粗细

      // 添加高亮类名
      if (line.element) {
        line.element.classList.add("highlight");
      }

      // 高亮对应的便签和插槽
      if (note.element) {
        note.element.classList.add("note-highlight");
      }

      const slot = this.slotsContainer.querySelector(
        `.note-slot[data-note-id="${note.id}"]`
      );
      if (slot) {
        slot.classList.add("slot-highlight");
      }
    }
  }

  /**
   * 取消高亮显示连接线
   * @param {Object} note - 便签对象
   */
  unhighlightConnection(note) {
    if (!note || !note.id) return;

    const line = this.connectionLines.get(note.id);
    if (line) {
      // 恢复原始颜色
      if (line._originalColor) {
        line.color = line._originalColor;
      }

      if (line._originalSize) {
        line.size = line._originalSize;
      } else {
        line.size = "var(--note-connection-size, 2)";
      }

      // 移除高亮类名
      if (line.element) {
        line.element.classList.remove("highlight");
      }

      // 移除便签和插槽的高亮
      if (note.element) {
        note.element.classList.remove("note-highlight");
      }

      const slot = this.slotsContainer.querySelector(
        `.note-slot[data-note-id="${note.id}"]`
      );
      if (slot) {
        slot.classList.remove("slot-highlight");
      }
    }
  }

  /**
   * 获取已连接的便签列表
   * @returns {Array} 已连接的便签列表
   */
  getConnectedNotes() {
    return [...this.connectedNotes];
  }

  /**
   * 检查便签是否已连接
   * @param {Object} note - 便签对象
   * @returns {boolean} 是否已连接
   */
  isConnected(note) {
    if (!note || !note.id) return false;
    return this.connectedNotes.some((n) => n.id === note.id);
  }

  /**
   * 切换便签连接状态
   * @param {Object} note - 便签对象
   * @returns {boolean} 切换后的连接状态
   */
  toggleConnection(note) {
    if (this.isConnected(note)) {
      // 使用 disconnectNote 而不是 removeConnection，确保同时移除连接线和插槽
      this.disconnectNote(note);
      return false;
    } else {
      this.addConnection(note);
      return true;
    }
  }

  /**
   * 销毁管理器，清理资源
   */
  destroy() {
    // 移除所有连接线
    this.connectionLines.forEach((line) => {
      if (line && typeof line.remove === "function") {
        line.remove();
      }
    });

    this.connectionLines.clear();
    this.connectedNotes = [];

    // 关闭DOM观察器
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    // 取消所有待处理的更新
    if (this._updateTimeout) {
      clearTimeout(this._updateTimeout);
      this._updateTimeout = null;
    }

    // 移除事件监听
    window.removeEventListener("resize", this.refreshAllConnections);
    document.removeEventListener(
      "canvas-transform-updated",
      this.forceUpdateAllConnections
    );
    document.removeEventListener("note-moving", this.refreshAllConnections);
    document.removeEventListener("note-moved", this.forceUpdateAllConnections);
    document.removeEventListener("note-resizing", this.refreshAllConnections);
    document.removeEventListener(
      "note-resized",
      this.forceUpdateAllConnections
    );

    // 清除所有插槽
    while (this.slotsContainer.firstChild) {
      this.slotsContainer.removeChild(this.slotsContainer.firstChild);
    }

    // 隐藏插槽容器
    this.slotsContainer.classList.remove("visible");

    console.log("节点连接管理器已销毁");
  }

  /**
   * 选中便签
   * @param {Object} note - 便签对象
   */
  selectNote(note) {
    // 如果已经选中了这个便签，取消选中
    if (this.selectedNote === note) {
      this.deselectNote();
      return;
    }

    // 如果之前选中了其他便签，先取消选中
    if (this.selectedNote) {
      this.deselectNote();
    }

    // 选中新便签
    this.selectedNote = note;

    // 添加选中样式
    if (note.element) {
      note.element.classList.add("selected");
    }

    // 触发选中事件
    dispatchCustomEvent("note-selected", { note });
  }

  /**
   * 取消选中便签
   */
  deselectNote() {
    if (!this.selectedNote) return;

    // 移除选中样式
    if (this.selectedNote.element) {
      this.selectedNote.element.classList.remove("selected");
    }

    const note = this.selectedNote;
    this.selectedNote = null;

    // 触发取消选中事件
    dispatchCustomEvent("note-deselected", { note });
  }

  /**
   * 兼容旧版本的方法：检查便签是否已连接
   * @param {Object} note - 便签对象
   * @returns {boolean} 是否已连接
   */
  isNoteConnected(note) {
    return this.isConnected(note);
  }

  /**
   * 兼容旧版本的方法：连接便签
   * @param {Object} note - 便签对象
   */
  connectNote(note) {
    if (!this.isConnected(note)) {
      // 添加连接
      this.addConnection(note);

      // 触发连接事件
      dispatchCustomEvent("note-connected", { note });

      // 触发连接状态变化事件，用于更新UI
      dispatchCustomEvent("connections-changed", {
        detail: { connections: this.connectedNotes },
      });

      // 自动更新界面占位符和按钮显示
      if (typeof window.app !== "undefined") {
        window.app.updatePromptPlaceholder();
        window.app.updateButtonVisibility();
      }
    }
  }

  /**
   * 兼容旧版本的方法：断开便签连接
   * @param {Object} note - 便签对象
   */
  disconnectNote(note) {
    if (!note || !note.id) return;

    // 检查便签是否已连接
    if (!this.isConnected(note)) return;

    try {
      // 移除连接
      this.removeConnection(note);

      // 移除插槽
      this.removeSlot(note);

      // 安全地移除节点按钮连接状态
      try {
        if (note.element) {
          const nodeButton = note.element.querySelector(".note-node-button");
          if (nodeButton) {
            nodeButton.classList.remove("connected");
          }
        }
      } catch (error) {
        // 忽略错误，便签可能已被删除
      }

      // 如果没有连接的便签，隐藏插槽区域和连接模式选择器
      if (this.connectedNotes.length === 0 && this.slotsContainer) {
        this.slotsContainer.classList.remove("visible");

        // 隐藏连接模式选择器
        const modeSelector = document.getElementById(
          "connection-mode-selector"
        );
        if (modeSelector) {
          modeSelector.style.display = "none";
        }
      }

      // 触发断开连接事件
      dispatchCustomEvent("note-disconnected", { note });

      // 触发连接状态变化事件，用于更新UI
      dispatchCustomEvent("connections-changed", {
        detail: { connections: this.connectedNotes },
      });

      // 自动更新界面占位符和按钮显示
      if (typeof window.app !== "undefined") {
        window.app.updatePromptPlaceholder();
        window.app.updateButtonVisibility();
      }
    } catch (error) {
      console.warn(`断开便签连接失败 (便签ID: ${note.id}):`, error);
    }
  }

  /**
   * 清除所有连接
   */
  clearAllConnections() {
    // 创建连接便签列表的副本，因为在移除过程中会修改原数组
    const notesToRemove = [...this.connectedNotes];

    // 遍历所有连接的便签并移除连接
    notesToRemove.forEach((note) => {
      this.disconnectNote(note);
    });

    // 如果移除后还有连接存在，记录警告
    if (this.connectedNotes.length > 0) {
      console.warn("清除所有连接后仍有连接存在:", this.connectedNotes.length);

      // 强制清空列表
      this.connectedNotes = [];

      // 移除所有连接线
      this.connectionLines.forEach((line) => {
        if (line && typeof line.remove === "function") {
          line.remove();
        }
      });
      this.connectionLines.clear();

      // 清空插槽列表
      if (this.slotsList) {
        this.slotsList.innerHTML = "";
      }
    }

    // 触发自定义事件，通知所有连接已清除
    dispatchCustomEvent("all-connections-cleared", {});

    // 触发连接状态变化事件，用于更新UI
    dispatchCustomEvent("connections-changed", {
      detail: { connections: [] },
    });

    // 自动更新界面占位符和按钮显示
    if (typeof window.app !== "undefined") {
      window.app.updatePromptPlaceholder();
      window.app.updateButtonVisibility();
    }

    // 隐藏插槽容器和连接模式选择器
    if (this.slotsContainer) {
      this.slotsContainer.classList.remove("visible");

      // 隐藏连接模式选择器
      const modeSelector = document.getElementById("connection-mode-selector");
      if (modeSelector) {
        modeSelector.style.display = "none";
      }
    }

    console.log("已清除所有便签连接");
  }

  /**
   * 创建插槽
   * @param {Object} note - 便签对象
   * @returns {HTMLElement|null} 创建的插槽元素或null
   */
  createSlot(note) {
    if (!note || !note.id) return null;

    // 检查插槽列表容器是否存在
    if (!this.slotsList) {
      this.slotsList = document.getElementById("slots-list");
      if (!this.slotsList) {
        console.error("插槽列表容器不存在，无法创建插槽");
        return null;
      }
    }

    // 检查插槽是否已存在
    const existingSlot = this.slotsList.querySelector(
      `.note-slot[data-note-id="${note.id}"]`
    );
    if (existingSlot) return existingSlot;

    // 创建插槽元素
    const slot = document.createElement("div");
    slot.className = "note-slot connected";
    slot.dataset.noteId = note.id;

    // 设置索引序号，用于显示
    slot.dataset.index = this.connectedNotes.indexOf(note) + 1;

    // 添加标题作为提示信息
    const noteTitle = note.title || `便签 ${note.id}`;
    slot.title = noteTitle; // 鼠标悬停时显示便签标题

    // 创建移除按钮
    const removeBtn = document.createElement("div");
    removeBtn.className = "slot-remove";
    removeBtn.innerHTML = "×";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // 阻止事件冒泡
      this.disconnectNote(note);
    });

    // 添加点击插槽的事件处理
    slot.addEventListener("click", () => {
      // 高亮对应的便签连接线
      this.highlightConnection(note);
    });

    slot.addEventListener("mouseleave", () => {
      // 取消高亮
      this.unhighlightConnection(note);
    });

    // 组装插槽
    slot.appendChild(removeBtn);

    // 添加到插槽列表容器
    this.slotsList.appendChild(slot);

    // 确保插槽区域可见
    this.slotsContainer.classList.add("visible");

    // 显示连接模式选择器
    const modeSelector = document.getElementById("connection-mode-selector");
    if (modeSelector) {
      modeSelector.style.display = "flex";

      // 如果App实例存在，初始化模式切换开关事件
      if (
        typeof window.app !== "undefined" &&
        window.app.initModeToggleEvents
      ) {
        window.app.initModeToggleEvents();
      }
    }

    console.log(`成功创建便签ID为${note.id}的插槽`);

    // 更新所有插槽的序号
    this.updateSlotIndexes();

    return slot;
  }

  /**
   * 更新所有插槽的序号
   */
  updateSlotIndexes() {
    // 获取所有插槽
    const slots = this.slotsList.querySelectorAll(".note-slot");

    // 更新每个插槽的序号
    slots.forEach((slot, index) => {
      slot.dataset.index = index + 1;
    });
  }

  /**
   * 移除插槽
   * @param {Object} note - 便签对象
   */
  removeSlot(note) {
    if (!note || !note.id) return;

    if (!this.slotsList) {
      this.slotsList = document.getElementById("slots-list");
    }

    if (!this.slotsList) return;

    const slot = this.slotsList.querySelector(
      `.note-slot[data-note-id="${note.id}"]`
    );

    if (slot) {
      slot.remove();

      // 更新剩余插槽的序号
      this.updateSlotIndexes();

      // 强制更新所有连接线，确保剩余连接线位置正确
      setTimeout(() => {
        this.refreshAllConnections();
      }, 10);

      // 如果没有连接的便签，隐藏插槽区域和连接模式选择器
      if (this.connectedNotes.length === 0 && this.slotsContainer) {
        this.slotsContainer.classList.remove("visible");

        // 隐藏连接模式选择器
        const modeSelector = document.getElementById(
          "connection-mode-selector"
        );
        if (modeSelector) {
          modeSelector.style.display = "none";
        }
      }
    }
  }
}

// 创建并导出单例实例以兼容现有代码
const nodeConnectionManager = new NodeConnectionManager();
export default nodeConnectionManager;
