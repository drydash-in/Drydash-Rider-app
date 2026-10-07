// services/notifications.ts
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

// ✅ Show notifications even when app is foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const BACKGROUND_NOTIFICATION_TASK = "BACKGROUND-NOTIFICATION-TASK";

try {
  if (!TaskManager.isTaskDefined(BACKGROUND_NOTIFICATION_TASK)) {
    TaskManager.defineTask(
      BACKGROUND_NOTIFICATION_TASK,
      async ({ data, error, executionInfo }: any) => {
        if (error) {
          console.warn("❌ [BackgroundNotification] Task error:", error);
          return;
        }
        console.log("📦 [BackgroundNotification] Notification received in background:", data);
      }
    );
  }

  Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch((err) => {
    // Might fail in environments without background support; catch gracefully
    console.warn("⚠️ registerTaskAsync background notification:", err?.message || err);
  });
} catch (e: any) {
  console.warn("⚠️ Error setting up background notification task:", e?.message || e);
}

export const requestNotificationPermission = async () => {
  const { status } = await Notifications.getPermissionsAsync();

  if (status !== "granted") {
    const res = await Notifications.requestPermissionsAsync();
    return res.status === "granted";
  }

  return true;
};

export const showSystemNotification = async (title: string, body: string) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // immediate
    });
  } catch (error) {
    console.log("❌ showSystemNotification error:", error);
  }
};
