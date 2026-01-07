
// Standardized Arabic Date Formatter (DD/MM/YYYY)
window.formatArabicDate = function (dateStr) {
    if (!dateStr) return '-';
    try {
        let d;
        if (typeof dateStr === 'string' && dateStr.includes('/') && dateStr.length > 7 && !dateStr.includes('-')) {
            return dateStr;
        }
        d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateStr;
    }
};

// Initialize Supabase - Local Config
let supabaseClient = null;

async function initApp() {
    try {
        console.log('🔄 Checking dependencies...');
        
        // Wait for db-ready if db is not ready yet
        if (!window.db || !window.db.isReady) {
            console.log('⏳ Waiting for database to be ready...');
            await new Promise(resolve => {
                window.addEventListener('db-ready', resolve, { once: true });
                // Safety timeout
                setTimeout(resolve, 3000);
            });
        }

        if (!window.EEJAZ_CONFIG) {
            throw new Error('ملف الإعدادات (config.js) مفقود أو لم يتم تحميله بشكل صحيح.');
        }

        if (!window.authSystem) {
            throw new Error('نظام المصادقة (auth.js) مفقود.');
        }

        // Always use global db supabase client
        supabaseClient = window.db ? window.db.supabase : (window.supabase ? window.supabase.createClient(window.EEJAZ_CONFIG.supabaseUrl, window.EEJAZ_CONFIG.supabaseKey) : null);
        
        if (!supabaseClient) {
            throw new Error('فشل إنشاء اتصال بقاعدة البيانات السحابية.');
        }

        console.log('✅ Supabase Connected Successfully');

        // Restore Session if exists
        if (authSystem.isLoggedIn()) {
            currentStudent = authSystem.getCurrentStudent();
            initDashboard();
            hide('authContainer');
            show('dashboardContainer');
            const mobileNav = get('mobileNav');
            if (mobileNav) mobileNav.classList.add('active');
            
            // Initial data fetch
            fetchAnnouncements();
            loadSchedule();
        }

        // Populate institutes list
        fetchInstitutes();

    } catch (e) {
        console.error('Initialization Failed:', e);
        // Show error on UI if possible
        const loginBtn = get('loginBtn');
        if (loginBtn) loginBtn.innerHTML = '❌ فشل الاتصال';
    }
}

async function fetchAnnouncements() {
    if (!currentStudent || !supabaseClient) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('announcements')
            .select('*')
            .eq('institute_id', currentStudent.institute_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        allAnnouncements = data || [];
        renderAnnouncements();
        updateNotificationBadge();
    } catch (e) {
        console.error('Failed to fetch announcements:', e);
    }
}

async function fetchInstitutes() {
    const loginSelect = get('instituteSelect');
    const actSelect = get('activateInstituteSelect');

    try {
        const { data, error } = await supabaseClient
            .from('institutes')
            .select('id, name, short_id')
            .eq('subscription_status', 'active')
            .order('name');

        if (error) throw error;

        const optionsHtml = data.map(inst =>
            `<option value="${inst.id}" data-short="${inst.short_id}">${inst.name}</option>`
        ).join('');

        const defaultOption = '<option value="">-- اختر المعهد --</option>';
        loginSelect.innerHTML = defaultOption + optionsHtml;
        actSelect.innerHTML = defaultOption + optionsHtml;

    } catch (e) {
        console.error('Failed to fetch institutes:', e);
        loginSelect.innerHTML = '<option value="">❌ فشل تحميل المعاهد</option>';
    }
}

// Start initialization
document.addEventListener('DOMContentLoaded', initApp);

// --- State ---
let currentStudent = null;
let selectedSemesterIdx = -1; // -1 means show latest by default
let allAnnouncements = []; // Store fetched notifications

// مفتاح التخزين للإشعارات المقروءة
const READ_NOTIFS_KEY = 'student_read_notifications';

/**
 * الحصول على قائمة معرفات الإشعارات المقروءة
 */
