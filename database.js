// database.js - Cloud-Only Database Manager (Supabase Direct)
// Simplified version for Student Portal

window.formatArabicDate = function (dateStr) {
    if (!dateStr) return '-';
    try {
        let d;
        if (String(dateStr).includes('/') && String(dateStr).length > 7 && !String(dateStr).includes('-')) {
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

class DatabaseManager {
    constructor() {
        this.supabase = null;
        this.isReady = false;
        this.init();
    }

    async init() {
        try {
            console.log('☁️ Initializing Cloud Database Connection...');
            
            // Wait for config to be available
            if (!window.EEJAZ_CONFIG) {
                console.warn('Waiting for config...');
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            const config = window.EEJAZ_CONFIG;
            if (!config) throw new Error('Configuration not found!');

            // Initialize Supabase Client
            if (!window.supabase) {
                await this.loadSupabaseScript();
            }
            
            this.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);
            this.isReady = true;
            console.log('✅ Cloud Database Ready');
            window.dispatchEvent(new CustomEvent('db-ready'));
        } catch (err) {
            console.error('❌ Database Initialization Failed:', err);
        }
    }

    loadSupabaseScript() {
        return new Promise((resolve, reject) => {
            if (window.supabase) return resolve();
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Direct fetch helpers for Student Portal
    async from(table) {
        if (!this.supabase) throw new Error('Database not initialized');
        return this.supabase.from(table);
    }

    get currentInstituteId() {
        const studentSession = JSON.parse(localStorage.getItem('student_session') || 'null');
        return studentSession ? studentSession.institute_id : null;
    }
}

// Initialize global db instance
window.db = new DatabaseManager();
