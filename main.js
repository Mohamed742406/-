/* ============================================
   منصة محمد القصبي - منطق JavaScript
   ربط الواجهة الأمامية بالـ API الخلفي
   ============================================ */

// ============================================
// متغيرات عامة
// ============================================
let adminToken = localStorage.getItem('adminToken') || null;
let currentStandardId = null;

// ============================================
// عند تحميل الصفحة
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 تم تحميل الصفحة بنجاح');
  
  // تحميل البيانات الأساسية
  loadStatistics();
  loadStandards();
  loadFiles();
  loadRatingSummary();
  
  // التحقق من حالة الأدمن
  checkAdminStatus();
  
  // ربط الأحداث
  setupEventListeners();
});

// ============================================
// تحميل الإحصائيات
// ============================================
function loadStatistics() {
  fetch('/api/statistics')
    .then(response => response.json())
    .then(data => {
      const grid = document.getElementById('statisticsGrid');
      grid.innerHTML = '';
      
      data.forEach(stat => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        card.innerHTML = `
          <div class="stat-card-content">
            <div class="stat-code">${stat.code}</div>
            <div class="stat-name">${stat.name}</div>
            <div class="stat-info">
              <span>📁 الملفات: <span class="stat-count">${stat.fileCount}</span></span>
              <span>⬇️ التحميلات: <span class="stat-count">${stat.totalDownloads}</span></span>
            </div>
          </div>
        `;
        grid.appendChild(card);
      });
    })
    .catch(error => console.error('خطأ في تحميل الإحصائيات:', error));
}

// ============================================
// تحميل المعايير
// ============================================
function loadStandards() {
  fetch('/api/standards')
    .then(response => response.json())
    .then(data => {
      const grid = document.getElementById('standardsGrid');
      grid.innerHTML = '';
      
      // ملء قائمة اختيار المعايير في Modal الرفع
      const select = document.getElementById('standardSelect');
      select.innerHTML = '<option value="">اختر المعيار</option>';
      
      data.forEach(standard => {
        // إضافة كارت المعيار
        const card = document.createElement('div');
        card.className = 'standard-card';
        card.innerHTML = `
          <div class="standard-icon">${standard.icon || '📋'}</div>
          <div class="standard-name">${standard.name}</div>
          <div class="standard-description">${standard.description || ''}</div>
        `;
        card.addEventListener('click', () => showStandardFiles(standard.id, standard.name));
        grid.appendChild(card);
        
        // إضافة خيار في القائمة
        const option = document.createElement('option');
        option.value = standard.id;
        option.textContent = standard.name;
        select.appendChild(option);
      });
    })
    .catch(error => console.error('خطأ في تحميل المعايير:', error));
}

// ============================================
// عرض ملفات المعيار
// ============================================
function showStandardFiles(standardId, standardName) {
  currentStandardId = standardId;
  
  fetch(`/api/standards/${standardId}/files`)
    .then(response => response.json())
    .then(files => {
      const modal = document.getElementById('standardFilesModal');
      const title = document.getElementById('standardFilesTitle');
      const list = document.getElementById('standardFilesList');
      
      title.textContent = `ملفات ${standardName}`;
      list.innerHTML = '';
      
      if (files.length === 0) {
        list.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b;">لا توجد ملفات حالياً</p>';
      } else {
        files.forEach(file => {
          const item = document.createElement('div');
          item.className = 'file-item';
          item.innerHTML = `
            <div class="file-item-icon">📄</div>
            <div class="file-item-name">${file.title}</div>
            <div class="file-item-downloads">⬇️ ${file.downloads}</div>
            <button class="file-item-download-btn" onclick="downloadFile(${file.id})">تحميل</button>
          `;
          list.appendChild(item);
        });
      }
      
      modal.style.display = 'flex';
    })
    .catch(error => {
      console.error('خطأ في تحميل ملفات المعيار:', error);
      alert('خطأ في تحميل الملفات');
    });
}

