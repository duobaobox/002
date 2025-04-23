import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt"; // 引入bcrypt库用于密码哈希

// 确保 data 目录存在
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFilePath = path.join(dataDir, "app_data.db");
let db; // This will be the sqlite3.Database instance

// Helper function to promisify db.run, db.get, db.all, db.exec
function promisifyDb(method) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      // For exec, the callback has only one argument: error
      if (method === "exec") {
        db[method](...args, function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(); // exec doesn't return rows
          }
        });
      } else {
        // For run, get, all, the callback is (err, result)
        // 'this' inside the callback refers to the statement object for run/get
        db[method](...args, function (err, result) {
          if (err) {
            reject(err);
          } else {
            // For db.run, resolve with { lastID: this.lastID, changes: this.changes }
            if (method === "run") {
              resolve({ lastID: this.lastID, changes: this.changes });
            } else {
              resolve(result); // For get and all
            }
          }
        });
      }
    });
  };
}

const dbRun = promisifyDb("run");
const dbGet = promisifyDb("get");
const dbAll = promisifyDb("all");
const dbExec = promisifyDb("exec");

/**
 * 初始化数据库连接和表结构
 */
async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    // Use sqlite3.Database directly
    db = new sqlite3.Database(dbFilePath, async (err) => {
      if (err) {
        console.error("连接 SQLite 数据库失败:", err);
        return reject(err);
      }
      console.log("成功连接到 SQLite 数据库:", dbFilePath);

      try {
        // 创建 notes 表（如果不存在）
        await dbExec(`
          CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT DEFAULT '',
            x INTEGER DEFAULT 50,
            y INTEGER DEFAULT 50,
            title TEXT DEFAULT '',
            colorClass TEXT DEFAULT 'note-yellow',
            width INTEGER,
            height INTEGER,
            zIndex INTEGER DEFAULT 1,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // 可选：添加索引
        await dbExec(
          `CREATE INDEX IF NOT EXISTS idx_notes_zIndex ON notes(zIndex);`
        );
        await dbExec(
          `CREATE INDEX IF NOT EXISTS idx_notes_updatedAt ON notes(updatedAt);`
        );

        console.log('数据库表 "notes" 已准备就绪。');

        // 创建 settings 表 (key-value store)
        await dbExec(`
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT
          );
        `);
        // Optional: Initialize default settings if they don't exist
        await setSettingIfNotExists("apiKey", "");
        await setSettingIfNotExists("baseURL", "");
        await setSettingIfNotExists("model", "");
        await setSettingIfNotExists("maxTokens", "800");
        await setSettingIfNotExists("temperature", "0.7");
        console.log('数据库表 "settings" 已准备就绪。');

        // 创建 users 表
        await dbExec(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            share_id TEXT,
            share_link TEXT,
            share_status INTEGER DEFAULT 0,
            share_canvas_name TEXT,
            share_notes INTEGER DEFAULT 1
          );
        `);

        // 检查并添加分享相关字段
        try {
          // 检查share_id字段是否存在
          const columns = await dbAll("PRAGMA table_info(users)");
          const hasShareId = columns.some((col) => col.name === "share_id");
          const hasCanvasState = columns.some(
            (col) => col.name === "share_canvas_state"
          );

          if (!hasShareId) {
            console.log("添加分享相关字段到users表...");
            // 添加分享相关字段
            await dbExec("ALTER TABLE users ADD COLUMN share_id TEXT;");
            await dbExec("ALTER TABLE users ADD COLUMN share_link TEXT;");
            await dbExec(
              "ALTER TABLE users ADD COLUMN share_status INTEGER DEFAULT 0;"
            );
            await dbExec(
              "ALTER TABLE users ADD COLUMN share_canvas_name TEXT;"
            );
            await dbExec(
              "ALTER TABLE users ADD COLUMN share_notes INTEGER DEFAULT 1;"
            );
            console.log("分享相关字段添加成功");
          }

          // 添加画布状态字段（如果不存在）
          if (!hasCanvasState) {
            console.log("添加画布状态字段到users表...");
            await dbExec(
              "ALTER TABLE users ADD COLUMN share_canvas_state TEXT;"
            );
            console.log("画布状态字段添加成功");
          }
        } catch (error) {
          console.error("检查或添加分享字段失败:", error);
          // 继续初始化过程，不中断
        }
        console.log('数据库表 "users" 已准备就绪。');

        // 创建 invitation_codes 表
        await dbExec(`
          CREATE TABLE IF NOT EXISTS invitation_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_used INTEGER DEFAULT 0,
            used_by INTEGER,
            used_at DATETIME,
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (used_by) REFERENCES users(id)
          );
        `);
        console.log('数据库表 "invitation_codes" 已准备就绪。');

        // 创建 API 密钥历史记录表
        await dbExec(`
          CREATE TABLE IF NOT EXISTS api_key_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            api_key TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
            use_count INTEGER DEFAULT 1
          );
        `);
        console.log('数据库表 "api_key_history" 已准备就绪。');

        // 创建 基础 URL 历史记录表
        await dbExec(`
          CREATE TABLE IF NOT EXISTS base_url_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            base_url TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
            use_count INTEGER DEFAULT 1
          );
        `);
        console.log('数据库表 "base_url_history" 已准备就绪。');

        // 创建 模型历史记录表
        await dbExec(`
          CREATE TABLE IF NOT EXISTS model_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
            use_count INTEGER DEFAULT 1
          );
        `);
        console.log('数据库表 "model_history" 已准备就绪。');

        // 创建 API 配置关联表
        await dbExec(`
          CREATE TABLE IF NOT EXISTS api_config_relations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            base_url TEXT NOT NULL,
            api_key TEXT NOT NULL,
            model TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
            use_count INTEGER DEFAULT 1,
            UNIQUE(base_url, api_key, model)
          );
        `);
        console.log('数据库表 "api_config_relations" 已准备就绪。');

        // 检查是否存在默认管理员账户，如果不存在则创建
        const adminUser = await dbGet(
          "SELECT * FROM users WHERE username = ?",
          ["admin"]
        );
        if (!adminUser) {
          // 使用 bcrypt 哈希默认密码
          const saltRounds = 10; // 哈希计算轮数，越高越安全但越慢
          const defaultPassword = "duobaobox"; // 默认密码
          bcrypt
            .hash(defaultPassword, saltRounds)
            .then((hashedPassword) => {
              return dbRun(
                "INSERT INTO users (username, password) VALUES (?, ?)",
                [
                  "admin",
                  hashedPassword, // 存储哈希后的密码
                ]
              );
            })
            .then(() => {
              console.log("创建默认管理员账户 (密码已哈希)");
              resolve();
            })
            .catch((err) => {
              console.error("创建默认管理员账户失败:", err);
              reject(err);
            });
        } else {
          resolve(); // 管理员账户已存在，初始化成功
        }
      } catch (initError) {
        console.error("初始化数据库表失败:", initError);
        reject(initError);
      }
    });
  });
}

