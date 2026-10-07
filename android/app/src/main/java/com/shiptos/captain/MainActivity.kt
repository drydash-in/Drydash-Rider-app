package com.shiptos.captain
import expo.modules.splashscreen.SplashScreenManager

import android.app.PictureInPictureParams
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.util.Rational

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {

    companion object {
        private const val TAG = "MainActivity"

        /**
         * Held so LocationService can call updatePiPParams() when tracking
         * starts/stops — enabling Android 12+ auto-enter.
         */
        var instance: MainActivity? = null
            private set

        @Volatile
        var isForeground: Boolean = false
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        SplashScreenManager.registerOnActivity(this)
        super.onCreate(null)
        instance = this
        // Initialise PiP params with autoEnterEnabled=false (tracking not yet started)
        updatePiPParams(trackingActive = false)
    }

    override fun onResume() {
        super.onResume()
        isForeground = true
        // Dismiss PiPActivity immediately if it is lingering while MainActivity is in foreground
        try {
            PiPActivity.instance?.finish()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to finish PiPActivity on resume", e)
        }
    }

    override fun onPause() {
        super.onPause()
        isForeground = false
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance == this) instance = null
        isForeground = false
    }

    override fun getMainComponentName(): String = "main"

    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return ReactActivityDelegateWrapper(
            this,
            BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
            object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {}
        )
    }

    override fun invokeDefaultOnBackPressed() {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
            if (!moveTaskToBack(false)) {
                super.invokeDefaultOnBackPressed()
            }
            return
        }
        super.invokeDefaultOnBackPressed()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PiP helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Update the PiP parameters registered with the system.
     *
     * On Android 12+ (API 31+) setting autoEnterEnabled=true means the OS will
     * automatically slide the activity into a PiP window whenever the user
     * navigates away — no explicit enterPictureInPictureMode() call needed.
     *
     * Called from LocationService when tracking starts/stops.
     */
    fun updatePiPParams(trackingActive: Boolean) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        try {
            val builder = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(3, 4))
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                builder.setAutoEnterEnabled(trackingActive)
            }
            setPictureInPictureParams(builder.build())
            Log.d(TAG, "✅ PiP params updated: trackingActive=$trackingActive autoEnterEnabled=${Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && trackingActive}")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to update PiP params", e)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── PRIMARY PiP TRIGGER ──────────────────────────────────────────────────
    //
    // onUserLeaveHint() fires when the user explicitly leaves the app
    // (Home button press, or the system decides to put the app in the background).
    // At this EXACT moment the Activity window is still ACTIVE and ATTACHED —
    // enterPictureInPictureMode() is guaranteed to succeed.
    //
    // WHY NOT onStop():
    //   onStop() fires AFTER the window has already started transitioning away.
    //   The system has committed to stopping the window, so PiP entry is
    //   SILENTLY REJECTED in release/production builds (though it may work in
    //   debug because of extra developer-tool permissions).
    //
    // For Android 12+ (API 31+): autoEnterEnabled=true (set in updatePiPParams)
    //   handles entry automatically — no explicit call needed here.
    // For Android 8–11 (API 26–30): we call enterPictureInPictureMode() here.
    // ─────────────────────────────────────────────────────────────────────────
    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        LocationService.pipRequested = false // consume any pending flag

        if (RiderTrackingModule.isSuppressed) {
            Log.d(TAG, "🔒 PiP suppressed — skipping onUserLeaveHint")
            return
        }
        if (!LocationService.isRunning) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
                // API 26–30: enter PiP manually here (autoEnterEnabled not available)
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(3, 4))
                    .build()
                val entered = enterPictureInPictureMode(params)
                Log.d(TAG, if (entered) "✅ PiP entered (API<31)" else "⚠️ PiP enter returned false (API<31)")
            }
            // API 31+: autoEnterEnabled=true already registered — OS handles it automatically

            // Also launch PiPActivity so it appears on the lock screen.
            // PiPActivity sets FLAG_SHOW_WHEN_LOCKED so the card is visible
            // above the keyguard when the device is locked.
            if (PiPActivity.instance == null) {
                val intent = Intent(this, PiPActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                }
                startActivity(intent)
                Log.d(TAG, "✅ PiPActivity launched for lock-screen overlay")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ PiP trigger failed in onUserLeaveHint", e)
        }
    }
}
