package com.uniteam.attendance;

import android.app.AppOpsManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
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

    /** الصلاحية التي يعلنها أي برنامج موقع وهمي حقيقي في ملف الـ Manifest الخاص به */
    private static final String MOCK_PERMISSION = "android.permission.ACCESS_MOCK_LOCATION";

    /** بادئات حزم الشركات المصنّعة - تُستثنى احتياطاً حتى لو حُدّثت من المتجر */
    private static final String[] VENDOR_PREFIXES = {
            "com.android.", "com.google.android.", "android.",
            "com.samsung.", "com.sec.", "com.sec.android.",
            "com.miui.", "com.xiaomi.", "com.mi.",
            "com.huawei.", "com.hihonor.",
            "com.oppo.", "com.coloros.", "com.oplus.",
            "com.vivo.", "com.bbk.",
            "com.oneplus.", "com.motorola.", "com.lge.", "com.transsion.",
            "com.qualcomm.", "com.mediatek."
    };

    /**
     * يبحث عن برنامج موقع وهمي حقيقي مثبّت من المستخدم.
     *
     * الفحص القديم كان يكتفي بسؤال AppOps، وهذا خطأ:
     * نظام AppOps يعيد MODE_ALLOWED افتراضياً لتطبيقات النظام المثبّتة مسبقاً
     * حتى لو لم تستخدم الصلاحية إطلاقاً، فظهرت تطبيقات مثل
     * com.samsung.android.smartswitchassistant كأنها برامج موقع وهمي.
     *
     * الشروط الثلاثة الآن يجب أن تتحقق معاً:
     *   1) التطبيق ليس تطبيق نظام ولا تحديثاً لتطبيق نظام
     *   2) لا ينتمي لبادئات حزم الشركات المصنّعة
     *   3) يعلن صلاحية ACCESS_MOCK_LOCATION في Manifest الخاص به
     *   4) ومنحه النظام العملية فعلياً عبر AppOps
     */
    private String findMockLocationApp() {
        try {
            PackageManager pm = ctx.getPackageManager();
            AppOpsManager aom = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
            if (pm == null || aom == null) {
                return null;
            }

            List<PackageInfo> packages = pm.getInstalledPackages(PackageManager.GET_PERMISSIONS);
            String selfPackage = ctx.getPackageName();

            for (PackageInfo pkgInfo : packages) {
                if (pkgInfo == null || pkgInfo.packageName == null) {
                    continue;
                }

                String pkgName = pkgInfo.packageName;
                if (pkgName.equals(selfPackage)) {
                    continue;
                }

                ApplicationInfo app = pkgInfo.applicationInfo;
                if (app == null) {
                    continue;
                }

                // 1) استثناء تطبيقات النظام
                if ((app.flags & ApplicationInfo.FLAG_SYSTEM) != 0) {
                    continue;
                }
                if ((app.flags & ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0) {
                    continue;
                }

                // 2) استثناء حزم الشركات المصنّعة
                if (isVendorPackage(pkgName)) {
                    continue;
                }

                // 3) يجب أن يعلن التطبيق صلاحية الموقع الوهمي صراحةً
                if (!declaresMockPermission(pkgInfo)) {
                    continue;
                }

                // 4) وأن يكون النظام قد منحه العملية فعلاً
                try {
                    int mode;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        mode = aom.unsafeCheckOpNoThrow(
                                AppOpsManager.OPSTR_MOCK_LOCATION,
                                app.uid,
                                pkgName
                        );
                    } else {
                        mode = aom.checkOpNoThrow(
                                AppOpsManager.OPSTR_MOCK_LOCATION,
                                app.uid,
                                pkgName
                        );
                    }

                    if (mode == AppOpsManager.MODE_ALLOWED) {
                        return pkgName;
                    }
                } catch (Exception ignored) {
                    // بعض الحزم ترفض الاستعلام - نتجاوزها
                }
            }
        } catch (Exception e) {
            return null;
        }
        return null;
    }

    private boolean isVendorPackage(String pkgName) {
        for (String prefix : VENDOR_PREFIXES) {
            if (pkgName.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    private boolean declaresMockPermission(PackageInfo pkgInfo) {
        String[] requested = pkgInfo.requestedPermissions;
        if (requested == null) {
            return false;
        }
        for (String permission : requested) {
            if (MOCK_PERMISSION.equals(permission)) {
                return true;
            }
        }
        return false;
    }

    // =====================================================
    // 4) تشخيص - يساعد على تفسير أي رفض غير متوقع
    // =====================================================

    /**
     * ملخص نصي لحالة الأمان على الجهاز، يظهر للمشرف عند الحاجة.
     */
    @JavascriptInterface
    public String getSecurityDiagnostics() {
        StringBuilder sb = new StringBuilder();
        try {
            sb.append("الجهاز: ").append(getDeviceModel()).append("\n");
            sb.append("إصدار أندرويد: ").append(Build.VERSION.SDK_INT).append("\n");
            sb.append("معرّف الجهاز: ").append(getAndroidId()).append("\n");
            sb.append("وضع المطور: ")
              .append(isDeveloperOptionsEnabled() ? "مفعّل" : "معطّل").append("\n");
            sb.append("علم الموقع الوهمي: ")
              .append(hasMockFlagOnLastLocation() ? "مرفوع" : "غير مرفوع").append("\n");
            String app = findMockLocationApp();
            sb.append("تطبيق موقع وهمي: ")
              .append(app == null ? "لا يوجد" : app);
        } catch (Exception e) {
            sb.append("تعذر جمع التشخيص");
        }
        return sb.toString();
    }
}
