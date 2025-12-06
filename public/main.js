// ملف main.js
// يحتوي على منطق الواجهة الأمامية لربطها بالـ API

const API_BASE = '/api';
let adminToken = localStorage.getItem('adminToken') || null;

// ============================================
// العناصر الأساسية في DOM
// ============================================
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminStatusDiv = document.getElementById('admin-status');
const uploadFileBtn = document.getElementById('upload-file-btn');
const loginModal = document.getElementById('login-modal');
const uploadModal = document.getElementById('upload-modal');
const closeButtons = document.querySelectorAll('.close-button');
const loginForm = document.getElementById('login-form');
const uploadForm = document.getElementById('upload-form');
const statsGrid = document.getElementById('stats-grid');
const standardsGrid = document.getElementById('standards-grid');
const filesList = document.getElementById('files-list');
const searchForm = document.getElementById('search-form');
const ratingForm = document.getElementById('rating-form');
const ratingSummaryDiv = document.getElementById('rating-summary');
const fileListTitle = document.getElementById('file-list-title');

// ============================================
// وظائف المساعدة (Helpers)
// ============================================

/**
 * إظهار رسالة خطأ بسيطة
 * @param {string} message
 */
function showMessage(message, type = 'error') {
    alert(`${type.toUpperCase()}: ${message}`);
}

/**
 * تحديث حالة الأدمن في الواجهة
 */
function updateAdminStatus() {
    if (adminToken) {
        adminLoginBtn.style.display = 'none';
        adminStatusDiv.innerHTML = `
            <span class="admin-status icon-admin">مرحباً، أدمن</span>
            <button id="admin-logout-btn" class="icon-logout">خروج</button>
        `;
        uploadFileBtn.style.display = 'block';
        document.getElementById('admin-logout-btn').addEventListener('click', logoutAdmin);
    } else {
        adminLoginBtn.style.display = 'block';
        adminStatusDiv.innerHTML = '';
        uploadFileBtn.style.display = 'none';
    }
}

/**
 * جلب البيانات من API
 * @param {string} endpoint
 * @returns {Promise<any>}
 */
