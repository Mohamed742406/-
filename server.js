// ============================================
// منصة محمد القصبي لإدارة المواصفات الهندسية
// Back-end: Node.js + Express + PostgreSQL
// ============================================

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 4000;

// ============================================
// إعدادات Middleware
// ============================================
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// توجيه الصفحة الرئيسية لتقديم index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// إعدادات Multer لحفظ الملفات
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 150 * 1024 * 1024 } // 150MB
});

// ============================================
// إعدادات قاعدة البيانات PostgreSQL
// ============================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('خطأ في تجمع الاتصالات:', err);
});

pool.on('connect', () => {
  console.log('تم الاتصال بقاعدة البيانات بنجاح');
});

// ============================================
// تهيئة قاعدة البيانات والجداول
// ============================================
async function initializeDatabase() {
  try {
    // جدول المعايير (Standards)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS standards (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // جدول الملفات (Files)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        standard_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        downloads INTEGER DEFAULT 0,
        FOREIGN KEY (standard_id) REFERENCES standards(id)
      )
    `);

    // جدول التقييمات (Ratings)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ تم إنشاء جميع الجداول بنجاح');

    // إدراج البيانات الأولية للمعايير
    insertInitialStandards();
  } catch (err) {
    console.error('❌ خطأ في تهيئة قاعدة البيانات:', err);
  }
}

// ============================================
// إدراج البيانات الأولية
// ============================================
async function insertInitialStandards() {
  const standards = [
    {
      code: 'ASTM',
      name: 'معايير ASTM الأمريكية',
      description: 'معايير الجمعية الأمريكية للاختبار والمواد',
      icon: '🧪'
    },
    {
      code: 'ACI',
      name: 'معايير ACI الخرسانية',
      description: 'معايير معهد الخرسانة الأمريكي',
      icon: '🏗️'
    },
    {
      code: 'BS',
      name: 'معايير BS البريطانية',
      description: 'معايير المواصفات البريطانية',
      icon: '🇬🇧'
    },
    {
      code: 'OTHER',
      name: 'معايير أخرى',
      description: 'معايير دولية وإقليمية أخرى',
      icon: '📋'
    }
  ];

  for (const std of standards) {
    try {
      await pool.query(
        `INSERT INTO standards (code, name, description, icon) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO NOTHING`,
        [std.code, std.name, std.description, std.icon]
      );
    } catch (err) {
      console.error('خطأ في إدراج المعيار:', err);
    }
  }
}

// ============================================
// Middleware للتحقق من صلاحيات الأدمن
// ============================================
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!token || token !== adminPassword) {
    return res.status(401).json({ error: 'غير مصرح - كلمة سر الأدمن غير صحيحة' });
  }

  next();
}

// ============================================
// API Endpoints
// ============================================

// 1. الحصول على جميع المعايير
app.get('/api/standards', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, code, name, description, icon FROM standards`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('خطأ في جلب المعايير:', err);
    res.status(500).json({ error: 'خطأ في جلب المعايير' });
  }
});

// 2. الحصول على الإحصائيات
app.get('/api/statistics', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        s.id, 
        s.code, 
        s.name, 
        COUNT(f.id) as fileCount,
        COALESCE(SUM(f.downloads), 0) as totalDownloads
      FROM standards s
      LEFT JOIN files f ON s.id = f.standard_id
      GROUP BY s.id, s.code, s.name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('خطأ في جلب الإحصائيات:', err);
    res.status(500).json({ error: 'خطأ في جلب الإحصائيات' });
  }
});

