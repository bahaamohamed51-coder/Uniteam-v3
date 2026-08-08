package com.uniteam.attendance;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * نقطة دخول التطبيق.
 *
 * الإضافة الوحيدة على النسخة الافتراضية من Capacitor هي تسجيل الجسر الأصلي
 * باسم "AndroidBridge" ليصبح متاحاً في JavaScript عبر window.AndroidBridge.
 *
 * التسجيل يتم مباشرة بعد super.onCreate لأن الـ WebView يكون قد أُنشئ عندها،
 * وقبل أن تبدأ صفحة الويب في تنفيذ الـ JavaScript الخاص بها.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            // بعد عودة super.onCreate يكون Capacitor قد أنشأ الـ Bridge والـ WebView،
            // ولم تبدأ الصفحة تنفيذ JavaScript بعد.
            if (this.getBridge() != null) {
                WebView webView = this.getBridge().getWebView();
                if (webView != null) {
                    webView.addJavascriptInterface(new AndroidBridge(this), "AndroidBridge");
                    android.util.Log.i("Uniteam", "AndroidBridge registered successfully");
                }
            }
        } catch (Exception e) {
            // في حال فشل التسجيل يستمر التطبيق بالعمل،
            // وتتحول واجهة الويب تلقائياً إلى البدائل المتاحة.
            android.util.Log.e("Uniteam", "AndroidBridge registration failed", e);
        }
    }
}
