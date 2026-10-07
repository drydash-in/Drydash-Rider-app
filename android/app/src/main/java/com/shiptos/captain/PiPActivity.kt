package com.shiptos.captain

import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.app.RemoteAction
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.drawable.Icon
import android.location.Location
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.util.Rational
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.annotation.RequiresApi
import androidx.appcompat.app.AppCompatActivity
import androidx.localbroadcastmanager.content.LocalBroadcastManager

/**
 * Lightweight activity that enters Picture-in-Picture mode to show
 * a compact tracking status (speed + live indicator) while the rider
 * is using other apps.
 *
 * Receives location broadcasts from LocationService via LocalBroadcastManager.
 */
class PiPActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "PiPActivity"
        const val ACTION_LOCATION_BROADCAST = "com.shiptos.captain.LOCATION_BROADCAST"
        const val ACTION_RETURN_TO_APP = "com.shiptos.captain.ACTION_RETURN_TO_APP"
        const val ACTION_TRACKING_STOPPED = "com.shiptos.captain.TRACKING_STOPPED"
        const val EXTRA_LAT = "lat"
        const val EXTRA_LNG = "lng"
        const val EXTRA_SPEED = "speed"
        const val EXTRA_BEARING = "bearing"

        @Volatile
        var instance: PiPActivity? = null
            private set
    }

    // UI views
    private lateinit var speedText: TextView
    private lateinit var liveLabel: TextView
    private lateinit var elapsedText: TextView
    private lateinit var liveDot: View
    private lateinit var rootLayout: FrameLayout

    // State
    private var startTimeMs = 0L
    private val uiHandler = Handler(Looper.getMainLooper())
    private var isInPiP = false
    private var wifiLock: WifiManager.WifiLock? = null

    // Broadcast receiver for tracking-stopped signal from LocationService
    private val trackingStoppedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == ACTION_TRACKING_STOPPED) {
                Log.d(TAG, "📡 Received TRACKING_STOPPED — finishing PiP")
                finish()
            }
        }
    }

    // Broadcast receiver for location updates from LocationService
    private val locationReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == ACTION_LOCATION_BROADCAST) {
                val speedKmh = (intent.getFloatExtra(EXTRA_SPEED, 0f) * 3.6f).toInt()
                speedText.text = "${speedKmh}\nkm/h"
            }
        }
    }

    // Timer runnable to update elapsed time
    private val timerRunnable = object : Runnable {
        override fun run() {
            val elapsed = SystemClock.elapsedRealtime() - startTimeMs
            val seconds = (elapsed / 1000) % 60
            val minutes = (elapsed / 60000) % 60
            val hours = elapsed / 3600000
            elapsedText.text = if (hours > 0) {
                String.format("%d:%02d:%02d", hours, minutes, seconds)
            } else {
                String.format("%02d:%02d", minutes, seconds)
            }

            // Pulse the live dot
            liveDot.alpha = if ((elapsed / 500) % 2 == 0L) 1.0f else 0.4f

            uiHandler.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "onCreate")
        instance = this
        startTimeMs = SystemClock.elapsedRealtime()

        // Acquire WiFi lock — keeps WiFi radio active when screen is off.
        // This prevents socket/HTTP timeouts during lock-screen tracking.
        try {
            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "com.shiptos.captain:PiPWifiLock")
            wifiLock?.setReferenceCounted(false)
            wifiLock?.acquire()
            Log.d(TAG, "✅ WiFi lock acquired")
        } catch (e: Exception) {
            Log.w(TAG, "⚠️ Failed to acquire WiFi lock", e)
        }

        // ── Show on lock screen (keyguard) ──────────────────────────────────
        // This is what Google Maps does: the activity is visible above the lock
        // screen so the PiP window appears even when the phone is locked.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            // API 27+ clean approach
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            // API < 27 legacy flags
            @Suppress("DEPRECATION")
            window.addFlags(
                android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }

        // Build UI programmatically (no XML layout needed — keeps it simple)
        rootLayout = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#1A1A2E"))
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(16), dp(12), dp(16), dp(12))
        }

        // Live indicator row
        val liveRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }

        liveDot = View(this).apply {
            val size = dp(8)
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                marginEnd = dp(6)
            }
            background = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.OVAL
                setColor(Color.parseColor("#10B981"))
            }
        }

        liveLabel = TextView(this).apply {
            text = "LIVE TRACKING"
            setTextColor(Color.parseColor("#10B981"))
            textSize = 11f
            letterSpacing = 0.1f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }

        liveRow.addView(liveDot)
        liveRow.addView(liveLabel)

        // Speed text
        speedText = TextView(this).apply {
            text = "0\nkm/h"
            setTextColor(Color.WHITE)
            textSize = 28f
            gravity = Gravity.CENTER
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(0, dp(4), 0, dp(4))
        }

        // Elapsed time
        elapsedText = TextView(this).apply {
            text = "00:00"
            setTextColor(Color.parseColor("#94A3B8"))
            textSize = 12f
            gravity = Gravity.CENTER
        }

        container.addView(liveRow)
        container.addView(speedText)
        container.addView(elapsedText)

        rootLayout.addView(container, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
            Gravity.CENTER
        ))

        setContentView(rootLayout)

        // Register for location broadcasts
        LocalBroadcastManager.getInstance(this)
            .registerReceiver(locationReceiver, IntentFilter(ACTION_LOCATION_BROADCAST))

        // Register for tracking-stopped broadcasts
        LocalBroadcastManager.getInstance(this)
            .registerReceiver(trackingStoppedReceiver, IntentFilter(ACTION_TRACKING_STOPPED))

        // Start timer
        uiHandler.post(timerRunnable)
    }

    override fun onResume() {
        super.onResume()
        if (MainActivity.isForeground || RiderTrackingModule.isSuppressed) {
            Log.d(TAG, "MainActivity is in foreground or PiP suppressed — finishing PiPActivity")
            finish()
            return
        }
        // Enter PiP immediately on resume — the window is guaranteed to be
        // ready and attached at this point (unlike onCreate where it can fail silently).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !isInPiP) {
            enterPiPMode()
        }
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private fun enterPiPMode() {
        try {
            val params = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(3, 4))

            // Add "Return to App" action
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val returnIntent = Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val pendingIntent = PendingIntent.getActivity(
                    this, 0, returnIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val returnAction = RemoteAction(
                    Icon.createWithResource(this, android.R.drawable.ic_menu_revert),
                    "Return to App",
                    "Return to Shiptos Rider app",
                    pendingIntent
                )

                params.setActions(listOf(returnAction))
            }

            enterPictureInPictureMode(params.build())
            isInPiP = true
            Log.d(TAG, "✅ Entered PiP mode")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to enter PiP mode", e)
        }
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        isInPiP = isInPictureInPictureMode
        Log.d(TAG, "PiP mode changed: $isInPictureInPictureMode")

        if (!isInPictureInPictureMode) {
            if (isFinishing || isDestroyed || MainActivity.isForeground || RiderTrackingModule.isSuppressed) {
                Log.d(TAG, "PiP dismissed and MainActivity is in foreground, finishing, or suppressed")
                finish()
                return
            }
            // PiP was dismissed by the user (swiped away or expanded).
            // If tracking is still active, force re-enter PiP — rider CANNOT
            // dismiss the PiP card while location sharing is on.
            if (LocationService.isRunning) {
                Log.d(TAG, "🔒 Tracking still active — re-entering PiP (non-dismissable)")
                uiHandler.postDelayed({
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && LocationService.isRunning && !MainActivity.isForeground && !RiderTrackingModule.isSuppressed) {
                        enterPiPMode()
                    } else if (MainActivity.isForeground || RiderTrackingModule.isSuppressed) {
                        finish()
                    }
                }, 300)
            } else {
                // Tracking was stopped — return to main app and finish
                Log.d(TAG, "✅ Tracking stopped — finishing PiP, returning to app")
                val intent = Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                startActivity(intent)
                finish()
            }
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (MainActivity.isForeground || RiderTrackingModule.isSuppressed) {
            return
        }
        // Re-enter PiP when user navigates away
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !isInPiP) {
            enterPiPMode()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "onDestroy")
        instance = null
        uiHandler.removeCallbacks(timerRunnable)
        try {
            LocalBroadcastManager.getInstance(this)
                .unregisterReceiver(locationReceiver)
        } catch (e: Exception) {
            Log.w(TAG, "Error unregistering receiver", e)
        }
        try {
            LocalBroadcastManager.getInstance(this)
                .unregisterReceiver(trackingStoppedReceiver)
        } catch (e: Exception) {
            Log.w(TAG, "Error unregistering trackingStoppedReceiver", e)
        }
        // Release WiFi lock
        try {
            if (wifiLock?.isHeld == true) {
                wifiLock?.release()
                Log.d(TAG, "✅ WiFi lock released")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error releasing WiFi lock", e)
        }
        wifiLock = null
    }

    private fun dp(value: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics
        ).toInt()
    }
}
