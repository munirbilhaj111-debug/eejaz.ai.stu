// Service Worker لـ PWA

const CACHE_NAME = 'eejaz-pwa-v3';
const STATIC_CACHE = 'eejaz-static-v3';
const DYNAMIC_CACHE = 'eejaz-dynamic-v3';

// الملفات الثابتة للتخزين المؤقت
const STATIC_ASSETS = [
    './',
    'index.html',
    'manifest.json',
    'css/styles.css',
    'css/ui-enhancements.css',
    'js/app.js',
    'js/student_portal.js',
    'js/database.js',
    'js/auth.js',
    'js/academic.js',
    'js/saas-manager.js',
    'js/cache-manager.js',
    'js/lazy-loader.js',
    'js/validation-system.js',
    'js/advanced-charts.js',
    'js/pdf-reports.js',
    'js/real-time-notifications.js',
    'js/pwa-manager.js',
    'js/institute-isolation-manager.js',
    'js/theme-manager.js',
    'js/notifications.js'
];

// تثبيت Service Worker
self.addEventListener('install', (event) => {
    console.log('📱 تثبيت Service Worker...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('✅ تخزين الملفات الثابتة');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch((error) => {
                console.error('❌ فشل تخزين الملفات الثابتة:', error);
            })
    );
});

// تفعيل Service Worker
self.addEventListener('activate', (event) => {
    console.log('🚀 تفعيل Service Worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('🗑️ حذف الكاش القديم:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ تم تفعيل Service Worker');
                return self.clients.claim();
            })
    );
});

