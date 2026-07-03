const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    themeToggle.textContent = document.body.classList.contains('dark-mode') ? '🌙' : '☀️';
});

const showLoader = () => document.getElementById('loader').classList.remove('hidden');
const hideLoader = () => document.getElementById('loader').classList.add('hidden');
const showToast = (msg, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div'); toast.className = `toast ${type}`; toast.textContent = msg;
    container.appendChild(toast); setTimeout(() => { toast.remove(); }, 3000);
};

const navigateTo = (pageId) => {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
};

const openModal = (modalId) => document.getElementById(modalId).style.display = 'flex';
window.closeModal = (modalId) => document.getElementById(modalId).style.display = 'none';
window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.style.display = 'none'; };

let currentUser = null;
let currentActiveSector = "";
let allJobs = [];
let allSectors = [];

const supportPhoneNumber = "966500000000"; 
window.contactSupport = () => { window.open(`https://wa.me/${supportPhoneNumber}?text=أهلاً،%20أحتاج%20مساعدة%20في%20حسابي`, '_blank'); };

window.onload = async () => {
    showLoader();
    try {
        const res = await fetch('api.php?action=check_session');
        const data = await res.json();
        if (data.success) { handleLoginSuccess(data.user); }
    } catch (e) { console.error(e); }
    hideLoader();
};

const handleLoginSuccess = (user) => {
    currentUser = user;
    document.getElementById('profile-name').textContent = user.full_name || user.username;
    document.getElementById('profile-expiry').textContent = user.role === 'admin' ? 'صلاحية مطلقة (مدير)' : (user.expiry || 'غير محدد');
    document.getElementById('prof-fullname').textContent = user.full_name || '-';
    document.getElementById('prof-age').textContent = user.age || '-';
    document.getElementById('prof-phone').textContent = user.phone || '-';
    document.getElementById('prof-email').textContent = user.email || '-';
    document.getElementById('prof-nationality').textContent = user.nationality || '-';
    document.getElementById('prof-icon').textContent = user.role === 'admin' ? '👑' : '👤';

    if (user.role === 'admin') {
        document.getElementById('admin-edit-self-btn').classList.remove('hidden'); // إظهار زر التعديل للآدمن
        document.getElementById('admin-display-username').textContent = user.full_name || user.username;
        navigateTo('admin-page'); renderAdminData();
    } else {
        document.getElementById('admin-edit-self-btn').classList.add('hidden');
        if (user.expiry && new Date(user.expiry) < new Date()) { showToast('انتهت صلاحية اشتراكك', 'error'); logout(); return; }
        document.getElementById('display-username').textContent = user.full_name || user.username;
        navigateTo('jobs-page'); renderJobs();
    }
};

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault(); showLoader();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const res = await fetch('api.php?action=login', { method: 'POST', body: JSON.stringify({ username, password }) });
    const result = await res.json();
    hideLoader();

    if (result.success) { showToast('تم تسجيل الدخول'); handleLoginSuccess(result.user); } 
    else { showToast(result.message, 'error'); }
});

window.logout = async () => {
    await fetch('api.php?action=logout');
    currentUser = null; closeModal('profile-modal'); navigateTo('home-page'); showToast('تم تسجيل الخروج');
};

// --- عرض الوظائف للمشترك ---
const renderJobs = async () => {
    showLoader();
    const res = await fetch('api.php?action=get_jobs');
    const data = await res.json();
    allJobs = data.jobs; allSectors = data.sectors;
    renderSectorTabs(); filterAndDisplayJobs();
    hideLoader();
};

const renderSectorTabs = () => {
    const tabsContainer = document.getElementById('sector-tabs');
    let html = `<button class="tab-btn ${currentActiveSector===''?'active':''}" data-sector="">الكل</button>`;
    allSectors.forEach(sec => {
        html += `<button class="tab-btn ${currentActiveSector===sec.name?'active':''}" data-sector="${sec.name}">${sec.name}</button>`;
    });
    tabsContainer.innerHTML = html;
    document.querySelectorAll('#sector-tabs .tab-btn').forEach(tab => {
        tab.addEventListener('click', (e) => {
            currentActiveSector = e.target.getAttribute('data-sector');
            renderSectorTabs(); filterAndDisplayJobs();
        });
    });
};

