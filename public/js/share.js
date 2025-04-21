/**
 * 分享页面的主要脚本
 * 负责从服务器获取分享的便签数据并展示
 */

document.addEventListener('DOMContentLoaded', () => {
  // 从URL获取分享ID
  const urlParams = new URLSearchParams(window.location.search);
  const shareId = urlParams.get('id');
  
  if (!shareId) {
    showError('无效的分享链接');
    return;
  }
  
  // 显示分享ID
  document.getElementById('share-id-display').textContent = shareId;
  
  // 加载分享数据
  loadSharedCanvas(shareId);
  
  // 设置定期刷新
  setInterval(() => {
    loadSharedCanvas(shareId, true);
  }, 30000); // 每30秒刷新一次
});

/**
 * 加载分享的画布数据
 * @param {string} shareId - 分享ID
 * @param {boolean} silent - 是否静默刷新（不显示加载提示）
 */
async function loadSharedCanvas(shareId, silent = false) {
  try {
    if (!silent) {
      // 显示加载中提示
      const canvas = document.getElementById('note-canvas');
      const loadingEl = document.createElement('div');
      loadingEl.className = 'loading-indicator';
      loadingEl.textContent = '加载中...';
      canvas.appendChild(loadingEl);
    }
    
    // 获取分享数据
    const response = await fetch(`/api/share/${shareId}`);
    
    if (!response.ok) {
      throw new Error('获取分享数据失败');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || '获取分享数据失败');
    }
    
    // 更新最后更新时间
    document.getElementById('last-updated').textContent = new Date(data.lastUpdated).toLocaleString();
    
    // 如果是静默刷新且没有变化，则不重新渲染
    if (silent && data.noChanges) {
      return;
    }
    
    // 渲染便签
    renderNotes(data.notes);
    
  } catch (error) {
    console.error('加载分享数据出错:', error);
    if (!silent) {
      showError(error.message);
    }
  } finally {
    // 移除加载提示
    if (!silent) {
      const loadingEl = document.querySelector('.loading-indicator');
      if (loadingEl) loadingEl.remove();
    }
  }
}

/**
 * 渲染便签到画布
 * @param {Array} notes - 便签数据数组
 */
function renderNotes(notes) {
  const canvas = document.getElementById('note-canvas');
  
  // 清空现有便签
  const existingNotes = canvas.querySelectorAll('.note');
  existingNotes.forEach(note => note.remove());
  
  // 创建便签容器
  let noteContainer = document.getElementById('note-container');
  if (!noteContainer) {
    noteContainer = document.createElement('div');
    noteContainer.id = 'note-container';
    noteContainer.className = 'note-container';
    noteContainer.style.position = 'absolute';
    noteContainer.style.width = '100%';
    noteContainer.style.height = '100%';
    noteContainer.style.top = '0';
    noteContainer.style.left = '0';
    noteContainer.style.transformOrigin = '0 0';
    canvas.appendChild(noteContainer);
  }
  
  // 渲染每个便签
  notes.forEach(noteData => {
    createReadOnlyNote(noteData, noteContainer);
  });
}

/**
 * 创建只读便签
 * @param {Object} noteData - 便签数据
 * @param {HTMLElement} container - 便签容器
 */
function createReadOnlyNote(noteData, container) {
  // 创建便签元素
  const note = document.createElement('div');
  note.className = `note ${noteData.colorClass || 'note-yellow'}`;
  note.style.left = `${noteData.x}px`;
  note.style.top = `${noteData.y}px`;
  note.style.zIndex = noteData.zIndex || 1;
  
  if (noteData.width) {
    note.style.width = `${noteData.width}px`;
  }
  if (noteData.height) {
    note.style.height = `${noteData.height}px`;
  }
  
  // 创建便签头部
  const header = document.createElement('div');
  header.className = 'note-header';
  
  // 添加标题
  const title = document.createElement('div');
  title.className = 'note-title';
  title.textContent = noteData.title || `便签 ${noteData.id}`;
  header.appendChild(title);
  
  // 创建便签内容区域
  const body = document.createElement('div');
  body.className = 'note-body';
  
  // 创建预览区域
  const preview = document.createElement('div');
  preview.className = 'markdown-preview';
  preview.innerHTML = renderMarkdown(noteData.text || '');
  body.appendChild(preview);
  
  // 组装便签
  note.appendChild(header);
  note.appendChild(body);
  
  // 添加到容器
  container.appendChild(note);
  
  return note;
}

/**
 * 简单的Markdown渲染函数
 * @param {string} text - Markdown文本
 * @returns {string} - 渲染后的HTML
 */
function renderMarkdown(text) {
  if (!text) return '';
  
  // 这是一个非常简单的Markdown渲染实现
  // 在实际应用中，你可能需要使用更完善的Markdown库
  
  // 转义HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // 处理标题
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  
  // 处理粗体和斜体
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // 处理链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  // 处理列表
  html = html.replace(/^\- (.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>)\s+(<li>)/g, '$1$2');
  html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');
  
  // 处理段落
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/^(.+?)$/gm, function(match) {
    if (match.startsWith('<h') || match.startsWith('<ul') || match.startsWith('<p>')) {
      return match;
    }
    return '<p>' + match + '</p>';
  });
  
  // 修复重复的段落标签
  html = html.replace(/<p><p>/g, '<p>');
  html = html.replace(/<\/p><\/p>/g, '</p>');
  
  return html;
}

/**
 * 显示错误信息
 * @param {string} message - 错误信息
 */
function showError(message) {
  const canvas = document.getElementById('note-canvas');
  canvas.innerHTML = '';
  
  const errorEl = document.createElement('div');
  errorEl.className = 'error-message';
  errorEl.innerHTML = `
    <h2>出错了</h2>
    <p>${message}</p>
    <p>请检查分享链接是否正确，或者稍后再试。</p>
  `;
  
  canvas.appendChild(errorEl);
}
