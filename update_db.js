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

// 添加分享相关字段
db.serialize(() => {
  // 检查字段是否存在
  db.all("PRAGMA table_info(users)", (err, rows) => {
    if (err) {
      console.error('获取表结构失败:', err.message);
      db.close();
      process.exit(1);
    }
    
    console.log('当前users表结构:');
    console.table(rows);
    
    // 检查是否有分享相关字段
    const shareFields = [
      { name: 'share_id', type: 'TEXT' },
      { name: 'share_link', type: 'TEXT' },
      { name: 'share_status', type: 'INTEGER', default: '0' },
      { name: 'share_canvas_name', type: 'TEXT' },
      { name: 'share_notes', type: 'INTEGER', default: '1' }
    ];
    
    const existingFields = rows.map(row => row.name);
    const missingFields = shareFields.filter(field => 
      !existingFields.includes(field.name)
    );
    
    if (missingFields.length > 0) {
      console.log('需要添加以下字段:', missingFields.map(f => f.name).join(', '));
      
      // 添加缺少的字段
      db.serialize(() => {
        missingFields.forEach(field => {
          const defaultValue = field.default ? ` DEFAULT ${field.default}` : '';
          const sql = `ALTER TABLE users ADD COLUMN ${field.name} ${field.type}${defaultValue}`;
          console.log('执行SQL:', sql);
          
          db.run(sql, (err) => {
            if (err) {
              console.error(`添加字段 ${field.name} 失败:`, err.message);
            } else {
              console.log(`成功添加字段 ${field.name}`);
            }
          });
        });
        
        // 完成后检查表结构
        setTimeout(() => {
          db.all("PRAGMA table_info(users)", (err, updatedRows) => {
            if (err) {
              console.error('获取更新后的表结构失败:', err.message);
            } else {
              console.log('更新后的users表结构:');
              console.table(updatedRows);
            }
            
            // 关闭数据库连接
            db.close();
          });
        }, 1000);
      });
    } else {
      console.log('所有分享相关字段都已存在');
      db.close();
    }
  });
});
