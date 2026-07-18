
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

/**
 * يحصل على معرف الجهاز من التخزين المحلي أو ينشئ واحداً جديداً
 */
export const getDeviceFingerprint = (): string => {
  let deviceId = localStorage.getItem('uniteam_device_token');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('uniteam_device_token', deviceId);
  }
  return deviceId;
};

// ==========================================
// نظام مزامنة الوقت الحقيقي وحمايته من التلاعب (Anti-Clock Tampering System)
// ==========================================

let serverSyncOffset = 0; // الفرق بالمللي ثانية لإضافته لـ Date.now() للوصول للوقت الحقيقي
let lastSyncPerformanceTime = 0;
let hasSynced = false;

// تحميل الفرق المخزن مسبقاً من التخزين المحلي لتسهيل العمل فوراً حتى لو كان الموظف خارج التغطية مؤقتاً
const savedOffsetStr = localStorage.getItem('uniteam_time_offset');
if (savedOffsetStr) {
  serverSyncOffset = parseInt(savedOffsetStr, 10) || 0;
  hasSynced = true;
}

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

      serverSyncOffset = adjustedServerTime - Date.now();
      lastSyncPerformanceTime = endTime;
      hasSynced = true;
      localStorage.setItem('uniteam_time_offset', serverSyncOffset.toString());
      console.log('Time synced with app server. Offset:', serverSyncOffset, 'ms');
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

        serverSyncOffset = adjustedServerTime - Date.now();
        lastSyncPerformanceTime = endTime;
        hasSynced = true;
        localStorage.setItem('uniteam_time_offset', serverSyncOffset.toString());
        console.log('Time synced with WorldTimeAPI (Egypt). Offset:', serverSyncOffset, 'ms');
        return;
      }
    }
  } catch (e) {
    console.warn('WorldTimeAPI sync failed.', e);
  }
};

/**
 * الحصول على الوقت الحقيقي الموثق (UTC) غير القابل للتلاعب
 */
export const getRealNetworkTime = (): Date => {
  let computedTimeMs = Date.now() + serverSyncOffset;

  // فحص التلاعب برجع الساعة إلى الوراء (Anti-Clock Rewinding)
  const lastKnownStr = localStorage.getItem('uniteam_last_known_real_time');
  if (lastKnownStr) {
    const lastKnown = parseInt(lastKnownStr, 10);
    if (computedTimeMs < lastKnown) {
      console.warn('Clock tampering detected! Current system clock is behind last known real time.');
      // إذا قام الموظف بتأخير ساعة هاتفه، نجبر التطبيق على المتابعة من آخر وقت حقيقي معروف + ثانية واحدة لتجنب الاحتيال
      computedTimeMs = lastKnown + 1000;
    }
  }

  localStorage.setItem('uniteam_last_known_real_time', computedTimeMs.toString());
  return new Date(computedTimeMs);
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
  const d = new Date();
  d.setFullYear(comps.year, comps.month - 1, comps.day);
  d.setHours(comps.hour, comps.minute, comps.second, 0);
  return d;
}

