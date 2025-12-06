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

// توجيه الملفات الثابتة من مجلد 'public'
app.use(express.static('public'));

// توجيه الصفحة الرئيسية لتقديم index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// إعدادات Multer لحفظ الملفات
// ============================================
// التأكد من وجود مجلد uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
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

    // إدخال البيانات الأولية للمعايير (تم تقسيمها لحل مشكلة صياغة SQL)
    await pool.query(`
        INSERT INTO standards (id, code, name, description) VALUES
        (1, 'ASTM', 'معايير ASTM الأمريكية', 'معايير الجمعية الأمريكية للاختبار والمواد')
        ON CONFLICT (id) DO NOTHING;
    `);
    await pool.query(`
        INSERT INTO standards (id, code, name, description) VALUES
        (2, 'ACI', 'معايير ACI الخرسانية', 'معايير معهد الخرسانة الأمريكي')
        ON CONFLICT (id) DO NOTHING;
    `);
    await pool.query(`
        INSERT INTO standards (id, code, name, description) VALUES
        (3, 'BS', 'معايير BS البريطانية', 'معايير المواصفات البريطانية')
        ON CONFLICT (id) DO NOTHING;
    `);
    await pool.query(`
        INSERT INTO standards (id, code, name, description) VALUES
        (4, 'OTHER', 'أكواد أخرى', 'معايير دولية وإقليمية أخرى')
        ON CONFLICT (id) DO NOTHING;
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

    console.log('✅ تم تهيئة قاعدة البيانات والجداول بنجاح');
  } catch (err) {
    console.error('❌ خطأ في تهيئة قاعدة البيانات:', err);
  }
}

// تشغيل الدالة عند بدء التشغيل
initializeDatabase();

// ============================================
// API Endpoints - Middleware
// ============================================

// Middleware للتحقق من صلاحيات الأدمن
function requireAdmin(req, res, next) {
    const adminToken = req.header('X-Admin-Token');
    // كلمة السر هي elkasaby2025 (مخزنة في .env)
    if (adminToken === process.env.ADMIN_PASSWORD) {
        next();
    } else {
        res.status(401).json({ message: 'غير مصرح لك. يجب تسجيل الدخول كأدمن.' });
    }
}

// ============================================
// API Endpoints - تسجيل الدخول والملفات
// ============================================

// 1. نقطة نهاية تسجيل الدخول
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        // نستخدم كلمة السر كتوكن بسيط
        res.json({ message: 'تم تسجيل الدخول بنجاح.', token: process.env.ADMIN_PASSWORD });
    } else {
        res.status(401).json({ message: 'كلمة السر غير صحيحة.' });
    }
});

// 2. نقطة نهاية رفع الملفات (محمية بكلمة سر الأدمن)
app.post('/api/files/upload', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم اختيار ملف' });
    }

    const { standardId, title, description } = req.body;

    if (!standardId || !title) {
      // حذف الملف المرفوع في حالة الخطأ
      fs.unlink(req.file.path, () => {});
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

// 3. تحميل ملف (زيادة عدد التحميلات وإرسال الملف)
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

// 4. تعديل بيانات ملف (محمي بكلمة سر الأدمن)
app.put('/api/files/:id', requireAdmin, async (req, res) => {
    try {
        const fileId = req.params.id;
        const { standardId, title, description } = req.body;

        if (!standardId || !title) {
            return res.status(400).json({ error: 'معرف المعيار والعنوان مطلوبان للتعديل' });
        }

        const result = await pool.query(
            `UPDATE files SET standard_id = $1, title = $2, description = $3 WHERE id = $4 RETURNING id`,
            [standardId, title, description || '', fileId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'الملف غير موجود' });
        }

        res.json({ success: true, message: 'تم تعديل بيانات الملف بنجاح.' });
    } catch (err) {
        console.error('خطأ في تعديل الملف:', err);
        res.status(500).json({ error: 'خطأ في تعديل بيانات الملف' });
    }
});

// 5. حذف ملف (محمي بكلمة سر الأدمن)
app.delete('/api/files/:id', requireAdmin, async (req, res) => {
    try {
        const fileId = req.params.id;

        // 1. جلب اسم الملف من قاعدة البيانات
        const fileResult = await pool.query('SELECT filename FROM files WHERE id = $1', [fileId]);
        if (fileResult.rows.length === 0) {
            return res.status(404).json({ error: 'الملف غير موجود' });
        }
        const filename = fileResult.rows[0].filename;

        // 2. حذف الملف من مجلد uploads
        const filePath = path.join(__dirname, 'uploads', filename);
        fs.unlink(filePath, (err) => {
            if (err) console.error('فشل حذف الملف من النظام:', err);
        });

        // 3. حذف سجل الملف من قاعدة البيانات
        const deleteResult = await pool.query('DELETE FROM files WHERE id = $1 RETURNING id', [fileId]);

        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ error: 'الملف غير موجود في قاعدة البيانات' });
        }

        res.json({ success: true, message: 'تم حذف الملف بنجاح.' });
    } catch (err) {
        console.error('خطأ في حذف الملف:', err);
        res.status(500).json({ error: 'خطأ في حذف الملف' });
    }
});

// ============================================
// API Endpoints - الإحصائيات والمعايير والتقييمات
// ============================================

// 6. جلب الإحصائيات
app.get('/api/statistics', async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                s.code, 
                s.name, 
                COUNT(f.id) AS file_count, 
                COALESCE(SUM(f.downloads), 0) AS total_downloads
            FROM standards s
            LEFT JOIN files f ON s.id = f.standard_id
            GROUP BY s.id, s.code, s.name
            ORDER BY s.id;
        `);
        res.json(stats.rows.map(row => ({
            code: row.code,
            name: row.name,
            fileCount: parseInt(row.file_count),
            totalDownloads: parseInt(row.total_downloads)
        })));
    } catch (err) {
        console.error('خطأ في جلب الإحصائيات:', err);
        res.status(500).json({ error: 'خطأ في جلب الإحصائيات' });
    }
});

