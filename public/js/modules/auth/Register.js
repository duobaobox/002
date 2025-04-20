/**
 * 注册功能模块
 * 处理用户注册流程和表单验证
 */

/**
 * 初始化注册功能
 */
export function initRegister() {
  const registerForm = document.querySelector(".login-form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirm-password");
  const inviteCodeInput = document.getElementById("invite-code");
  const registerButton = document.getElementById("register-button");
  const messageContainer = document.getElementById("register-message");

  // 检查是否已登录
  checkLoginStatus();

  // 注册按钮点击事件
  registerButton.addEventListener("click", handleRegister);

  // 输入框回车事件
  inviteCodeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleRegister();
    }
  });

  // 密码输入事件 - 实时检查密码匹配
  confirmPasswordInput.addEventListener("input", checkPasswordMatch);
  passwordInput.addEventListener("input", () => {
    if (confirmPasswordInput.value) {
      checkPasswordMatch();
    }
  });

  /**
   * 检查登录状态
   * 如果已登录，则重定向到主页
   */
  async function checkLoginStatus() {
    try {
      const response = await fetch("/api/session");
      const data = await response.json();

      if (data.success && data.isLoggedIn) {
        // 已登录，重定向到主页
        window.location.href = "/";
      }
    } catch (error) {
      console.error("检查登录状态失败:", error);
    }
  }

  /**
   * 处理注册请求
   */
  async function handleRegister() {
    // 获取表单数据
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const inviteCode = inviteCodeInput.value.trim();

    // 表单验证
    if (!username) {
      showMessage("请输入用户名", "error");
      return;
    }

    if (!password) {
      showMessage("请输入密码", "error");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("两次输入的密码不一致", "error");
      return;
    }

    if (!inviteCode) {
      showMessage("请输入邀请码", "error");
      return;
    }

    try {
      // 禁用注册按钮，防止重复提交
      registerButton.disabled = true;
      registerButton.textContent = "注册中...";

      // 发送注册请求
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password, inviteCode }),
      });

      const data = await response.json();

      if (data.success) {
        showMessage("注册成功，正在跳转到登录页面...", "success");
        // 注册成功后跳转到登录页
        setTimeout(() => {
          window.location.href = "/login.html";
        }, 2000);
      } else {
        showMessage(data.message || "注册失败", "error");
        registerButton.disabled = false;
        registerButton.textContent = "注册";
      }
    } catch (error) {
      console.error("注册请求失败:", error);
      showMessage("网络错误，请稍后重试", "error");
      registerButton.disabled = false;
      registerButton.textContent = "注册";
    }
  }

  /**
   * 检查两次输入的密码是否匹配
   */
  function checkPasswordMatch() {
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // 如果确认密码为空，不显示任何提示
    if (!confirmPassword) {
      return;
    }

    // 检查密码是否匹配
    if (password === confirmPassword) {
      // 密码匹配
      const matchElement = document.querySelector(".password-match");
      if (matchElement) {
        matchElement.textContent = "✓ 密码匹配";
        matchElement.classList.remove("mismatch");
        matchElement.classList.add("match");
      } else {
        // 创建密码匹配提示元素
        const matchDiv = document.createElement("div");
        matchDiv.className = "password-match match";
        matchDiv.textContent = "✓ 密码匹配";
        confirmPasswordInput.parentElement.parentElement.appendChild(matchDiv);
      }
    } else {
      // 密码不匹配
      const matchElement = document.querySelector(".password-match");
      if (matchElement) {
        matchElement.textContent = "✗ 密码不匹配";
        matchElement.classList.remove("match");
        matchElement.classList.add("mismatch");
      } else {
        // 创建密码不匹配提示元素
        const matchDiv = document.createElement("div");
        matchDiv.className = "password-match mismatch";
        matchDiv.textContent = "✗ 密码不匹配";
        confirmPasswordInput.parentElement.parentElement.appendChild(matchDiv);
      }
    }
  }

  /**
   * 显示消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型 (success/error)
   */
  function showMessage(message, type) {
    messageContainer.textContent = message;
    messageContainer.className = `message-container ${type}`;
    messageContainer.style.display = "block";

    // 自动隐藏成功消息
    if (type === "success") {
      setTimeout(() => {
        messageContainer.style.display = "none";
      }, 5000);
    }
  }
}
