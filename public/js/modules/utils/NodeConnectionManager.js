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
      this.updateAllConnections();
    });

    // 监听画布变换事件，更新连接线
    document.addEventListener("canvas-transform-updated", () => {
      this.updateAllConnections();
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

    // 创建插槽标题
    const title = document.createElement("div");
    title.className = "slot-title";
    title.textContent = note.title || `便签 ${note.id}`;

    // 创建移除按钮
    const removeBtn = document.createElement("div");
    removeBtn.className = "slot-remove";
    removeBtn.innerHTML = "×";
    removeBtn.addEventListener("click", () => {
      this.disconnectNote(note);
    });

    // 组装插槽
    slot.appendChild(title);
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

    // 添加到SVG容器
    this.svgContainer.appendChild(path);

    // 保存连接线引用
    this.connectionLines.set(note.id, path);

    // 更新连接线路径
    this.updateConnection(note);
  }

  /**
   * 移除连接线
   * @param {Note} note - 便签实例
   */
  removeConnection(note) {
    const path = this.connectionLines.get(note.id);
    if (path) {
      path.remove();
      this.connectionLines.delete(note.id);
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

    const nodeRect = nodeButton.getBoundingClientRect();

    // 获取插槽位置
    const slot = this.slotsContainer.querySelector(
      `.note-slot[data-note-id="${note.id}"]`
    );
    if (!slot) return;

    const slotRect = slot.getBoundingClientRect();

    // 计算连接线路径 - 从右下角节点按钮中心到插槽顶部中心
    const startX = nodeRect.left + nodeRect.width / 2;
    const startY = nodeRect.top + nodeRect.height / 2;
    const endX = slotRect.left + slotRect.width / 2;
    const endY = slotRect.top;

    // 创建贝塞尔曲线路径 - 调整控制点使曲线更自然
    const dx = endX - startX;
    const dy = endY - startY;

    // 调整控制点，使曲线从左下角自然延伸
    const controlX1 = startX;
    const controlY1 = startY + dy / 3;
    const controlX2 = endX;
    const controlY2 = endY - Math.abs(dy) / 3;

    const pathData = `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;

    // 更新路径
    path.setAttribute("d", pathData);
  }

  /**
   * 更新所有连接线
   */
  updateAllConnections() {
    this.connectedNotes.forEach((note) => {
      this.updateConnection(note);
    });
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
