package io.github.bebenleneufe.semainier;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

// L'appli affiche le site en ligne : chaque mise à jour du site arrive sans réinstaller l'APK,
// et le service worker du site garde tout disponible hors ligne après la première ouverture.
public class MainActivity extends Activity {
    private static final String APP_URL = "https://bebenleneufe.github.io/app-ads/lidl-recettes/";
    // Le site repère cette marque pour masquer ses boutons d'installation.
    private static final String USER_AGENT_MARK = " SemainierAndroid";
    private static final String OFFLINE_PAGE =
        "<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\">"
        + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
        + "<style>body{font-family:sans-serif;margin:0;padding:48px 24px;background:#f1f4ee;color:#1f2420}"
        + "@media (prefers-color-scheme: dark){body{background:#121a16;color:#e3ebe5}}"
        + "a{display:inline-block;margin-top:16px;padding:10px 20px;border-radius:999px;background:#2c6a4c;color:#fff;text-decoration:none}</style>"
        + "</head><body><h1>Pas de connexion</h1>"
        + "<p>La première ouverture du Semainier a besoin d’internet. Ensuite, l’appli marche aussi hors ligne.</p>"
        + "<a href=\"" + APP_URL + "\">Réessayer</a></body></html>";

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        configureWebView(webView);
        setContentView(webView);
        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(APP_URL);
        }
    }

    private void configureWebView(WebView targetWebView) {
        WebSettings webSettings = targetWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setUserAgentString(webSettings.getUserAgentString() + USER_AGENT_MARK);
        // Sans WebChromeClient, la WebView ignore les boîtes de dialogue JavaScript.
        targetWebView.setWebChromeClient(new WebChromeClient());
        targetWebView.setWebViewClient(new SemainierWebViewClient(this));
    }

    private static boolean isAppUrl(Uri uri) {
        return uri.toString().startsWith(APP_URL);
    }

    private void openInBrowser(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException missingBrowserError) {
            // Aucun navigateur installé : le lien est simplement ignoré.
        }
    }

    // Classe statique : le compilateur Android (d8) plante sur les classes internes compilées par Java 21.
    private static final class SemainierWebViewClient extends WebViewClient {
        private final MainActivity activity;

        SemainierWebViewClient(MainActivity activity) {
            this.activity = activity;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (isAppUrl(request.getUrl())) {
                return false;
            }
            activity.openInBrowser(request.getUrl());
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                view.loadDataWithBaseURL(APP_URL, OFFLINE_PAGE, "text/html", "utf-8", null);
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    // La page enregistre sa saisie en attente quand elle passe en arrière-plan : on le lui signale ici.
    @Override
    protected void onPause() {
        webView.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
