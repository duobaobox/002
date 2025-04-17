/**
 * 模块入口文件
 * 导出所有模块，提供统一的 API
 */

// 导出便签核心功能
export { Note } from "./note/Note.js";

// 导出便签事件处理功能
export * from "./note/NoteEvents.js";

// 导出便签 UI 功能
export * from "./note/NoteUI.js";

// 导出临时便签功能
export { createEmptyAiNote } from "./note/TempNote.js";

// 导出 Canvas 类
export { Canvas } from "./canvas/Canvas.js";

// 导出 DOM 工具函数
export {
  getHighestZIndex,
  dispatchCustomEvent,
  debounce,
  throttle,
  createElement,
} from "./utils/DOMUtils.js";

// 导出 Markdown 工具函数
export {
  renderMarkdown,
  updateScrollbar,
  updateNoteContent,
} from "./utils/MarkdownUtils.js";
