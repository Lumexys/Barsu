import re, sys

# --- манифест: разрешения и виджеты ---
p = "android/app/src/main/AndroidManifest.xml"
s = open(p, encoding="utf-8").read()
perms = """
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
    <uses-permission android:name="android.permission.VIBRATE"/>
"""
def receiver(cls, res, label):
    return f"""
        <receiver android:name="by.barsu.student.{cls}" android:exported="false" android:label="{label}">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/{res}"/>
        </receiver>"""
recv = (receiver("ScheduleWidget", "widget_schedule_info", "Расписание на день")
        + receiver("ScholarshipWidget", "widget_scholarship_info", "Таймер до стипендии")
        + receiver("TasksWidget", "widget_tasks_info", "Домашка и дедлайны")
        + """
        <receiver android:name="by.barsu.student.Widgets$Refresh" android:exported="false"/>
        <activity android:name="by.barsu.student.QuickAddActivity" android:exported="false" android:excludeFromRecents="true" android:taskAffinity="" android:launchMode="singleTask" android:theme="@android:style/Theme.Material.Light.Dialog.NoActionBar" android:windowSoftInputMode="stateVisible|adjustResize"/>""" + "\n    ")
assert "</application>" in s and "</manifest>" in s
s = s.replace("</application>", recv + "</application>", 1)
s = s.replace("</manifest>", perms + "</manifest>", 1)
open(p, "w", encoding="utf-8").write(s)

# --- gradle: WorkManager и jsoup ---
g = "android/app/build.gradle"
t = open(g, encoding="utf-8").read()
dep = '\n    implementation "androidx.work:work-runtime:2.9.0"\n    implementation "org.jsoup:jsoup:1.17.2"\n    implementation "com.google.android.gms:play-services-auth:21.2.0"'
t2, n = re.subn(r"^dependencies \{", "dependencies {" + dep, t, count=1, flags=re.M)
assert n == 1, "dependencies block not found"
open(g, "w", encoding="utf-8").write(t2)
print("android patched")

# --- Firebase: google-services.json, плагин сервисов, minSdk 23 ---
import shutil, os
assert os.path.exists("google-services.json"), "google-services.json не найден в корне проекта"
shutil.copyfile("google-services.json", "android/app/google-services.json")

pb = "android/build.gradle"
tb = open(pb, encoding="utf-8").read()
if "com.google.gms:google-services" not in tb:
    tb, n = re.subn(r"(dependencies\s*\{)", r"\1\n        classpath 'com.google.gms:google-services:4.4.2'", tb, count=1)
    assert n == 1, "buildscript dependencies not found"
    open(pb, "w", encoding="utf-8").write(tb)

ab = "android/app/build.gradle"
ta = open(ab, encoding="utf-8").read()
if "com.google.gms.google-services" not in ta:
    ta += "\napply plugin: 'com.google.gms.google-services'\n"
    open(ab, "w", encoding="utf-8").write(ta)

# --- подпись APK: всегда ключ debug.keystore из проекта, чтобы SHA-1 совпадал с Firebase (иначе вход через Google даёт ошибку 10) ---
assert os.path.exists("debug.keystore"), "debug.keystore не найден в корне проекта"
shutil.copyfile("debug.keystore", "android/app/barsu.keystore")
ta = open(ab, encoding="utf-8").read()
if "barsuSign" not in ta:
    ta += """
android {
    signingConfigs {
        barsuSign {
            storeFile file('barsu.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug { signingConfig signingConfigs.barsuSign }
        release { signingConfig signingConfigs.barsuSign }
    }
}
"""
    open(ab, "w", encoding="utf-8").write(ta)
print("signing patched")

vg = "android/variables.gradle"
if os.path.exists(vg):
    tv = open(vg, encoding="utf-8").read()
    tv = re.sub(r"minSdkVersion\s*=\s*\d+", "minSdkVersion = 23", tv)
    open(vg, "w", encoding="utf-8").write(tv)
print("firebase patched")
