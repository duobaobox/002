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
