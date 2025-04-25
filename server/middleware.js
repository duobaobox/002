/**
 * Middleware to validate note data (placeholder).
 * Add actual validation logic here as needed.
 * For example, check data types, lengths, required fields etc.
 */
export function validateNoteData(req, res, next) {
  const { text, x, y, title, colorClass, width, height, zIndex } = req.body;

  // --- Basic Placeholder Validation Example ---
  // You can add more specific checks here.

  // Example: Check if x and y are numbers if provided
  if (x !== undefined && typeof x !== "number") {
    // return res.status(400).json({ success: false, message: "Field 'x' must be a number." });
  }
  if (y !== undefined && typeof y !== "number") {
    // return res.status(400).json({ success: false, message: "Field 'y' must be a number." });
  }

  // If validation passes (or is just a placeholder)
  console.log("Note data validation middleware executed (placeholder).");
  next(); // Proceed to the next middleware or route handler
}

// Add other middleware functions here if needed

/**
 * 验证用户是否已登录的中间件
 * 同时检查用户是否已被删除
 */
export function requireAuth(req, res, next) {
  // 检查用户是否已登录
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: "请先登录",
      redirectTo: "/login.html",
    });
  }

  // 检查用户是否已被删除
  const deletedUsers = req.app.locals.deletedUsers;
  if (deletedUsers && deletedUsers.has(req.session.user.username)) {
    console.log(`检测到已删除的用户尝试访问: ${req.session.user.username}`);

    // 用户已被删除，清除会话
    req.session.destroy((err) => {
      if (err) {
        console.error("清除已删除用户会话失败:", err);
      } else {
        console.log(`已删除用户 ${req.session.user.username} 的会话已清除`);
      }

      // 从删除用户集合中移除该用户，因为其会话已被清除
      deletedUsers.delete(req.session.user.username);
      console.log("已从删除用户集合中移除该用户");

      // 如果删除用户集合为空，可以清除它以节省内存
      if (deletedUsers.size === 0) {
        delete req.app.locals.deletedUsers;
        console.log("删除用户集合已清空");
      }
    });

    // 返回明确的错误响应，包含重定向信息
    return res.status(401).json({
      success: false,
      message: "您的账户已被删除，请联系管理员",
      accountDeleted: true,
      redirectTo: "/login.html",
      forceRedirect: true, // 添加强制重定向标志
    });
  }

  // 用户已登录且未被删除，继续下一步
  return next();
}

/**
 * 验证用户是否为管理员的中间件
 * 必须在 requireAuth 中间件之后使用
 */
export function requireAdmin(req, res, next) {
  // 确保用户已登录（虽然通常会先使用 requireAuth 中间件）
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: "请先登录",
      redirectTo: "/login.html",
    });
  }

  // 检查用户是否为管理员
  if (req.session.user.username !== "admin") {
    return res.status(403).json({
      success: false,
      message: "只有管理员可以执行此操作",
    });
  }

  // 如果是管理员，继续下一步
  next();
}
