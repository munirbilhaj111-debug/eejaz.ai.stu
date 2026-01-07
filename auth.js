// auth.js - Cloud-Only Secure Auth System (Supabase Direct)
// Simplified version for Student Portal

class SecureAuthSystem {
    constructor() {
        this.CURRENT_USER_KEY = 'currentUser';
        this.initSplashScreen();
    }

    initSplashScreen() {
        document.addEventListener('DOMContentLoaded', () => {
            const splash = document.getElementById('splash-screen');
            const authContainer = document.getElementById('authContainer');

            if (!splash) return;

            splash.style.opacity = '1';
            splash.style.visibility = 'visible';

            setTimeout(() => {
                splash.style.opacity = '0';
                splash.style.visibility = 'hidden';

                setTimeout(() => {
                    if (authContainer) {
                        authContainer.style.opacity = '1';
                        authContainer.style.display = 'flex';
                    }
                    splash.remove();
                }, 400);
            }, 800); // Reduced to 0.8s for faster experience
        });
    }

    isLoggedIn() {
        return localStorage.getItem(this.CURRENT_USER_KEY) !== null || localStorage.getItem('student_session') !== null;
    }

    getCurrentUser() {
        const userJson = localStorage.getItem(this.CURRENT_USER_KEY) || localStorage.getItem('student_session');
        if (userJson) {
            try {
                return JSON.parse(userJson);
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    getCurrentStudent() {
        return this.getCurrentUser();
    }

    logout() {
        localStorage.removeItem(this.CURRENT_USER_KEY);
        localStorage.removeItem('student_session');
        localStorage.removeItem('active_tab');
        window.location.href = 'index.html';
    }

    async login(username, password, instituteId) {
        if (!instituteId) throw new Error('يرجى اختيار المعهد');

        const client = (window.db && window.db.supabase) || window.supabaseClient;
        if (!client) throw new Error('فشل الاتصال بقاعدة البيانات');

        try {
            // Student Login via National ID
            const { data: students, error } = await client
                .from('students')
                .select('*')
                .eq('national_id', username)
                .eq('institute_id', instituteId)
                .limit(1);

            if (error) throw error;

            if (students && students.length > 0) {
                const student = students[0];
                const studentData = typeof student.json_data === 'string' ? JSON.parse(student.json_data || '{}') : (student.json_data || {});
                
                // Base64 encoding for student passwords (legacy support)
                const encodedPassword = btoa(unescape(encodeURIComponent(password)));

                if (studentData.portal_password === encodedPassword) {
                    const sessionData = {
                        ...studentData,
                        id: student.id,
                        national_id: student.national_id,
                        registration_number: student.registration_number,
                        role: 'طالب',
                        fullName: studentData.full_name || studentData.name || student.name,
                        institute_id: student.institute_id
                    };
                    localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(sessionData));
                    localStorage.setItem('student_session', JSON.stringify(sessionData));
                    return sessionData;
                }
            }
            throw new Error('الرقم الوطني أو كلمة المرور غير صحيحة');
        } catch (e) {
            throw new Error(e.message || 'فشل تسجيل الدخول');
        }
    }
}

// Global initialization
window.AuthSystem = SecureAuthSystem;
window.authSystem = new SecureAuthSystem();

function togglePassword(inputId, toggleElement) {
    const passwordInput = document.getElementById(inputId);
    const icon = toggleElement.querySelector('i');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}