function getReadNotifications() {
    try {
        const stored = localStorage.getItem(READ_NOTIFS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

/**
 * وضع علامة مقروء على إشعار
 */
function markNotificationAsRead(notifId) {
    if (!notifId) return;
    const readNotifs = getReadNotifications();
    if (!readNotifs.includes(notifId)) {
        readNotifs.push(notifId);
        localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify(readNotifs));
        updateNotificationBadge();
        renderAnnouncements(); // تحديث القائمة لإخفاء علامة غير المقروء
    }
}

/**
 * تحديث شارة الإشعارات بناءً على غير المقروء
 */
function updateNotificationBadge() {
    const badgeEl = get('notifBadge');
    if (!badgeEl) return;

    const readNotifs = getReadNotifications();
    const unreadCount = allAnnouncements.filter(n => !readNotifs.includes(n.id)).length;

    if (unreadCount > 0) {
        badgeEl.textContent = unreadCount;
        badgeEl.classList.remove('hidden');
    } else {
        badgeEl.classList.add('hidden');
    }
}

// --- DOM Helpers ---
const get = (id) => document.getElementById(id);
const show = (id) => get(id).classList.remove('hidden');
const hide = (id) => get(id).classList.add('hidden');
const setBtnLoading = (btnId, isLoading) => {
    const btn = get(btnId);
    if (!btn) return;
    const loader = btn.querySelector('.loader');
    const text = btn.querySelector('.btn-text');

    if (isLoading) {
        if (text) text.style.display = 'none';
        if (loader) loader.style.display = 'block';
        btn.disabled = true;
    } else {
        if (text) text.style.display = 'block';
        if (loader) loader.style.display = 'none';
        btn.disabled = false;
    }
};

// --- View Navigation ---
function switchView(viewName) {
    const actTitle = get('activateStepTitle');
    if (viewName === 'login') {
        show('loginView');
        hide('activateView');
        resetActivation();
    } else if (viewName === 'activate') {
        hide('loginView');
        show('activateView');
        if (actTitle) actTitle.textContent = 'المرحلة 1: التحقق من الهوية (تفعيل)';
    } else if (viewName === 'reset') {
        hide('loginView');
        show('activateView');
        if (actTitle) actTitle.textContent = 'المرحلة 1: التحقق من الهوية (إعادة تعيين)';
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const tabEl = get('tab-' + tabName);
    if (tabEl) tabEl.classList.add('active');

    // Update Desktop Tabs
    const btns = document.querySelectorAll('.tab-btn');
    btns.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)) {
            btn.classList.add('active');
        }
    });

    // Update Mobile Nav
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(tabName)) {
            item.classList.add('active');
        }
    });

    if (tabName === 'schedule') loadSchedule();
    if (tabName === 'announcements') fetchAnnouncements();
    if (tabName === 'finance') renderFinance();
    if (tabName === 'settings' && currentStudent) {
        get('settingsStudentId').textContent = currentStudent.registration_number || '--';
        get('settingsStudentId').style.fontWeight = 'bold';
    }

    // Save Active Tab
    localStorage.setItem('active_tab', tabName);
}

// --- Auth Logic ---

// 1. Activation
// 1. Activation - Step 1: Verify Student
let pendingStudent = null;

