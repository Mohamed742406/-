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
            loginForm.reset();
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
            uploa
