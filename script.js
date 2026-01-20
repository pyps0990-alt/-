// 1. 引入 Firebase 模組
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// 2. Firebase 設定 (請確認 Config 正確)
const firebaseConfig = {
    apiKey: "AIzaSyD7vNnMJXaa4mQOblyN2dhMYMuz-AkoIJM",
    authDomain: "account-web-83442.firebaseapp.com",
    projectId: "account-web-83442",
    storageBucket: "account-web-83442.firebasestorage.app",
    messagingSenderId: "485098674204",
    appId: "1:485098674204:web:927427366be9ea3ecce7d9",
    measurementId: "G-WL86KC9FQ5"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const dbRef = ref(db, 'transactions');

let currentTransactions = [];
let currentUser = null;
let deleteTargetId = null;

// 初始化日期
const dateInput = document.getElementById('date');
if(dateInput) dateInput.valueAsDate = new Date();

// --- UI 工具: Toast 通知 ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- UI 工具: Login Modal ---
const loginModal = document.getElementById('loginModal');
const btnOpenLogin = document.getElementById('btnOpenLogin');
const btnCancelLogin = document.getElementById('btnCancelLogin');
const btnConfirmLogin = document.getElementById('btnConfirmLogin');

btnOpenLogin.addEventListener('click', () => {
    loginModal.classList.add('active');
    document.getElementById('modalEmail').focus();
});

function closeModal() {
    loginModal.classList.remove('active');
    document.getElementById('modalPass').value = '';
}
btnCancelLogin.addEventListener('click', closeModal);
loginModal.addEventListener('click', (e) => { if (e.target === loginModal) closeModal(); });

btnConfirmLogin.addEventListener('click', () => {
    const email = document.getElementById('modalEmail').value;
    const pass = document.getElementById('modalPass').value;
    if(!email || !pass) return showToast("請輸入帳號與密碼", "error");

    signInWithEmailAndPassword(auth, email, pass)
        .then(() => {
            showToast("歡迎你回來，總務", "success");
            closeModal();
        })
        .catch((error) => showToast("登入失敗", "error"));
});

// --- UI 工具: Delete Modal ---
const deleteModal = document.getElementById('deleteModal');
const btnCancelDelete = document.getElementById('btnCancelDelete');
const btnConfirmDelete = document.getElementById('btnConfirmDelete');

function closeDeleteModal() {
    deleteModal.classList.remove('active');
    deleteTargetId = null;
}
btnCancelDelete.addEventListener('click', closeDeleteModal);
deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) closeDeleteModal(); });

btnConfirmDelete.addEventListener('click', () => {
    if (deleteTargetId) {
        remove(ref(db, 'transactions/' + deleteTargetId))
            .then(() => {
                showToast("已刪除紀錄", "success");
                closeDeleteModal();
            })
            .catch(e => {
                showToast("刪除失敗: " + e.message, "error");
                closeDeleteModal();
            });
    }
});

// --- UI 工具: Preview Modal (連結預覽) ---
const previewModal = document.getElementById('previewModal');
window.closePreviewModal = function() {
    previewModal.classList.remove('active');
};
previewModal.addEventListener('click', (e) => { if (e.target === previewModal) window.closePreviewModal(); });

window.openPreview = function(url) {
    const contentDiv = document.getElementById('previewContent');
    const btnOpenLink = document.getElementById('btnOpenLink');
    
    // 設定按鈕前往原始網頁
    btnOpenLink.href = url;

    // 檢查副檔名是否為圖片
    const isImage = /\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(url);

    if (isImage) {
        contentDiv.innerHTML = `<img src="${url}" class="preview-img" alt="預覽圖片">`;
    } else {
        contentDiv.innerHTML = `
            <div class="preview-placeholder">
                <i class="fa-solid fa-link" style="font-size: 3em; margin-bottom: 10px;"></i><br>
                這是一個網頁連結<br>
                <span style="font-size:0.8em">點擊下方按鈕前往查看</span>
            </div>`;
    }
    previewModal.classList.add('active');
};


// --- Auth 狀態監聽 ---
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const userInfo = document.getElementById('userInfo');
    const adminPanel = document.getElementById('adminPanel');
    const btnOpenLogin = document.getElementById('btnOpenLogin');

    if (user) {
        btnOpenLogin.classList.add('hidden');
        userInfo.classList.remove('hidden');
        document.getElementById('userEmail').innerText = "歡迎你回來，總務";
        adminPanel.classList.remove('hidden');
        document.body.classList.add('admin-mode');
    } else {
        btnOpenLogin.classList.remove('hidden');
        userInfo.classList.add('hidden');
        adminPanel.classList.add('hidden');
        document.body.classList.remove('admin-mode');
    }
    renderList(currentTransactions);
});

