/**
 * 节点连接管理器模块
 * 负责管理便签节点的连接关系和交互
 */

import { dispatchCustomEvent } from "./DOMUtils.js";

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

    // 连接线元素
    this.connectionLines = new Map();

    // SVG容器
    this.svgContainer = document.getElementById("connections-svg");

    // 插槽容器
    this.slotsContainer = document.getElementById("slots-container");

    // 初始化
    this.init();
  }

  /**
   * 初始化连接管理器
   */
  init() {
    // 确保SVG容器存在
    if (!this.svgContainer) {
      console.error("SVG容器不存在，无法初始化节点连接管理器");
      return;
    }

    // 确保插槽容器存在
    if (!this.slotsContainer) {
      console.error("插槽容器不存在，无法初始化节点连接管理器");
      return;
    }

    // 监听窗口大小变化，更新连接线
    window.addEventListener("resize", () => {
      this.updateAllConnections(true); // 使用requestAnimationFrame
    });

    // 监听画布变换事件，更新连接线
    document.addEventListener("canvas-transform-updated", () => {
      this.updateAllConnections(true); // 使用requestAnimationFrame
    });

    // 监听便签移动完成事件，更新连接线
    document.addEventListener("note-moved", () => {
      this.updateAllConnections(true); // 使用requestAnimationFrame
    });

    // 监听便签移动中事件，实时更新连接线
    document.addEventListener("note-moving", (e) => {
      if (e.detail && e.detail.immediate) {
        // 如果标记为立即更新，则直接更新指定便签的连接线
        if (e.detail.note) {
          this.updateConnection(e.detail.note);
        } else {
          // 如果没有提供便签实例，则通过ID查找
          const noteId = e.detail.id;
          const note = this.connectedNotes.find((n) => n.id === noteId);
          if (note) {
            this.updateConnection(note);
          }
        }
      } else {
        // 否则使用requestAnimationFrame更新所有连接线
        this.updateAllConnections(true);
      }
    });

    // 监听便签调整大小事件，实时更新连接线
    document.addEventListener("note-resizing", (e) => {
      if (e.detail && e.detail.immediate) {
        // 如果标记为立即更新，则直接更新指定便签的连接线
        if (e.detail.note) {
          this.updateConnection(e.detail.note);
        } else {
          // 如果没有提供便签实例，则通过ID查找
          const noteId = e.detail.id;
          const note = this.connectedNotes.find((n) => n.id === noteId);
          if (note) {
            this.updateConnection(note);
          }
        }
      } else {
        // 否则使用requestAnimationFrame更新所有连接线
        this.updateAllConnections(true);
      }
    });

    // 监听便签调整大小完成事件，更新连接线
    document.addEventListener("note-resized", () => {
      this.updateAllConnections(true); // 使用requestAnimationFrame
    });

    console.log("节点连接管理器初始化完成");
  }

  /**
   * 选中便签
   * @param {Note} note - 便签实例
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

    console.log(`选中便签: ${note.id}`);

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

    console.log(`取消选中便签: ${this.selectedNote.id}`);

    // 清除选中状态
    this.selectedNote = null;

    // 触发取消选中事件
    dispatchCustomEvent("note-deselected", {});
  }

  /**
   * 连接便签到插槽
   * @param {Note} note - 便签实例
   */
  connectNote(note) {
    // 检查便签是否已连接
    if (this.isNoteConnected(note)) {
      console.log(`便签 ${note.id} 已经连接，断开连接`);
      this.disconnectNote(note);
      return;
    }

    // 添加到连接列表
    this.connectedNotes.push(note);

    // 创建插槽
    this.createSlot(note);

    // 创建连接线
    this.createConnection(note);

    // 显示插槽区域
    this.slotsContainer.classList.add("visible");

    console.log(`连接便签: ${note.id}`);

    // 触发连接事件
    dispatchCustomEvent("note-connected", { note });
  }

  /**
   * 断开便签连接
   * @param {Note} note - 便签实例
   */
  disconnectNote(note) {
    // 从连接列表中移除
    this.connectedNotes = this.connectedNotes.filter((n) => n.id !== note.id);

    // 移除插槽
    this.removeSlot(note);

    // 移除连接线
    this.removeConnection(note);

    // 如果没有连接的便签，隐藏插槽区域
    if (this.connectedNotes.length === 0) {
      this.slotsContainer.classList.remove("visible");
    }

    console.log(`断开便签连接: ${note.id}`);

    // 触发断开连接事件
    dispatchCustomEvent("note-disconnected", { note });
  }

  /**
   * 检查便签是否已连接
   * @param {Note} note - 便签实例
   * @returns {boolean} 是否已连接
   */
  isNoteConnected(note) {
    return this.connectedNotes.some((n) => n.id === note.id);
  }

  /**
   * 创建插槽
   * @param {Note} note - 便签实例
   */
  createSlot(note) {
    // 创建插槽元素
    const slot = document.createElement("div");
    slot.className = "note-slot connected";
    slot.dataset.noteId = note.id;

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
      // 可以添加点击插槽时的行为，例如高亮对应的便签
      console.log(`点击了便签插槽: ${noteTitle}`);
    });

    // 组装插槽
    slot.appendChild(removeBtn);

    // 添加到插槽容器
    this.slotsContainer.appendChild(slot);
  }

  /**
   * 移除插槽
   * @param {Note} note - 便签实例
   */
  removeSlot(note) {
    const slot = this.slotsContainer.querySelector(
      `.note-slot[data-note-id="${note.id}"]`
    );
    if (slot) {
      slot.remove();
    }
  }

  /**
   * 创建连接线
   * @param {Note} note - 便签实例
   */
  createConnection(note) {
    // 创建连接线
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("connection-line");
    path.dataset.noteId = note.id;

    // 设置路径属性
    path.setAttribute("stroke-linecap", "round"); // 圆形线帽
    path.setAttribute("stroke-linejoin", "round"); // 圆形连接

    // 添加交互事件
    path.addEventListener("mouseover", () => {
      path.style.strokeWidth = "3.5px";
      path.style.opacity = "1";
    });

    path.addEventListener("mouseout", () => {
      path.style.strokeWidth = "";
      path.style.opacity = "";
    });

    path.addEventListener("click", (e) => {
      // 可以添加点击连接线的行为，例如高亮对应的便签
      console.log(`点击了连接线: ${note.id}`);
      e.stopPropagation();
    });

    // 添加到SVG容器
    this.svgContainer.appendChild(path);

    // 保存连接线引用
    this.connectionLines.set(note.id, path);

    // 更新连接线路径
    this.updateConnection(note);

    // 添加连接状态类到节点按钮
    const nodeButton = note.element.querySelector(".note-node-button");
    if (nodeButton) {
      nodeButton.classList.add("connected");
    }
  }

  /**
   * 移除连接线
   * @param {Note} note - 便签实例
   */
  removeConnection(note) {
    const path = this.connectionLines.get(note.id);
    if (path) {
      // 移除事件监听器
      path.removeEventListener("mouseover", null);
      path.removeEventListener("mouseout", null);
      path.removeEventListener("click", null);

      // 移除路径元素
      path.remove();
      this.connectionLines.delete(note.id);

      // 移除节点按钮的连接状态
      const nodeButton = note.element.querySelector(".note-node-button");
      if (nodeButton) {
        nodeButton.classList.remove("connected");
      }
    }
  }

  /**
   * 更新连接线
   * @param {Note} note - 便签实例
   */
  updateConnection(note) {
    const path = this.connectionLines.get(note.id);
    if (!path) return;

    // 获取便签节点按钮位置
    const nodeButton = note.element.querySelector(".note-node-button");
    if (!nodeButton) return;

    // 获取插槽位置
    const slot = this.slotsContainer.querySelector(
      `.note-slot[data-note-id="${note.id}"]`
    );
    if (!slot) return;

    // 获取Canvas实例
    const canvas = window.canvasInstance;

    // 获取节点按钮和插槽的DOM位置
    const nodeRect = nodeButton.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();

    // 计算连接线路径 - 从左下角节点按钮中心到插槽中心
    let startX, startY, endX, endY;

    // 使用DOM位置计算，但考虑SVG容器的位置偏移
    const svgRect = this.svgContainer.getBoundingClientRect();

    // 计算相对于SVG容器的坐标
    startX = nodeRect.left + nodeRect.width / 2 - svgRect.left;
    startY = nodeRect.top + nodeRect.height / 2 - svgRect.top;
    endX = slotRect.left + slotRect.width / 2 - svgRect.left;
    endY = slotRect.top + slotRect.height / 2 - svgRect.top; // 连接到插槽中心

    // 创建贝塞尔曲线路径 - 调整控制点使曲线更自然
    const dx = endX - startX;
    const dy = endY - startY;

    // 计算控制点 - 使用更自然的曲线
    // 由于插槽位置较高，需要调整控制点计算方式
    let controlX1, controlY1, controlX2, controlY2;

    // 计算距离
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 根据距离调整控制点
    if (dy < 0) {
      // 向上连接（便签在插槽下方）
      // 第一个控制点：从便签节点垂直向上
      controlX1 = startX;
      controlY1 = startY + dy * 0.25; // 向上25%距离，更平滑的曲线

      // 第二个控制点：从插槽垂直向下
      controlX2 = endX;
      controlY2 = endY - dy * 0.25; // 向下25%距离，更平滑的曲线

      // 对于较长的连接线，进一步调整控制点
      if (distance > 300) {
        controlY1 = startY + dy * 0.2;
        controlY2 = endY - dy * 0.2;
      }
    } else {
      // 向下连接（便签在插槽上方）
      // 使用更平缓的曲线
      controlX1 = startX + dx * 0.2;
      controlY1 = startY + dy * 0.4;
      controlX2 = endX - dx * 0.2;
      controlY2 = endY - dy * 0.4;
    }

    // 生成路径数据
    const pathData = `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;

    // 更新路径
    path.setAttribute("d", pathData);

    // 添加数据属性，用于交互
    path.dataset.startX = startX;
    path.dataset.startY = startY;
    path.dataset.endX = endX;
    path.dataset.endY = endY;
  }

  /**
   * 更新所有连接线
   * @param {boolean} useRAF - 是否使用requestAnimationFrame (默认: false)
   */
  updateAllConnections(useRAF = false) {
    if (useRAF) {
      // 使用requestAnimationFrame确保平滑更新
      if (!this.updateAnimationFrame) {
        this.updateAnimationFrame = requestAnimationFrame(() => {
          this.connectedNotes.forEach((note) => {
            this.updateConnection(note);
          });
          this.updateAnimationFrame = null;
        });
      }
    } else {
      // 直接更新
      this.connectedNotes.forEach((note) => {
        this.updateConnection(note);
      });
    }
  }

  /**
   * 获取所有连接的便签
   * @returns {Array} 连接的便签列表
   */
  getConnectedNotes() {
    return [...this.connectedNotes];
  }

  /**
   * 清除所有连接
   */
  clearAllConnections() {
    // 复制一份连接列表，避免在遍历过程中修改原列表
    const notesToDisconnect = [...this.connectedNotes];

    // 断开所有连接
    notesToDisconnect.forEach((note) => {
      this.disconnectNote(note);
    });
  }
}

// 创建单例实例
const nodeConnectionManager = new NodeConnectionManager();

export default nodeConnectionManager;