const filterAndDisplayJobs = () => {
    const grid = document.getElementById('jobs-grid');
    const searchVal = document.getElementById('search-input').value.toLowerCase();
    const prefVal = document.getElementById('pref-filter').value;
    grid.innerHTML = '';
    
    const filtered = allJobs.filter(job => {
        const matchSearch = job.title.toLowerCase().includes(searchVal) || job.desc.toLowerCase().includes(searchVal);
        const matchPref = prefVal === '' || job.pref === prefVal || job.pref === 'الكل';
        const matchSector = currentActiveSector === '' || job.sector === currentActiveSector;
        return matchSearch && matchPref && matchSector;
    });

    if (filtered.length === 0) { grid.innerHTML = '<p style="text-align:center;">لا توجد وظائف.</p>'; return; }

    filtered.forEach(job => {
        const card = document.createElement('div');
        card.className = 'job-card';
        // زر "التفاصيل" و "قدم الآن" متجاورين في صف واحد
        card.innerHTML = `
            <h3 style="margin:0;">${job.title}</h3>
            <div class="job-tags" style="margin-top:10px;"><span class="badge badge-primary">${job.sector}</span></div>
            <div class="job-actions">
                <button class="btn btn-outline" style="flex:1;" onclick='openJobModal(${JSON.stringify(job).replace(/'/g, "&#39;")})'>التفاصيل</button>
                <a href="${job.link}" target="_blank" class="btn btn-primary" style="flex:1;">قدم الآن</a>
            </div>
        `;
        grid.appendChild(card);
    });
};

document.getElementById('search-input').addEventListener('input', filterAndDisplayJobs);
document.getElementById('pref-filter').addEventListener('change', filterAndDisplayJobs);

window.openJobModal = (job) => {
    document.getElementById('modal-title').textContent = job.title;
    document.getElementById('modal-sector').textContent = job.sector;
    document.getElementById('modal-pref').textContent = job.pref;
    document.getElementById('modal-desc').textContent = job.desc;
    openModal('job-modal');
};

// --- لوحة الإدارة ---
window.switchAdminTab = (tabId, btnElement) => {
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.admin-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active'); btnElement.classList.add('active');
};

const renderAdminData = async () => {
    showLoader();
    const res = await fetch('api.php?action=get_admin_data');
    const data = await res.json();
    
    document.getElementById('stat-jobs').textContent = data.jobs_count;
    document.getElementById('stat-users').textContent = data.users_count;

    // القطاعات
    const sectorSelectAdd = document.getElementById('job-sector');
    const sectorSelectEdit = document.getElementById('edit-job-sector');
    sectorSelectAdd.innerHTML = ''; sectorSelectEdit.innerHTML = '';
    data.sectors.forEach(s => { 
        sectorSelectAdd.innerHTML += `<option value="${s.name}">${s.name}</option>`; 
        sectorSelectEdit.innerHTML += `<option value="${s.name}">${s.name}</option>`; 
    });

    const sectorsList = document.getElementById('sectors-list');
    sectorsList.innerHTML = '';
    data.sectors.forEach(s => { sectorsList.innerHTML += `<li style="align-items:center;"><span>📁 ${s.name}</span> <button class="btn btn-danger" style="padding:2px 8px;" onclick="deleteSector(${s.id})">حذف</button></li>`; });

    // الوظائف (بها زر التعديل)
    const tbody = document.getElementById('admin-jobs-tbody');
    tbody.innerHTML = '';
    data.jobs.forEach(job => {
        tbody.innerHTML += `<tr>
            <td>${job.title}</td><td><span class="badge badge-primary">${job.sector}</span></td><td>${job.timestamp.split(' ')[0]}</td>
            <td>
                <button class="btn btn-outline" style="padding:4px 8px; font-size:12px;" onclick='editJobData(${JSON.stringify(job).replace(/'/g, "&#39;")})'>تعديل</button>
                <button class="btn btn-danger" style="padding:4px 8px; font-size:12px;" onclick="deleteJob(${job.id})">حذف</button>
            </td>
        </tr>`;
    });

    // المستخدمين (نعرض المدراء والمشتركين)
    const ul = document.getElementById('users-list');
    ul.innerHTML = '';
    data.users.forEach(u => {
        const icon = u.role === 'admin' ? '👑' : '👤';
        ul.innerHTML += `<li style="align-items:center;">
            <span>${icon} ${u.full_name || u.username} - <small>${u.phone || 'لا يوجد رقم'}</small></span>
            <button class="btn btn-outline" style="padding:2px 8px;" onclick='editUserData(${JSON.stringify(u).replace(/'/g, "&#39;")})'>تعديل</button>
        </li>`;
    });
    hideLoader();
};

document.getElementById('add-sector-form').addEventListener('submit', async (e) => {
    e.preventDefault(); showLoader();
    const name = document.getElementById('new-sector-name').value;
    const res = await fetch('api.php?action=add_sector', { method: 'POST', body: JSON.stringify({ name }) });
    const result = await res.json();
    if(result.success) { showToast('تم الإضافة'); e.target.reset(); renderAdminData(); } else { hideLoader(); showToast(result.message, 'error'); }
});

