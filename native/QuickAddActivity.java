package by.barsu.student;

import android.app.Activity;
import android.app.DatePickerDialog;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Быстрое добавление задания прямо с виджета: текст, предмет, срок и файлы. */
public class QuickAddActivity extends Activity {
    private static final int REQ_FILE = 77;
    private static final int MAX_FILES = 5;
    private static final long MAX_SIZE = 25L * 1024 * 1024;

    private EditText et, es;
    private Button bDate, bSave;
    private LinearLayout filesBox;
    private String due = "";
    private final List<Uri> uris = new ArrayList<>();
    private final List<String> names = new ArrayList<>();
    private final List<String> mimes = new ArrayList<>();
    private final List<Long> sizes = new ArrayList<>();

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        int p = dp(20);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(p, p, p, p);

        TextView title = new TextView(this);
        title.setText("Новое задание");
        title.setTextSize(18);
        title.setTypeface(null, Typeface.BOLD);
        title.setTextColor(Color.parseColor("#111827"));
        root.addView(title);

        et = new EditText(this);
        et.setHint("Что нужно сделать");
        et.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        et.setMaxLines(3);
        et.setFilters(new InputFilter[]{new InputFilter.LengthFilter(120)});
        root.addView(et);

        es = new EditText(this);
        es.setHint("Предмет (необязательно)");
        es.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        es.setSingleLine(true);
        es.setFilters(new InputFilter[]{new InputFilter.LengthFilter(60)});
        root.addView(es);

