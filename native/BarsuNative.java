package by.barsu.student;

import android.appwidget.AppWidgetManager;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import java.io.File;
import java.io.OutputStream;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

/** Мост между страницей и нативной частью: общие данные, виджеты, фоновая синхронизация. */
@CapacitorPlugin(name = "BarsuNative")
public class BarsuNative extends Plugin {
    static String launch = null;

    static void setLaunch(Intent i) {
        if (i != null && i.hasExtra("open")) {
            launch = i.getStringExtra("open");
            i.removeExtra("open"); // чтобы пересоздание окна не открывало раздел повторно
        }
    }

    @PluginMethod
    public void setFollow(PluginCall call) {
        Store.setFollow(getContext(), call.getString("json", "{}"));
        Widgets.updateAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void clearFollow(PluginCall call) {
        Store.clearFollow(getContext());
        Widgets.updateAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void setLessons(PluginCall call) {
        try {
            Store.mergeLessons(getContext(), new JSONObject(call.getString("json", "{}")), System.currentTimeMillis());
            Widgets.updateAll(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void getLessons(PluginCall call) {
        JSObject r = new JSObject();
        r.put("lessons", Store.lessonsPlain(getContext()).toString());
        call.resolve(r);
    }

    @PluginMethod
    public void setTasks(PluginCall call) {
        long ts = Store.setTasks(getContext(), call.getString("json", "[]"));
        TasksWidget.updateAll(getContext());
        JSObject r = new JSObject();
        r.put("ts", ts);
        call.resolve(r);
    }

    @PluginMethod
    public void getTasks(PluginCall call) {
        JSObject r = new JSObject();
        r.put("json", Store.tasks(getContext()).toString());
        r.put("ts", Store.tasksTs(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void syncNow(final PluginCall call) {
        final Context c = getContext();
        new Thread(new Runnable() {
            @Override
            public void run() {
                JSObject r = new JSObject();
                try {
                    r.put("weeks", Sync.run(c, false));
                } catch (Exception e) {
                    r.put("error", String.valueOf(e.getMessage()));
                }
                try {
                    Widgets.updateAll(c);
                } catch (Exception e) {
                    // ignore
                }
                call.resolve(r);
            }
        }).start();
    }

    @PluginMethod
    public void scheduleSync(PluginCall call) {
        SyncWorker.schedule(getContext());
        call.resolve();
    }

    @PluginMethod
    public void pendingPath(PluginCall call) {
        String id = call.getString("id", "").replaceAll("[^A-Za-z0-9_-]", "");
        File f = new File(new File(getContext().getFilesDir(), "pending"), id);
        if (id.isEmpty() || !f.exists()) {
            call.reject("none");
            return;
        }
        JSObject r = new JSObject();
        r.put("path", f.getAbsolutePath());
        call.resolve(r);
    }

    @PluginMethod
    public void deletePending(PluginCall call) {
        String id = call.getString("id", "").replaceAll("[^A-Za-z0-9_-]", "");
        if (!id.isEmpty()) new File(new File(getContext().getFilesDir(), "pending"), id).delete();
        call.resolve();
    }

    @PluginMethod
    public void consumeLaunch(PluginCall call) {
        JSObject r = new JSObject();
        r.put("target", launch == null ? "" : launch);
        launch = null;
        call.resolve(r);
    }

    @PluginMethod
    public void pinWidget(PluginCall call) {
        String n = call.getString("name", "");
        Class<?> cls = "schedule".equals(n) ? ScheduleWidget.class
            : "scholarship".equals(n) ? ScholarshipWidget.class
            : "tasks".equals(n) ? TasksWidget.class : null;
        boolean ok = false;
        if (cls != null && Build.VERSION.SDK_INT >= 26) {
            try {
                AppWidgetManager m = AppWidgetManager.getInstance(getContext());
                if (m.isRequestPinAppWidgetSupported()) {
                    ok = m.requestPinAppWidget(new ComponentName(getContext(), cls), null, null);
                }
            } catch (Exception e) {
                ok = false;
            }
        }
        JSObject r = new JSObject();
        r.put("ok", ok);
        call.resolve(r);
    }

    /** Сохраняет файл в общую папку «Загрузки» (Android 10+ без дополнительных разрешений). */
    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) {
            call.reject("old_android");
            return;
        }
        try {
            String name = call.getString("name", "file");
            String mime = call.getString("mime", "application/octet-stream");
            byte[] data = Base64.decode(call.getString("data", ""), Base64.DEFAULT);
            ContentResolver cr = getContext().getContentResolver();
            ContentValues v = new ContentValues();
            v.put(MediaStore.Downloads.DISPLAY_NAME, name);
            v.put(MediaStore.Downloads.MIME_TYPE, mime);
            v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            v.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri u = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (u == null) {
                call.reject("insert_failed");
                return;
            }
            OutputStream os = cr.openOutputStream(u);
            if (os == null) {
                call.reject("stream_failed");
                return;
            }
            try {
                os.write(data);
            } finally {
                os.close();
            }
            ContentValues done = new ContentValues();
            done.put(MediaStore.Downloads.IS_PENDING, 0);
            cr.update(u, done, null, null);
            String shown = name;
            android.database.Cursor cur = cr.query(u, new String[] {MediaStore.Downloads.DISPLAY_NAME}, null, null, null);
            if (cur != null) {
                try {
                    if (cur.moveToFirst()) shown = cur.getString(0);
                } finally {
                    cur.close();
                }
            }
            JSObject r = new JSObject();
            r.put("uri", u.toString());
            r.put("name", shown);
            call.resolve(r);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void openFile(PluginCall call) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(Uri.parse(call.getString("uri", "")), call.getString("mime", "*/*"));
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("no_app");
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }
}