// 3. الحصول على ملفات معيار معين
app.get('/api/standards/:id/files', async (req, res) => {
  try {
    const standardId = req.params.id;
    const result = await pool.query(
      `SELECT id, title, description, original_name, uploaded_at, downloads 
       FROM files WHERE standard_id = $1 ORDER BY uploaded_at DESC`,
      [standardId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('خطأ في جلب الملفات:', err);
    res.status(500).json({ error: 'خطأ في جلب الملفات' });
  }
});

// 4. تحميل ملف (زيادة عدد التحميلات وإرسال الملف)
app.get('/api/files/:id/download', async (req, res) => {
  try {
    const fileId = req.params.id;
    
    const result = await pool.query(
      `SELECT id, filename, original_name FROM files WHERE id = $1`,
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }

    const file = result.rows[0];

    // زيادة عدد التحميلات
    await pool.query(
      `UPDATE files SET downloads = downloads + 1 WHERE id = $1`,
      [fileId]
    );

    // إرسال الملف
    const filePath = path.join(__dirname, 'uploads', file.filename);
    res.download(filePath, file.original_name, (err) => {
      if (err) {
        console.error('خطأ في تحميل الملف:', err);
      }
    });
  } catch (err) {
    console.error('خطأ في تحميل الملف:', err);
    res.status(500).json({ error: 'خطأ في تحميل الملف' });
  }
});

// 5. رفع ملف جديد (محمي بكلمة سر الأدمن)
app.post('/api/files/upload', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم اختيار ملف' });
    }

    const { standardId, title, description } = req.body;

    if (!standardId || !title) {
      return res.status(400).json({ error: 'معرف المعيار والعنوان مطلوبان' });
    }

    const result = await pool.query(
      `INSERT INTO files (standard_id, title, description, filename, original_name) 
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [standardId, title, description || '', req.file.filename, req.file.originalname]
    );

    res.json({
      success: true,
      message: 'تم رفع الملف بنجاح',
      fileId: result.rows[0].id
    });
  } catch (err) {
    // حذف الملف المرفوع في حالة الخطأ
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    console.error('خطأ في رفع الملف:', err);
    res.status(500).json({ error: 'خطأ في حفظ الملف' });
  }
});

// 6. حذف ملف (أدمن فقط)
app.delete('/api/files/:id', requireAdmin, async (req, res) => {
  try {
    const fileId = req.params.id;

    const result = await pool.query(
      `SELECT filename FROM files WHERE id = $1`,
      [fileId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }

    const file = result.rows[0];

    // حذف الملف من النظام
    const filePath = path.join(__dirname, 'uploads', file.filename);
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        console.error('خطأ في حذف الملف:', err);
      }
    });

    // حذف من قاعدة البيانات
    await pool.query(
      `DELETE FROM files WHERE id = $1`,
      [fileId]
    );

    res.json({ success: true, message: 'تم حذف الملف بنجاح' });
  } catch (err) {
    console.error('خطأ في حذف الملف:', err);
    res.status(500).json({ error: 'خطأ في حذف الملف' });
  }
});

// 7. البحث عن ملفات
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.query || '';

    if (!query.trim()) {
      return res.json([]);
    }

    const searchTerm = `%${query}%`;
    const result = await pool.query(
      `SELECT id, title, description, original_name, uploaded_at, downloads 
       FROM files 
       WHERE title ILIKE $1 OR description ILIKE $2
       ORDER BY uploaded_at DESC`,
      [searchTerm, searchTerm]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('خطأ في البحث:', err);
    res.status(500).json({ error: 'خطأ في البحث' });
  }
});

// 8. إضافة تقييم
app.post('/api/ratings', async (req, res) => {
  try {
    const { score, comment } = req.body;

    // التحقق من صحة البيانات
    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ error: 'التقييم يجب أن يكون بين 1 و 5' });
    }

    const result = await pool.query(
      `INSERT INTO ratings (score, comment) VALUES ($1, $2)
       RETURNING id`,
      [score, comment || '']
    );

    res.json({
      success: true,
      message: 'شكراً لتقييمك',
      ratingId: result.rows[0].id
    });
  } catch (err) {
    console.error('خطأ في حفظ التقييم:', err);
    res.status(500).json({ error: 'خطأ في حفظ التقييم' });
  }
});

// 9. الحصول على ملخص التقييمات
app.get('/api/ratings/summary', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as totalRatings,
        AVG(score) as averageScore,
        MIN(score) as minScore,
        MAX(score) as maxScore
      FROM ratings`
    );

    const row = result.rows[0];
    res.json({
      totalRatings: parseInt(row.totalratings) || 0,
      averageScore: row.averagescore ? parseFloat(row.averagescore).toFixed(2) : 0,
      minScore: row.minscore || 0,
      maxScore: row.maxscore || 0
    });
  } catch (err) {
    console.error('خطأ في جلب ملخص التقييمات:', err);
    res.status(500).json({ error: 'خطأ في جلب ملخص التقييمات' });
  }
});

// 10. تسجيل دخول الأدمن
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: 'كلمة السر غير صحيحة' });
  }

  res.json({
    success: true,
    token: adminPassword,
    message: 'تم تسجيل الدخول بنجاح'
  });
});

// 11. التحقق من حالة الأدمن
app.get('/api/admin/status', (req, res) => {
  const token = req.headers['x-admin-token'];
  const adminPassword = process.env.ADMIN_PASSWORD;
  const isAdmin = token === adminPassword;

  res.json({ isAdmin });
});

// ============================================
// معالجة الأخطاء العامة
// ============================================
app.use((err, req, res, next) => {
  console.error('خطأ:', err);
  res.status(500).json({ error: 'حدث خطأ في الخادم' });
});

// ============================================
// بدء الخادم
// ============================================
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 منصة محمد القصبي تعمل على http://0.0.0.0:${port}`);
  console.log(`📁 مجلد الملفات: ${path.join(__dirname, 'uploads')}`);
  console.log(`💾 قاعدة البيانات: PostgreSQL`);
  
  // تهيئة قاعدة البيانات
  initializeDatabase();
});

// ============================================
// ملاحظات للتخصيص:
// 1. تم التحول من SQLite إلى PostgreSQL
// 2. يتم الاتصال بـ PostgreSQL عبر متغير البيئة DATABASE_URL
// 3. في Render، سيتم توفير DATABASE_URL تلقائياً
// 4. لتغيير كلمة سر الأدمن: عدّل متغير ADMIN_PASSWORD في ملف .env
// ============================================