// --- Settings Functions ---

/**
 * 获取指定键的设置值
 * @param {string} key - 设置项的键
 * @param {string} [defaultValue=null] - 如果未找到，返回的默认值
 * @returns {Promise<string|null>} 设置值或默认值
 */
async function getSetting(key, defaultValue = null) {
  if (!db) throw new Error("数据库未初始化");
  const row = await dbGet("SELECT value FROM settings WHERE key = ?", key);
  return row ? row.value : defaultValue;
}

/**
 * 设置指定键的值 (插入或更新)
 * @param {string} key - 设置项的键
 * @param {string} value - 设置项的值
 * @returns {Promise<void>}
 */
async function setSetting(key, value) {
  if (!db) throw new Error("数据库未初始化");
  // Use REPLACE to insert or update the setting
  await dbRun("REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
}

/**
 * 如果设置项不存在，则设置其默认值
 * @param {string} key
 * @param {string} defaultValue
 * @returns {Promise<void>}
 */
async function setSettingIfNotExists(key, defaultValue) {
  const existingValue = await getSetting(key);
  if (existingValue === null) {
    await setSetting(key, defaultValue);
  }
}

/**
 * 获取所有 AI 相关设置
 * @returns {Promise<object>} 包含所有 AI 设置的对象
 */
async function getAllAiSettings() {
  const apiKey = await getSetting("apiKey", "");
  const baseURL = await getSetting("baseURL", "");
  const model = await getSetting("model", "");
  const maxTokens = parseInt(await getSetting("maxTokens", "800"), 10);
  const temperature = parseFloat(await getSetting("temperature", "0.7"));
  const isEmpty = !apiKey && !baseURL && !model;

  return {
    apiKey,
    baseURL,
    model,
    maxTokens: isNaN(maxTokens) ? 800 : maxTokens,
    temperature: isNaN(temperature) ? 0.7 : temperature,
    isEmpty,
  };
}

// --- Notes Functions ---

/**
 * 获取所有便签
 * @returns {Promise<Array>} 便签数组
 */
async function getAllNotes() {
  if (!db) throw new Error("数据库未初始化");
  return await dbAll("SELECT * FROM notes ORDER BY zIndex ASC, updatedAt DESC");
}

/**
 * 添加一个新便签
 * @param {object} noteData - 便签数据
 * @returns {Promise<object>} 创建的便签对象
 */
async function addNote(noteData) {
  if (!db) throw new Error("数据库未初始化");
  const {
    text = "",
    x = 50,
    y = 50,
    title = "",
    colorClass = "note-yellow",
    zIndex = 1,
    width,
    height,
  } = noteData;

  const sql = `
    INSERT INTO notes (text, x, y, title, colorClass, zIndex, width, height, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

  const result = await dbRun(sql, [
    text,
    x,
    y,
    title,
    colorClass,
    zIndex,
    width,
    height,
  ]);
  return await dbGet("SELECT * FROM notes WHERE id = ?", result.lastID);
}

/**
 * 更新一个便签
 * @param {number} id - 便签 ID
 * @param {object} noteData - 要更新的便签数据
 * @returns {Promise<object|null>} 更新后的便签对象，如果未找到则返回 null
 */
async function updateNote(id, noteData) {
  if (!db) throw new Error("数据库未初始化");
  const { text, x, y, title, colorClass, width, height, zIndex } = noteData;

  const fields = [];
  const values = [];
  if (text !== undefined) {
    fields.push("text = ?");
    values.push(text);
  }
  if (x !== undefined) {
    fields.push("x = ?");
    values.push(x);
  }
  if (y !== undefined) {
    fields.push("y = ?");
    values.push(y);
  }
  if (title !== undefined) {
    fields.push("title = ?");
    values.push(title);
  }
  if (colorClass !== undefined) {
    fields.push("colorClass = ?");
    values.push(colorClass);
  }
  if (width !== undefined) {
    fields.push("width = ?");
    values.push(width);
  }
  if (height !== undefined) {
    fields.push("height = ?");
    values.push(height);
  }
  if (zIndex !== undefined) {
    fields.push("zIndex = ?");
    values.push(zIndex);
  }

  if (fields.length === 0) {
    return await dbGet("SELECT * FROM notes WHERE id = ?", id);
  }

  fields.push("updatedAt = CURRENT_TIMESTAMP");
  values.push(id);

  const sql = `UPDATE notes SET ${fields.join(", ")} WHERE id = ?`;
  const result = await dbRun(sql, values);

  if (result.changes === 0) {
    return null;
  }
  return await dbGet("SELECT * FROM notes WHERE id = ?", id);
}

/**
 * 删除一个便签
 * @param {number} id - 便签 ID
 * @returns {Promise<boolean>} 是否成功删除
 */
async function deleteNote(id) {
  if (!db) throw new Error("数据库未初始化");
  const result = await dbRun("DELETE FROM notes WHERE id = ?", id);
  return result.changes > 0;
}

/**
 * 批量导入便签 (会先清空现有便签)
 * @param {Array<object>} notesToImport - 要导入的便签数组
 * @returns {Promise<number>} 成功导入的数量
 */
async function importNotes(notesToImport) {
  if (!db) throw new Error("数据库未初始化");
  console.log(
    `[DB importNotes] Starting import for ${notesToImport.length} notes.`
  ); // Log start

  // 使用 exec 进行事务处理更方便
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      // Use serialize to ensure sequential execution
      try {
        console.log("[DB importNotes] Beginning transaction..."); // Log transaction start
        await dbExec("BEGIN TRANSACTION");

        console.log("[DB importNotes] Deleting existing notes..."); // Log delete start
        await dbExec("DELETE FROM notes");
        console.log("[DB importNotes] Existing notes deleted."); // Log delete end

        const sql = `
          INSERT INTO notes (text, x, y, title, colorClass, zIndex, width, height, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        console.log("[DB importNotes] Preparing INSERT statement..."); // Log prepare start
        const stmt = db.prepare(sql);
        console.log("[DB importNotes] INSERT statement prepared."); // Log prepare end

        let importedCount = 0;
        for (const [index, note] of notesToImport.entries()) {
          // Add index for logging
          // console.log(`[DB importNotes] Processing note ${index + 1}/${notesToImport.length}:`, note); // Log each note (can be verbose)
          const text = note.text || "";
          const x = note.x || 50;
          const y = note.y || 50;
          const title = note.title || "";
          const colorClass = note.colorClass || "note-yellow";
          const zIndex = note.zIndex || 1;
          const width = note.width; // Keep as potentially undefined
          const height = note.height; // Keep as potentially undefined
          // Ensure dates are valid ISO strings or null/default
          const createdAt =
            note.createdAt && !isNaN(new Date(note.createdAt))
              ? new Date(note.createdAt).toISOString()
              : new Date().toISOString();
          const updatedAt =
            note.updatedAt && !isNaN(new Date(note.updatedAt))
              ? new Date(note.updatedAt).toISOString()
              : new Date().toISOString();

          // Use stmt.run with a promise wrapper
          await new Promise((res, rej) => {
            stmt.run(
              text,
              x,
              y,
              title,
              colorClass,
              zIndex,
              width,
              height,
              createdAt,
              updatedAt,
              function (err) {
                // Use standard function for 'this' context if needed, though not used here
                if (err) {
                  console.error(
                    `[DB importNotes] Error inserting note ${index + 1}:`,
                    err
                  ); // Log insert error
                  rej(err);
                } else {
                  // console.log(`[DB importNotes] Note ${index + 1} inserted successfully.`); // Log insert success (verbose)
                  res();
                }
              }
            );
          });
          importedCount++;
        }
        console.log(
          `[DB importNotes] Finished inserting ${importedCount} notes.`
        ); // Log loop end

        console.log("[DB importNotes] Finalizing statement..."); // Log finalize start
        await new Promise((res, rej) =>
          stmt.finalize((err) => (err ? rej(err) : res()))
        );
        console.log("[DB importNotes] Statement finalized."); // Log finalize end

        console.log("[DB importNotes] Committing transaction..."); // Log commit start
        await dbExec("COMMIT");
        console.log("[DB importNotes] Transaction committed."); // Log commit end
        resolve(importedCount);
      } catch (error) {
        console.error(
          "[DB importNotes] Error during import transaction:",
          error
        ); // Log transaction error
        try {
          console.warn(
            "[DB importNotes] Attempting to rollback transaction..."
          ); // Log rollback attempt
          await dbExec("ROLLBACK");
          console.warn("[DB importNotes] Transaction rolled back."); // Log rollback success
        } catch (rollbackError) {
          console.error(
            "[DB importNotes] Failed to rollback transaction:",
            rollbackError
          ); // Log rollback failure
        }
        reject(new Error("导入便签失败")); // Reject the main promise
      }
    });
  });
}

