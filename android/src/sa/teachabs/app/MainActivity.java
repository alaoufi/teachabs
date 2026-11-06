package sa.teachabs.app;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

/**
 * «احتراف التدريس» for Android: opens the trial site in a full-screen WebView.
 * Same-site pages stay in the app; other links open in the browser. Supports file upload (book page image,
 * lesson import), the microphone for recorded explanations, downloads of lesson files, and the back button.
 */
public class MainActivity extends Activity {
    static final String HOME = "https://abdulrahman-edu-trial.onrender.com/";
    static final String HOST = "abdulrahman-edu-trial.onrender.com";
    static final int FILE_REQUEST = 41, MIC_REQUEST = 42;
    static final String VERSION = "0.3";

    WebView web;
    ProgressBar progress;
    ValueCallback<Uri[]> pendingFiles;
    PermissionRequest pendingMic;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); // the board stays on during a lesson
        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        root.addView(progress, new FrameLayout.LayoutParams(-1, 8));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); // the narrator can speak when the teacher starts the tour
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setUserAgentString(s.getUserAgentString() + " TeachabsApp/" + VERSION + "");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("https".equals(u.getScheme()) && HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException e) { /* nothing to open it */ }
                return true;
            }
            @Override
            public void onPageStarted(WebView view, String url, Bitmap icon) { progress.setVisibility(View.VISIBLE); }
            @Override
            public void onPageFinished(WebView view, String url) { progress.setVisibility(View.GONE); CookieManager.getInstance().flush(); }
            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (!req.isForMainFrame()) return;
                view.loadDataWithBaseURL(null, OFFLINE, "text/html", "utf-8", null);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) { progress.setProgress(p); }
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFiles != null) pendingFiles.onReceiveValue(null);
                pendingFiles = callback;
                Intent pick = params.createIntent();
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                try { startActivityForResult(pick, FILE_REQUEST); }
                catch (ActivityNotFoundException e) { pendingFiles = null; Toast.makeText(MainActivity.this, "لا يوجد تطبيق لاختيار الملفات", Toast.LENGTH_LONG).show(); return false; }
                return true;
            }
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean wantsMic = false;
                    for (String r : request.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) wantsMic = true;
                    if (!wantsMic || !HOST.equals(request.getOrigin().getHost())) { request.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        pendingMic = request;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_REQUEST);
                    }
                });
            }
        });

        web.setDownloadListener((url, agent, disposition, mime, length) -> {
            if (!url.startsWith("https://")) {
                Toast.makeText(this, "تنزيل هذا الملف غير متاح داخل التطبيق؛ افتح الموقع في المتصفح لتنزيله.", Toast.LENGTH_LONG).show();
                return;
            }
            String name = URLUtil.guessFileName(url, disposition, mime);
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            r.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url));
            r.addRequestHeader("User-Agent", agent);
            r.setMimeType(mime);
            r.setTitle(name);
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(r);
            Toast.makeText(this, "جارٍ تنزيل " + name, Toast.LENGTH_SHORT).show();
        });

        // A new app version never shows pages cached by an older one.
        SharedPreferences prefs = getSharedPreferences("app", MODE_PRIVATE);
        if (!VERSION.equals(prefs.getString("version", ""))) { web.clearCache(true); web.clearHistory(); prefs.edit().putString("version", VERSION).apply(); }
        s.setCacheMode(WebSettings.LOAD_NO_CACHE); // a trial site changes often: always load the latest
        if (saved != null) web.restoreState(saved);
        else showStart();
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        if (code == FILE_REQUEST && pendingFiles != null) {
            pendingFiles.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            pendingFiles = null;
            return;
        }
        super.onActivityResult(code, result, data);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code == MIC_REQUEST && pendingMic != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) pendingMic.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else pendingMic.deny();
            pendingMic = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    /** The app's own start screen: teacher straight to «دروسي», student to the class code. Served as the site's origin. */
    void showStart() { web.loadDataWithBaseURL(HOME, START, "text/html", "utf-8", null); }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onPause() { super.onPause(); web.onPause(); CookieManager.getInstance().flush(); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }

    static final String START = "<!doctype html><html lang=ar dir=rtl><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>احتراف التدريس</title>"
        + "<style>body{margin:0;font-family:sans-serif;background:linear-gradient(160deg,#155c4d,#0f3d34);color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}"
        + ".c{width:100%;max-width:420px;text-align:center}h1{font-size:30px;margin:6px 0 4px}p{opacity:.85;margin:0 0 26px}img{width:84px;height:84px;border-radius:20px;background:#fff}"
        + "form,a{display:block;margin:12px 0}button,a{width:100%;box-sizing:border-box;font-size:22px;font-weight:700;padding:20px;border-radius:18px;border:0;text-decoration:none;cursor:pointer}"
        + ".t{background:#fff;color:#155c4d}.s{background:#e8890c;color:#fff}small{display:block;margin-top:26px;opacity:.7}</style></head><body><div class=c>"
        + "<img src='/icon-192.png' alt=''><h1>احتراف التدريس</h1><p>السبورة الواحدة للحصة</p>"
        + "<form method=post action='/demo/start'><input type=hidden name=role value=teacher><input type=hidden name=next value='/teach/plans'><button class=t>👩‍🏫 أنا المعلم</button></form>"
        + "<a class=s href='/join'>🎒 أنا الطالب</a>"
        + "<small>الإصدار " + VERSION + " · نسخة تجريبية</small></div></body></html>";

    static final String OFFLINE = "<!doctype html><html lang=ar dir=rtl><meta name=viewport content='width=device-width,initial-scale=1'>"
        + "<body style='font-family:sans-serif;background:#faf8f2;color:#163d34;display:flex;align-items:center;justify-content:center;min-height:90vh;text-align:center;padding:20px'>"
        + "<div><h1 style='font-size:24px'>تعذّر الاتصال</h1><p>تأكد من الإنترنت. خادم التجربة قد يحتاج دقيقة ليستيقظ.</p>"
        + "<button style='font-size:18px;padding:12px 28px;border-radius:12px;border:0;background:#155c4d;color:#fff' onclick=\"location.href='" + HOME + "'\">إعادة المحاولة</button></div></body></html>";
}
