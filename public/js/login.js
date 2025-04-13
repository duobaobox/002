document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.querySelector(".login-form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const loginButton = document.getElementById("login-button");
  const messageContainer = document.getElementById("login-message");

  // 检查是否已登录
  checkLoginStatus();

  // 登录按钮点击事件
  loginButton.addEventListener("click", handleLogin);

  // 输入框回车事件
  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  });

  // 处理登录请求
  async function handleLogin() {
    // 清除之前的消息
    clearMessage();

    // 获取输入值
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    // 简单验证
    if (!username || !password) {
      showMessage("请输入用户名和密码", "error");
      return;
    }

    try {
      // 禁用登录按钮，防止重复提交
      loginButton.disabled = true;
      loginButton.textContent = "登录中...";

      // 发送登录请求
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        showMessage("登录成功，正在跳转...", "success");
        // 登录成功后跳转到主页
        setTimeout(() => {
          window.location.href = "/";
        }, 1000);
      } else {
        showMessage(data.message || "登录失败", "error");
        loginButton.disabled = false;
        loginButton.textContent = "登录";
      }
    } catch (error) {
      console.error("登录请求失败:", error);
      showMessage("网络错误，请稍后重试", "error");
      loginButton.disabled = false;
      loginButton.textContent = "登录";
    }
  }

  // 检查登录状态
  async function checkLoginStatus() {
    try {
      const response = await fetch("/api/session");
      const data = await response.json();

      if (data.success && data.isLoggedIn) {
        // 已登录，跳转到主页
        window.location.href = "/";
      }
    } catch (error) {
      console.error("检查登录状态失败:", error);
    }
  }

  // 显示消息
  function showMessage(message, type) {
    messageContainer.textContent = message;
    messageContainer.className = "message-container " + type;
  }

  // 清除消息
  function clearMessage() {
    messageContainer.textContent = "";
    messageContainer.className = "message-container";
  }
});
