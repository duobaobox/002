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
 */
export function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  } else {
    return res.status(401).json({
      success: false,
      message: "请先登录",
      redirectTo: "/login.html",
    });
  }
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