/**
 * 重置所有便签数据
 * @returns {Promise<void>}
 */
async function resetNotes() {
  if (!db) throw new Error("数据库未初始化");
  await dbExec("DELETE FROM notes");
}

/**
 * 验证用户登录
 * @param {string} username 用户名
 * @param {string} password 密码
 * @returns {Promise<object|null>} 用户对象或null
 */
async function validateUserLogin(username, password) {
  if (!db) throw new Error("数据库未初始化");

  try {
    // 1. 根据用户名查找用户及其密码哈希
    const user = await dbGet(
      "SELECT id, username, password FROM users WHERE username = ?",
      [username]
    );

    if (!user) {
      return null; // 用户不存在
    }

    // 2. 比较提供的密码和存储的哈希值
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      // 密码匹配，返回用户信息（不包含密码哈希）
      return { id: user.id, username: user.username };
    } else {
      return null; // 密码不匹配
    }
  } catch (error) {
    console.error("验证用户登录失败:", error);
    throw error;
  }
}

/**
 * 更新用户密码
 * @param {number} userId 用户ID
 * @param {string} newPassword 新密码
 * @returns {Promise<void>}
 */
async function updateUserPassword(userId, newPassword) {
  if (!db) throw new Error("数据库未初始化");

  try {
    // 哈希新密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await dbRun("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword, // 存储哈希后的密码
      userId,
    ]);
  } catch (error) {
    console.error("更新用户密码失败:", error);
    throw error;
  }
}

