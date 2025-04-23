const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 打开数据库连接
const db = new sqlite3.Database(path.join(__dirname, 'data', 'app_data.db'), (err) => {
  if (err) {
    console.error('打开数据库失败:', err.message);
    process.exit(1);
  }
  console.log('已连接到数据库');
});

// 获取users表的结构
db.all("PRAGMA table_info(users)", (err, rows) => {
  if (err) {
    console.error('获取表结构失败:', err.message);
    db.close();
    process.exit(1);
  }
  
  console.log('users表结构:');
  console.table(rows);
  
  // 检查是否有分享相关字段
  const shareFields = ['share_id', 'share_link', 'share_status', 'share_canvas_name', 'share_notes'];
  const missingFields = shareFields.filter(field => 
    !rows.some(row => row.name === field)
  );
  
  if (missingFields.length > 0) {
    console.log('缺少以下分享相关字段:', missingFields);
  } else {
    console.log('所有分享相关字段都存在');
  }
  
  // 关闭数据库连接
  db.close();
});
