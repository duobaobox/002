import sqlite3 from "sqlite3";
// import { open } from 'sqlite/build/esm/index.js'; // Remove sqlite wrapper import
import path from "path";
import fs from "fs";

// 确保 data 目录存在
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFilePath = path.join(dataDir, "notes.db");
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

        resolve(); // Initialization successful
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

  // 使用 exec 进行事务处理更方便
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      // Use serialize to ensure sequential execution
      try {
        await dbExec("BEGIN TRANSACTION");
        await dbExec("DELETE FROM notes");

        const sql = `
                    INSERT INTO notes (text, x, y, title, colorClass, zIndex, width, height, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
        // Prepare statement within the transaction
        const stmt = db.prepare(sql);

        let importedCount = 0;
        for (const note of notesToImport) {
          const text = note.text || "";
          const x = note.x || 50;
          const y = note.y || 50;
          const title = note.title || "";
          const colorClass = note.colorClass || "note-yellow";
          const zIndex = note.zIndex || 1;
          const width = note.width;
          const height = note.height;
          const createdAt = note.createdAt || new Date().toISOString();
          const updatedAt = note.updatedAt || new Date().toISOString();

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
                if (err) rej(err);
                else res();
              }
            );
          });
          importedCount++;
        }
        await new Promise((res, rej) =>
          stmt.finalize((err) => (err ? rej(err) : res()))
        ); // Finalize statement

        await dbExec("COMMIT");
        resolve(importedCount);
      } catch (error) {
        console.error("导入便签时发生错误:", error);
        try {
          await dbExec("ROLLBACK"); // Attempt rollback
        } catch (rollbackError) {
          console.error("回滚事务失败:", rollbackError);
        }
        reject(new Error("导入便签失败"));
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
};
