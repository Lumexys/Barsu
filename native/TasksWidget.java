package by.barsu.student;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.app.PendingIntent;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StrikethroughSpan;
import android.text.style.StyleSpan;
import android.view.View;
import android.widget.RemoteViews;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

public class TasksWidget extends AppWidgetProvider {
    static final String A_TOGGLE = "by.barsu.student.TK_TOGGLE";
    private static final int[] ROW = {R.id.tk_row1, R.id.tk_row2, R.id.tk_row3, R.id.tk_row4, R.id.tk_row5, R.id.tk_row6};
    private static final int[] CHK = {R.id.tk_c1, R.id.tk_c2, R.id.tk_c3, R.id.tk_c4, R.id.tk_c5, R.id.tk_c6};
    private static final int[] TXT = {R.id.tk_t1, R.id.tk_t2, R.id.tk_t3, R.id.tk_t4, R.id.tk_t5, R.id.tk_t6};

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) {
            try {
                m.updateAppWidget(id, build(c));
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
    public void onReceive(Context c, Intent i) {
        if (A_TOGGLE.equals(i.getAction())) {
            String tid = i.getStringExtra("tid");
            if (tid != null) toggle(c, tid);
            updateAll(c);
            return;
        }
        super.onReceive(c, i);
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, TasksWidget.class));
        for (int id : ids) {
            try {
                m.updateAppWidget(id, build(c));
            } catch (Throwable t) {
                // один сбой не должен ломать остальные виджеты
            }
        }
    }

    private static void toggle(Context c, String tid) {
        try {
            JSONArray a = Store.tasks(c);
            for (int k = 0; k < a.length(); k++) {
                JSONObject o = a.getJSONObject(k);
                if (tid.equals(o.optString("id"))) {
                    o.put("done", !o.optBoolean("done"));
                    break;
                }
            }
            Store.setTasks(c, a.toString());
        } catch (Exception e) {
            // ignore
        }
    }

    private static long daysTo(String d) {
        try {
            String[] a = d.split("-");
            Calendar t = Calendar.getInstance();
            t.clear();
            t.set(Integer.parseInt(a[0]), Integer.parseInt(a[1]) - 1, Integer.parseInt(a[2]));
            Calendar n = Calendar.getInstance();
            n.set(Calendar.HOUR_OF_DAY, 0);
            n.set(Calendar.MINUTE, 0);
            n.set(Calendar.SECOND, 0);
            n.set(Calendar.MILLISECOND, 0);
            return Math.round((t.getTimeInMillis() - n.getTimeInMillis()) / 86400000.0);
        } catch (Exception e) {
            return 9999;
        }
    }

    private static String rel(long n) {
        if (n < 0) return "просрочено";
        if (n == 0) return "сегодня";
        if (n == 1) return "завтра";
        return "через " + n + " дн.";
    }

    private static String ddmm(String d) {
        String[] a = d.split("-");
        return a.length == 3 ? a[2] + "." + a[1] : d;
    }

    static RemoteViews build(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_tasks);
        JSONArray all = Store.tasks(c);
        List<JSONObject> open = new ArrayList<>(), done = new ArrayList<>();
        for (int k = 0; k < all.length(); k++) {
            JSONObject o = all.optJSONObject(k);
            if (o == null) continue;
            if (o.optBoolean("done")) done.add(o);
            else open.add(o);
        }
        Collections.sort(open, new Comparator<JSONObject>() {
            @Override
            public int compare(JSONObject a, JSONObject b) {
                String x = a.optString("d"), y = b.optString("d");
                if (x.isEmpty()) x = "9999";
                if (y.isEmpty()) y = "9999";
                return x.compareTo(y);
            }
        });
        List<JSONObject> list = new ArrayList<>(open);
        list.addAll(done);

        v.setTextViewText(R.id.tk_title, "📝 Задания" + (open.isEmpty() ? "" : " · " + open.size()));
        v.setOnClickPendingIntent(R.id.tk_add, Widgets.quickAdd(c, 104));
        v.setOnClickPendingIntent(R.id.tk_title, Widgets.open(c, "tasks", 103));
        v.setOnClickPendingIntent(R.id.tk_root, Widgets.open(c, "tasks", 103));

        for (int k = 0; k < ROW.length; k++) {
            if (list.isEmpty() && k == 0) {
                v.setViewVisibility(ROW[k], View.VISIBLE);
                v.setTextViewText(CHK[k], "＋");
                v.setTextViewText(TXT[k], "Заданий нет. Нажмите «+», чтобы добавить.");
                v.setOnClickPendingIntent(CHK[k], Widgets.quickAdd(c, 104));
                v.setOnClickPendingIntent(TXT[k], Widgets.quickAdd(c, 104));
                continue;
            }
            if (k >= list.size()) {
                v.setViewVisibility(ROW[k], View.GONE);
                continue;
            }
            JSONObject o = list.get(k);
            boolean isDone = o.optBoolean("done");
            String t = o.optString("t"), subj = o.optString("s"), d = o.optString("d");
            SpannableStringBuilder sb = new SpannableStringBuilder(t);
            sb.setSpan(new StyleSpan(Typeface.BOLD), 0, t.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            if (isDone) {
                sb.setSpan(new StrikethroughSpan(), 0, t.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                sb.setSpan(new ForegroundColorSpan(Color.parseColor("#8A94A6")), 0, t.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
            String meta = subj;
            long n = d.isEmpty() ? 9999 : daysTo(d);
            if (!d.isEmpty()) {
                String ds = ddmm(d) + (isDone ? "" : " · " + rel(n));
                meta = meta.isEmpty() ? ds : meta + " · " + ds;
            }
            if (!meta.isEmpty()) {
                int st = sb.length() + 1;
                sb.append("\n").append(meta);
                int color = (!isDone && !d.isEmpty() && n < 0) ? Color.parseColor("#DC2626")
                    : (!isDone && !d.isEmpty() && n <= 1) ? Color.parseColor("#D97706") : Color.parseColor("#8A94A6");
                sb.setSpan(new ForegroundColorSpan(color), st, sb.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
            v.setViewVisibility(ROW[k], View.VISIBLE);
            v.setTextViewText(CHK[k], isDone ? "☑" : "☐");
            v.setTextViewText(TXT[k], sb);
            String tid = o.optString("id");
            Intent i = new Intent(c, TasksWidget.class);
            i.setAction(A_TOGGLE);
            i.setData(Uri.parse("barsu://task/" + tid));
            i.putExtra("tid", tid);
            v.setOnClickPendingIntent(CHK[k], PendingIntent.getBroadcast(c, tid.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            v.setOnClickPendingIntent(TXT[k], Widgets.open(c, "tasks", 103));
        }
        return v;
    }
}
