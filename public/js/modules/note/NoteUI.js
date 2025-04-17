/**
 * Note UI 模块
 * 提供便签 UI 相关的功能
 */

import { dispatchCustomEvent } from "../utils/DOMUtils.js";
import { renderMarkdown, updateScrollbar } from "../utils/MarkdownUtils.js";

/**
 * 切换便签的编辑/预览模式
 * @param {HTMLElement} element - 便签元素
 * @param {boolean} editMode - 当前的编辑模式
 * @param {string} text - 便签文本内容
 * @returns {void}
 */
export function toggleEditPreviewMode(element, editMode, text) {
  const textarea = element.querySelector(".note-content");
  const preview = element.querySelector(".markdown-preview");
  const scrollbarThumb = element.querySelector(".scrollbar-thumb");
  const editHint = element.querySelector(".edit-hint");

  if (editMode) {
    textarea.style.display = "block";
    preview.style.display = "none";
    updateScrollbar(textarea, scrollbarThumb);
  } else {
    textarea.style.display = "none";
    preview.style.display = "block";
    preview.innerHTML = renderMarkdown(text); // 切换时渲染
    updateScrollbar(preview, scrollbarThumb);
  }

  // 更新编辑提示的可见性
  updateEditHintVisibility(element, editMode);
}

/**
 * 更新编辑提示的可见性
 * @param {HTMLElement} element - 便签元素
 * @param {boolean} editMode - 当前的编辑模式
 */
export function updateEditHintVisibility(element, editMode) {
  if (!element) return;
  const editHint = element.querySelector(".edit-hint");
  if (!editHint) return;

  if (editMode) {
    editHint.style.opacity = "0";
    editHint.style.pointerEvents = "none";
  } else {
    editHint.style.opacity = "1"; // 在预览模式下显示提示
    editHint.style.pointerEvents = "auto"; // 预览模式下可点击
  }
}

/**
 * 编辑便签标题
 * @param {HTMLElement} titleElement - 标题元素
 * @param {string} currentTitle - 当前标题
 * @param {string} id - 便签 ID
 * @param {Function} callback - 回调函数，接收新标题
 */
export function editTitle(titleElement, currentTitle, id, callback) {
  // 保存原始标题，以便取消时恢复
  const originalTitle = currentTitle;

  // 使标题元素可编辑
  titleElement.setAttribute("contenteditable", "true");
  titleElement.classList.add("editing");
  titleElement.focus();

  // 选中所有文本以便用户直接输入
  document.execCommand("selectAll", false, null);

  // 处理失焦事件，保存修改
  const saveTitle = () => {
    titleElement.removeAttribute("contenteditable");
    titleElement.classList.remove("editing");

    // 获取并清理标题文本
    let newTitle = titleElement.textContent.trim();

    // 如果标题为空，恢复默认标题
    if (!newTitle) {
      newTitle = `便签 ${id}`;
    }

    titleElement.textContent = newTitle;

    // 通过回调更新标题
    if (callback && typeof callback === "function") {
      callback(newTitle);
    }

    // 触发标题更新事件
    dispatchCustomEvent("note-updated", { id });
  };

  // 处理按键事件
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // 阻止换行
      saveTitle();
      titleElement.blur(); // 移除焦点
    } else if (e.key === "Escape") {
      // 取消编辑，恢复原标题
      titleElement.textContent = originalTitle;
      titleElement.blur();
    }
  };

  // 添加事件监听器
  titleElement.addEventListener("blur", saveTitle, { once: true });
  titleElement.addEventListener("keydown", handleKeyDown);
}
