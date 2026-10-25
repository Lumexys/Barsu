package by.barsu.student;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.CookieHandler;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Простой HTTP-клиент для фоновых запросов к rasp.barsu.by. */
final class Net {
    static final String UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

    static final class Res {
        int status;
        String url;
        String cs;
        String text;
    }

    private static synchronized void initCookies() {
        if (CookieHandler.getDefault() == null) {
            CookieHandler.setDefault(new CookieManager(null, CookiePolicy.ACCEPT_ALL));
        }
    }

    static Res get(String url) throws Exception {
        return req("GET", url, null, null);
    }

    static Res post(String url, String body, String referer) throws Exception {
        return req("POST", url, body, referer);
    }

    private static Res req(String method, String url, String body, String referer) throws Exception {
        initCookies();
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(20000);
            c.setReadTimeout(30000);
            c.setInstanceFollowRedirects(true);
            c.setRequestMethod(method);
            c.setRequestProperty("User-Agent", UA);
            c.setRequestProperty("Accept-Language", "ru-RU,ru;q=0.9");
            if ("POST".equals(method)) {
                byte[] b = body.getBytes(StandardCharsets.ISO_8859_1);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                c.setRequestProperty("Referer", referer == null ? url : referer);
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
            byte[] data = bo.toByteArray();
            Res r = new Res();
            r.status = status;
            r.url = c.getURL().toString();
            r.cs = charsetOf(c.getContentType(), data);
            Charset cs;
            try {
                cs = Charset.forName(r.cs);
            } catch (Exception e) {
                cs = StandardCharsets.UTF_8;
            }
            r.text = new String(data, cs);
            return r;
        } finally {
            c.disconnect();
        }
    }

    static String charsetOf(String ct, byte[] b) {
        String cs = null;
        if (ct != null) {
            Matcher m = Pattern.compile("charset=([\\w-]+)", Pattern.CASE_INSENSITIVE).matcher(ct);
            if (m.find()) cs = m.group(1).toLowerCase();
        }
        if (cs == null) {
            String head = new String(b, 0, Math.min(2048, b.length), StandardCharsets.ISO_8859_1);
            Matcher m = Pattern.compile("charset=[\"']?([\\w-]+)", Pattern.CASE_INSENSITIVE).matcher(head);
            cs = m.find() ? m.group(1).toLowerCase() : "utf-8";
        }
        if (cs.equals("cp1251")) cs = "windows-1251";
        return cs;
    }
}