/**
 * 创建新的邀请码
 * @param {number} userId 创建者ID
 * @returns {Promise<object>} 邀请码对象
 */
async function createInviteCode(userId) {
  if (!db) throw new Error("数据库未初始化");

  // 生成随机邀请码
  const code = generateRandomCode(8);

  try {
    await dbRun(
      "INSERT INTO invitation_codes (code, created_by) VALUES (?, ?)",
      [code, userId]
    );

    return {
      code,
      createdAt: new Date().toISOString(),
      isUsed: false,
    };
  } catch (error) {
    console.error("创建邀请码失败:", error);
    throw error;
  }
}

/**
 * 获取所有可用的邀请码
 * @returns {Promise<Array>} 邀请码数组
 */
async function getAvailableInviteCodes() {
  if (!db) throw new Error("数据库未初始化");

  try {
    return await dbAll(
      `SELECT code, created_at as createdAt, created_by as createdBy,
      is_used as isUsed, used_by as usedBy, used_at as usedAt
      FROM invitation_codes
      WHERE is_used = 0
      ORDER BY created_at DESC`
    );
  } catch (error) {
    console.error("获取邀请码失败:", error);
    throw error;
  }
}

/**
 * 删除邀请码
 * @param {string} code 要删除的邀请码
 * @returns {Promise<boolean>} 是否成功删除
 */
