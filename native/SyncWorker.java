package by.barsu.student;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.util.concurrent.TimeUnit;

public class SyncWorker extends Worker {
    public SyncWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        try {
            Sync.run(c, true);
        } catch (Throwable t) {
            // сеть недоступна или сайт не ответил — попробуем в следующий раз
        }
        try {
            Widgets.updateAll(c);
        } catch (Throwable t) {
            // ignore
        }
        return Result.success();
    }

    static void schedule(Context c) {
        Constraints cons = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest r = new PeriodicWorkRequest.Builder(SyncWorker.class, 15, TimeUnit.MINUTES)
            .setConstraints(cons)
            .build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork("barsu-sync", ExistingPeriodicWorkPolicy.KEEP, r);
    }
}