async function handleVerifyStudent(e) {
    e.preventDefault();
    const instId = get('activateInstituteSelect').value;
    const id = get('actId').value.trim();
    const regNum = get('actRegNum').value.trim();

    // Clear previous errors
    const errBox = get('verifyError');
    if (errBox) {
        errBox.textContent = '';
        hide('verifyError');
    }

    if (!instId || !id || !regNum) return alert('الرجاء اختيار المعهد وإدخال الرقم الوطني ورقم القيد');

    setBtnLoading('verifyBtn', true);

    try {
        const { data: students, error } = await supabaseClient
            .from('students')
            .select('*')
            .eq('national_id', id)
            .eq('registration_number', regNum)
            .eq('institute_id', instId)
            .limit(1);

        if (error) throw error;
        if (!students || students.length === 0) {
            throw new Error('الرقم الوطني أو القيد غير صحيح راجع إدارة المعهد أو قم بإعادة المحاولة');
        }

        const data = students[0];
        const studentData = typeof data.json_data === 'string' ? JSON.parse(data.json_data || '{}') : (data.json_data || {});

        // دمج البيانات الأساسية لضمان عدم فقدانها عند الحفظ
        const mergedData = {
            ...studentData,
            national_id: data.national_id,
            registration_number: data.registration_number,
            institute_id: data.institute_id,
            name: data.name || studentData.name || studentData.full_name,
            full_name: data.name || studentData.full_name || studentData.name
        };

        const isReset = get('activateStepTitle').textContent.includes('إعادة تعيين');

        if (mergedData.portal_active && !isReset) {
            throw new Error('هذا الحساب مفعل مسبقاً. يمكنك تسجيل الدخول مباشرة.');
        }

        if (!mergedData.portal_active && isReset) {
            throw new Error('هذا الحساب لم يتم تفعيله بعد. يرجى اختيار "تفعيل الحساب" أولاً.');
        }

        // Success - Move to step 2
        pendingStudent = { ...mergedData, db_id: data.id };
        get('verifiedStudentName').textContent = mergedData.full_name;

        get('activateStepTitle').textContent = isReset ? 'المرحلة 2: إعادة تعيين كلمة المرور' : 'المرحلة 2: تعيين كلمة المرور';

        hide('activateStage1');
        show('activateStage2');
        hide('activationBackBtn');

    } catch (err) {
        const errBox = get('verifyError');
        if (errBox) {
            errBox.textContent = err.message;
            show('verifyError');
        } else {
            alert(err.message);
        }
    } finally {
        setBtnLoading('verifyBtn', false);
    }
}

// 1. Activation - Step 2: Set Password
async function handleFinalRegistration(e) {
    e.preventDefault();
    const pass = get('actPass').value;
    const confirmPass = get('actPassConfirm').value;

    if (!pass || !confirmPass) return alert('الرجاء إدخال كلمة المرور وتأكيدها');
    if (pass !== confirmPass) return alert('كلمات المرور غير متطابقة!');
    if (pass.length < 6) return alert('كلمة المرور يجب أن تكون 6 خانات على الأقل');

    setBtnLoading('actBtn', true);

    try {
        const updatedData = { ...pendingStudent };
        // Use the same encoding as authSystem.login
        updatedData.portal_password = btoa(unescape(encodeURIComponent(pass)));
        updatedData.portal_active = true;

        // Remove helper field before saving
        const dbId = updatedData.db_id;
        delete updatedData.db_id;

        const { error } = await supabaseClient
            .from('students')
            .update({
                json_data: JSON.stringify(updatedData),
                last_modified: new Date().toISOString()
            })
            .eq('id', dbId);

        if (error) throw error;

        alert('✨ مبارك! تم تفعيل حسابك بنجاح. يمكنك الآن الدخول لبوابة الطالب.');
        switchView('login');

    } catch (err) {
        alert('فشل اتمام التسجيل: ' + err.message);
    } finally {
        setBtnLoading('actBtn', false);
    }
}

function resetActivation() {
    pendingStudent = null;
    get('actId').value = '';
    get('actRegNum').value = '';
    get('actPass').value = '';
    get('actPassConfirm').value = '';
    const actTitle = get('activateStepTitle');
    if (actTitle) actTitle.textContent = 'المرحلة 1: التحقق من الهوية';
    const errBox = get('verifyError');
    if (errBox) {
        errBox.textContent = '';
        hide('verifyError');
    }
    show('activateStage1');
    hide('activateStage2');
    show('activationBackBtn');
}