// ============================================
// تحميل الملفات العامة
// ============================================
function loadFiles() {
  // في البداية، نعرض رسالة أو نحمل جميع الملفات من جميع المعايير
  // يمكن تحسين هذا لاحقاً
  const grid = document.getElementById('filesGrid');
  grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b;">استخدم البحث أو اختر معيار لعرض الملفات</p>';
}

// ============================================
// تحميل ملف
// ============================================
function downloadFile(fileId) {
  window.location.href = `/api/files/${fileId}/download`;
}

// ============================================
// البحث عن ملفات
// ============================================
const searchInput = document.getElementById('searchInput');
let searchTimeout;

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (!query) {
      document.getElementById('searchResults').style.display = 'none';
      return;
    }
    
    searchTimeout = setTimeout(() => {
      fetch(`/api/search?query=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(results => {
          const resultsDiv = document.getElementById('searchResults');
          resultsDiv.innerHTML = '';
          
          if (results.length === 0) {
            resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b;">لا توجد نتائج</div>';
          } else {
            results.forEach(file => {
              const item = document.createElement('div');
              item.className = 'search-result-item';
              item.innerHTML = `
                <div class="search-result-title">${file.title}</div>
                <div class="search-result-desc">${file.description || ''}</div>
              `;
              item.addEventListener('click', () => downloadFile(file.id));
              resultsDiv.appendChild(item);
            });
          }
          
          resultsDiv.style.display = 'block';
        })
        .catch(error => console.error('خطأ في البحث:', error));
    }, 300);
  });
}

// ============================================
// تحميل ملخص التقييمات
// ============================================
function loadRatingSummary() {
  fetch('/api/ratings/summary')
    .then(response => response.json())
    .then(data => {
      const summaryDiv = document.getElementById('ratingSummary');
      summaryDiv.innerHTML = `
        <div class="rating-summary-item">
          <span class="rating-summary-label">عدد التقييمات:</span>
          <span class="rating-summary-value">${data.totalRatings}</span>
        </div>
        <div class="rating-summary-item">
          <span class="rating-summary-label">متوسط التقييم:</span>
          <span class="rating-summary-value">${data.averageScore.toFixed(1)} ⭐</span>
        </div>
      `;
    })
    .catch(error => console.error('خطأ في تحميل ملخص التقييمات:', error));
}

// ============================================
// إرسال تقييم
// ============================================
const ratingForm = document.getElementById('ratingForm');
if (ratingForm) {
  ratingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const score = document.querySelector('input[name="rating"]:checked').value;
    const comment = document.getElementById('ratingComment').value;
    
    fetch('/api/ratings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ score: parseInt(score), comment })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        alert('شكراً لتقييمك!');
        ratingForm.reset();
        loadRatingSummary();
      } else {
        alert('خطأ: ' + data.error);
      }
    })
    .catch(error => {
      console.error('خطأ في إرسال التقييم:', error);
      alert('خطأ في إرسال التقييم');
    });
  });
}

// ============================================
// إدارة الأدمن - تسجيل الدخول
// ============================================
const adminLoginBtn = document.getElementById('adminLoginBtn');
if (adminLoginBtn) {
  adminLoginBtn.addEventListener('click', () => {
    document.getElementById('adminLoginModal').style.display = 'flex';
  });
}

// زر رفع الملفات
const uploadFileBtn = document.getElementById('uploadFileBtn');
if (uploadFileBtn) {
  uploadFileBtn.addEventListener('click', () => {
    document.getElementById('uploadModal').style.display = 'flex';
  });
}

const adminLoginForm = document.getElementById('adminLoginForm');
if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const password = document.getElementById('adminPassword').value;
    
    fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        adminToken = data.token;
        localStorage.setItem('adminToken', adminToken);
        document.getElementById('adminLoginModal').style.display = 'none';
        adminLoginForm.reset();
        checkAdminStatus();
        alert('تم تسجيل الدخول بنجاح');
      } else {
        document.getElementById('loginError').textContent = data.error || 'خطأ في تسجيل الدخول';
        document.getElementById('loginError').style.display = 'block';
      }
    })
    .catch(error => {
      console.error('خطأ في تسجيل الدخول:', error);
      document.getElementById('loginError').textContent = 'خطأ في الاتصال بالخادم';
      document.getElementById('loginError').style.display = 'block';
    });
  });
}

// ============================================
// التحقق من حالة الأدمن
// ============================================
function checkAdminStatus() {
  if (!adminToken) {
    document.getElementById('adminStatus').style.display = 'none';
    document.getElementById('adminLoginBtn').style.display = 'block';
    return;
  }
  
  fetch('/api/admin/status', {
    headers: {
      'X-Admin-Token': adminToken
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.isAdmin) {
      document.getElementById('adminLoginBtn').style.display = 'none';
      document.getElementById('adminStatus').style.display = 'flex';
    } else {
      adminToken = null;
      localStorage.removeItem('adminToken');
      checkAdminStatus();
    }
  })
  .catch(error => {
    console.error('خطأ في التحقق من حالة الأدمن:', error);
  });
}

// ============================================
// تسجيل خروج الأدمن
// ============================================
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener('click', () => {
    adminToken = null;
    localStorage.removeItem('adminToken');
    checkAdminStatus();
    alert('تم تسجيل الخروج');
  });
}

// ============================================
// رفع ملف جديد (أدمن)
// ============================================
const uploadForm = document.getElementById('uploadForm');
if (uploadForm) {
  uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!adminToken) {
      alert('يجب تسجيل الدخول كأدمن أولاً');
      return;
    }
    
    const standardId = document.getElementById('standardSelect').value;
    const title = document.getElementById('fileTitle').value;
    const description = document.getElementById('fileDescription').value;
    const fileInput = document.getElementById('fileInput');
    
    if (!fileInput.files[0]) {
      alert('اختر ملف أولاً');
      return;
    }
    
    const formData = new FormData();
    formData.append('standardId', standardId);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('file', fileInput.files[0]);
    
    fetch('/api/files/upload', {
      method: 'POST',
      headers: {
        'X-Admin-Token': adminToken
      },
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        alert('تم رفع الملف بنجاح');
        uploadForm.reset();
        document.getElementById('uploadModal').style.display = 'none';
        loadStatistics();
        loadFiles();
      } else {
        document.getElementById('uploadError').textContent = data.error || 'خطأ في رفع الملف';
        document.getElementById('uploadError').style.display = 'block';
      }
    })
    .catch(error => {
      console.error('خطأ في رفع الملف:', error);
      document.getElementById('uploadError').textContent = 'خطأ في الاتصال بالخادم';
      document.getElementById('uploadError').style.display = 'block';
    });
  });
}

// ============================================
// إدارة النوافذ المنبثقة (Modals)
// ============================================
function setupEventListeners() {
  // إغلاق النوافذ المنبثقة
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.modal').style.display = 'none';
    });
  });
  
  // إغلاق النافذة عند النقر خارجها
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });
  
  // زر رفع ملف (يظهر فقط للأدمن)
  // يمكن إضافة زر في الواجهة لاحقاً
}

// ============================================
// دالة مساعدة لعرض رسالة نجاح
// ============================================
function showSuccess(message) {
  const div = document.createElement('div');
  div.className = 'success-message';
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// ============================================
// دالة مساعدة لعرض رسالة خطأ
// ============================================
function showError(message) {
  const div = document.createElement('div');
  div.className = 'error-message';
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// ============================================
// ملاحظات للتطوير:
// 1. يمكن إضافة زر "رفع ملف" في الهيدر للأدمن
// 2. يمكن تحسين البحث بإضافة فلاتر حسب المعيار
// 3. يمكن إضافة تصفية الملفات حسب التاريخ أو عدد التحميلات
// 4. يمكن إضافة نظام تنبيهات أفضل
// ============================================