async function fetchData(endpoint) {
    try {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (adminToken) {
            headers['X-Admin-Token'] = adminToken;
        }
        const response = await fetch(`${API_BASE}${endpoint}`, { headers });
        if (!response.ok) {
            if (response.status === 401) {
                // إذا انتهت صلاحية التوكن
                logoutAdmin();
                showMessage('انتهت صلاحية جلسة الأدمن. يرجى تسجيل الدخول مرة أخرى.', 'warning');
                return null;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        showMessage('حدث خطأ أثناء جلب البيانات.', 'error');
        return null;
    }
}

// ============================================
// منطق الأدمن (Admin Logic)
// ============================================

/**
 * تسجيل دخول الأدمن
 * @param {Event} e
 */
async function loginAdmin(e) {
    e.preventDefault();
    const password = document.getElementById('admin-password').value;

    try {
        const response = await fetch(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (response.ok) {
            adminToken = data.token;
            localStorage.setItem('adminToken', adminToken);
            updateAdminStatus();
            loginModal.style.display = 'none';
            showMessage('تم تسجيل الدخول بنجاح!', 'success');
        } else {
            showMessage(data.message || 'كلمة السر غير صحيحة.', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('حدث خطأ أثناء محاولة تسجيل الدخول.', 'error');
    }
}

/**
 * تسجيل خروج الأدمن
 */
function logoutAdmin() {
    adminToken = null;
    localStorage.removeItem('adminToken');
    updateAdminStatus();
    showMessage('تم تسجيل الخروج.', 'info');
}

// ============================================
// منطق رفع الملفات (Upload Logic)
// ============================================

/**
 * رفع ملف جديد
 * @param {Event} e
 */
async function uploadFile(e) {
    e.preventDefault();

    if (!adminToken) {
        showMessage('يجب تسجيل الدخول كأدمن لرفع الملفات.', 'error');
        return;
    }

    const formData = new FormData(uploadForm);

    try {
        const response = await fetch(`${API_BASE}/files/upload`, {
            method: 'POST',
            headers: { 'X-Admin-Token': adminToken },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            uploadModal.style.display = 'none';
            uploadForm.reset();
            showMessage('تم رفع الملف بنجاح!', 'success');
            loadStatistics(); // تحديث الإحصائيات
            loadStandards(); // تحديث قائمة المعايير
        } else {
            showMessage(data.message || 'فشل رفع الملف.', 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showMessage('حدث خطأ أثناء رفع الملف.', 'error');
    }
}

// ============================================
// منطق عرض البيانات (Data Display)
// ============================================

/**
 * عرض الإحصائيات (تم التحديث لإضافة أيقونات واضحة)
 */
async function loadStatistics() {
    const data = await fetchData('/statistics');
    if (!data) return;

    statsGrid.innerHTML = '';
    data.forEach(stat => {
        let iconClass = '';
        let iconColor = '';
        switch (stat.code) {
            case 'ASTM':
                iconClass = 'fas fa-vial'; // أنبوبة اختبار (للتربة/المواد)
                iconColor = 'var(--primary)';
                break;
            case 'ACI':
                iconClass = 'fas fa-cube'; // مكعب (للخرسانة)
                iconColor = 'var(--secondary)';
                break;
            case 'BS':
                iconClass = 'fas fa-flag-usa'; // علم (بديل للعلم البريطاني)
                iconColor = '#eab308';
                break;
            case 'OTHER':
                iconClass = 'fas fa-folder-open'; // مجلد مفتوح
                iconColor = 'var(--text-dark)';
                break;
        }

        const card = document.createElement('div');
        card.className = 'stat-card';
        card.setAttribute('data-code', stat.code);
        card.innerHTML = `
            <i class="${iconClass}" style="font-size: 2rem; color: ${iconColor}; margin-bottom: 10px;"></i>
            <h3>${stat.name}</h3>
            <p class="icon-file">${stat.fileCount} ملف</p>
            <p class="icon-download">${stat.totalDownloads} تحميل</p>
        `;
        statsGrid.appendChild(card);
    });
}

/**
 * عرض قائمة المعايير (تم التحديث لإضافة أيقونات)
 */
async function loadStandards() {
    const data = await fetchData('/standards');
    if (!data) return;

    standardsGrid.innerHTML = '';
    data.forEach(standard => {
        let iconClass = 'fas fa-file-alt'; // أيقونة افتراضية
        switch (standard.code) {
            case 'ASTM':
                iconClass = 'fas fa-vial';
                break;
            case 'ACI':
                iconClass = 'fas fa-cube';
                break;
            case 'BS':
                iconClass = 'fas fa-flag-usa';
                break;
            case 'OTHER':
                iconClass = 'fas fa-folder-open';
                break;
        }

        const item = document.createElement('div');
        item.className = 'standard-item';
        item.setAttribute('data-id', standard.id);
        item.innerHTML = `
            <h4><i class="${iconClass}"></i> ${standard.name} (${standard.code})</h4>
            <p>${standard.description}</p>
        `;
        item.addEventListener('click', () => loadStandardFiles(standard.id, standard.name));
        standardsGrid.appendChild(item);
    });
}

/**
 * عرض ملفات معيار محدد
 * @param {number} standardId
 * @param {string} standardName
 */
async function loadStandardFiles(standardId, standardName) {
    const data = await fetchData(`/standards/${standardId}/files`);
    if (!data) return;

    fileListTitle.textContent = `ملفات المعيار: ${standardName}`;
    filesList.innerHTML = '';

    if (data.length === 0) {
        filesList.innerHTML = '<p>لا توجد ملفات لهذا المعيار بعد.</p>';
        return;
    }

    data.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <h4><span class="fa-icon icon-file"></span> ${file.title}</h4>
            <p>${file.description}</p>
            <p>تحميلات: ${file.downloads}</p>
            <a href="${API_BASE}/files/${file.id}/download" target="_blank" class="download-link icon-download">تحميل الملف</a>
        `;
        filesList.appendChild(item);
    });
}

/**
 * البحث عن ملفات
 * @param {Event} e
 */
async function searchFiles(e) {
    e.preventDefault();
    const query = document.getElementById('search-input').value;
    if (!query) return;

    const data = await fetchData(`/search?query=${encodeURIComponent(query)}`);
    if (!data) return;

    fileListTitle.textContent = `نتائج البحث عن: "${query}"`;
    filesList.innerHTML = '';

    if (data.length === 0) {
        filesList.innerHTML = '<p>لا توجد نتائج مطابقة لبحثك.</p>';
        return;
    }

    data.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <h4><span class="fa-icon icon-file"></span> ${file.title}</h4>
            <p>${file.description}</p>
            <p>المعيار: ${file.code}</p>
            <p>تحميلات: ${file.downloads}</p>
            <a href="${API_BASE}/files/${file.id}/download" target="_blank" class="download-link icon-download">تحميل الملف</a>
        `;
        filesList.appendChild(item);
    });
}

// ============================================
// منطق التقييم (Rating Logic)
// ============================================

/**
 * عرض ملخص التقييم
 */
async function loadRatingSummary() {
    const data = await fetchData('/ratings/summary');
    if (!data) return;

    const avg = parseFloat(data.average_score).toFixed(1);
    const count = data.total_ratings;

    ratingSummaryDiv.innerHTML = `
        <div class="rating-summary">
            <div class="stars">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5 - Math.round(avg))}</div>
            <p>متوسط التقييم: ${avg} من 5</p>
            <p>(${count} تقييم)</p>
        </div>
    `;
}

/**
 * إرسال تقييم جديد
 * @param {Event} e
 */
async function submitRating(e) {
    e.preventDefault();
    const score = document.querySelector('input[name="rating"]:checked')?.value;
    const comment = document.getElementById('rating-comment').value;

    if (!score) {
        showMessage('الرجاء اختيار عدد النجوم.', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/ratings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: parseInt(score), comment })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('شكراً لتقييمك!', 'success');
            ratingForm.reset();
            loadRatingSummary(); // تحديث الملخص
        } else {
            showMessage(data.message || 'فشل إرسال التقييم.', 'error');
        }
    } catch (error) {
        console.error('Rating error:', error);
        showMessage('حدث خطأ أثناء إرسال التقييم.', 'error');
    }
}

// ============================================
// الأحداث (Event Listeners)
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // تحميل البيانات الأولية
    loadStatistics();
    loadStandards();
    loadRatingSummary();
    updateAdminStatus();

    // إظهار مودال تسجيل الدخول
    adminLoginBtn.addEventListener('click', () => {
        loginModal.style.display = 'block';
    });

    // إظهار مودال رفع الملفات
    uploadFileBtn.addEventListener('click', () => {
        if (adminToken) {
            uploadModal.style.display = 'block';
        } else {
            showMessage('يجب تسجيل الدخول كأدمن أولاً.', 'error');
        }
    });

    // إغلاق المودال
    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });

    // إغلاق المودال عند الضغط خارج المحتوى
    window.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.style.display = 'none';
        }
        if (e.target === uploadModal) {
            uploadModal.style.display = 'none';
        }
    });

    // ربط نماذج الإرسال
    loginForm.addEventListener('submit', loginAdmin);
    uploadForm.addEventListener('submit', uploadFile);
    searchForm.addEventListener('submit', searchFiles);
    ratingForm.addEventListener('submit', submitRating);

    // تحميل ملفات المعيار الافتراضي عند التحميل
    // (يمكن تعديل هذا لتحميل أول معيار أو تركه فارغاً)
    // loadStandardFiles(1, 'ASTM');
});
