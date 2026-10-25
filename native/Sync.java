package by.barsu.student;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import org.json.JSONArray;
import org.json.JSONObject;

/** Фоновая синхронизация: обновляет данные виджетов и сообщает об изменениях в расписании. */
final class Sync {
    static int run(Context c, boolean notify) throws Exception {
        JSONObject f = Store.follow(c);
        if (f == null) return 0;
        List<String> weeks = Scraper.weekStarts();
        if (weeks.isEmpty()) return 0;
        Collections.sort(weeks);
        String today = Store.ymd(Calendar.getInstance());
        String cur = null, next = null;
        for (String w : weeks) {
            if (w.compareTo(today) <= 0) cur = w;
            else if (next == null) next = w;
        }
        List<String> targets = new ArrayList<>();
        if (cur != null) targets.add(cur);
        if (next != null) targets.add(next);
        int n = 0;
        for (String wk : targets) {
            Map<String, List<Scraper.Les>> data = Scraper.week(f, wk);
            if (data == null) continue;
            n++;
            JSONObject lessons = new JSONObject();
            JSONObject snap = new JSONObject();
            for (Map.Entry<String, List<Scraper.Les>> en : data.entrySet()) {
                JSONArray arr = new JSONArray();
                for (Scraper.Les l : en.getValue()) {
                    JSONObject o = new JSONObject();
                    o.put("s", l.s);
                    o.put("e", l.e);
                    o.put("t", l.t);
                    o.put("a", l.a);
                    JSONArray pa = new JSONArray();
                    for (String[] pt : l.parts) {
                        JSONObject po = new JSONObject();
                        po.put("g", pt[0]);
                        po.put("t", pt[1]);
                        po.put("a", pt[2]);
                        pa.put(po);
                    }
                    o.put("p", pa);
                    arr.put(o);
                    snap.put(en.getKey() + "|" + l.s, l.t + (l.a.isEmpty() ? "" : " · " + l.a));
                }
                lessons.put(en.getKey(), arr);
            }
            Store.mergeLessons(c, lessons, System.currentTimeMillis());
            JSONObject prev = Store.snap(c, wk);
            if (prev != null && notify) {
                List<String> ch = diff(prev, snap, today);
                if (!ch.isEmpty()) notifyChanges(c, ch);
            }
            Store.setSnap(c, wk, snap);
        }
        return n;
    }

    private static List<String> diff(JSONObject prev, JSONObject cur, String today) {
        TreeSet<String> keys = new TreeSet<>();
        Iterator<String> a = prev.keys();
        while (a.hasNext()) keys.add(a.next());
        Iterator<String> b = cur.keys();
        while (b.hasNext()) keys.add(b.next());
        List<String> out = new ArrayList<>();
        for (String k : keys) {
            int bar = k.indexOf('|');
            if (bar < 0) continue;
            String date = k.substring(0, bar);
            if (date.compareTo(today) < 0) continue;
            String label = Store.dayLabel(date) + " " + hm(k.substring(bar + 1)) + ": ";
            boolean hp = prev.has(k), hc = cur.has(k);
            String ov = prev.optString(k), nv = cur.optString(k);
            if (!hp && hc) out.add("➕ " + label + nv);
            else if (hp && !hc) out.add("➖ " + label + "отменено — " + ov);
            else if (!ov.equals(nv)) out.add("✏️ " + label + nv + " (было: " + ov + ")");
        }
        return out;
    }

    private static String hm(String minutes) {
        try {
            int m = Integer.parseInt(minutes);
            return (m / 60) + ":" + (m % 60 < 10 ? "0" : "") + (m % 60);
        } catch (Exception e) {
            return minutes;
        }
    }

    private static void notifyChanges(Context c, List<String> lines) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel("changes", "Изменения в расписании", NotificationManager.IMPORTANCE_HIGH));
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < lines.size() && i < 8; i++) {
            if (i > 0) sb.append('\n');
            sb.append(lines.get(i));
        }
        if (lines.size() > 8) sb.append("\n… и ещё ").append(lines.size() - 8);
        Intent i = new Intent(c, MainActivity.class);
        i.putExtra("open", "sched");
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 201, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, "changes")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Расписание изменилось")
            .setContentText(lines.get(0))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(sb.toString()))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH);
        nm.notify((int) (System.currentTimeMillis() / 1000L), b.build());
    }
}
