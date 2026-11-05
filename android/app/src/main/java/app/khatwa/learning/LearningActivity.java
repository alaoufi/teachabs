package app.khatwa.learning;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.net.Uri;

public final class LearningActivity extends Activity {
    private Uri service;
    private WebView web;
    private LinearLayout failure;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        service = Uri.parse(getString(R.string.khatwa_start_url));
        getWindow().setStatusBarColor(0xff155c4d);
        web = new WebView(this);
        web.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return !(service.getScheme().equalsIgnoreCase(uri.getScheme())
                        && service.getHost().equalsIgnoreCase(uri.getHost())
                        && uri.getUserInfo() == null && port(service) == port(uri));
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showConnectionHelp();
            }
        });
        setContentView(web);
        if (state == null || !service.toString().equals(state.getString("service"))
                || web.restoreState(state) == null) web.loadUrl(service.toString());
    }
    private static int port(Uri uri) {
        if (uri.getPort() != -1) return uri.getPort();
        return "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
    }
    private void showConnectionHelp() {
        if (failure != null) return;
        failure = new LinearLayout(this);
        failure.setOrientation(LinearLayout.VERTICAL);
        failure.setGravity(Gravity.CENTER);
        failure.setPadding(48,32,48,32);
        failure.setBackgroundColor(0xfffaf8f2);
        TextView info = new TextView(this);
        if ("https".equals(service.getScheme())) {
            info.setText("تعذّر الاتصال بخادم خطوة. تحقّق من اتصال الإنترنت ثم أعد المحاولة.");
        } else {
            info.setText("تعذّر الاتصال بخادم خطوة المحلي. شغّل التطبيق على الكمبيوتر، ثم صِل الهاتف عبر USB وفعّل تحويل المنفذ الموضح في دليل التشغيل.");
        }
        info.setTextSize(19);
        info.setGravity(Gravity.CENTER);
        failure.addView(info);
        Button retry = new Button(this);
        retry.setText("إعادة الاتصال");
        retry.setOnClickListener(v -> {
            failure = null;
            setContentView(web);
            web.loadUrl(service.toString());
        });
        failure.addView(retry);
        setContentView(failure);
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        state.putString("service", service.toString());
        web.saveState(state);
    }
    @Override public void onBackPressed() {
        if (failure == null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
