// services/OverlayManager.ts
//
// Manages the PiP / floating overlay lifecycle from the React Native side.
//
// Strategy:
//  1. Prefer PiP (Android 8+ / API 26+) — no extra permission needed.
//  2. Fall back to floating overlay if PiP is not supported or denied.
//  3. If overlay permission is not granted, prompt the user.
//
// Call showMiniWindow() when the app goes to background.
// Call hideMiniWindow() when the app returns to foreground or tracking stops.

import { Alert, Linking, NativeModules, Platform } from 'react-native';

const { RiderTrackingModule } = NativeModules;

// ─────────────────────────────────────────────────────────────────────────────
// Permission helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check whether SYSTEM_ALERT_WINDOW (overlay draw) permission is granted.
 * Always returns true on non-Android or Android < 6 (API 23).
 */
export async function isOverlayPermissionGranted(): Promise<boolean> {
  if (Platform.OS !== 'android') return false; // Overlay is Android-only
  try {
    return await RiderTrackingModule?.checkOverlayPermission?.() ?? false;
  } catch {
    return false;
  }
}

export async function openOverlaySettingsDirectly(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await RiderTrackingModule?.requestOverlayPermission?.();
  } catch {
    try {
      await Linking.sendIntent('android.settings.action.MANAGE_OVERLAY_PERMISSION', [
        { key: 'android.provider.extra.APP_PACKAGE', value: 'com.shiptos.captain' },
      ]);
    } catch {
      await Linking.openSettings();
    }
  }
}

/**
 * Open Android settings so the user can grant SYSTEM_ALERT_WINDOW.
 * Returns true if the user was directed to settings, false if unavailable.
 */
export async function requestOverlayPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  return new Promise((resolve) => {
    Alert.alert(
      '🫧 Floating Overlay Permission',
      'To show a mini tracking window while you use other apps, please allow "Display over other apps" in the next screen.',
      [
        { text: 'Skip', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Open Settings',
          onPress: async () => {
            await openOverlaySettingsDirectly();
            resolve(true);
          },
        },
      ],
      { cancelable: false }
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini-window lifecycle
// ─────────────────────────────────────────────────────────────────────────────

let _activeMiniWindow: 'pip' | 'overlay' | null = null;
let _isCameraActive = false;
let _isSuppressed = false;

/**
 * Set whether a camera activity is currently active.
 * Prevents PiP/Overlay from opening when app goes background during camera capture.
 */
export function setCameraActive(active: boolean): void {
  _isCameraActive = active;
  console.log('[OverlayManager] Camera active state set to:', active);
}

export function isCameraActive(): boolean {
  return _isCameraActive;
}

/**
 * Suppress PiP and floating overlay during internal screen transitions (e.g. Start Workflow).
 */
export async function setMiniWindowSuppressed(suppressed: boolean): Promise<void> {
  _isSuppressed = suppressed;
  console.log('[OverlayManager] Mini window suppressed set to:', suppressed);
  if (suppressed) {
    await hideMiniWindow();
  }
  try {
    await RiderTrackingModule?.setPiPSuppressed?.(suppressed);
  } catch (e) {
    console.warn('[OverlayManager] setPiPSuppressed failed:', e);
  }
}

export function isMiniWindowSuppressed(): boolean {
  return _isSuppressed || _isCameraActive;
}

/**
 * Show a mini tracking window when the app moves to the background.
 *
 * Prefers PiP (Android 8+) → falls back to overlay → does nothing if neither
 * is available / permitted.
 */
export async function showMiniWindow(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (_activeMiniWindow) return; // Already shown
  if (_isCameraActive || _isSuppressed) {
    console.log('[OverlayManager] Camera active or suppressed — skipping mini window');
    return;
  }

  try {
    const pipSupported: boolean =
      (await RiderTrackingModule?.isPiPSupported?.()) ?? false;

    if (pipSupported) {
      await RiderTrackingModule?.startPiP?.();
      _activeMiniWindow = 'pip';
      console.log('[OverlayManager] PiP started');
      return;
    }

    // PiP not available — try floating overlay
    const overlayGranted = await isOverlayPermissionGranted();
    if (overlayGranted) {
      await RiderTrackingModule?.startOverlay?.();
      _activeMiniWindow = 'overlay';
      console.log('[OverlayManager] Floating overlay started');
    } else {
      console.log('[OverlayManager] Neither PiP nor overlay available — no mini window shown');
    }
  } catch (e) {
    console.warn('[OverlayManager] showMiniWindow failed:', e);
  }
}

/**
 * Dismiss the mini tracking window when the app returns to the foreground
 * or when tracking is stopped.
 */
export async function hideMiniWindow(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!_activeMiniWindow) return;

  try {
    if (_activeMiniWindow === 'pip') {
      await RiderTrackingModule?.stopPiP?.();
      console.log('[OverlayManager] PiP stopped');
    } else if (_activeMiniWindow === 'overlay') {
      await RiderTrackingModule?.stopOverlay?.();
      console.log('[OverlayManager] Floating overlay stopped');
    }
  } catch (e) {
    console.warn('[OverlayManager] hideMiniWindow failed:', e);
  } finally {
    _activeMiniWindow = null;
  }
}

/**
 * Returns which mini-window mode is currently active, or null.
 */
export function getActiveMiniWindow(): 'pip' | 'overlay' | null {
  return _activeMiniWindow;
}

/**
 * Check if PiP is supported on this device.
 */
export async function isPiPSupported(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return (await RiderTrackingModule?.isPiPSupported?.()) ?? false;
  } catch {
    return false;
  }
}