// 3. Change Password from Dashboard
async function handleChangePassword(e) {
    e.preventDefault();
    const newPass = get('newPass').value;
    const confirmPass = get('newPassConfirm').value;

    if (!newPass || !confirmPass) return alert('الرجاء إدخال كلمة المرور وتأكيدها');
    if (newPass !== confirmPass) return alert('كلمات المرور غير متطابقة!');
    if (newPass.length < 6) return alert('كلمة المرور يجب أن تكون 6 خانات على الأقل');

    setBtnLoading('changePassBtn', true);

    try {
        // Find current record in DB
        const { data: students, error: fetchError } = await supabaseClient
            .from('students')
            .select('id, json_data')
            .eq('national_id', currentStudent.national_id)
            .limit(1);

        if (fetchError || !students[0]) throw new Error('فشل الوصول لبيانات الطالب');

        const dbRec = students[0];
        const updatedJson = JSON.parse(dbRec.json_data || '{}');

        // Update password using the same encoding as authSystem.login
        updatedJson.portal_password = btoa(unescape(encodeURIComponent(newPass)));

        // Save back
        const { error: updateError } = await supabaseClient
            .from('students')
            .update({
                json_data: JSON.stringify(updatedJson),
                last_modified: new Date().toISOString()
            })
            .eq('id', dbRec.id);

        if (updateError) throw updateError;

        // Update local state
        currentStudent.portal_password = updatedJson.portal_password;

        alert('✅ تم تحديث كلمة المرور بنجاح!');
        get('newPass').value = '';
        get('newPassConfirm').value = '';
        switchTab('academic');

    } catch (err) {
        alert('فشل تحديث كلمة المرور: ' + err.message);
    } finally {
        setBtnLoading('changePassBtn', false);
    }
}

// 2. Login
async function handleLogin(e) {
    e.preventDefault();

    if (!supabaseClient) {
        alert('جاري تهيئة النظام... يرجى الانتظار واعادة المحاولة.');
        return;
    }

    const instId = get('instituteSelect').value;
    const idInput = get('loginId');
    const id = idInput ? idInput.value.trim() : '';
    const password = get('loginPass').value.trim();

    if (!instId || !id || !password) return alert('الرجاء إختيار المعهد وإدخال بيانات الدخول');

    setBtnLoading('loginBtn', true);

    try {
        // استخدام نظام المصادقة الموحد - الترتيب الصحيح: (username, password, instituteId)
        currentStudent = await authSystem.login(id, password, instId);

        initDashboard();
        hide('authContainer');
        show('dashboardContainer');
        const mobileNav = get('mobileNav');
        if (mobileNav) mobileNav.classList.add('active');
        fetchAnnouncements(); // Fetch on login

    } catch (err) {
        alert(err.message);
    } finally {
        setBtnLoading('loginBtn', false);
    }
}

function logout() {
    // Logout with Farewell Animation
    const fw = document.getElementById('farewellScreen');
    const fwMsg1 = document.getElementById('fwMsg1');
    const fwMsg2 = document.getElementById('fwMsg2');

    if (fw) {
        fw.style.display = 'flex';
        // Fade in screen
        setTimeout(() => fw.style.opacity = '1', 10);

        // Animate Text
        setTimeout(() => {
            if (fwMsg1) {
                fwMsg1.style.opacity = '1';
                fwMsg1.style.transform = 'translateY(0)';
            }
        }, 300);

        setTimeout(() => {
            if (fwMsg2) fwMsg2.style.opacity = '1';
        }, 800);

        // Actual Logout after 3 seconds
        setTimeout(() => {
            finalizeLogout();
            // Reset Animation State
            fw.style.opacity = '0';
            setTimeout(() => {
                fw.style.display = 'none';
                if (fwMsg1) { fwMsg1.style.opacity = '0'; fwMsg1.style.transform = 'translateY(20px)'; }
                if (fwMsg2) fwMsg2.style.opacity = '0';
            }, 500);
        }, 3000);
    } else {
        finalizeLogout();
    }
}

function finalizeLogout() {
    authSystem.logout();
    currentStudent = null;
    selectedSemesterIdx = -1;

    hide('dashboardContainer');
    window.location.href = 'index.html';
}

// --- Dashboard Logic ---

