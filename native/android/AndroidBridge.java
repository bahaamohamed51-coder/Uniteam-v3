package com.uniteam.attendance;

import android.app.AppOpsManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import java.util.List;

/**
 * جسر أصلي بين نظام أندرويد وواجهة الويب.
 *
 * يُسجَّل في MainActivity باسم "AndroidBridge"، فيصبح متاحاً في JavaScript
 * عبر window.AndroidBridge ويستدعيه ملف utils.ts مباشرة.
 *
 * كل دالة محاطة بـ try/catch لأن استدعاءها يحدث من WebView،
 * وأي استثناء غير ملتقط قد يوقف الصفحة بالكامل.
 */
public class AndroidBridge {

    private final Context ctx;

    public AndroidBridge(Context context) {
        this.ctx = context.getApplicationContext();
    }

    // =====================================================
    // 1) معرّف الجهاز الفريد
    // =====================================================

    /**
     * يعيد ANDROID_ID وهو معرّف ثابت مرتبط بـ (الجهاز + المستخدم + مفتاح توقيع التطبيق).
     *
     * يبقى ثابتاً عند حذف التطبيق وإعادة تثبيته طالما أن مفتاح التوقيع لم يتغير.
     * يتغير فقط عند إعادة ضبط المصنع أو تغيير مفتاح التوقيع.
     */
    @JavascriptInterface
    public String getAndroidId() {
        try {
            String id = Settings.Secure.getString(
                    ctx.getContentResolver(),
                    Settings.Secure.ANDROID_ID
            );
            return id == null ? "" : id;
        } catch (Exception e) {
            return "";
        }
    }

    /**
     * معلومات وصفية للجهاز، تُعرض للمشرف عند الحاجة لتمييز الأجهزة.
     */
    @JavascriptInterface
    public String getDeviceModel() {
        try {
            return Build.MANUFACTURER + " " + Build.MODEL;
        } catch (Exception e) {
            return "";
        }
    }

    /**
     * للتأكد من الجانب الآخر أن الجسر يعمل فعلاً.
     */
    @JavascriptInterface
    public boolean isNativeBridgeReady() {
        return true;
    }

    // =====================================================
    // 2) كشف وضع المطور
    // =====================================================

    /**
     * يفحص إعدادات النظام مباشرة:
     * - DEVELOPMENT_SETTINGS_ENABLED: تفعيل قائمة "خيارات المطور"
     * - ADB_ENABLED: تفعيل تصحيح USB
     */
    @JavascriptInterface
    public boolean isDeveloperOptionsEnabled() {
        try {
            int devEnabled = Settings.Global.getInt(
                    ctx.getContentResolver(),
                    Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
                    0
            );
            if (devEnabled != 0) {
                return true;
            }

            int adbEnabled = Settings.Global.getInt(
                    ctx.getContentResolver(),
                    Settings.Global.ADB_ENABLED,
                    0
            );
            return adbEnabled != 0;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * يوضح أي الإعدادين هو المفعّل، ليظهر في رسالة التنبيه وسجل المحاولات.
     */
    @JavascriptInterface
    public String getDeveloperOptionsDetail() {
        try {
            int devEnabled = Settings.Global.getInt(
                    ctx.getContentResolver(),
                    Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
                    0
            );
            int adbEnabled = Settings.Global.getInt(
                    ctx.getContentResolver(),
                    Settings.Global.ADB_ENABLED,
                    0
            );

            if (devEnabled != 0 && adbEnabled != 0) {
                return "خيارات المطور وتصحيح USB مفعّلان";
            }
            if (devEnabled != 0) {
                return "خيارات المطور مفعّلة";
            }
            if (adbEnabled != 0) {
                return "تصحيح USB مفعّل";
            }
            return "";
        } catch (Exception e) {
            return "";
        }
    }

    // =====================================================
    // 3) كشف الموقع الوهمي
    // =====================================================

    /**
     * طبقتان مستقلتان للكشف:
     * أ) فحص آخر موقع معروف من كل مزوّد وقراءة علم isMock عليه
     * ب) البحث عن أي تطبيق مثبّت مُنح صلاحية "تعيين موقع وهمي"
     */
    @JavascriptInterface
    public boolean isMockLocationActive() {
        if (hasMockFlagOnLastLocation()) {
            return true;
        }
        return hasAppWithMockLocationPermission();
    }

    @JavascriptInterface
    public String getMockLocationDetail() {
        if (hasMockFlagOnLastLocation()) {
            return "علم الموقع الوهمي مرفوع على آخر إحداثيات من النظام";
        }
        String pkg = findMockLocationApp();
        if (pkg != null) {
            return "تطبيق ممنوح صلاحية الموقع الوهمي: " + pkg;
        }
        return "";
    }

    private boolean hasMockFlagOnLastLocation() {
        try {
            LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
            if (lm == null) {
                return false;
            }

            String[] providers = {
                    LocationManager.GPS_PROVIDER,
                    LocationManager.NETWORK_PROVIDER,
                    LocationManager.PASSIVE_PROVIDER
            };

            for (String provider : providers) {
                try {
                    Location loc = lm.getLastKnownLocation(provider);
                    if (loc != null && isMockLocation(loc)) {
                        return true;
                    }
                } catch (SecurityException se) {
                    // صلاحية الموقع لم تُمنح بعد - نتجاهل هذا المزوّد
                } catch (IllegalArgumentException iae) {
                    // مزوّد غير متاح على هذا الجهاز
                }
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    @SuppressWarnings("deprecation")
    private boolean isMockLocation(Location loc) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                return loc.isMock();
            }
            return loc.isFromMockProvider();
        } catch (Exception e) {
            return false;
        }
    }

    private boolean hasAppWithMockLocationPermission() {
        return findMockLocationApp() != null;
    }

    /**
     * يمر على التطبيقات المثبتة ويسأل نظام AppOps:
     * هل مُنح هذا التطبيق صلاحية OPSTR_MOCK_LOCATION؟
     *
     * يحتاج QUERY_ALL_PACKAGES على أندرويد 11 فأعلى ليرى القائمة كاملة.
     */
    private String findMockLocationApp() {
        try {
            PackageManager pm = ctx.getPackageManager();
            AppOpsManager aom = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
            if (pm == null || aom == null) {
                return null;
            }

            List<ApplicationInfo> apps = pm.getInstalledApplications(PackageManager.GET_META_DATA);
            String selfPackage = ctx.getPackageName();

            for (ApplicationInfo app : apps) {
                if (app == null || app.packageName == null) {
                    continue;
                }
                if (app.packageName.equals(selfPackage)) {
                    continue;
                }

                try {
                    int mode;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        mode = aom.unsafeCheckOpNoThrow(
                                AppOpsManager.OPSTR_MOCK_LOCATION,
                                app.uid,
                                app.packageName
                        );
                    } else {
                        mode = aom.checkOpNoThrow(
                                AppOpsManager.OPSTR_MOCK_LOCATION,
                                app.uid,
                                app.packageName
                        );
                    }

                    if (mode == AppOpsManager.MODE_ALLOWED) {
                        return app.packageName;
                    }
                } catch (Exception ignored) {
                    // بعض التطبيقات النظامية ترفض الاستعلام - نتجاوزها
                }
            }
        } catch (Exception e) {
            return null;
        }
        return null;
    }
}