// اعتراض طلبات الشبكة
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // استراتيجية خاصة لـ Supabase و API
    if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // تخزين نسخة في الكاش الديناميكي للعمل دون اتصال
                    if (response.ok && request.method === 'GET') {
                        const responseClone = response.clone();
                        caches.open(DYNAMIC_CACHE).then(cache => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // في حالة الفشل (أوفلاين)، حاول البحث في الكاش
                    return caches.match(request);
                })
        );
        return;
    }

    // استراتيجية Stale-While-Revalidate للملفات الثابتة
    const isStaticAsset = STATIC_ASSETS.some(asset => url.pathname.endsWith(asset.replace('./', ''))) ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.svg');

    if (isStaticAsset || url.pathname === '/' || url.pathname.endsWith('index.html')) {
        event.respondWith(
            caches.match(request).then(cachedResponse => {
                const fetchPromise = fetch(request).then(networkResponse => {
                    if (networkResponse.ok) {
                        caches.open(STATIC_CACHE).then(cache => {
                            cache.put(request, networkResponse.clone());
                        });
                    }
                    return networkResponse;
                });
                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // الاستراتيجية الافتراضية: الشبكة أولاً مع الرجوع للكاش
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok && request.method === 'GET') {
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE).then(cache => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});

// معالجة الرسائل
self.addEventListener('message', (event) => {
    const { type, data } = event.data;

    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;

        case 'GET_VERSION':
            event.ports[0].postMessage({
                type: 'VERSION',
                version: '1.0.0'
            });
            break;

        case 'CLEAR_CACHE':
            clearAllCaches()
                .then(() => {
                    event.ports[0].postMessage({
                        type: 'CACHE_CLEARED'
                    });
                });
            break;
    }
});

// المزامنة في الخلفية
self.addEventListener('sync', (event) => {
    console.log('🔄 بدء المزامنة في الخلفية:', event.tag);

    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

// الإشعارات الفورية
self.addEventListener('push', (event) => {
    console.log('📢 استلام إشعار فوري:', event);

    const options = {
        body: event.data.text(),
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'استكشاف',
                icon: '/icon-192x192.png'
            },
            {
                action: 'close',
                title: 'إغلاق',
                icon: '/icon-192x192.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('إيجاز', options)
    );
});

// التعامل مع النقر على الإشعار
self.addEventListener('notificationclick', (event) => {
    console.log('🖱️ النقر على الإشعار:', event);

    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    } else if (event.action === 'close') {
        // إغلاق الإشعار فقط
    } else {
        // فتح التطبيق عند النقر على الإشعار
        event.waitUntil(
            clients.matchAll()
                .then((clientList) => {
                    for (const client of clientList) {
                        if (client.url === '/' && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    if (clients.openWindow) {
                        return clients.openWindow('/');
                    }
                })
        );
    }
});

// إغلاق الإشعار
self.addEventListener('notificationclose', (event) => {
    console.log('🔕 إغلاق الإشعار:', event);

    // إحصائيات الإشعارات المغلقة
    const notification = event.notification;
    const primaryKey = notification.data.primaryKey;

    console.log('تم إغلاق الإشعار:', primaryKey);
});

// مسح جميع الكاش
async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('🧹 تم مسح جميع الكاش');
}

// مزامنة البيانات
async function syncData() {
    try {
        // جلب البيانات المعلقة من IndexedDB
        const pendingData = await getPendingData();

        for (const item of pendingData) {
            try {
                const response = await fetch(item.url, {
                    method: item.method,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(item.data)
                });

                if (response.ok) {
                    await removePendingData(item.id);
                    console.log('✅ تم مزامنة:', item.id);
                }
            } catch (error) {
                console.error('❌ فشل مزامنة:', item.id, error);
            }
        }
    } catch (error) {
        console.error('❌ فشل المزامنة:', error);
    }
}

// الحصول على البيانات المعلقة (محاكاة IndexedDB)
async function getPendingData() {
    // في التطبيق الحقيقي، هذا سيتصل بـ IndexedDB
    return [];
}

// إزالة البيانات المعلقة (محاكاة IndexedDB)
async function removePendingData(id) {
    // في التطبيق الحقيقي، هذا سيتصل بـ IndexedDB
    console.log('إزالة البيانات المعلقة:', id);
}

// التحقق من صحة الكاش
async function validateCache() {
    try {
        const cache = await caches.open(STATIC_CACHE);
        const keys = await cache.keys();

        for (const request of keys) {
            const response = await cache.match(request);
            if (!response || response.status !== 200) {
                await cache.delete(request);
                console.log('🗑️ حذف ملف كاش غير صالح:', request.url);
            }
        }
    } catch (error) {
        console.error('❌ فشل التحقق من صحة الكاش:', error);
    }
}

// تحديث الكاش
async function updateCache() {
    try {
        const cache = await caches.open(STATIC_CACHE);

        for (const asset of STATIC_ASSETS) {
            try {
                const response = await fetch(asset);
                if (response.ok) {
                    await cache.put(asset, response);
                    console.log('✅ تحديث الكاش:', asset);
                }
            } catch (error) {
                console.error('❌ فشل تحديث الكاش:', asset, error);
            }
        }
    } catch (error) {
        console.error('❌ فشل تحديث الكاش:', error);
    }
}

// تنظيف الكاش القديم
async function cleanupCache() {
    try {
        const cacheNames = await caches.keys();
        const currentTime = Date.now();

        for (const cacheName of cacheNames) {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                const cache = await caches.open(cacheName);
                const requests = await cache.keys();

                for (const request of requests) {
                    const response = await cache.match(request);
                    if (response) {
                        const date = response.headers.get('date');
                        if (date) {
                            const responseTime = new Date(date).getTime();
                            const age = currentTime - responseTime;
                            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 أيام

                            if (age > maxAge) {
                                await cache.delete(request);
                                console.log('🗑️ حذف ملف كاش قديم:', request.url);
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ فشل تنظيف الكاش:', error);
    }
}

// تشغيل التنظيف الدوري
setInterval(() => {
    cleanupCache();
}, 24 * 60 * 60 * 1000); // كل 24 ساعة

console.log('📱 Service Worker جاهز للعمل');