function initDashboard() {
    if (!currentStudent) return;

    // Header
    get('dashName').textContent = currentStudent.full_name;
    get('dashId').textContent = 'رقم القيد: ' + (currentStudent.registration_number || '---');
    get('dashId').style.fontWeight = 'bold';
    get('dashId').style.color = 'var(--primary)';

    get('dashSpec').textContent = currentStudent.specialization || 'غير محدد';

    // Format Semester to "Season Year" (e.g., خريف 2025)
    let semDisplay = '';
    const currentSem = currentStudent.current_semester || '';

    if (currentSem) {
        if (currentSem.includes('_')) {
            // التعامل مع الصيغة القديمة Fall_2025
            const parts = currentSem.split('_');
            const seasonMap = {
                'Spring': 'ربيع',
                'Fall': 'خريف',
                'Summer': 'صيف',
                'Winter': 'شتاء'
            };
            const season = seasonMap[parts[0]] || parts[0];
            semDisplay = season + ' ' + (parts[1] || '');
        } else {
            // عرض القيمة كما هي إذا كانت مخزنة بالفعل بصيغة نصية (مثل "خريف 2025")
            semDisplay = currentSem;
        }
    } else {
        // Fallback للرقم إذا لم يوجد اسم
        semDisplay = 'الفصل ' + (currentStudent.placement_semester_index || '1');
    }

    get('dashSem').textContent = semDisplay;
    get('dashAvatar').textContent = currentStudent.gender === 'female' ? '👩‍🎓' : '👨‍🎓';

    // Populate Data
    renderAcademic();
    renderFinance();

    // Restore Active Tab or default
    const lastTab = localStorage.getItem('active_tab') || 'academic';
    switchTab(lastTab);
}