window.deleteSector = async (id) => {
    if(confirm('متأكد من حذف القطاع؟')) { await fetch('api.php?action=delete_sector', { method: 'POST', body: JSON.stringify({ id }) }); renderAdminData(); showToast('تم الحذف'); }
};

document.getElementById('add-job-form').addEventListener('submit', async (e) => {
    e.preventDefault(); showLoader();
    const jobData = { title: document.getElementById('job-title').value, sector: document.getElementById('job-sector').value, pref: document.getElementById('job-pref').value, link: document.getElementById('job-link').value, desc: document.getElementById('job-desc').value };
    await fetch('api.php?action=add_job', { method: 'POST', body: JSON.stringify(jobData) });
    e.target.reset(); renderAdminData(); showToast('تم إضافة الوظيفة');
});

// نافذة تعديل الوظيفة
window.editJobData = (job) => {
    document.getElementById('edit-job-id').value = job.id;
    document.getElementById('edit-job-title').value = job.title;
    document.getElementById('edit-job-sector').value = job.sector;
    document.getElementById('edit-job-pref').value = job.pref;
    document.getElementById('edit-job-link').value = job.link;
    document.getElementById('edit-job-desc').value = job.desc;
    openModal('edit-job-modal');
};
document.getElementById('edit-job-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const jobData = { id: document.getElementById('edit-job-id').value, title: document.getElementById('edit-job-title').value, sector: document.getElementById('edit-job-sector').value, pref: document.getElementById('edit-job-pref').value, link: document.getElementById('edit-job-link').value, desc: document.getElementById('edit-job-desc').value };
    await fetch('api.php?action=edit_job', { method: 'POST', body: JSON.stringify(jobData) });
    closeModal('edit-job-modal'); renderAdminData(); showToast('تم تعديل الوظيفة');
});

window.deleteJob = async (id) => {
    if(confirm('تأكيد حذف الوظيفة؟')) { await fetch('api.php?action=delete_job', { method: 'POST', body: JSON.stringify({ id }) }); renderAdminData(); showToast('تم الحذف'); }
};

document.getElementById('add-user-form').addEventListener('submit', async (e) => {
    e.preventDefault(); showLoader();
    const userData = { role: document.getElementById('new-role').value, full_name: document.getElementById('new-fullname').value, age: document.getElementById('new-age').value, phone: document.getElementById('new-phone').value, email: document.getElementById('new-email').value, nationality: document.getElementById('new-nationality').value, username: document.getElementById('new-username').value, password: document.getElementById('new-password').value, expiry: document.getElementById('new-expiry').value };
    const res = await fetch('api.php?action=add_user', { method: 'POST', body: JSON.stringify(userData) });
    const result = await res.json();
    if(result.success) { showToast('تم إنشاء الحساب'); e.target.reset(); renderAdminData(); } else { hideLoader(); showToast(result.message, 'error'); }
});

// فتح نافذة تعديل بيانات الآدمن لنفسه
window.editMyAdminProfile = () => {
    closeModal('profile-modal');
    editUserData(currentUser);
};

window.editUserData = (user) => {
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-role').value = user.role;
    document.getElementById('edit-fullname').value = user.full_name || ''; 
    document.getElementById('edit-age').value = user.age || ''; 
    document.getElementById('edit-phone').value = user.phone || ''; 
    document.getElementById('edit-email').value = user.email || ''; 
    document.getElementById('edit-nationality').value = user.nationality || ''; 
    document.getElementById('edit-username').value = user.username; 
    document.getElementById('edit-expiry').value = user.expiry || ''; 
    document.getElementById('edit-password').value = ''; 
    openModal('edit-user-modal');
};

document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userData = { id: document.getElementById('edit-user-id').value, role: document.getElementById('edit-role').value, full_name: document.getElementById('edit-fullname').value, age: document.getElementById('edit-age').value, phone: document.getElementById('edit-phone').value, email: document.getElementById('edit-email').value, nationality: document.getElementById('edit-nationality').value, username: document.getElementById('edit-username').value, expiry: document.getElementById('edit-expiry').value, password: document.getElementById('edit-password').value };
    await fetch('api.php?action=edit_user', { method: 'POST', body: JSON.stringify(userData) });
    
    // إذا كان يعدل بياناته الشخصية، نحدث الجلسة
    if (userData.id == currentUser.id) {
        const res = await fetch('api.php?action=check_session');
        const data = await res.json();
        if (data.success) { handleLoginSuccess(data.user); }
    }
    
    closeModal('edit-user-modal'); renderAdminData(); showToast('تم التحديث بنجاح');
});
