package by.barsu.student;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.CookieHandler;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.HttpURLConnection;
import java.net.URL;

/** Нативные HTTP-запросы к rasp.barsu.by: без CORS, байты как есть (нужно для windows-1251). */
@CapacitorPlugin(name = "BarsuHttp")
public class BarsuHttp extends Plugin {
    private static final String UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

    @Override
    public void load() {
        CookieHandler.setDefault(new CookieManager(null, CookiePolicy.ACCEPT_ALL));
    }

    @PluginMethod
    public void request(final PluginCall call) {
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                String url = call.getString("url");
                String method = call.getString("method", "GET");
                String body = call.getString("body", "");
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(20000);
                c.setReadTimeout(30000);
                c.setInstanceFollowRedirects(true);
                c.setRequestMethod(method);
                c.setRequestProperty("User-Agent", UA);
                c.setRequestProperty("Accept-Language", "ru-RU,ru;q=0.9");
                if ("POST".equals(method)) {
                    byte[] b = body.getBytes("ISO-8859-1");
                    c.setDoOutput(true);
                    c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                    c.setRequestProperty("Referer", call.getString("referer", url));
                    c.setRequestProperty("Origin", "https://rasp.barsu.by");
                    c.setFixedLengthStreamingMode(b.length);
                    OutputStream os = c.getOutputStream();
                    os.write(b);
                    os.close();
                }
                int status = c.getResponseCode();
                InputStream is = status >= 400 ? c.getErrorStream() : c.getInputStream();
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                if (is != null) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = is.read(buf)) > 0) bo.write(buf, 0, n);
                    is.close();
                }
                JSObject r = new JSObject();
                r.put("status", status);
                r.put("url", c.getURL().toString());
                r.put("contentType", c.getContentType() == null ? "" : c.getContentType());
                r.put("data", Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP));
                call.resolve(r);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            } finally {
                if (c != null) c.disconnect();
            }
        }).start();
    }
}
