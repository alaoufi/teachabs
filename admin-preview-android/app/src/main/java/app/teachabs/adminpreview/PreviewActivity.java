package app.teachabs.adminpreview;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import org.json.JSONObject;

/** Packaged static administration design only. No server, login, writes or real data. */
public final class PreviewActivity extends Activity {
    private static final String HOST = "admin-preview.invalid";
    private static final String START = "https://" + HOST + "/admin";
    private WebView web;
    private JSONObject routes;

    private boolean allowed(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
            && uri.getPort() == -1 && uri.getUserInfo() == null && uri.getQuery() == null
            && routes.has(uri.getPath());
    }
    private WebResourceResponse blocked() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Offline preview only",
            Collections.emptyMap(), new ByteArrayInputStream("Offline preview only".getBytes(StandardCharsets.UTF_8)));
    }
    private String assetText(String path) throws Exception {
        try (InputStream in = getAssets().open(path); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int size;
            while ((size = in.read(buffer)) != -1) out.write(buffer, 0, size);
            return out.toString("UTF-8");
        }
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            routes = new JSONObject(assetText("preview-manifest.json")).getJSONObject("routes");
        } catch (Exception error) {
            TextView failure = new TextView(this);
            failure.setText("تعذّر تحميل ملفات المعاينة. لا يتصل هذا التطبيق بخادم.");
            failure.setPadding(32,48,32,32); failure.setTextSize(18); setContentView(failure); return;
        }
        getWindow().setStatusBarColor(0xff155c4d);
        WebView.setWebContentsDebuggingEnabled(false);
        web = new WebView(this);
        web.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        web.getSettings().setJavaScriptEnabled(false);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setBlockNetworkLoads(true);
        web.getSettings().setDomStorageEnabled(false);
        web.getSettings().setSaveFormData(false);
        CookieManager.getInstance().setAcceptCookie(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !"GET".equals(request.getMethod()) || !allowed(request.getUrl());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!"GET".equals(request.getMethod()) || !allowed(request.getUrl())) return blocked();
                try {
                    String path = routes.getString(request.getUrl().getPath());
                    // The route map is packaged by our generator, and cannot be changed at runtime.
                    if (!path.matches("[a-zA-Z0-9/_-]+\\.(html|css)")) return blocked();
                    String mime = path.endsWith(".css") ? "text/css" : "text/html";
                    return new WebResourceResponse(mime, "UTF-8", getAssets().open(path));
                } catch (Exception error) { return blocked(); }
            }
        });
        setContentView(web);
        String previous = state == null ? null : state.getString("previewUrl");
        web.loadUrl(previous != null && allowed(Uri.parse(previous)) ? previous : START);
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        if (web != null && web.getUrl() != null) state.putString("previewUrl", web.getUrl());
    }
    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        if (web != null) { web.stopLoading(); web.destroy(); web = null; }
        super.onDestroy();
    }
}
