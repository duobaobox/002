/**
 * ShareCanvas 类
 * 为分享页面提供画布移动和缩放功能
 */
export class ShareCanvas {
  constructor() {
    this.canvas = document.getElementById("note-canvas");
    this.noteContainer = document.getElementById("note-container");
    
    if (!this.noteContainer) {
      console.error("找不到便签容器元素");
      return;
    }
    
    this.isPanning = false;
    this.startPoint = { x: 0, y: 0 };
    this.currentPoint = { x: 0, y: 0 };
    this.offset = { x: 0, y: 0 }; // 平移偏移量

    // 添加画布缩放相关属性
    this.scale = 1.0; // 默认缩放比例为100%
    this.minScale = 0.3; // 最小缩放比例30%
    this.maxScale = 2.0; // 最大缩放比例200%

    // 初始化事件处理
    this.setupEvents();
    
    // 应用初始变换
    this.applyTransform();
    
    console.log("ShareCanvas 初始化完成");
  }

  // 缩小画布
  zoomOut() {
    if (this.scale > this.minScale) {
      this.scale = Math.max(this.scale - 0.1, this.minScale);
      this.applyTransform();
    }
  }

  // 放大画布
  zoomIn() {
    if (this.scale < this.maxScale) {
      this.scale = Math.min(this.scale + 0.1, this.maxScale);
      this.applyTransform();
    }
  }

  // 重置缩放
  resetZoom() {
    this.scale = 1.0;
    this.offset = { x: 0, y: 0 };
    this.applyTransform();
  }

  // 应用变换（统一处理缩放和平移）
  applyTransform() {
    // 应用变换：使用硬件加速
    this.noteContainer.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
    
    // 强制使用硬件加速
    this.noteContainer.style.willChange = "transform";
  }

  // 事件处理
  setupEvents() {
    // 鼠标按下事件 - 开始平移画布
    this.canvas.addEventListener("mousedown", (e) => {
      // 只有当点击画布空白处或网格背景时才触发平移
      if (
        e.target === this.canvas ||
        e.target.classList.contains("grid") ||
        e.target.classList.contains("grid-background") ||
        e.target === this.noteContainer
      ) {
        this.isPanning = true;
        this.startPoint = { x: e.clientX, y: e.clientY };
        this.canvas.style.cursor = "grabbing";
        e.preventDefault(); // 防止选中文本
      }
    });

    // 鼠标移动事件 - 平移画布
    document.addEventListener("mousemove", (e) => {
      if (!this.isPanning) return;

      // 移动画布
      this.moveCanvas(e.clientX, e.clientY);
    });

    // 鼠标松开事件 - 停止平移
    document.addEventListener("mouseup", () => {
      this.isPanning = false;
      this.canvas.style.cursor = "default";
    });

    // 鼠标离开事件 - 停止平移
    document.addEventListener("mouseleave", () => {
      this.isPanning = false;
      this.canvas.style.cursor = "default";
    });

    // 添加鼠标滚轮缩放事件
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        // 按住Ctrl键时进行缩放，否则进行平移
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault(); // 防止页面滚动

          // 获取当前鼠标在画布上的位置
          const rect = this.canvas.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          // 缩放前的值
          const oldScale = this.scale;

          if (e.deltaY < 0) {
            // 向上滚动，放大
            this.zoomIn();
          } else {
            // 向下滚动，缩小
            this.zoomOut();
          }

          // 缩放比例变化
          const scaleFactor = this.scale / oldScale;

          // 调整偏移量以保持鼠标指向的点不变
          this.offset.x = mouseX - (mouseX - this.offset.x) * scaleFactor;
          this.offset.y = mouseY - (mouseY - this.offset.y) * scaleFactor;

          // 应用变换
          this.applyTransform();
        } else {
          // 不按Ctrl键时，使用滚轮进行平移
          e.preventDefault();
          
          // 垂直滚动时上下平移，水平滚动时左右平移
          if (e.deltaY !== 0) {
            this.offset.y -= e.deltaY;
          }
          if (e.deltaX !== 0) {
            this.offset.x -= e.deltaX;
          }
          
          this.applyTransform();
        }
      },
      { passive: false }
    );
    
    // 添加触摸事件支持
    this.setupTouchEvents();
  }
  
  // 设置触摸事件
  setupTouchEvents() {
    let lastTouchDistance = 0;
    
    // 触摸开始
    this.canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        // 单指触摸 - 平移
        this.isPanning = true;
        this.startPoint = { 
          x: e.touches[0].clientX, 
          y: e.touches[0].clientY 
        };
        e.preventDefault();
      } else if (e.touches.length === 2) {
        // 双指触摸 - 缩放
        lastTouchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        e.preventDefault();
      }
    });
    
    // 触摸移动
    this.canvas.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1 && this.isPanning) {
        // 单指移动 - 平移
        this.moveCanvas(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
      } else if (e.touches.length === 2) {
        // 双指移动 - 缩放
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        
        if (lastTouchDistance > 0) {
          // 计算缩放比例变化
          const scaleFactor = currentDistance / lastTouchDistance;
          
          // 获取双指中心点
          const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          
          // 获取中心点在画布上的位置
          const rect = this.canvas.getBoundingClientRect();
          const canvasCenterX = centerX - rect.left;
          const canvasCenterY = centerY - rect.top;
          
          // 缩放前的值
          const oldScale = this.scale;
          
          // 计算新的缩放值
          this.scale = Math.min(
            Math.max(this.scale * scaleFactor, this.minScale),
            this.maxScale
          );
          
          // 计算实际应用的缩放比例
          const appliedScaleFactor = this.scale / oldScale;
          
          // 调整偏移量以保持中心点不变
          this.offset.x = canvasCenterX - (canvasCenterX - this.offset.x) * appliedScaleFactor;
          this.offset.y = canvasCenterY - (canvasCenterY - this.offset.y) * appliedScaleFactor;
          
          // 应用变换
          this.applyTransform();
        }
        
        lastTouchDistance = currentDistance;
        e.preventDefault();
      }
    });
    
    // 触摸结束
    this.canvas.addEventListener("touchend", () => {
      this.isPanning = false;
      lastTouchDistance = 0;
    });
    
    // 触摸取消
    this.canvas.addEventListener("touchcancel", () => {
      this.isPanning = false;
      lastTouchDistance = 0;
    });
  }

  // 移动画布
  moveCanvas(clientX, clientY) {
    this.currentPoint = { x: clientX, y: clientY };

    // 计算鼠标移动距离
    const deltaX = this.currentPoint.x - this.startPoint.x;
    const deltaY = this.currentPoint.y - this.startPoint.y;

    // 更新偏移量
    this.offset.x += deltaX;
    this.offset.y += deltaY;

    // 应用变换
    this.applyTransform();

    // 更新起始点为当前点
    this.startPoint = { x: this.currentPoint.x, y: this.currentPoint.y };
  }
  
  // 应用初始画布状态
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
    if (canvasState.offsetX !== undefined && canvasState.offsetY !== undefined) {
      this.offset.x = canvasState.offsetX;
      this.offset.y = canvasState.offsetY;
    }
    
    // 应用变换
    this.applyTransform();
    
    console.log("应用初始画布状态:", canvasState);
  }
}

export default ShareCanvas;
