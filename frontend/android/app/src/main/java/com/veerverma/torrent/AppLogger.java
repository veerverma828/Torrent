package com.veerverma.torrent;

import android.content.Context;
import android.util.Log;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Persistent, file-backed logger for diagnosing issues we can't reproduce —
 * in particular a genuine native crash, where the process dies before
 * logcat (or any in-memory JS state) can be inspected. Every entry is
 * flushed to disk immediately so it survives the crash that follows it.
 *
 * Installed as the process's uncaught-exception handler (see {@link #install})
 * so a crash's full stack trace is captured before Android tears the app
 * down, then chains to the previous handler so default crash behavior
 * (system crash dialog, process death) still happens normally.
 *
 * Exposed to JS via NativePlayerPlugin.getLogs/clearLogs so Settings can
 * show a Logs tab without needing adb/logcat access.
 */
public class AppLogger {

    private static final String TAG = "AppLogger";
    private static final String LOG_FILE = "app_log.txt";
    private static final long MAX_LOG_BYTES = 512 * 1024; // rotate before it grows unbounded

    private static File logFile;
    private static final SimpleDateFormat TIME_FORMAT =
            new SimpleDateFormat("MM-dd HH:mm:ss", Locale.US);
    // Routine log writes go through a single background thread so disk I/O
    // (including the occasional full-file rewrite on rotation) never blocks
    // whatever main-thread call site logged it (e.g. PlayerActivity.onCreate).
    // The crash path below deliberately bypasses this and writes inline —
    // queued work can be lost if the process dies before the executor drains.
    private static final ExecutorService writeExecutor = Executors.newSingleThreadExecutor();

    public static synchronized void init(Context context) {
        if (logFile != null) return;
        logFile = new File(context.getApplicationContext().getFilesDir(), LOG_FILE);
    }

    /** Install a process-wide crash handler that persists the full stack
     *  trace before the app dies. Call once, early (Application/first
     *  Activity's onCreate). */
    public static void install(Context context) {
        init(context);
        Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                // Synchronous, not queued: the process may be gone before a
                // background executor gets to drain, and the whole point of
                // this logger is surviving the crash that follows it.
                writeSync("E", "CRASH", "Uncaught exception on thread " + thread.getName(), throwable);
            } catch (Throwable ignored) {
                // Never let logging itself block the crash from surfacing.
            }
            if (previous != null) previous.uncaughtException(thread, throwable);
        });
        info(TAG, "Crash handler installed");
    }

    public static void info(String tag, String message) {
        write("I", tag, message, null);
    }

    public static void error(String tag, String message) {
        write("E", tag, message, null);
    }

    public static void error(String tag, String message, Throwable t) {
        write("E", tag, message, t);
    }

    private static void write(String level, String tag, String message, Throwable t) {
        // Always mirror to logcat too, for when a debugger IS attached.
        if ("E".equals(level)) Log.e(tag, message, t);
        else Log.i(tag, message);

        writeExecutor.execute(() -> writeSync(level, tag, message, t));
    }

    private static synchronized void writeSync(String level, String tag, String message, Throwable t) {
        if (logFile == null) return; // init() never called — degrade to logcat-only

        StringBuilder line = new StringBuilder();
        line.append(TIME_FORMAT.format(new Date())).append(' ')
                .append(level).append('/').append(tag).append(": ").append(message).append('\n');
        if (t != null) {
            StringWriter sw = new StringWriter();
            t.printStackTrace(new PrintWriter(sw));
            line.append(sw).append('\n');
        }

        try {
            if (logFile.exists() && logFile.length() > MAX_LOG_BYTES) {
                // Simple rotation: keep only the second half of the file.
                String content = readAll();
                String trimmed = content.length() > MAX_LOG_BYTES / 2
                        ? content.substring(content.length() - (int) (MAX_LOG_BYTES / 2))
                        : content;
                try (FileWriter fw = new FileWriter(logFile, false)) {
                    fw.write("--- log rotated ---\n");
                    fw.write(trimmed);
                }
            }
            try (FileWriter fw = new FileWriter(logFile, true)) {
                fw.write(line.toString());
            }
        } catch (Throwable ignored) {
            // Logging must never itself crash the app.
        }
    }

    public static synchronized String readAll() {
        if (logFile == null || !logFile.exists()) return "";
        try {
            byte[] bytes = java.nio.file.Files.readAllBytes(logFile.toPath());
            return new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Throwable e) {
            return "(failed to read log file: " + e.getMessage() + ")";
        }
    }

    public static synchronized void clear() {
        if (logFile != null && logFile.exists()) {
            //noinspection ResultOfMethodCallIgnored
            logFile.delete();
        }
    }
}