        bDate = new Button(this);
        bDate.setAllCaps(false);
        bDate.setText("📅 Срок сдачи: не выбран");
        bDate.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                pickDate();
            }
        });
        root.addView(bDate);

        Button bAttach = new Button(this);
        bAttach.setAllCaps(false);
        bAttach.setText("📎 Прикрепить фото или файл");
        bAttach.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                pickFile();
            }
        });
        root.addView(bAttach);

        filesBox = new LinearLayout(this);
        filesBox.setOrientation(LinearLayout.VERTICAL);
        root.addView(filesBox);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.END);
        Button bCancel = new Button(this);
        bCancel.setAllCaps(false);
        bCancel.setText("Отмена");
        bCancel.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });
        bSave = new Button(this);
        bSave.setAllCaps(false);
        bSave.setText("Добавить");
        bSave.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                save();
            }
        });
        row.addView(bCancel);
        row.addView(bSave);
        root.addView(row);

        ScrollView sv = new ScrollView(this);
        sv.addView(root, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(sv);
        getWindow().setLayout((int) (getResources().getDisplayMetrics().widthPixels * 0.92), ViewGroup.LayoutParams.WRAP_CONTENT);
        et.requestFocus();
    }

    private void pickDate() {
        Calendar c = Calendar.getInstance();
        new DatePickerDialog(this, new DatePickerDialog.OnDateSetListener() {
            @Override
            public void onDateSet(android.widget.DatePicker v, int y, int m, int d) {
                due = String.format(java.util.Locale.US, "%04d-%02d-%02d", y, m + 1, d);
                bDate.setText("📅 Срок сдачи: " + String.format(java.util.Locale.US, "%02d.%02d.%04d", d, m + 1, y));
            }
        }, c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH)).show();
    }

    private void pickFile() {
        if (uris.size() >= MAX_FILES) {
            Toast.makeText(this, "Не больше 5 файлов к одному заданию.", Toast.LENGTH_SHORT).show();
            return;
        }
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
            "image/*", "application/pdf", "text/plain",
            "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"});
        i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        try {
            startActivityForResult(i, REQ_FILE);
        } catch (Exception e) {
            Toast.makeText(this, "Не удалось открыть выбор файлов.", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_FILE || res != RESULT_OK || data == null) return;
        List<Uri> got = new ArrayList<>();
        if (data.getClipData() != null) {
            for (int k = 0; k < data.getClipData().getItemCount(); k++) got.add(data.getClipData().getItemAt(k).getUri());
        } else if (data.getData() != null) {
            got.add(data.getData());
        }
        for (Uri u : got) {
            if (uris.size() >= MAX_FILES) {
                Toast.makeText(this, "Не больше 5 файлов к одному заданию.", Toast.LENGTH_SHORT).show();
                break;
            }
            String name = "file";
            long size = -1;
            Cursor c = null;
            try {
                c = getContentResolver().query(u, null, null, null, null);
                if (c != null && c.moveToFirst()) {
                    int ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME), si = c.getColumnIndex(OpenableColumns.SIZE);
                    if (ni >= 0) name = c.getString(ni);
                    if (si >= 0 && !c.isNull(si)) size = c.getLong(si);
                }
            } catch (Exception e) {
                // ignore
            } finally {
                if (c != null) c.close();
            }
            if (size > MAX_SIZE) {
                Toast.makeText(this, "«" + name + "» больше 25 МБ.", Toast.LENGTH_LONG).show();
                continue;
            }
            String mime = getContentResolver().getType(u);
            uris.add(u);
            names.add(name);
            mimes.add(mime == null ? "application/octet-stream" : mime);
            sizes.add(size);
        }
        drawFiles();
    }

    private void drawFiles() {
        filesBox.removeAllViews();
        for (int k = 0; k < uris.size(); k++) {
            final int idx = k;
            LinearLayout r = new LinearLayout(this);
            r.setOrientation(LinearLayout.HORIZONTAL);
            r.setGravity(Gravity.CENTER_VERTICAL);
            TextView t = new TextView(this);
            t.setText((mimes.get(k).startsWith("image/") ? "🖼 " : "📄 ") + names.get(k));
            t.setTextColor(Color.parseColor("#111827"));
            t.setSingleLine(true);
            t.setEllipsize(android.text.TextUtils.TruncateAt.END);
            r.addView(t, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            Button x = new Button(this);
            x.setText("✕");
            x.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    uris.remove(idx);
                    names.remove(idx);
                    mimes.remove(idx);
                    sizes.remove(idx);
                    drawFiles();
                }
            });
            r.addView(x);
            filesBox.addView(r);
        }
    }

    private void save() {
        final String text = et.getText().toString().trim();
        if (text.isEmpty()) {
            et.setError("Напишите, что нужно сделать");
            et.requestFocus();
            return;
        }
        final String subj = es.getText().toString().trim();
        bSave.setEnabled(false);
        bSave.setText("Сохраняем…");
        final List<Uri> u = new ArrayList<>(uris);
        final List<String> nn = new ArrayList<>(names), mm = new ArrayList<>(mimes);
        new Thread(new Runnable() {
            @Override
            public void run() {
                JSONArray pf = new JSONArray();
                List<File> made = new ArrayList<>();
                boolean fail = false;
                try {
                    File dir = new File(getFilesDir(), "pending");
                    dir.mkdirs();
                    for (int k = 0; k < u.size(); k++) {
                        String fid = "w" + Long.toString(System.currentTimeMillis(), 36) + k + Integer.toString((int) (Math.random() * 46656), 36);
                        File f = new File(dir, fid);
                        made.add(f);
                        long total = 0;
                        InputStream in = getContentResolver().openInputStream(u.get(k));
                        OutputStream out = new FileOutputStream(f);
                        try {
                            byte[] buf = new byte[65536];
                            int n;
                            while (in != null && (n = in.read(buf)) > 0) {
                                total += n;
                                if (total > MAX_SIZE) throw new Exception("big");
                                out.write(buf, 0, n);
                            }
                        } finally {
                            if (in != null) in.close();
                            out.close();
                        }
                        pf.put(new JSONObject().put("id", fid).put("name", nn.get(k)).put("mime", mm.get(k)).put("size", total));
                    }
                } catch (Exception e) {
                    fail = true;
                    for (File f : made) f.delete();
                }
                final boolean bad = fail;
                if (!bad) {
                    try {
                        JSONObject o = new JSONObject();
                        o.put("id", Long.toString(System.currentTimeMillis(), 36) + Integer.toString((int) (Math.random() * 1679616), 36));
                        o.put("t", text);
                        o.put("s", subj);
                        o.put("d", due);
                        o.put("done", false);
                        o.put("f", new JSONArray());
                        if (pf.length() > 0) o.put("pf", pf);
                        JSONArray a = Store.tasks(QuickAddActivity.this);
                        a.put(o);
                        Store.setTasks(QuickAddActivity.this, a.toString());
                        TasksWidget.updateAll(QuickAddActivity.this);
                    } catch (Exception e) {
                        fail = true;
                    }
                }
                final boolean bad2 = fail;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (bad2) {
                            bSave.setEnabled(true);
                            bSave.setText("Добавить");
                            Toast.makeText(QuickAddActivity.this, "Не удалось сохранить задание или файлы.", Toast.LENGTH_LONG).show();
                        } else {
                            Toast.makeText(QuickAddActivity.this, "Задание добавлено", Toast.LENGTH_SHORT).show();
                            finish();
                        }
                    }
                });
            }
        }).start();
    }
}
