package by.barsu.student;

import android.content.Context;
import android.content.SharedPreferences;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Iterator;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** Общее хранилище приложения, виджетов и фоновой синхронизации (SharedPreferences). */
final class Store {
    static SharedPreferences p(Context c) {
        return c.getSharedPreferences("barsu", Context.MODE_PRIVATE);
    }

    static String ymd(Calendar cal) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.getTime());
    }

    static String dayLabel(String date) {
        try {
            Date d = new SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(date);
            return new SimpleDateFormat("EE d.MM", new Locale("ru")).format(d);
        } catch (Exception e) {
            return date;
        }
    }

    // ---------- «моё расписание» ----------
    static JSONObject follow(Context c) {
        String s = p(c).getString("follow", null);
        if (s == null) return null;
        try {
            return new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }

    private static void dropSnaps(SharedPreferences.Editor ed, Context c) {
        for (String k : p(c).getAll().keySet()) {
            if (k.startsWith("snap_")) ed.remove(k);
        }
    }

    static void setFollow(Context c, String json) {
        String oldKey = "";
        JSONObject o = follow(c);
        if (o != null) oldKey = o.optString("key");
        String newKey = "";
        try {
            newKey = new JSONObject(json).optString("key");
        } catch (Exception e) {
            // ignore
        }
        SharedPreferences.Editor ed = p(c).edit();
        if (!oldKey.equals(newKey)) {
            dropSnaps(ed, c);
            ed.remove("lessons");
        }
        ed.putString("follow", json);
        ed.apply();
    }

    static void clearFollow(Context c) {
        SharedPreferences.Editor ed = p(c).edit();
        dropSnaps(ed, c);
        ed.remove("follow");
        ed.remove("lessons");
        ed.apply();
    }

    // ---------- пары: дата -> {ts, items:[{s,e,t,a}]} ----------
    static JSONObject lessonsRoot(Context c) {
        String s = p(c).getString("lessons", null);
        if (s == null) return new JSONObject();
        try {
            return new JSONObject(s);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static void mergeLessons(Context c, JSONObject map, long ts) {
        JSONObject root = lessonsRoot(c);
        Calendar cut = Calendar.getInstance();
        cut.add(Calendar.DAY_OF_YEAR, -14);
        String cutS = ymd(cut);
        try {
            Iterator<String> it = map.keys();
            while (it.hasNext()) {
                String d = it.next();
                JSONObject old = root.optJSONObject(d);
                if (old != null && old.optLong("ts") > ts) continue;
                JSONObject e = new JSONObject();
                e.put("ts", ts);
                e.put("items", map.getJSONArray(d));
                root.put(d, e);
            }
            JSONObject out = new JSONObject();
            Iterator<String> k2 = root.keys();
            while (k2.hasNext()) {
                String d = k2.next();
                if (d.compareTo(cutS) >= 0) out.put(d, root.get(d));
            }
            p(c).edit().putString("lessons", out.toString()).apply();
        } catch (Exception e) {
            // ignore
        }
    }

    /** null, если данных за этот день нет вообще. */
    static JSONArray lessonsFor(Context c, String date) {
        JSONObject e = lessonsRoot(c).optJSONObject(date);
        if (e == null) return null;
        return e.optJSONArray("items");
    }

    static JSONObject lessonsPlain(Context c) {
        JSONObject root = lessonsRoot(c), out = new JSONObject();
        try {
            Iterator<String> it = root.keys();
            while (it.hasNext()) {
                String d = it.next();
                JSONObject e = root.optJSONObject(d);
                if (e != null && e.optJSONArray("items") != null) out.put(d, e.getJSONArray("items"));
            }
        } catch (Exception e) {
            // ignore
        }
        return out;
    }

    // ---------- снимки недель для поиска изменений ----------
    static JSONObject snap(Context c, String wk) {
        String s = p(c).getString("snap_" + wk, null);
        if (s == null) return null;
        try {
            return new JSONObject(s);
        } catch (Exception e) {
            return null;
        }
    }

    static void setSnap(Context c, String wk, JSONObject o) {
        p(c).edit().putString("snap_" + wk, o.toString()).apply();
    }

    // ---------- задания ----------
    static JSONArray tasks(Context c) {
        String s = p(c).getString("tasks", null);
        if (s == null) return new JSONArray();
        try {
            return new JSONArray(s);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    static long tasksTs(Context c) {
        return p(c).getLong("tasks_ts", 0L);
    }

    static long setTasks(Context c, String json) {
        long ts = System.currentTimeMillis();
        p(c).edit().putString("tasks", json).putLong("tasks_ts", ts).apply();
        return ts;
    }
}
