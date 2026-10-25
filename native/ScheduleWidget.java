package by.barsu.student;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StyleSpan;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

public class ScheduleWidget extends AppWidgetProvider {
    static final String A_PREV = "by.barsu.student.WS_PREV";
    static final String A_NEXT = "by.barsu.student.WS_NEXT";
    static final String A_RESET = "by.barsu.student.WS_RESET";
    private static final int[] ROWS = {R.id.ws_r1, R.id.ws_r2, R.id.ws_r3, R.id.ws_r4, R.id.ws_r5, R.id.ws_r6};

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) {
            try {
                m.updateAppWidget(id, build(c, id));
            } catch (Throwable t) {
                // один сбой не должен ломать остальные виджеты
            }
        }
        Widgets.scheduleRefresh(c);
    }

    @Override
    public void onEnabled(Context c) {
        SyncWorker.schedule(c);
    }

    @Override
    public void onDeleted(Context c, int[] ids) {
        android.content.SharedPreferences.Editor e = Store.p(c).edit();
        for (int id : ids) e.remove("wofs_" + id);
        e.apply();
    }

    @Override
    public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        int id = i.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (id != AppWidgetManager.INVALID_APPWIDGET_ID && (A_PREV.equals(a) || A_NEXT.equals(a) || A_RESET.equals(a))) {
            int o = Store.p(c).getInt("wofs_" + id, 0);
            if (A_PREV.equals(a)) o--;
            else if (A_NEXT.equals(a)) o++;
            else o = 0;
            Store.p(c).edit().putInt("wofs_" + id, o).apply();
            AppWidgetManager.getInstance(c).updateAppWidget(id, build(c, id));
            return;
        }
        super.onReceive(c, i);
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, ScheduleWidget.class));
        for (int id : ids) {
            try {
                m.updateAppWidget(id, build(c, id));
            } catch (Throwable t) {
                // один сбой не должен ломать остальные виджеты
            }
        }
    }

    private static String hm(int m) {
        return (m / 60) + ":" + (m % 60 < 10 ? "0" : "") + (m % 60);
    }

    static RemoteViews build(Context c, int id) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_schedule);
        int off = Store.p(c).getInt("wofs_" + id, 0);
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_YEAR, off);
        String date = Store.ymd(cal);

        v.setOnClickPendingIntent(R.id.ws_prev, Widgets.bcast(c, ScheduleWidget.class, A_PREV, id, id * 10 + 1));
        v.setOnClickPendingIntent(R.id.ws_next, Widgets.bcast(c, ScheduleWidget.class, A_NEXT, id, id * 10 + 2));
        v.setOnClickPendingIntent(R.id.ws_title, Widgets.bcast(c, ScheduleWidget.class, A_RESET, id, id * 10 + 3));
        v.setOnClickPendingIntent(R.id.ws_root, Widgets.open(c, "sched", 101));

        String title = new SimpleDateFormat("EEE, d MMMM", new Locale("ru")).format(cal.getTime());
        if (title.length() > 0) title = title.substring(0, 1).toUpperCase(new Locale("ru")) + title.substring(1);
        if (off == 0) title += " · сегодня";
        JSONObject fo = Store.follow(c);
        String sub = fo == null ? "" : fo.optString("sub", "");
        if (!sub.isEmpty()) title += " · " + sub;
        v.setTextViewText(R.id.ws_title, title);

        List<CharSequence> lines = new ArrayList<>();
        if (fo == null) {
            lines.add("Откройте приложение → Расписание → «Сделать моим расписанием».");
        } else {
            JSONArray items = Store.lessonsFor(c, date);
            if (items == null) {
                lines.add("Нет данных за этот день. Откройте приложение, чтобы загрузить расписание.");
            } else {
                List<Row> list = new ArrayList<>();
                for (int k = 0; k < items.length(); k++) {
                    JSONObject o = items.optJSONObject(k);
                    if (o == null) continue;
                    Row r = rowOf(o, sub);
                    if (r != null) list.add(r);
                }
                if (list.isEmpty()) {
                    lines.add("Занятий нет 🎉");
                } else {
                    java.util.Collections.sort(list, new java.util.Comparator<Row>() {
                        @Override
                        public int compare(Row a, Row b) {
                            return Integer.compare(a.s, b.s);
                        }
                    });
                    Calendar now = Calendar.getInstance();
                    int mm = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
                    int max = list.size() > 6 ? 5 : list.size();
                    for (int k = 0; k < max; k++) {
                        Row r = list.get(k);
                        String head = ((off == 0 && mm >= r.s && mm < r.e) ? "▶ " : "") + hm(r.s) + "–" + hm(r.e)
                            + (r.a.isEmpty() ? "" : " · " + r.a);
                        SpannableString sp = new SpannableString(head + "\n" + r.text);
                        sp.setSpan(new StyleSpan(Typeface.BOLD), 0, head.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                        lines.add(sp);
                    }
                    if (list.size() > 6) lines.add("… и ещё " + (list.size() - 5));
                }
            }
        }
        for (int k = 0; k < ROWS.length; k++) {
            if (k < lines.size()) {
                v.setTextViewText(ROWS[k], lines.get(k));
                v.setViewVisibility(ROWS[k], View.VISIBLE);
            } else {
                v.setViewVisibility(ROWS[k], View.GONE);
            }
        }
        return v;
    }

    private static final class Row {
        int s, e;
        String a, text;
    }

    /** Строка виджета для одной пары с учётом выбранной подгруппы; null, если пара не для неё. */
    private static Row rowOf(JSONObject o, String sub) {
        Row r = new Row();
        r.s = o.optInt("s");
        r.e = o.optInt("e");
        r.a = o.optString("a");
        JSONArray p = o.optJSONArray("p");
        if (p == null || p.length() == 0) {
            r.text = o.optString("t");
            return r;
        }
        List<String[]> keep = new ArrayList<>();
        for (int k = 0; k < p.length(); k++) {
            JSONObject x = p.optJSONObject(k);
            if (x == null) continue;
            String g = x.optString("g");
            if (!sub.isEmpty() && !g.isEmpty() && !g.equals(sub)) continue;
            keep.add(new String[] {g, x.optString("t"), x.optString("a")});
        }
        if (keep.isEmpty()) return null;
        if (keep.size() == 1) {
            String[] x = keep.get(0);
            r.text = (sub.isEmpty() && !x[0].isEmpty() ? x[0] + ": " : "") + x[1];
            if (!x[2].isEmpty()) r.a = x[2];
        } else {
            StringBuilder sb = new StringBuilder();
            for (String[] x : keep) {
                if (sb.length() > 0) sb.append("\n");
                if (!x[0].isEmpty()) sb.append(x[0]).append(": ");
                sb.append(x[1]);
                if (!x[2].isEmpty()) sb.append(" · ").append(x[2]);
            }
            r.text = sb.toString();
            r.a = "";
        }
        return r;
    }
}