// 7. جلب المعايير
app.get('/api/standards', async (req, res) => {
    try {
        const standards = await pool.query('SELECT id, code, name, description FROM standards ORDER BY id');
        res.json(standards.rows);
    } catch (err) {
        console.error('خطأ في جلب المعايير:', err);
        res.status(500).json({ error: 'خطأ في جلب المعايير' });
    }
});

// 8. جلب ملفات معيار محدد
app.get('/api/standards/:id/files', async (req, res) => {
    try {
        const standardId = req.params.id;
        const files = await pool.query('SELECT id, title, description, downloads FROM files WHERE standard_id = $1 ORDER BY uploaded_at DESC', [standardId]);
        res.json(files.rows);
    } catch (err) {
        console.error('خطأ في جلب ملفات المعيار:', err);
        res.status(500).json({ error: 'خطأ في جلب ملفات المعيار' });
    }
});

// 9. البحث عن ملفات
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.query;
        if (!query) {
            return res.json([]);
        }
        const searchPattern = `%${query}%`;
        const files = await pool.query(`
            SELECT f.id, f.title, f.description, f.downloads, s.code 
            FROM files f
            JOIN standards s ON f.standard_id = s.id
            WHERE f.title ILIKE $1 OR f.description ILIKE $1
            ORDER BY f.uploaded_at DESC
        `, [searchPattern]);
        res.json(files.rows);
    } catch (err) {
        console.error('خطأ في البحث عن الملفات:', err);
        res.status(500).json({ error: 'خطأ في البحث عن الملفات' });
    }
});

// 10. جلب ملخص التقييمات
app.get('/api/ratings/summary', async (req, res) => {
    try {
        const summary = await pool.query('SELECT AVG(score) AS average_score, COUNT(id) AS total_ratings FROM ratings');
        res.json({
            average_score: summary.rows[0].average_score || 0,
            total_ratings: parseInt(summary.rows[0].total_ratings) || 0
        });
    } catch (err) {
        console.error('خطأ في جلب ملخص التقييمات:', err);
        res.status(500).json({ error: 'خطأ في جلب ملخص التقييمات' });
    }
});

// 11. إرسال تقييم جديد
app.post('/api/ratings', async (req, res) => {
    try {
        const { score, comment } = req.body;
        if (!score || score < 1 || score > 5) {
            return res.status(400).json({ error: 'التقييم (score) يجب أن يكون بين 1 و 5.' });
        }
        
        await pool.query('INSERT INTO ratings (score, comment) VALUES ($1, $2)', [score, comment || null]);
        res.status(201).json({ message: 'تم إرسال التقييم بنجاح.' });
    } catch (err) {
        console.error('خطأ في إرسال التقييم:', err);
        res.status(500).json({ error: 'خطأ في إرسال التقييم' });
    }
});


// ============================================
// تشغيل الخادم
// ============================================
app.listen(port, () => {
  console.log(`Your service is live 🎉 on port ${port}`);
});
