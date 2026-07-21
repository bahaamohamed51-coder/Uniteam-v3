
/**
 * Calculates the distance between two points in meters using Haversine formula
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const formatDate = (dateStr: string) => {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(dateStr));
};

import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

// ==========================================
// نظام التخزين المقاوم للمسح (IndexedDB) والمعرف المستقر للجهاز
// ==========================================

const DB_NAME = 'uniteam_secure_db';
const STORE_NAME = 'device_settings';
const KEY_NAME = 'permanent_device_id';

const getIndexedDBValue = (): Promise<string | null> => {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          resolve(null);
          return;
        }
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const getReq = store.get(KEY_NAME);
        getReq.onsuccess = () => {
          resolve(getReq.result || null);
        };
        getReq.onerror = () => {
          resolve(null);
        };
      };
      request.onerror = () => {
        resolve(null);
      };
    } catch (e) {
      resolve(null);
    }
  });
};

const setIndexedDBValue = (value: string): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const putReq = store.put(value, KEY_NAME);
        putReq.onsuccess = () => {
          resolve(true);
        };
        putReq.onerror = () => {
          resolve(false);
        };
      };
      request.onerror = () => {
        resolve(false);
      };
    } catch (e) {
      resolve(false);
    }
  });
};

let cachedDeviceFingerprint = '';

/**
 * تهيئة وإعداد معرف الجهاز بشكل غير قابل للمسح أو التغيير
 */
export const initDeviceFingerprint = async (): Promise<string> => {
  if (cachedDeviceFingerprint) {
    return cachedDeviceFingerprint;
  }

  // 1. على الهواتف والأندرويد (عبر Capacitor): جلب المعرف الحقيقي الفريد للعتاد (Hardware UUID)
  try {
    if (Capacitor.isNativePlatform()) {
      const info = await Device.getId();
      if (info && info.identifier) {
        // معرف عتاد ثابت لا يتغير بحذف الكاش أو إعادة التثبيت
        cachedDeviceFingerprint = 'cap_' + info.identifier;
        localStorage.setItem('uniteam_device_token', cachedDeviceFingerprint);
        await setIndexedDBValue(cachedDeviceFingerprint);
        return cachedDeviceFingerprint;
      }
    }
  } catch (e) {
    console.warn('Capacitor Device ID detection failed, falling back to Web storage:', e);
  }

  // 2. على المتصفحات واللاب توب: الفحص المزدوج بين LocalStorage و IndexedDB لمنع الحذف
  let localId = localStorage.getItem('uniteam_device_token');
  let indexedId = await getIndexedDBValue();

  if (localId && !indexedId) {
    // إعادة البناء في IndexedDB
    await setIndexedDBValue(localId);
    cachedDeviceFingerprint = localId;
  } else if (!localId && indexedId) {
    // إعادة البناء في LocalStorage
    localStorage.setItem('uniteam_device_token', indexedId);
    cachedDeviceFingerprint = indexedId;
  } else if (localId && indexedId) {
    // مطابقة وتوحيد المعرف
    cachedDeviceFingerprint = indexedId;
    localStorage.setItem('uniteam_device_token', indexedId);
  } else {
    // توليد معرف جديد وحفظه في كلا المنصتين المقاومتين للمسح
    const newId = 'web_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem('uniteam_device_token', newId);
    await setIndexedDBValue(newId);
    cachedDeviceFingerprint = newId;
  }

  return cachedDeviceFingerprint;
};

/**
 * الحصول على معرف الجهاز الموثق والآمن
 */
export const getDeviceFingerprint = (): string => {
  if (cachedDeviceFingerprint) {
    return cachedDeviceFingerprint;
  }
  // كاحتياط متزامن إذا تم الاستدعاء قبل انتهاء التهيئة
  const localId = localStorage.getItem('uniteam_device_token');
  if (localId) {
    cachedDeviceFingerprint = localId;
    return localId;
  }
  return 'gen_waiting_init';
};

// ==========================================
// فحص الحماية من المواقع الوهمية وتزييف الـ GPS (Anti-Spoofing & Mock GPS)
// ==========================================

export interface GPSCheckResult {
  isMocked: boolean;
  reason: string;
}