document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth).then(() => showToast("已安全登出", "success"));
});


// --- Database 邏輯 ---
onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    currentTransactions = [];
    if (data) {
        Object.keys(data).forEach(key => currentTransactions.push({ id: key, ...data[key] }));
    }
    renderApp();
});

// 新增資料 (包含連結)
document.getElementById('btnAdd').addEventListener('click', () => {
    if (!currentUser) return showToast("請先登入", "error");
    
    const type = document.getElementById('type').value;
    const date = document.getElementById('date').value;
    const item = document.getElementById('item').value;
    const amount = parseInt(document.getElementById('amount').value);
    const people = parseInt(document.getElementById('people').value);
    const unit = document.getElementById('unit').value;
    const link = document.getElementById('link').value || ""; // 抓取連結

    if (!item || !amount || !date) return showToast("請填寫完整資訊", "error");

    push(dbRef, { type, date, item, people, unit, amount, link, createdAt: new Date().toISOString() })
        .then(() => {
            showToast("新增成功！", "success");
            // 清空所有欄位
            document.getElementById('item').value = '';
            document.getElementById('amount').value = '';
            document.getElementById('link').value = '';
            document.getElementById('people').value = '1';
        })
        .catch(e => showToast("新增失敗: " + e.message, "error"));
});

window.deleteTrans = function(id) {
    if (!currentUser) return showToast("權限不足", "error");
    deleteTargetId = id;
    deleteModal.classList.add('active');
};

window.switchTab = function(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const tabs = document.querySelectorAll('.tab');
    if(tabName === 'list') tabs[0].classList.add('active');
    else tabs[1].classList.add('active');

    if (tabName === 'list') {
        document.getElementById('listView').classList.remove('hidden');
        document.getElementById('reportView').classList.add('hidden');
    } else {
        document.getElementById('listView').classList.add('hidden');
        document.getElementById('reportView').classList.remove('hidden');
    }
};

// --- Render Logic ---
function renderApp() {
    let income = 0, expense = 0;
    currentTransactions.forEach(t => {
        if (t.type === 'income') income += t.amount; else expense += t.amount;
    });
    document.getElementById('totalIncome').innerText = `$${income}`;
    document.getElementById('totalExpense').innerText = `$${expense}`;
    document.getElementById('balance').innerText = `$${income - expense}`;
    
    renderList(currentTransactions);
    renderReports();
}

function renderList(data) {
    const tbody = document.getElementById('transactionList');
    if (!tbody) return;

    if(data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#999;">目前無任何紀錄</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(t => {
        const isExp = t.type === 'expense';
        const color = isExp ? 'text-red' : 'text-green';
        const sign = isExp ? '-' : '+';
        const displayUnit = t.unit || '人';
        
        // 刪除按鈕
        const delBtn = currentUser ? 
            `<button class="del-btn" onclick="deleteTrans('${t.id}')"><i class="fa-solid fa-times"></i></button>` : '';

        // 連結按鈕邏輯
        let linkHtml = '<span style="color:#ccc;">-</span>';
        if (t.link) {
            linkHtml = `<button class="btn-link" onclick="openPreview('${t.link}')" title="查看連結/收據">
                            <i class="fa-solid fa-link"></i>
                        </button>`;
        }

        tbody.innerHTML += `
            <tr>
                <td>${t.date}</td>
                <td class="${color}">
                    ${isExp ? '<i class="fa-solid fa-arrow-trend-down"></i> 支出' : '<i class="fa-solid fa-arrow-trend-up"></i> 收入'}
                </td>
                <td>${t.item}</td>
                <td>${t.people} ${displayUnit}</td>
                <td class="${color}">${sign}$${t.amount}</td>
                <td style="text-align:center;">${linkHtml}</td>
                <td class="action-col">${delBtn}</td>
            </tr>`;
    });
}

function renderReports() {
    const container = document.getElementById('reportContainer');
    container.innerHTML = '';
    const groups = {};
    currentTransactions.forEach(t => {
        const m = t.date.substring(0, 7);
        if (!groups[m]) groups[m] = { inc: 0, exp: 0, count: 0 };
        if (t.type === 'income') groups[m].inc += t.amount; else groups[m].exp += t.amount;
        groups[m].count++;
    });

    Object.keys(groups).sort().reverse().forEach(m => {
        const d = groups[m];
        container.innerHTML += `
            <div class="report-card">
                <div class="report-head"><span>📅 ${m}</span><span>餘額: $${d.inc - d.exp}</span></div>
                <div class="report-body">
                    <div>收: <span class="text-green">$${d.inc}</span></div>
                    <div>支: <span class="text-red">$${d.exp}</span></div>
                    <small style="grid-column:span 2; color:#888;">共 ${d.count} 筆紀錄</small>
                </div>
            </div>`;
    });
}