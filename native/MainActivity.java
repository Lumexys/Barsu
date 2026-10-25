package by.barsu.student;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BarsuHttp.class);
        registerPlugin(BarsuNative.class);
        BarsuNative.setLaunch(getIntent());
        super.onCreate(savedInstanceState);
        try {
            Widgets.scheduleRefresh(this);
            SyncWorker.schedule(this);
        } catch (Throwable t) {
            // ignore
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        try {
            // если раздел ещё не забрали (событие могло уйти до готовности страницы), напоминаем странице
            if (BarsuNative.launch != null) getBridge().triggerWindowJSEvent("barsuOpen", "{}");
        } catch (Throwable t) {
            // ignore
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        BarsuNative.setLaunch(intent);
        try {
            // приложение уже запущено: сразу сообщаем странице, что нужно открыть раздел
            getBridge().triggerWindowJSEvent("barsuOpen", "{}");
        } catch (Throwable t) {
            // ignore
        }
    }
}
