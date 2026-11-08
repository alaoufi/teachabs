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
import android.webkit.JavascriptInterface;
import java.net.HttpURLConnection;
import java.net.URL;
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
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.view.Gravity;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import java.util.Locale;

/**
 * «احتراف التدريس» for Android: opens the trial site in a full-screen WebView.
 * Same-site pages stay in the app; other links open in the browser. Supports file upload (book page image,
 * lesson import), the microphone for recorded explanations, downloads of lesson files, and the back button.
 */
public class MainActivity extends Activity {
    static final String HOME = "https://abdulrahman-edu-trial.onrender.com/";
    static final String HOST = "abdulrahman-edu-trial.onrender.com";
    static final int FILE_REQUEST = 41, MIC_REQUEST = 42;
    static final String VERSION = "1.3";

    WebView web;
    ProgressBar progress;
    LinearLayout loading;
    TextView label;
    final Runnable slowNote = () -> label.setText("الخادم يستيقظ بعد خمول… قد يستغرق حتى دقيقة");
    final Handler ui = new Handler(Looper.getMainLooper());
    // The page cannot speak inside an Android WebView, so the app reads the lesson's explanations aloud itself.
    TextToSpeech tts; volatile String ttsState = "loading"; // loading | ar | none
    final Runnable showLoading = () -> loading.setVisibility(View.VISIBLE);
    ValueCallback<Uri[]> pendingFiles;
    PermissionRequest pendingMic; String[] pendingWant;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); // the board stays on during a lesson
        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        root.addView(progress, new FrameLayout.LayoutParams(-1, 14));
        // A clear loading card in the middle of the screen, shown only when a page takes longer than a moment.
        loading = new LinearLayout(this);
        loading.setOrientation(LinearLayout.VERTICAL); loading.setGravity(Gravity.CENTER);
        loading.setBackgroundColor(Color.argb(150, 11, 31, 42));
        ProgressBar spin = new ProgressBar(this);
        label = new TextView(this); label.setText("جارٍ التحميل…"); label.setTextColor(Color.WHITE); label.setTextSize(18); label.setPadding(0, 24, 0, 0);
        loading.addView(spin); loading.addView(label);
        loading.setVisibility(View.GONE);
        root.addView(loading, new FrameLayout.LayoutParams(-1, -1));
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
        s.setTextZoom(100); // ignore the phone's large-font setting: the board and tools are sized for the screen
        s.setUserAgentString(s.getUserAgentString() + " TeachabsApp/" + VERSION + "");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);

        tts = new TextToSpeech(this, status -> {
            if (status != TextToSpeech.SUCCESS) { ttsState = "none"; return; }
            int r = tts.setLanguage(new Locale("ar", "SA"));
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) r = tts.setLanguage(new Locale("ar"));
            ttsState = (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) ? "none" : "ar";
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) {}
                @Override public void onDone(String id) { done(id); }
                @Override public void onError(String id) { done(id); }
                void done(String id) { ui.post(() -> web.evaluateJavascript("window.__appSpeechDone&&window.__appSpeechDone(" + org.json.JSONObject.quote(id) + ")", null)); }
            });
        });
        web.addJavascriptInterface(new Bridge(), "App");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("https".equals(u.getScheme()) && HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException e) { /* nothing to open it */ }
                return true;
            }
            @Override
            public void onPageStarted(WebView view, String url, Bitmap icon) { progress.setVisibility(View.VISIBLE); ui.removeCallbacks(showLoading); ui.removeCallbacks(slowNote); label.setText("جارٍ التحميل…"); ui.postDelayed(showLoading, 250); ui.postDelayed(slowNote, 5000); }
            @Override
            public void onPageFinished(WebView view, String url) { progress.setVisibility(View.GONE); ui.removeCallbacks(showLoading); ui.removeCallbacks(slowNote); loading.setVisibility(View.GONE); CookieManager.getInstance().flush(); }
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
                    // Only our own site may use the microphone (voice) and the camera (the teacher's picture).
                    java.util.List<String> want = new java.util.ArrayList<>(), android = new java.util.ArrayList<>();
                    for (String r : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) { want.add(r); android.add(Manifest.permission.RECORD_AUDIO); }
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) { want.add(r); android.add(Manifest.permission.CAMERA); }
                    }
                    if (want.isEmpty() || !HOST.equals(request.getOrigin().getHost())) { request.deny(); return; }
                    java.util.List<String> missing = new java.util.ArrayList<>();
                    for (String a : android) if (checkSelfPermission(a) != PackageManager.PERMISSION_GRANTED) missing.add(a);
                    if (missing.isEmpty()) { request.grant(want.toArray(new String[0])); return; }
                    pendingMic = request; pendingWant = want.toArray(new String[0]);
                    requestPermissions(missing.toArray(new String[0]), MIC_REQUEST);
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
        s.setCacheMode(WebSettings.LOAD_DEFAULT); // the site stamps its files per deploy, so cached files are always current
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
            boolean ok = results.length > 0;
            for (int r : results) if (r != PackageManager.PERMISSION_GRANTED) ok = false;
            if (ok) pendingMic.grant(pendingWant); else pendingMic.deny();
            pendingMic = null; pendingWant = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    /** The app's own start screen: its buttons ask the app (not the page) to open the site, so a tap always does something. */
    void showStart() { web.loadDataWithBaseURL(HOME, START, "text/html", "utf-8", null); warmUp(); }

    volatile String serverState = "waiting";
    /** Wakes the trial server in the background (it sleeps when idle) so the first tap opens quickly. */
    void warmUp() {
        serverState = "waiting";
        new Thread(() -> {
            String state = "error";
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(HOME + "join").openConnection();
                c.setConnectTimeout(90000); c.setReadTimeout(90000);
                if (c.getResponseCode() < 500) state = "ready";
                c.disconnect();
            } catch (Exception e) { state = "error"; }
            serverState = state;
        }).start();
    }

    /** Called by the start screen. Only two fixed destinations. */
    class Bridge {
        @JavascriptInterface public String state() { return serverState; }
        @JavascriptInterface public String version() { return VERSION; }
        @JavascriptInterface public void go(String who) {
            ui.post(() -> {
                label.setText("جارٍ الفتح…"); loading.setVisibility(View.VISIBLE);
                ui.removeCallbacks(slowNote); ui.postDelayed(slowNote, 5000);
                web.loadUrl(HOME + ("teacher".equals(who) ? "start/teacher" : "start/student")); // the student goes straight into the running trial class
            });
        }
        @JavascriptInterface public void retry() { ui.post(() -> warmUp()); }
        /** "ar" when an Arabic voice is ready, "none" when the phone has none, "loading" while it starts. */
        @JavascriptInterface public String voice() { return ttsState; }
        @JavascriptInterface public boolean speak(String text, String id) {
            if (!"ar".equals(ttsState) || text == null) return false;
            return tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) == TextToSpeech.SUCCESS;
        }
        @JavascriptInterface public void stopSpeaking() { if (tts != null) tts.stop(); }
    }

    @Override
    protected void onDestroy() { if (tts != null) { tts.stop(); tts.shutdown(); } super.onDestroy(); }

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
        + "button{display:block;width:100%;box-sizing:border-box;font-size:22px;font-weight:700;padding:20px;margin:12px 0;border-radius:18px;border:0;cursor:pointer}"
        + ".t{background:#fff;color:#155c4d}.s{background:#e8890c;color:#fff}button:active{transform:scale(.98)}small{display:block;margin-top:18px;opacity:.7}"
        + ".st{margin:18px 0 0;font-size:16px;opacity:.9}.st.ok{color:#9fe0b4}.st.bad{color:#ffc9b8}</style></head><body><div class=c>"
        + "<img src='/icon-192.png' alt=''><h1>احتراف التدريس</h1><p>السبورة الواحدة للحصة</p>"
        + "<button class=t onclick=\"App.go('teacher')\">👩‍🏫 أنا المعلم</button>"
        + "<button class=s onclick=\"App.go('student')\">🎒 أنا الطالب</button>"
        + "<p id=st class=st>⏳ جارٍ تجهيز الخادم…</p>"
        + "<small>الإصدار " + VERSION + " · نسخة تجريبية</small></div>"
        + "<script>var st=document.getElementById('st'),n=0;setInterval(function(){var s=App.state();n++;"
        + "if(s=='ready'){st.textContent='✓ جاهز، اختر';st.className='st ok'}"
        + "else if(s=='error'){st.innerHTML='⚠ تعذّر الوصول للخادم. <u onclick=App.retry()>إعادة المحاولة</u>';st.className='st bad'}"
        + "else if(n>10){st.textContent='⏳ الخادم يستيقظ بعد خمول، قد يستغرق حتى دقيقة…'}},500)</script></body></html>";

    static final String OFFLINE = "<!doctype html><html lang=ar dir=rtl><meta name=viewport content='width=device-width,initial-scale=1'>"
        + "<body style='font-family:sans-serif;background:#faf8f2;color:#163d34;display:flex;align-items:center;justify-content:center;min-height:90vh;text-align:center;padding:20px'>"
        + "<div><h1 style='font-size:24px'>تعذّر الاتصال</h1><p>تأكد من الإنترنت. خادم التجربة قد يحتاج دقيقة ليستيقظ.</p>"
        + "<button style='font-size:18px;padding:12px 28px;border-radius:12px;border:0;background:#155c4d;color:#fff' onclick=\"location.href='" + HOME + "'\">إعادة المحاولة</button></div></body></html>";
}
