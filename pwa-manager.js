// pwa-manager.js - مدير تطبيق الويب التقدمي

class PWAManager {
    constructor() {
        this.serviceWorker = null;
        this.isOnline = navigator.onLine;
        this.installPrompt = null;
        this.deferredPrompt = null;
        this.cacheName = 'eejaz-pwa-v1';
        this.cachedAssets = new Set();
        this.init();
    }

    init() {
        this.setupServiceWorker();
        this.setupInstallPrompt();
        this.setupOnlineStatus();
        this.setupBackgroundSync();
        this.setupPushNotifications();
        this.setupAppLifecycle();
    }

    // إعداد Service Worker
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            // استخدام مسار نسبي لضمان العمل على GitHub Pages
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('✅ Service Worker مسجل:', registration);
                    this.serviceWorker = registration;
                    
                    // التحقق من التحديثات
                    registration.addEventListener('updatefound', () => {
                        this.handleUpdateFound(registration);
                    });
                    
                    // التحقق من التحكم النشط
                    if (registration.active) {
                        console.log('📱 Service Worker نشط');
                    }
                })
                .catch(error => {
                    console.error('❌ فشل تسجيل Service Worker:', error);
                });
        } else {
            console.warn('⚠️ Service Worker غير مدعوم');
        }
    }

    // إعداد موجه التثبيت
    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.installPrompt = e;
            this.showInstallButton();
        });

        window.addEventListener('appinstalled', () => {
            console.log('✅ تم تثبيت التطبيق');
            this.hideInstallButton();
            this.trackInstallation();
        });
    }

    // إعداد حالة الاتصال
    setupOnlineStatus() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.handleOnlineStatus();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.handleOfflineStatus();
        });
    }

    // إعداد المزامنة في الخلفية
    setupBackgroundSync() {
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
            this.registerSyncEvents();
        }
    }

    // إعداد الإشعارات الفورية
    setupPushNotifications() {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            this.subscribeToPushNotifications();
        }
    }

    // إعداد دورة حياة التطبيق
    setupAppLifecycle() {
        // إخفاء شريط العنوان في PWA
        if (window.matchMedia('(display-mode: standalone)').matches) {
            document.documentElement.classList.add('pwa-standalone');
        }

        // التعامل مع تغيير حجم الشاشة
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // التعامل مع تغيير الاتجاه
        window.addEventListener('orientationchange', () => {
            this.handleOrientationChange();
        });
    }

    // عرض زر التثبيت
    showInstallButton() {
        let installButton = document.getElementById('pwa-install-button');
        
        if (!installButton) {
            installButton = document.createElement('button');
            installButton.id = 'pwa-install-button';
            installButton.innerHTML = `
                <span class="install-icon">📱</span>
                <span class="install-text">تثبيت التطبيق</span>
            `;
            installButton.className = 'pwa-install-button';
            
            installButton.addEventListener('click', () => {
                this.installApp();
            });
            
            document.body.appendChild(installButton);
            
            // إضافة الأنماط
            this.addInstallButtonStyles();
        }
    }

    // إخفاء زر التثبيت
    hideInstallButton() {
        const installButton = document.getElementById('pwa-install-button');
        if (installButton) {
            installButton.remove();
        }
    }

    // تثبيت التطبيق
    async installApp() {
        if (!this.installPrompt) return;

        try {
            this.installPrompt.prompt();
            const result = await this.installPrompt.userChoice;
            
            if (result.outcome === 'accepted') {
                console.log('✅ قبل المستخدم التثبيت');
            } else {
                console.log('❌ رفض المستخدم التثبيت');
            }
            
            this.installPrompt = null;
            this.hideInstallButton();
        } catch (error) {
            console.error('❌ فشل تثبيت التطبيق:', error);
        }
    }

    // التعامل مع العثور على تحديث
    handleUpdateFound(registration) {
        const newWorker = registration.installing;
        
        newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.showUpdateNotification();
            }
        });
    }

    // عرض إشعار التحديث
    showUpdateNotification() {
        const notification = document.createElement('div');
        notification.className = 'pwa-update-notification';
        notification.innerHTML = `
            <div class="update-content">
                <span class="update-icon">🔄</span>
                <span class="update-text">تحديث جديد متاح</span>
                <button class="update-button" onclick="window.pwaManager.applyUpdate()">
                    تحديث الآن
                </button>
                <button class="update-close" onclick="this.parentElement.parentElement.remove()">
                    ✕
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        this.addUpdateNotificationStyles();
    }

    // تطبيق التحديث
    applyUpdate() {
        if (this.serviceWorker) {
            this.serviceWorker.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
        }
    }

    // التعامل مع حالة الاتصال
    handleOnlineStatus() {
        document.body.classList.remove('offline');
        document.body.classList.add('online');
        
        // إرسال الإشعارات المعلقة
        this.syncPendingData();
        
        // إظهار إشعار الاتصال
        this.showOnlineNotification();
    }

    // التعامل مع حالة الانقطاع
    handleOfflineStatus() {
        document.body.classList.remove('online');
        document.body.classList.add('offline');
        
        // إظهار إشعار الانقطاع
        this.showOfflineNotification();
    }

    // إظهار إشعار الاتصال
    showOnlineNotification() {
        if (window.notifications) {
            window.notifications.system({
                title: 'اتصال الإنترنت',
                body: 'تم استعادة الاتصال بالإنترنت',
                icon: '🌐'
            });
        }
    }

    // إظهار إشعار الانقطاع
    showOfflineNotification() {
        if (window.notifications) {
            window.notifications.system({
                title: 'انقطاع الاتصال',
                body: 'انقطع الاتصال بالإنترنت - يعمل التطبيق في وضع عدم الاتصال',
                icon: '📵'
            });
        }
    }

    // تسجيل أحداث المزامنة
    registerSyncEvents() {
        // تسجيل حدث مزامنة البيانات
        navigator.serviceWorker.ready.then(registration => {
            registration.sync.register('sync-data');
        });
    }

    // الاشتراك في الإشعارات الفورية
    async subscribeToPushNotifications() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.getVAPIDPublicKey()
            });
            
            // إرسال الاشتراك للخادم
            await this.sendSubscriptionToServer(subscription);
            
            console.log('✅ تم الاشتراك في الإشعارات الفورية');
        } catch (error) {
            console.error('❌ فشل الاشتراك في الإشعارات الفورية:', error);
        }
    }

    // الحصول على مفتاح VAPID العام
    getVAPIDPublicKey() {
        return 'BEl62iUYgUjyR16k5tA1lUI2Ze-YIuBLz8OaE7JFBqLGHJLb8hE9iLd3AnvLwDRqZUvA8yT2h3k8y';
    }

    // إرسال الاشتراك للخادم
    async sendSubscriptionToServer(subscription) {
        try {
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(subscription)
            });
            
            if (!response.ok) {
                throw new Error('فشل إرسال الاشتراك');
            }
            
            console.log('✅ تم إرسال اشتراك الإشعارات للخادم');
        } catch (error) {
            console.error('❌ فشل إرسال الاشتراك:', error);
        }
    }

    // مزامنة البيانات المعلقة
    async syncPendingData() {
        try {
            const pendingData = localStorage.getItem('pendingSyncData');
            if (pendingData) {
                const data = JSON.parse(pendingData);
                
                for (const item of data) {
                    await this.syncDataItem(item);
                }
                
                localStorage.removeItem('pendingSyncData');
                console.log('✅ تم مزامنة البيانات المعلقة');
            }
        } catch (error) {
            console.error('❌ فشل مزامنة البيانات المعلقة:', error);
        }
    }

    // مزامنة عنصر بيانات
    async syncDataItem(item) {
        try {
            const response = await fetch(item.url, {
                method: item.method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(item.data)
            });
            
            if (!response.ok) {
                throw new Error('فشل مزامنة العنصر');
            }
            
            console.log(`✅ تم مزامنة ${item.type}:`, item.id);
        } catch (error) {
            console.error(`❌ فشل مزامنة ${item.type}:`, error);
        }
    }

    // حفظ البيانات للمزامنة لاحقاً
    savePendingData(type, data, url, method = 'POST') {
        try {
            const pendingData = JSON.parse(localStorage.getItem('pendingSyncData') || '[]');
            
            pendingData.push({
                type,
                data,
                url,
                method,
                timestamp: new Date().toISOString()
            });
            
            localStorage.setItem('pendingSyncData', JSON.stringify(pendingData));
        } catch (error) {
            console.error('❌ فشل حفظ البيانات المعلقة:', error);
        }
    }

    // التعامل مع تغيير الحجم
    handleResize() {
        // تحديث تخطيط PWA حسب حجم الشاشة
        const width = window.innerWidth;
        
        if (width < 768) {
            document.documentElement.classList.add('pwa-mobile');
            document.documentElement.classList.remove('pwa-tablet', 'pwa-desktop');
        } else if (width < 1024) {
            document.documentElement.classList.add('pwa-tablet');
            document.documentElement.classList.remove('pwa-mobile', 'pwa-desktop');
        } else {
            document.documentElement.classList.add('pwa-desktop');
            document.documentElement.classList.remove('pwa-mobile', 'pwa-tablet');
        }
    }

    // التعامل مع تغيير الاتجاه
    handleOrientationChange() {
        const orientation = window.orientation;
        
        if (orientation === 90 || orientation === -90) {
            document.documentElement.classList.add('landscape');
            document.documentElement.classList.remove('portrait');
        } else {
            document.documentElement.classList.add('portrait');
            document.documentElement.classList.remove('landscape');
        }
    }

    // تتبع التثبيت
    trackInstallation() {
        try {
            // إرسال إحصائيات التثبيت
            if (window.gtag) {
                gtag('event', 'pwa_install', {
                    'event_category': 'PWA',
                    'event_label': 'app_installed'
                });
            }
        } catch (error) {
            console.error('فشل تتبع التثبيت:', error);
        }
    }

    // إضافة أنماط زر التثبيت
    addInstallButtonStyles() {
        if (document.getElementById('pwa-install-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'pwa-install-styles';
        style.textContent = `
            .pwa-install-button {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #8b5cf6, #7c3aed);
                color: white;
                border: none;
                border-radius: 12px;
                padding: 12px 20px;
                font-family: 'Cairo', sans-serif;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(139, 92, 246, 0.3);
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.3s ease;
                direction: ltr;
            }
            
            .pwa-install-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 30px rgba(139, 92, 246, 0.4);
            }
            
            .pwa-install-button:active {
                transform: translateY(0);
            }
            
            .install-icon {
                font-size: 18px;
            }
            
            .install-text {
                font-size: 14px;
            }
            
            @media (max-width: 640px) {
                .pwa-install-button {
                    bottom: 10px;
                    right: 10px;
                    padding: 10px 16px;
                    font-size: 12px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    // إضافة أنماط إشعار التحديث
    addUpdateNotificationStyles() {
        if (document.getElementById('pwa-update-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'pwa-update-styles';
        style.textContent = `
            .pwa-update-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95));
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 16px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(10px);
                z-index: 10000;
                direction: rtl;
            }
            
            .update-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .update-icon {
                font-size: 24px;
                color: #8b5cf6;
            }
            
            .update-text {
                color: #f1f5f9;
                font-family: 'Cairo', sans-serif;
                font-size: 14px;
                font-weight: 600;
            }
            
            .update-button {
                background: #8b5cf6;
                color: white;
                border: none;
                border-radius: 6px;
                padding: 8px 16px;
                font-family: 'Cairo', sans-serif;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .update-button:hover {
                background: #7c3aed;
            }
            
            .update-close {
                background: none;
                border: none;
                color: #64748b;
                font-size: 16px;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s ease;
            }
            
            .update-close:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #f1f5f9;
            }
            
            @media (max-width: 640px) {
                .pwa-update-notification {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                }
                
                .update-content {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 8px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    // التحقق من دعم PWA
    checkPWASupport() {
        return {
            serviceWorker: 'serviceWorker' in navigator,
            manifest: 'manifest' in document,
            push: 'PushManager' in window,
            sync: 'sync' in window.ServiceWorkerRegistration.prototype,
            installPrompt: 'beforeinstallprompt' in window,
            standalone: window.matchMedia('(display-mode: standalone)').matches
        };
    }

    // الحصول على معلومات PWA
    getPWAInfo() {
        return {
            isInstalled: window.matchMedia('(display-mode: standalone)').matches,
            isOnline: this.isOnline,
            hasServiceWorker: !!this.serviceWorker,
            hasInstallPrompt: !!this.installPrompt,
            support: this.checkPWASupport()
        };
    }

    // تفعيل وضع عدم الاتصال
    enableOfflineMode() {
        document.body.classList.add('offline-mode');
        console.log('📵 تم تفعيل وضع عدم الاتصال');
    }

    // تعطيل وضع عدم الاتصال
    disableOfflineMode() {
        document.body.classList.remove('offline-mode');
        console.log('🌐 تم تعطيل وضع عدم الاتصال');
    }
}

// تهيئة مدير PWA
window.pwaManager = new PWAManager();

// اختصارات للوظائف الشائعة
window.pwa = {
    install: () => window.pwaManager.installApp(),
    update: () => window.pwaManager.applyUpdate(),
    sync: () => window.pwaManager.syncPendingData(),
    info: () => window.pwaManager.getPWAInfo(),
    support: () => window.pwaManager.checkPWASupport(),
    offline: {
        enable: () => window.pwaManager.enableOfflineMode(),
        disable: () => window.pwaManager.disableOfflineMode()
    }
};
