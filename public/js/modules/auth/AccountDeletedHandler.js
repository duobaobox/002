/**
 * 账户删除处理模块
 * 提供全局的账户删除检测和处理功能
 */

/**
 * 初始化账户删除处理器
 * 拦截所有API请求，检测账户删除情况并处理
 */
export function initAccountDeletedHandler() {
  console.log("初始化账户删除处理器...");
  
  // 保存原始的fetch函数
  const originalFetch = window.fetch;
  
  // 替换全局fetch函数
  window.fetch = async function(...args) {
    try {
      // 调用原始fetch
      const response = await originalFetch.apply(this, args);
      
      // 检查是否是API请求
      if (args[0] && typeof args[0] === 'string' && args[0].startsWith('/api/')) {
        // 尝试解析响应
        try {
          const clonedResponse = response.clone();
          const data = await clonedResponse.json();
          
          // 检查是否是账户删除的情况
          if (response.status === 401 && data.accountDeleted) {
            console.log("检测到账户已被删除，准备重定向...");
            
            // 存储账户删除状态
            sessionStorage.setItem("accountDeleted", "true");
            
            // 显示提示
            alert("您的账户已被管理员删除，即将返回登录页面");
            
            // 重定向到登录页面
            setTimeout(() => {
              window.location.href = "/login.html";
            }, 500);
          }
        } catch (e) {
          // 解析JSON失败，忽略
        }
      }
      
      return response;
    } catch (error) {
      return Promise.reject(error);
    }
  };
  
  console.log("账户删除处理器初始化完成");
}

export default { initAccountDeletedHandler };
