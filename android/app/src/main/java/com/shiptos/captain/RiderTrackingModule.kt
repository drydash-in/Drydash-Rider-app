package com.shiptos.captain

import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter
import android.location.Location
import android.util.Log
import androidx.core.app.NotificationManagerCompat

class RiderTrackingModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "RiderTrackingModule"
        var instance: RiderTrackingModule? = null
        @Volatile
        var isSuppressed: Boolean = false
    }

    init {
        instance = this
    }

    override fun getName(): String {
        return "RiderTrackingModule"
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required by NativeEventEmitter.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required by NativeEventEmitter.
    }

    @ReactMethod
    fun startTrip(riderId: String, apiBaseUrl: String, promise: Promise) {
        try {
            Log.e(TAG, "🚀 startTrip called with riderId: $riderId")
            val intent = Intent(reactContext, LocationService::class.java).apply {
                putExtra("riderId", riderId)
                putExtra("apiBaseUrl", apiBaseUrl)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            promise.resolve("Service Started")
        } catch (e: Exception) {
            Log.e(TAG, "❌ startTrip failed", e)
            promise.reject("Error", e)
        }
    }

    @ReactMethod
    fun stopTrip(promise: Promise) {
        try {
            Log.e(TAG, "🛑 stopTrip called")
            // Stop PiP and overlay first
            LocationService.instance?.stopPiP()
            LocationService.instance?.stopOverlay()
            // Mark as user-requested so the service knows to fully stop
            // (otherwise self-heal alarms will restart it)
            LocationService.instance?.userRequestedStop()
            val intent = Intent(reactContext, LocationService::class.java)
            reactContext.getSharedPreferences("rider_tracking_prefs", android.content.Context.MODE_PRIVATE)
                .edit()
                .remove("key_rider_id")
                .remove("key_api_base_url")
                .apply()
            reactContext.stopService(intent)
            promise.resolve("Service Stopped")
        } catch (e: Exception) {
            Log.e(TAG, "❌ stopTrip failed", e)
            promise.reject("Error", e)
        }
    }

    /**
     * Dynamically update tracking extras (taskTracking JSON) without restarting the service.
     * Called from JS when a navigation leg starts/stops so the native HTTP POST includes
     * per-task tracking data. Pass null or empty string to clear.
     */
    @ReactMethod
    fun updateTrackingExtras(extras: String, promise: Promise) {
        try {
            LocationService.instance?.updateExtras(extras)
            promise.resolve("Extras Updated")
        } catch (e: Exception) {
            Log.e(TAG, "❌ updateTrackingExtras failed", e)
            promise.reject("Error", e)
        }
    }

    /**
     * Check if the native foreground service is currently running.
     * Used by the JS watchdog to skip the Expo task check on Android.
     */
    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        try {
            val running = LocationService.isRunning
            promise.resolve(running)
            Log.e(TAG, "isServiceRunning: $running")
        } catch (e: Exception) {
            promise.reject("Error", e)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PERMISSION CHECKS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Check if the SYSTEM_ALERT_WINDOW (overlay) permission is granted.
     * Returns true/false to JS.
     */
    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        try {
            val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(reactContext)
            } else {
                true // Always available below API 23
            }
            Log.d(TAG, "checkOverlayPermission: $granted")
            promise.resolve(granted)
        } catch (e: Exception) {
            Log.e(TAG, "❌ checkOverlayPermission failed", e)
            promise.reject("Error", e)
        }
    }

    /**
     * Open the system settings page for SYSTEM_ALERT_WINDOW permission.
     *
     * IMPORTANT: Must use currentActivity.startActivity() — NOT reactContext.startActivity().
     * In release builds, Android 10+ blocks startActivity() from a non-Activity context
     * for the overlay settings screen. Using the current foreground Activity bypasses this.
     */
    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    android.net.Uri.parse("package:${reactContext.packageName}")
                ).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                // Use currentActivity if available (foreground Activity context)
                // Falls back to reactContext only if no activity is attached
                val activity = reactContext.currentActivity
                if (activity != null) {
                    activity.startActivity(intent)
                } else {
                    reactContext.startActivity(intent)
                }
                promise.resolve("Settings Opened")
            } else {
                promise.resolve("Not Required")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ requestOverlayPermission failed", e)
            promise.reject("Error", e)
        }
    }

    /**
     * Check if POST_NOTIFICATIONS permission is granted (Android 13+, API 33).
     * On older versions this is always true.
     */
    @ReactMethod
    fun checkNotificationPermission(promise: Promise) {
        try {
            val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                NotificationManagerCompat.from(reactContext).areNotificationsEnabled()
            } else {
                true
            }
            Log.d(TAG, "checkNotificationPermission: $granted")
            promise.resolve(granted)
        } catch (e: Exception) {
            Log.e(TAG, "❌ checkNotificationPermission failed", e)
            promise.reject("Error", e)
        }
    }

    /**
     * Open the notification settings so the user can enable notifications
     * for this app. Required on Android 13+ if POST_NOTIFICATIONS was denied.
     */
    @ReactMethod
    fun openNotificationSettings(promise: Promise) {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                    putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
            } else {
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = android.net.Uri.parse("package:${reactContext.packageName}")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
            }
            val activity = reactContext.currentActivity
            if (activity != null) {
                activity.startActivity(intent)
            } else {
                reactContext.startActivity(intent)
            }
            promise.resolve("Settings Opened")
        } catch (e: Exception) {
            Log.e(TAG, "❌ openNotificationSettings failed", e)
            promise.reject("Error", e)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PiP CONTROLS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Check whether PiP is supported on this device (Android 8+, API 26+).
     */
    @ReactMethod
    fun isPiPSupported(promise: Promise) {
        try {
            val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            promise.resolve(supported)
        } catch (e: Exception) {
            promise.reject("Error", e)
        }
    }

    /**
     * Launch PiPActivity which auto-enters PiP mode.
     * Only works on Android 8+ (API 26+).
     */
    @ReactMethod
    fun startPiP(promise: Promise) {
        try {
            LocationService.instance?.startPiP()
                ?: run {
                    // Service not running yet — launch PiPActivity directly.
                    // Must use currentActivity to bypass Android 10+ background launch restrictions.
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        val intent = Intent(reactContext, PiPActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                        }
                        val activity = reactContext.currentActivity
                        if (activity != null) {
                            activity.startActivity(intent)
                        } else {
                            reactContext.startActivity(intent)
                        }
                    }
                }
            promise.resolve("PiP Started")
        } catch (e: Exception) {
            Log.e(TAG, "❌ startPiP failed", e)
            promise.reject("Error", e)
        }
    }

    /**
     * Finish PiPActivity and dismiss the PiP window.
     */
    @ReactMethod
    fun stopPiP(promise: Promise) {
        try {
            LocationService.instance?.stopPiP()
                ?: PiPActivity.instance?.finish()
            promise.resolve("PiP Stopped")
        } catch (e: Exception) {
            Log.e(TAG, "❌ stopPiP failed", e)
            promise.reject("Error", e)
        }
    }

    /**
     * Suppress PiP during internal app navigation/transitions.
     */
    @ReactMethod
    fun setPiPSuppressed(suppressed: Boolean, promise: Promise) {
        try {
            isSuppressed = suppressed
            if (suppressed) {
                LocationService.instance?.stopPiP()
                    ?: PiPActivity.instance?.finish()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Error", e)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OVERLAY CONTROLS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Start the floating bubble overlay service.
     * Requires SYSTEM_ALERT_WINDOW permission.
     */
    @ReactMethod
    fun startOverlay(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
                promise.reject("PERMISSION_DENIED", "SYSTEM_ALERT_WINDOW permission not granted")
                return
            }
            LocationService.instance?.startOverlay()
                ?: run {
                    val intent = Intent(reactContext, OverlayService::class.java)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        reactContext.startForegroundService(intent)
                    } else {
                        reactContext.startService(intent)
                    }
                }
            promise.resolve("Overlay Started")
        } catch (e: Exception) {
            Log.e(TAG, "❌ startOverlay failed", e)
            promise.reject("Error", e)
        }
    }

    /**
     * Stop the floating bubble overlay service.
     */
    @ReactMethod
    fun stopOverlay(promise: Promise) {
        try {
            reactContext.stopService(Intent(reactContext, OverlayService::class.java))
            promise.resolve("Overlay Stopped")
        } catch (e: Exception) {
            Log.e(TAG, "❌ stopOverlay failed", e)
            promise.reject("Error", e)
        }
    }

    /**
     * Check if the overlay service is currently running.
     */
    @ReactMethod
    fun isOverlayRunning(promise: Promise) {
        try {
            promise.resolve(OverlayService.isRunning)
        } catch (e: Exception) {
            promise.reject("Error", e)
        }
    }

    /**
     * Check if PiPActivity is currently visible.
     */
    @ReactMethod
    fun isPiPRunning(promise: Promise) {
        try {
            promise.resolve(PiPActivity.instance != null)
        } catch (e: Exception) {
            promise.reject("Error", e)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL — Called from LocationService
    // ─────────────────────────────────────────────────────────────────────────

    fun sendLocationEvent(location: Location) {
        Log.e(TAG, "📡 Emitting location to JS: lat=${location.latitude}, lng=${location.longitude}, speed=${location.speed}")

        val params = Arguments.createMap().apply {
            putDouble("latitude", location.latitude)
            putDouble("longitude", location.longitude)
            putDouble("speed", (location.speed * 3.6f).toDouble())
            putDouble("bearing", location.bearing.toDouble())
            putDouble("accuracy", location.accuracy.toDouble())
            putDouble("timestamp", location.time.toDouble())
        }

        try {
            reactContext
                .getJSModule(RCTDeviceEventEmitter::class.java)
                .emit("onLocationUpdate", params)
            Log.e(TAG, "✅ Location event emitted successfully")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to emit location event", e)
        }
    }
}