function renderAcademic() {
    const container = get('academicContent');
    const selector = get('semesterSelector');
    const records = currentStudent.academic_record || [];

    if (records.length === 0) {
        selector.innerHTML = '';
        container.innerHTML = '<p class="label" style="text-align:center; padding:1rem;">لا توجد سجلات أكاديمية</p>';
        return;
    }

    // Filter semesters that have subjects
    const validSemesters = records.map((sem, idx) => ({ ...sem, idx })).filter(sem => sem.subjects && sem.subjects.length > 0);

    if (validSemesters.length === 0) {
        selector.innerHTML = '';
        container.innerHTML = '<p class="label" style="text-align:center; padding:1rem;">لا توجد نتائج نهائية مرصودة</p>';
        return;
    }

    // Set default selected to the latest semester if none selected
    if (selectedSemesterIdx === -1) {
        selectedSemesterIdx = validSemesters[validSemesters.length - 1].idx;
    }

    // Render Selector Chips
    selector.innerHTML = validSemesters.map(sem => `
        <div class="sem-chip ${sem.idx === selectedSemesterIdx ? 'active' : ''}" onclick="switchSemester(${sem.idx})">
            الفصل ${sem.semester_index || (sem.idx + 1)}
        </div>
    `).join('');

    // Get current selected record
    const sem = records[selectedSemesterIdx];

    // FINANCIAL CHECK: Check if this semester is paid
    const financialRecords = currentStudent.financial_record || [];
    const fin = financialRecords.find(f => parseInt(f.semester_index) === parseInt(sem.semester_index || (selectedSemesterIdx + 1)));

    const isPaid = fin ? ((fin.total_fee || 0) - (fin.paid_amount || 0) - (fin.discount || 0) <= 0) : false;

    if (!isPaid) {
        container.innerHTML = `
            <div class="locked-msg">
                <span class="locked-icon">🔒</span>
                <div style="font-weight:bold; margin-bottom:0.5rem;">النتيجة محجوبة</div>
                <p style="font-size:0.9rem; opacity:0.8;">يرجى سداد الرسوم الدراسية المتبقية لهذا الفصل الدراسي لتتمكن من عرض درجاتك.</p>
                <div style="margin-top:1rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.1); font-size:0.8rem;">
                    المبلغ المطلوب: ${(fin ? (fin.total_fee - fin.paid_amount - fin.discount) : '--')} د.ل
                </div>
            </div>
        `;
        return;
    }

    // Calculate Average
    const totalScore = sem.subjects.reduce((sum, s) => sum + (s.total || s.final || 0), 0);
    const maxScore = sem.subjects.length * 100;
    const average = maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : 0;

    // General Grade Label
    const getGradeLabel = (avg) => {
        if (avg >= 85) return 'ممتاز';
        if (avg >= 75) return 'جيد جداً';
        if (avg >= 65) return 'جيد';
        if (avg >= 50) return 'مقبول';
        return 'ضعيف';
    };
    const gradeLabel = getGradeLabel(parseFloat(average));

    // Determine Semester Status
    const isPassed = sem.subjects.every(s => (s.total || s.final || 0) >= 50);

    let html = `
        <div class="info-card highlight" style="flex-direction: column; align-items: stretch; gap: 0.5rem;">
            <div style="display:flex; justify-content:space-between; align-items: center;">
                <div>
                    <span class="value">نتائج الفصل ${sem.semester_index || (selectedSemesterIdx + 1)}</span>
                    <div class="label" style="margin-top:2px;">
                        المعدل: ${average}% | التقدير: <span style="color: var(--primary); font-weight: bold;">${gradeLabel}</span>
                    </div>
                </div>
                <span class="status-badge ${isPassed ? 'status-paid' : 'status-failed'}" style="${!isPassed ? 'background:rgba(239,68,68,0.2); color:#fca5a5;' : ''}">
                    ${isPassed ? 'ناجح' : 'راسب'}
                </span>
            </div>
            <div style="margin-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.5rem;">
    `;

    sem.subjects.forEach(sub => {
        const score = sub.total || sub.final || 0;
        const subPassed = score >= 50;
        html += `
            <div style="display:flex; justify-content:space-between; margin-bottom: 0.25rem; font-size: 0.9rem;">
                <span style="color: var(--text-dim);">${sub.subject_name}</span>
                <span style="${!subPassed ? 'color:#f87171;' : ''}">${score}%</span>
            </div>
        `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

function switchSemester(idx) {
    selectedSemesterIdx = idx;
    renderAcademic();
}

function renderFinance() {
    const summary = get('financeSummary');
    const history = get('financeHistory');
    const records = currentStudent.financial_record || [];

    // Summary Calculations
    let totalRequired = 0;
    let totalPaid = 0;
    records.forEach(sem => {
        totalRequired += (sem.total_fee || 0);
        totalPaid += (sem.paid_amount || 0) + (sem.discount || 0);
    });
    const remaining = totalRequired - totalPaid;

    summary.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 1rem; border-radius: 12px; text-align: center;">
            <div class="label" style="color: #6ee7b7;">المدفوع</div>
            <div class="value" style="color: #34d399;">${totalPaid.toLocaleString()} د.ل</div>
        </div>
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 1rem; border-radius: 12px; text-align: center;">
            <div class="label" style="color: #fca5a5;">المتبقي</div>
            <div class="value" style="color: #f87171;">${remaining.toLocaleString()} د.ل</div>
        </div>
    `;

    if (records.length === 0) {
        history.innerHTML = '<p class="label" style="text-align:center;">لا توجد سجلات مالية</p>';
        return;
    }

    let html = '';
    records.forEach((sem, idx) => {
        const semTotal = sem.total_fee || 0;
        const semPaid = (sem.paid_amount || 0) + (sem.discount || 0);
        const semRem = semTotal - semPaid;
        const status = semRem <= 0 ? 'مكتمل' : 'غير مكتمل';
        const color = semRem <= 0 ? 'status-paid' : 'status-partial';

        html += `
            <div class="info-card">
                <div>
                    <div class="value" style="font-size: 0.95rem;">الفصل ${sem.semester_index || (idx + 1)}</div>
                    <div class="label">المطلوب: ${semTotal}</div>
                </div>
                <div style="text-align: left;">
                    <div class="status-badge ${color}">${status}</div>
                    <div class="label" style="margin-top:2px;">باقي: ${semRem}</div>
                </div>
            </div>
        `;
    });
    history.innerHTML = html;
}

async function loadSchedule() {
    const container = get('scheduleContent');
    if (!currentStudent || !supabaseClient) return;

    container.innerHTML = '<div class="loading-spinner" style="margin: 2rem auto;"></div>';

    try {
        const { data, error } = await supabaseClient
            .from('schedules')
            .select('*')
            .eq('institute_id', currentStudent.institute_id)
            .eq('semester_index', currentStudent.placement_semester_index || 1)
            .limit(1);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="label" style="text-align:center; padding:2rem;">الجدول الدراسي غير متوفر حالياً</p>';
            return;
        }

        const scheduleData = typeof data[0].json_data === 'string' ? JSON.parse(data[0].json_data) : data[0].json_data;
        renderScheduleTable(scheduleData);

    } catch (e) {
        console.error('Failed to load schedule:', e);
        container.innerHTML = '<p class="label" style="text-align:center; color:var(--error);">خطأ في تحميل الجدول</p>';
    }
}

function renderScheduleTable(schedule) {
    const container = get('scheduleContent');
    if (!schedule || !schedule.days) {
        container.innerHTML = '<p class="label" style="text-align:center;">لا يوجد جدول متاح</p>';
        return;
    }

    const daysOrder = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    const daysArabic = {
        'Saturday': 'السبت', 'Sunday': 'الأحد', 'Monday': 'الاثنين',
        'Tuesday': 'الثلاثاء', 'Wednesday': 'الأربعاء', 'Thursday': 'الخميس'
    };

    let html = '';
    daysOrder.forEach(dayKey => {
        const dayData = schedule.days[dayKey];
        if (dayData && dayData.length > 0) {
            html += `
                <div class="schedule-day-card">
                    <div class="day-header">${daysArabic[dayKey]}</div>
                    <div class="day-slots">
                        ${dayData.map(slot => `
                            <div class="slot-item">
                                <div class="slot-time">${slot.time}</div>
                                <div class="slot-info">
                                    <div class="slot-subject">${slot.subject}</div>
                                    <div class="slot-meta">
                                        <span>📍 ${slot.room || '---'}</span>
                                        <span>👤 ${slot.teacher || '---'}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    });

    container.innerHTML = html || '<p class="label" style="text-align:center;">الجدول فارغ</p>';
}

// --- Announcements Logic ---
async function fetchAnnouncements() {
    if (!currentStudent || !currentStudent.institute_id) return;
    if (!supabaseClient) {
        console.warn('Supabase client not ready yet');
        return;
    }

    const listEl = get('announcementsList');
    const badgeEl = get('notifBadge');

    try {
        const instId = currentStudent.institute_id;
        const spec = currentStudent.specialization;
        const sem = String(currentStudent.current_semester || currentStudent.placement_semester_index || '1');

        // Fetch ONLY institute-specific announcements (Privacy Logic: Super Admin -> Institute -> Student)
        const { data, error } = await supabaseClient
            .from('announcements')
            .select('*')
            .eq('institute_id', instId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Smart Filtering by Specialization and Semester
        // Smart Filtering by Specialization and Semester with Debugging
        console.log(`🔎 Filtering Announcements for Student: Inst=${instId}, Spec=${spec}, Sem=${sem}`);

        allAnnouncements = (data || []).filter(item => {
            // Check Expiry
            if (item.expires_at) {
                const expiryDate = new Date(item.expires_at);
                const now = new Date();
                if (expiryDate < now) {
                    console.log(`⏰ Announcement ${item.id} expired on ${item.expires_at} -> DROPPED`);
                    return false;
                }
            }

            // Specialization Match
            const targetSpec = item.target_specialization || 'all';
            const matchSpec = targetSpec === 'all' || targetSpec === spec;

            // Semester Match (Robust string/number comparison)
            const targetSem = String(item.target_semester || 'all');
            const studentSem = String(sem);
            const matchSem = targetSem === 'all' || targetSem === studentSem;

            if (!matchSpec || !matchSem) {
                console.log(`Running filter on item ${item.id}: SpecMatch=${matchSpec} (${targetSpec} vs ${spec}), SemMatch=${matchSem} (${targetSem} vs ${studentSem}) -> DROPPED`);
            }

            return matchSpec && matchSem;
        });

        renderAnnouncements();

        // Update Badge
        updateNotificationBadge();

    } catch (err) {
        console.error('Error fetching announcements:', err);
        if (listEl) listEl.innerHTML = '<p style="text-align:center; color: #ef4444; padding: 2rem;">فشل تحميل الإشعارات</p>';
    }
}

function renderAnnouncements() {
    const listEl = get('announcementsList');
    if (!listEl) return;

    if (allAnnouncements.length === 0) {
        listEl.innerHTML = '<p style="text-align:center; color: var(--text-dim); padding: 2rem;">لا توجد إشعارات جديدة حالياً.</p>';
        return;
    }

    listEl.innerHTML = allAnnouncements.map((notif, idx) => {
        const typeClass = `notif-${notif.type || 'study'}`;
        const icon = notif.type === 'exam' ? '📝' : notif.type === 'finance' ? '💰' : '📘';
        const dateStr = window.formatArabicDate(notif.created_at);
        const readNotifs = getReadNotifications();
        const isRead = readNotifs.includes(notif.id);

        return `
            <div class="notification-card ${isRead ? 'read' : 'unread'}" onclick="showNotifDetails(${idx})">
                <div class="notification-icon ${typeClass}">${icon}</div>
                <div class="notification-content">
                    <div class="notification-title">
                        ${notif.title}
                        ${!isRead ? '<span class="unread-dot"></span>' : ''}
                    </div>
                    <div class="notification-summary">${notif.content}</div>
                    <span class="notification-date">${dateStr}</span>
                </div>
            </div>
        `;
    }).join('');
}

function showNotifDetails(idx) {
    const notif = allAnnouncements[idx];
    if (!notif) return;

    // وضع علامة مقروء
    markNotificationAsRead(notif.id);

    const icon = notif.type === 'exam' ? '📝' : notif.type === 'finance' ? '💰' : '📘';
    const typeClass = `notif-${notif.type || 'study'}`;
    const dateStr = window.formatArabicDate(notif.created_at);

    get('modalIcon').textContent = icon;
    get('modalIcon').className = `notification-icon ${typeClass}`;
    get('modalTitle').textContent = notif.title;
    get('modalDate').textContent = 'التاريخ: ' + dateStr;
    get('modalContent').textContent = notif.content;

    show('notifModal');
}

function closeNotifModal() {
    hide('notifModal');
}

// Add these to window scope to rely on global handlers if needed
window.fetchAnnouncements = fetchAnnouncements;
window.showNotifDetails = showNotifDetails;
window.closeNotifModal = closeNotifModal;
window.switchView = switchView;
window.switchTab = switchTab;
window.switchSemester = switchSemester;
window.handleVerifyStudent = handleVerifyStudent;
window.handleFinalRegistration = handleFinalRegistration;
window.handleLogin = handleLogin;
window.handleChangePassword = handleChangePassword;
window.logout = logout;
window.resetActivation = resetActivation;

// --- Barcode Scanner Logic ---
let html5QrCode = null;
let targetInputId = null;

function startScanner(inputId) {
    targetInputId = inputId;
    const modal = document.getElementById('scannerModal');
    if (modal) modal.style.display = 'flex';

    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" },
        {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        },
        (decodedText, decodedResult) => {
            // Handle Success
            console.log(`Scan result: ${decodedText}`, decodedResult);

            let finalValue = decodedText;
            try {
                // Check if it's JSON (comes from our student ID card)
                const data = JSON.parse(decodedText);
                if (data && data.nat) {
                    finalValue = data.nat; // Use national ID if available
                } else if (data && data.reg) {
                    finalValue = data.reg; // Fallback to registration number
                }
            } catch (e) {
                // Not JSON, use raw text (might be a simple barcode scan)
            }

            if (targetInputId) {
                document.getElementById(targetInputId).value = finalValue;
            }
            stopScanner();
        },
        (errorMessage) => {
            // parse error, ignore it.
        })
        .catch(err => {
            console.error('Scanner start failed:', err);
            alert('فشل تشغيل الكاميرا: ' + err);
            // Do not call stopScanner() here as it might not be running
            if (html5QrCode) {
                try { html5QrCode.clear(); } catch (e) { }
                html5QrCode = null;
            }
            document.getElementById('scannerModal').style.display = 'none';
        });
}

function stopScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            document.getElementById('scannerModal').style.display = 'none';
            html5QrCode = null;
        }).catch(err => {
            console.warn("Scanner failed to stop (might not be running):", err);
            // Force cleanup
            try { html5QrCode.clear(); } catch (e) { }
            document.getElementById('scannerModal').style.display = 'none';
            html5QrCode = null;
        });
    } else {
        document.getElementById('scannerModal').style.display = 'none';
    }
}
window.startScanner = startScanner;
window.stopScanner = stopScanner;