async function deleteInviteCode(code) {
  if (!db) throw new Error("数据库未初始化");

  try {
    const result = await dbRun(
      "DELETE FROM invitation_codes WHERE code = ? AND is_used = 0",
      [code]
    );

    return result.changes > 0;
  } catch (error) {
    console.error("删除邀请码失败:", error);
    throw error;
  }
}

/**
 * 验证邀请码有效性
 * @param {string} code 邀请码
 * @returns {Promise<boolean>} 是否有效
 */
async function validateInviteCode(code) {
  if (!db) throw new Error("数据库未初始化");

  try {
    const inviteCode = await dbGet(
      "SELECT * FROM invitation_codes WHERE code = ? AND is_used = 0",
      [code]
    );

    return !!inviteCode;
  } catch (error) {
    console.error("验证邀请码失败:", error);
    throw error;
  }
}

/**
 * 标记邀请码为已使用
 * @param {string} code 邀请码
 * @param {number} userId 使用者ID
 * @returns {Promise<boolean>} 是否成功标记
 */
async function markInviteCodeAsUsed(code, userId) {
  if (!db) throw new Error("数据库未初始化");

  try {
    const result = await dbRun(
      "UPDATE invitation_codes SET is_used = 1, used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ? AND is_used = 0",
      [userId, code]
    );

    return result.changes > 0;
  } catch (error) {
    console.error("标记邀请码为已使用失败:", error);
    throw error;
  }
}

/**
 * 创建新用户
 * @param {string} username 用户名
 * @param {string} password 密码
 * @returns {Promise<object>} 创建的用户对象
 */
