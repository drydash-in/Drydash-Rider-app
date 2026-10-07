// src/services/notificationSetup.ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function setupNotificationChannel() {
  if (Platform.OS !== "android") return;

  try {
    // Primary channel for pickup & delivery assignments
    await Notifications.setNotificationChannelAsync("assignments", {
      name: "Assignments",
      description: "Notifications for new pickup and delivery assignments",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    });

    // Fallback default channel
    await Notifications.setNotificationChannelAsync("default", {
      name: "General Notifications",
      description: "General app notifications and updates",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      showBadge: true,
    });
  } catch (err) {
    console.warn("⚠️ setupNotificationChannel error:", err);
  }
}