export const verifyGPSIntegrity = (
  position: any,
  responseTimeMs: number
): GPSCheckResult => {
  // أ. الفحص على الأندرويد والهواتف (عبر Capacitor): التحقق من أن الإحداثيات قادمة من مستشعر حقيقي
  // الهواتف تضع خاصية mocked داخل كائن الإحداثيات إذا كانت قادمة من تطبيق Fake GPS أو خيارات المطور
  if (position && position.coords) {
    const coords = position.coords;
    if (coords.mocked === true || coords.mocked === 'true' || position.mocked === true) {
      return {
        isMocked: true,
        reason: 'تنبيه أمني: تم اكتشاف إحداثيات موقع وهمية (Mock Location Detected) - يرجى إيقاف برامج تزييف الموقع الجغرافي.'
      };
    }
  }

  // ب. الفحص على المتصفحات واللاب توب: التحقق من الدقة (Accuracy) واستجابة الإشارة والأنماط المريبة
  if (position && position.coords) {
    const accuracy = position.coords.accuracy;

    // 1. الدقة السلبية أو الصفرية (مستحيلة في أجهزة الاستقبال الحقيقية وتشير لتزييف برمجي)
    if (accuracy <= 0) {
      return {
        isMocked: true,
        reason: 'تنبيه أمني: دقة إشارة الـ GPS غير صالحة وتدل على تلاعب برمجي بالموقع.'
      };
    }

    // 2. قيم دقة مثالية مستحيلة وثابتة (العديد من برامج تزييف الـ GPS تضع الدقة كـ 1.0 متر أو 0 متر وتستجيب فوراً)
    if (responseTimeMs < 150 && accuracy === 1) {
      return {
        isMocked: true,
        reason: 'تنبيه أمني: سرعة استجابة فائقة غير واقعية مع دقة مثالية غير طبيعية - تم حظر محاولة التزييف.'
      };
    }

    // 3. دقة رقمية صحيحة ثابتة (مثل 10.0 أو 5.0) دون أي كسور عشرية متغيرة على أجهزة اللاب توب
    if (accuracy === 10 || accuracy === 5) {
      return {
        isMocked: true,
        reason: 'تنبيه أمني: نمط دقة رقمي ثابت ومريب يشير إلى استخدام محاكي مواقع.'
      };
    }

    // 4. دقة ضعيفة جداً لا يمكن الثقة بها لتحديد الحضور (أكبر من 150 متر)
    if (accuracy > 150) {
      return {
        isMocked: true,
        reason: 'إشارة الـ GPS ضعيفة جداً (> 150 متر). يرجى فتح الـ GPS والوقوف في مكان مفتوح للحصول على دقة مقبولة.'
      };
    }
  }

  return { isMocked: false, reason: '' };
};

// ==========================================
// حظر وضع مطوري البرامج (Anti-Developer Mode)
// ==========================================

export interface DevModeResult {
  isDev: boolean;
  reason: string;
}

export const checkDeveloperModeActive = async (): Promise<DevModeResult> => {
  // أ. على الهواتف والأندرويد (عبر Capacitor): فحص بيئة التشغيل وهل هي محاكاة (Virtual Emulator)
  try {
    if (Capacitor.isNativePlatform()) {
      const info = await Device.getInfo();
      if (info.isVirtual) {
        return {
          isDev: true,
          reason: 'تنبيه أمني: لا يمكن تسجيل الحضور من داخل محاكي (Virtual Emulator) أو جهاز وهمي.'
        };
      }
    }
  } catch (e) {
    console.warn('Failed to inspect native device virtual environment:', e);
  }

  // ب. على المتصفحات واللاب توب: كشف فتح أدوات المطور (Developer Tools) بالمتصفح
  const threshold = 160;
  // فحص الفرق بين حجم الشاشة الداخلي والخارجي
  const isDevToolsOpen = 
    (window.outerWidth - window.innerWidth > threshold) || 
    (window.outerHeight - window.innerHeight > threshold);

  if (isDevToolsOpen) {
    return {
      isDev: true,
      reason: 'تنبيه أمني: يرجى إغلاق أدوات مطوري البرامج (Developer Tools) بالمتصفح لإتمام عملية الحضور/الانصراف.'
    };
  }

  // ج. التحقق من التلاعب وفحص الكود النشط (Debugger detection) عبر فارق الوقت
  const start = performance.now();
  debugger;
  const end = performance.now();
  if (end - start > 100) {
    return {
      isDev: true,
      reason: 'تنبيه أمني: تم كشف تنقيح نشط للكود (Debugger Active) - يرجى إيقاف وضع التطوير.'
    };
  }

  return { isDev: false, reason: '' };
};


// ==========================================
// نظام مزامنة الوقت الحقيقي وحمايته من التلاعب (Anti-Clock Tampering System)
// ==========================================

let syncBaseTimeMs = Date.now();
let syncBasePerfMs = performance.now();
let lastSavedTimeMs = 0;
let hasSyncedWithServer = false;

// 1. تحميل الفرق المخزن مسبقاً من التخزين المحلي لتسهيل العمل فوراً
const savedOffsetStr = localStorage.getItem('uniteam_time_offset');
let initialOffset = 0;
if (savedOffsetStr) {
  initialOffset = parseInt(savedOffsetStr, 10) || 0;
}

// 2. حساب الوقت الافتراضي عند بدء التشغيل
let initialTimeMs = Date.now() + initialOffset;

// 3. التحقق من تلاعب الساعة وإعادتها للوراء عند بدء التشغيل
const lastKnownStr = localStorage.getItem('uniteam_last_known_real_time');
if (lastKnownStr) {
  const lastKnown = parseInt(lastKnownStr, 10) || 0;
  if (initialTimeMs < lastKnown) {
    console.warn('Clock tampering/rewinding detected on startup.');
    // نجبر التطبيق على البدء من آخر وقت حقيقي موثق + ثانية واحدة
    initialTimeMs = lastKnown + 1000;
    // تعديل الفارق لمنع التلاعب
    initialOffset = initialTimeMs - Date.now();
    localStorage.setItem('uniteam_time_offset', initialOffset.toString());
  }
}

