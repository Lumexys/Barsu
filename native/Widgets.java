package by.barsu.student;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import java.util.Calendar;

/** Общие помощники для виджетов. */
public final class Widgets {
    static final String A_REFRESH = "by.barsu.student.WIDGET_REFRESH";

    static PendingIntent open(Context c, String target, int code) {
        // Свой action и уникальный адрес: иначе Android считает такой запуск обычным стартом
        // из лаунчера и не передаёт запущенному приложению, какой раздел открыть.
        Intent i = new Intent(c, MainActivity.class);
        i.setAction("by.barsu.student.OPEN");
        i.setData(Uri.parse("barsu://open/" + target));
        i.putExtra("open", target);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Кнопка «＋» в виджете заданий: окно быстрого добавления с файлами. */
    static PendingIntent quickAdd(Context c, int code) {
        Intent i = new Intent(c, QuickAddActivity.class);
        i.setAction("by.barsu.student.QUICK_ADD");
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent bcast(Context c, Class<?> cls, String action, int widgetId, int code) {
        Intent i = new Intent(c, cls);
        i.setAction(action);
        i.setData(Uri.parse("barsu://widget/" + widgetId + "/" + action));
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * Обновление виджетов без сети и без открытого приложения: будильник примерно раз в полчаса и сразу после полуночи.
     * Не требует особых разрешений: время неточное, но достаточное для счётчиков и смены дня.
     */
    static void scheduleRefresh(Context c) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Intent i = new Intent(c, Refresh.class);
            i.setAction(A_REFRESH);
            PendingIntent pi = PendingIntent.getBroadcast(c, 900, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Calendar mid = Calendar.getInstance();
            mid.add(Calendar.DAY_OF_YEAR, 1);
            mid.set(Calendar.HOUR_OF_DAY, 0);
            mid.set(Calendar.MINUTE, 0);
            mid.set(Calendar.SECOND, 5);
            mid.set(Calendar.MILLISECOND, 0);
            long t = Math.min(System.currentTimeMillis() + 30L * 60L * 1000L, mid.getTimeInMillis());
            am.setAndAllowWhileIdle(AlarmManager.RTC, t, pi);
        } catch (Throwable t) {
            // ignore
        }
    }

    static void updateAll(Context c) {
        scheduleRefresh(c);
        try { ScheduleWidget.updateAll(c); } catch (Throwable t) { /* ignore */ }
        try { ScholarshipWidget.updateAll(c); } catch (Throwable t) { /* ignore */ }
        try { TasksWidget.updateAll(c); } catch (Throwable t) { /* ignore */ }
    }

    /** Приёмник будильника: обновляет все виджеты и заводит следующий будильник. */
    public static class Refresh extends BroadcastReceiver {
        @Override
        public void onReceive(Context c, Intent i) {
            updateAll(c);
        }
    }
}