async function createUser(username, password) {
  if (!db) throw new Error("数据库未初始化");

  try {
    // 检查用户名是否已存在
    const existingUser = await dbGet(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    if (existingUser) {
      throw new Error("用户名已存在");
    }

    // 对密码进行哈希处理
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 创建新用户
    const result = await dbRun(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hashedPassword]
    );

    // 返回创建的用户对象（不包含密码）
    return {
      id: result.lastID,
      username,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("创建用户失败:", error);
    throw error;
  }
}

/**
 * 生成随机邀请码
 * @param {number} length 长度
 * @returns {string} 随机码
 */
function generateRandomCode(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// --- API 配置历史记录函数 ---

/**
 * 添加或更新 API 密钥历史记录
 * @param {string} apiKey - API 密钥
 * @returns {Promise<void>}
 */
async function addOrUpdateApiKeyHistory(apiKey) {
  if (!db) throw new Error("数据库未初始化");
  if (!apiKey || apiKey.trim() === "") return; // 不记录空值

  const trimmedKey = apiKey.trim();

  // 检查是否已存在此 API 密钥
  const existingKey = await dbGet(
    "SELECT id, use_count FROM api_key_history WHERE api_key = ?",
    [trimmedKey]
  );

  if (existingKey) {
    // 已存在，更新使用次数和最后使用时间
    await dbRun(
      "UPDATE api_key_history SET use_count = use_count + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?",
      [existingKey.id]
    );
  } else {
    // 新密钥，添加到历史记录
    await dbRun("INSERT INTO api_key_history (api_key) VALUES (?)", [
      trimmedKey,
    ]);
  }
}

/**
 * 添加或更新基础 URL 历史记录
 * @param {string} baseUrl - 基础 URL
 * @returns {Promise<void>}
 */
async function addOrUpdateBaseUrlHistory(baseUrl) {
  if (!db) throw new Error("数据库未初始化");
  if (!baseUrl || baseUrl.trim() === "") return; // 不记录空值

  const trimmedUrl = baseUrl.trim();

  // 检查是否已存在此基础 URL
  const existingUrl = await dbGet(
    "SELECT id, use_count FROM base_url_history WHERE base_url = ?",
    [trimmedUrl]
  );

  if (existingUrl) {
    // 已存在，更新使用次数和最后使用时间
    await dbRun(
      "UPDATE base_url_history SET use_count = use_count + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?",
      [existingUrl.id]
    );
  } else {
    // 新 URL，添加到历史记录
    await dbRun("INSERT INTO base_url_history (base_url) VALUES (?)", [
      trimmedUrl,
    ]);
  }
}

/**
 * 添加或更新模型名称历史记录
 * @param {string} modelName - 模型名称
 * @returns {Promise<void>}
 */
async function addOrUpdateModelHistory(modelName) {
  if (!db) throw new Error("数据库未初始化");
  if (!modelName || modelName.trim() === "") return; // 不记录空值

  const trimmedModelName = modelName.trim();

  // 检查是否已存在此模型名称
  const existingModel = await dbGet(
    "SELECT id, use_count FROM model_history WHERE model_name = ?",
    [trimmedModelName]
  );

  if (existingModel) {
    // 已存在，更新使用次数和最后使用时间
    await dbRun(
      "UPDATE model_history SET use_count = use_count + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?",
      [existingModel.id]
    );
  } else {
    // 新模型，添加到历史记录
    await dbRun("INSERT INTO model_history (model_name) VALUES (?)", [
      trimmedModelName,
    ]);
  }
}

/**
 * 获取 API 密钥历史记录列表
 * @param {number} limit - 限制返回数量，默认为10
 * @param {string} baseUrl - 可选的基础URL过滤条件
 * @returns {Promise<Array>} API 密钥历史记录数组
 */
async function getApiKeyHistory(limit = 10, baseUrl = null) {
  if (!db) throw new Error("数据库未初始化");

  // 如果提供了baseUrl，根据baseUrl过滤
  if (baseUrl) {
    // 查询与该baseUrl一起使用过的API密钥
    return await dbAll(
      `SELECT DISTINCT a.id, a.api_key as apiKey, a.created_at as createdAt, a.last_used as lastUsed, a.use_count as useCount
       FROM api_key_history a
       JOIN api_config_relations r ON r.api_key = a.api_key
       WHERE r.base_url = ?
       ORDER BY a.last_used DESC, a.use_count DESC
       LIMIT ?`,
      [baseUrl, limit]
    );
  } else {
    // 如果没有提供 baseUrl，返回所有历史记录
    return await dbAll(
      `SELECT id, api_key as apiKey, created_at as createdAt, last_used as lastUsed, use_count as useCount
       FROM api_key_history
       ORDER BY last_used DESC, use_count DESC
       LIMIT ?`,
      [limit]
    );
  }
}

/**
 * 获取基础 URL 历史记录列表
 * @param {number} limit - 限制返回数量，默认为10
 * @returns {Promise<Array>} 基础 URL 历史记录数组
 */
async function getBaseUrlHistory(limit = 10) {
  if (!db) throw new Error("数据库未初始化");
  return await dbAll(
    `SELECT id, base_url as baseUrl, created_at as createdAt, last_used as lastUsed, use_count as useCount
     FROM base_url_history
     ORDER BY last_used DESC, use_count DESC
     LIMIT ?`,
    [limit]
  );
}

/**
 * 获取模型名称历史记录列表
 * @param {number} limit - 限制返回数量，默认为10
 * @param {string} baseUrl - 可选的基础URL过滤条件
 * @returns {Promise<Array>} 模型名称历史记录数组
 */
async function getModelHistory(limit = 10, baseUrl = null) {
  if (!db) throw new Error("数据库未初始化");

  // 如果提供了baseUrl，根据baseUrl过滤
  if (baseUrl) {
    // 查询与该baseUrl一起使用过的模型
    return await dbAll(
      `SELECT DISTINCT m.id, m.model_name as modelName, m.created_at as createdAt, m.last_used as lastUsed, m.use_count as useCount
       FROM model_history m
       JOIN api_config_relations r ON r.model = m.model_name
       WHERE r.base_url = ?
       ORDER BY m.last_used DESC, m.use_count DESC
       LIMIT ?`,
      [baseUrl, limit]
    );
  } else {
    // 如果没有提供 baseUrl，返回所有历史记录
    return await dbAll(
      `SELECT id, model_name as modelName, created_at as createdAt, last_used as lastUsed, use_count as useCount
       FROM model_history
       ORDER BY last_used DESC, use_count DESC
       LIMIT ?`,
      [limit]
    );
  }
}

/**
 * 删除 API 密钥历史记录
 * @param {number} id - 记录 ID
 * @returns {Promise<boolean>} 是否成功删除
 */
async function deleteApiKeyHistory(id) {
  if (!db) throw new Error("数据库未初始化");
  const result = await dbRun("DELETE FROM api_key_history WHERE id = ?", [id]);
  return result.changes > 0;
}

/**
 * 删除基础 URL 历史记录
 * @param {number} id - 记录 ID
 * @returns {Promise<boolean>} 是否成功删除
 */
async function deleteBaseUrlHistory(id) {
  if (!db) throw new Error("数据库未初始化");
  const result = await dbRun("DELETE FROM base_url_history WHERE id = ?", [id]);
  return result.changes > 0;
}

/**
 * 删除模型名称历史记录
 * @param {number} id - 记录 ID
 * @returns {Promise<boolean>} 是否成功删除
 */
async function deleteModelHistory(id) {
  if (!db) throw new Error("数据库未初始化");
  const result = await dbRun("DELETE FROM model_history WHERE id = ?", [id]);
  return result.changes > 0;
}

/**
 * 添加或更新 API 配置关联
 * @param {string} baseUrl - 基础 URL
 * @param {string} apiKey - API 密钥
 * @param {string} model - 模型名称
 * @returns {Promise<void>}
 */
async function addOrUpdateApiConfigRelation(baseUrl, apiKey, model) {
  if (!db) throw new Error("数据库未初始化");
  if (!baseUrl || !apiKey || !model) return; // 不记录空值

  const trimmedUrl = baseUrl.trim();
  const trimmedKey = apiKey.trim();
  const trimmedModel = model.trim();

  // 检查是否已存在此关联
  const existingRelation = await dbGet(
    "SELECT id, use_count FROM api_config_relations WHERE base_url = ? AND api_key = ? AND model = ?",
    [trimmedUrl, trimmedKey, trimmedModel]
  );

  if (existingRelation) {
    // 已存在，更新使用次数和最后使用时间
    await dbRun(
      "UPDATE api_config_relations SET use_count = use_count + 1, last_used = CURRENT_TIMESTAMP WHERE id = ?",
      [existingRelation.id]
    );
  } else {
    // 新关联，添加到表中
    await dbRun(
      "INSERT INTO api_config_relations (base_url, api_key, model) VALUES (?, ?, ?)",
      [trimmedUrl, trimmedKey, trimmedModel]
    );
  }
}

/**
 * 获取与指定 URL 关联的 API 密钥列表
 * @param {string} baseUrl - 基础 URL
 * @param {number} limit - 限制返回数量，默认为10
 * @returns {Promise<Array>} API 密钥数组
 */
async function getApiKeysByBaseUrl(baseUrl, limit = 10) {
  if (!db) throw new Error("数据库未初始化");
  if (!baseUrl) return [];

  return await dbAll(
    `SELECT DISTINCT api_key as apiKey
     FROM api_config_relations
     WHERE base_url = ?
     ORDER BY last_used DESC, use_count DESC
     LIMIT ?`,
    [baseUrl, limit]
  );
}

/**
 * 获取与指定 URL 关联的模型列表
 * @param {string} baseUrl - 基础 URL
 * @param {number} limit - 限制返回数量，默认为10
 * @returns {Promise<Array>} 模型数组
 */
async function getModelsByBaseUrl(baseUrl, limit = 10) {
  if (!db) throw new Error("数据库未初始化");
  if (!baseUrl) return [];

  return await dbAll(
    `SELECT DISTINCT model as modelName
     FROM api_config_relations
     WHERE base_url = ?
     ORDER BY last_used DESC, use_count DESC
     LIMIT ?`,
    [baseUrl, limit]
  );
}

/**
 * 清除所有 API 配置历史记录
 * @returns {Promise<boolean>} 是否成功清除
 */
async function clearAllApiHistory() {
  if (!db) throw new Error("数据库未初始化");

  try {
    // 开始事务
    await dbRun("BEGIN TRANSACTION");

    // 清除所有历史记录表
    await dbRun("DELETE FROM api_key_history");
    await dbRun("DELETE FROM base_url_history");
    await dbRun("DELETE FROM model_history");
    await dbRun("DELETE FROM api_config_relations");

    // 提交事务
    await dbRun("COMMIT");
    return true;
  } catch (error) {
    // 出错时回滚
    await dbRun("ROLLBACK");
    console.error("清除API历史记录失败:", error);
    return false;
  }
}

// --- 用户分享相关函数 ---

/**
 * 获取用户的分享信息
 * @param {number} userId - 用户ID
 * @returns {Promise<object|null>} 分享信息对象或null
 */
async function getUserShareInfo(userId) {
  if (!db) throw new Error("数据库未初始化");

  try {
    const user = await dbGet(
      "SELECT share_id, share_link, share_status, share_canvas_name, share_notes, share_canvas_state FROM users WHERE id = ?",
      [userId]
    );

    if (!user) return null;

    // 解析画布状态JSON（如果有）
    let canvasState = null;
    if (user.share_canvas_state) {
      try {
        canvasState = JSON.parse(user.share_canvas_state);
      } catch (e) {
        console.warn("解析画布状态JSON失败:", e);
      }
    }

    return {
      shareId: user.share_id,
      shareLink: user.share_link,
      shareStatus: user.share_status === 1,
      canvasName: user.share_canvas_name || "InfinityNotes",
      shareNotes: user.share_notes === 1,
      canvasState: canvasState,
    };
  } catch (error) {
    console.error("获取用户分享信息失败:", error);
    throw error;
  }
}

/**
 * 更新用户的分享信息
 * @param {number} userId - 用户ID
 * @param {object} shareInfo - 分享信息对象
 * @returns {Promise<boolean>} 是否成功更新
 */
async function updateUserShareInfo(userId, shareInfo) {
  if (!db) throw new Error("数据库未初始化");

  try {
    const {
      shareId,
      shareLink,
      shareStatus,
      canvasName,
      shareNotes,
      canvasState,
    } = shareInfo;

    // 将画布状态转换为JSON字符串（如果有）
    let canvasStateJson = null;
    if (canvasState) {
      canvasStateJson = JSON.stringify(canvasState);
    }

    const result = await dbRun(
      `UPDATE users SET
        share_id = ?,
        share_link = ?,
        share_status = ?,
        share_canvas_name = ?,
        share_notes = ?,
        share_canvas_state = ?
      WHERE id = ?`,
      [
        shareId,
        shareLink,
        shareStatus ? 1 : 0,
        canvasName,
        shareNotes ? 1 : 0,
        canvasStateJson,
        userId,
      ]
    );

    return result.changes > 0;
  } catch (error) {
    console.error("更新用户分享信息失败:", error);
    throw error;
  }
}

/**
 * 关闭用户的分享
 * @param {number} userId - 用户ID
 * @returns {Promise<boolean>} 是否成功关闭
 */
async function closeUserShare(userId) {
  if (!db) throw new Error("数据库未初始化");

  try {
    const result = await dbRun(
      `UPDATE users SET
        share_status = 0
      WHERE id = ?`,
      [userId]
    );

    return result.changes > 0;
  } catch (error) {
    console.error("关闭用户分享失败:", error);
    throw error;
  }
}

/**
 * 根据分享ID获取用户信息
 * @param {string} shareId - 分享ID
 * @returns {Promise<object|null>} 用户对象或null
 */
async function getUserByShareId(shareId) {
  if (!db) throw new Error("数据库未初始化");

  try {
    const user = await dbGet(
      "SELECT id, username, share_status, share_canvas_name, share_notes, share_canvas_state FROM users WHERE share_id = ?",
      [shareId]
    );

    if (!user) {
      return { notFound: true };
    }

    if (user.share_status !== 1) {
      return {
        closed: true,
        canvasName: user.share_canvas_name || "InfinityNotes",
      };
    }

    // 解析画布状态JSON（如果有）
    let canvasState = null;
    if (user.share_canvas_state) {
      try {
        canvasState = JSON.parse(user.share_canvas_state);
      } catch (e) {
        console.warn("解析画布状态JSON失败:", e);
      }
    }

    return {
      id: user.id,
      username: user.username,
      canvasName: user.share_canvas_name || "InfinityNotes",
      shareNotes: user.share_notes === 1,
      canvasState: canvasState,
    };
  } catch (error) {
    console.error("根据分享ID获取用户信息失败:", error);
    throw error;
  }
}

export {
  initializeDatabase,
  // Settings functions
  getSetting,
  setSetting,
  getAllAiSettings,
  // Notes functions
  getAllNotes,
  addNote,
  updateNote,
  deleteNote,
  importNotes,
  resetNotes,
  // Export the database file path
  dbFilePath,
  validateUserLogin,
  updateUserPassword,
  createUser,
  createInviteCode,
  getAvailableInviteCodes,
  deleteInviteCode,
  validateInviteCode,
  markInviteCodeAsUsed,
  // API 配置历史记录函数
  addOrUpdateApiKeyHistory,
  addOrUpdateBaseUrlHistory,
  addOrUpdateModelHistory,
  getApiKeyHistory,
  getBaseUrlHistory,
  getModelHistory,
  deleteApiKeyHistory,
  deleteBaseUrlHistory,
  deleteModelHistory,
  clearAllApiHistory,
  // API 配置关联函数
  addOrUpdateApiConfigRelation,
  getApiKeysByBaseUrl,
  getModelsByBaseUrl,
  // 用户分享相关函数
  getUserShareInfo,
  updateUserShareInfo,
  closeUserShare,
  getUserByShareId,
};