// تثبيت نقطة الأساس للوقت والمؤقت عالي الدقة (Monotonic Clock)
syncBaseTimeMs = initialTimeMs;
syncBasePerfMs = performance.now();

/**
 * مزامنة وقت التطبيق مع خوادم موثوقة (خادم التطبيق أو API عامة)
 */
export const syncTimeWithServer = async () => {
  const startTime = performance.now();
  
  // المحاولة 1: جلب الوقت من خادم التطبيق المحلي (سريع وموثوق جداً ومحمي من جدار الحماية)
  try {
    const res = await fetch('/server-config.json?t=' + Date.now(), { method: 'HEAD' });
    const serverDateHeader = res.headers.get('date');
    if (serverDateHeader) {
      const serverTime = new Date(serverDateHeader).getTime();
      const endTime = performance.now();
      const rtt = endTime - startTime; // زمن الرحلة ذهاباً وإياباً
      const adjustedServerTime = serverTime + (rtt / 2); // تصحيح الوقت بإضافة نصف الـ RTT

      const offset = adjustedServerTime - Date.now();
      localStorage.setItem('uniteam_time_offset', offset.toString());
      
      // تحديث نقاط الأساس في الذاكرة
      syncBaseTimeMs = adjustedServerTime;
      syncBasePerfMs = endTime;
      hasSyncedWithServer = true;
      console.log('Time synced with app server. Base:', new Date(syncBaseTimeMs).toISOString());
      return;
    }
  } catch (e) {
    console.warn('App server sync failed, attempting fallbacks...', e);
  }

  // المحاولة 2: جلب الوقت من WorldTimeAPI لجمهورية مصر العربية
  try {
    const res = await fetch('https://worldtimeapi.org/api/timezone/Africa/Cairo');
    if (res.ok) {
      const data = await res.json();
      if (data && data.unixtime) {
        const serverTime = data.unixtime * 1000;
        const endTime = performance.now();
        const rtt = endTime - startTime;
        const adjustedServerTime = serverTime + (rtt / 2);

        const offset = adjustedServerTime - Date.now();
        localStorage.setItem('uniteam_time_offset', offset.toString());

        // تحديث نقاط الأساس في الذاكرة
        syncBaseTimeMs = adjustedServerTime;
        syncBasePerfMs = endTime;
        hasSyncedWithServer = true;
        console.log('Time synced with WorldTimeAPI (Egypt). Base:', new Date(syncBaseTimeMs).toISOString());
        return;
      }
    }
  } catch (e) {
    console.warn('WorldTimeAPI sync failed.', e);
  }
};

/**
 * الحصول على الوقت الحقيقي الموثق (UTC) غير القابل للتلاعب
 * يعتمد على مؤقت المتصفح الأحادي (performance.now) لضمان زيادة بمعدل 1 ثانية في الثانية مهما حصل من تلاعب في ساعة الهاتف أثناء الجلسة
 */
export const getRealNetworkTime = (): Date => {
  const elapsedMs = performance.now() - syncBasePerfMs;
  const currentRealTimeMs = syncBaseTimeMs + elapsedMs;

  // حفظ آخر وقت حقيقي معروف في التخزين المحلي بحد أقصى مرة كل 5 ثوانٍ لتجنب الحلقات اللانهائية السريعة وحماية الأداء
  const nowPerf = performance.now();
  if (nowPerf - lastSavedTimeMs > 5000) {
    localStorage.setItem('uniteam_last_known_real_time', Math.round(currentRealTimeMs).toString());
    lastSavedTimeMs = nowPerf;
  }

  return new Date(currentRealTimeMs);
};

/**
 * استخراج تفاصيل التاريخ والوقت لجمهورية مصر العربية بالتحديد (توقيت القاهرة) بغض النظر عن لغة ونطاق الهاتف
 */
export function getEgyptDateTimeComponents(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const components: { [key: string]: number } = {};
  parts.forEach(p => {
    if (p.type !== 'literal') {
      components[p.type] = parseInt(p.value, 10);
    }
  });
  return components;
}

/**
 * تحويل أي تاريخ إلى كائن تاريخ يعمل بالتوقيت المحلي لجمهورية مصر العربية (قاهرية)
 */
export function getEgyptTime(dateInput?: Date | number | string): Date {
  const baseDate = dateInput ? new Date(dateInput) : getRealNetworkTime();
  const comps = getEgyptDateTimeComponents(baseDate);
  
  // إنشاء كائن تاريخ يعكس قيم الوقت الخاصة بمصر محلياً
  const d = new Date(baseDate.getTime());
  d.setFullYear(comps.year, comps.month - 1, comps.day);
  d.setHours(comps.hour, comps.minute, comps.second, 0);
  return d;
}

