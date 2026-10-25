package by.barsu.student;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

public class ScholarshipWidget extends AppWidgetProvider {
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

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, ScholarshipWidget.class));
        for (int id : ids) {
            try {
                m.updateAppWidget(id, build(c));
            } catch (Throwable t) {
                // один сбой не должен ломать остальные виджеты
            }
        }
    }

    /** Ближайший день выплаты (00:00): 20 число, а если это сб/вс — предшествующая пятница. */
    static Calendar payday(Calendar now) {
        for (int k = 0; k < 3; k++) {
            Calendar p = (Calendar) now.clone();
            p.set(Calendar.DAY_OF_MONTH, 1);
            p.add(Calendar.MONTH, k);
            p.set(Calendar.DAY_OF_MONTH, 20);
            p.set(Calendar.HOUR_OF_DAY, 0);
            p.set(Calendar.MINUTE, 0);
            p.set(Calendar.SECOND, 0);
            p.set(Calendar.MILLISECOND, 0);
            int w = p.get(Calendar.DAY_OF_WEEK);
            if (w == Calendar.SATURDAY) p.add(Calendar.DAY_OF_MONTH, -1);
            else if (w == Calendar.SUNDAY) p.add(Calendar.DAY_OF_MONTH, -2);
            Calendar end = (Calendar) p.clone();
            end.add(Calendar.DAY_OF_MONTH, 1);
            if (now.before(end)) return p;
        }
        return now;
    }

    static RemoteViews build(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_scholarship);
        Calendar now = Calendar.getInstance();
        Calendar pay = payday(now);
        String big, sub;
        boolean today = pay.get(Calendar.YEAR) == now.get(Calendar.YEAR) && pay.get(Calendar.DAY_OF_YEAR) == now.get(Calendar.DAY_OF_YEAR);
        String date = new SimpleDateFormat("EEE, d MMMM", new Locale("ru")).format(pay.getTime());
        if (today) {
            big = "Сегодня! 🎉";
            sub = "День выплаты стипендии";
        } else {
            long diff = pay.getTimeInMillis() - now.getTimeInMillis();
            long d = diff / 86400000L;
            long h = (diff % 86400000L) / 3600000L;
            big = d + " д " + h + " ч";
            sub = "до выплаты · " + date;
        }
        v.setTextViewText(R.id.sc_big, big);
        v.setTextViewText(R.id.sc_sub, sub);
        v.setOnClickPendingIntent(R.id.sc_root, Widgets.open(c, "gpa", 102));
        return v;
    }
}
