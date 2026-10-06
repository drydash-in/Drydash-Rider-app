// context/NotificationContext.tsx
import InAppToast from "@/components/notifications/InAppToast";
import { useAuth } from "@/context/useAuth";
import { useRiderData } from "@/context/RiderDataContext";
import { setupNotificationChannel } from "@/services/notificationSetup";
import { playNotificationSound } from "@/services/notificationSound";
import { registerForPushNotifications } from "@/services/pushNotifications";
import { API_V1_BASE_URL } from "@/constants/apiConfig";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, // ✅ REQUIRED (new)
    shouldShowList: true, // ✅ REQUIRED (new)
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type NotifyPayload = {
  title: string;
  message: string;
  duration?: number;
};

type NotificationContextType = {
  notify: (payload: NotifyPayload & { data?: any }) => void;
  hide: () => void;
  notifications: NotificationItem[];
  addNotification: (n: NotificationItem) => void;
};

type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  data?: any;
  createdAt?: string;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { user, token } = useAuth();
  const riderData = useRiderData();
  const refreshActiveTrip = riderData?.refreshActiveTrip;

  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState(500);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const addNotification = (n: NotificationItem) => {
    setNotifications((prev) => [n, ...prev]);
  };

  const fcmTokenRef = useRef<string | null>(null);
  const registeredUserRef = useRef<string | null>(null);

  const notify = ({ title, message, duration = 500, data }: any) => {
    const id = `${Date.now()}-${Math.random()}`;

    setTitle(title);
    setMessage(message);
    setDuration(duration);
    setVisible(true);

    addNotification({
      _id: id,
      title,
      message,
      data,
      createdAt: new Date().toISOString(),
    });
  };
  const hide = () => {
    setVisible(false);
  };

  const handleNavigationFromData = (data: any) => {
    try {
      if (!data) return;

      const orderId = data?.orderId ?? data?.order_id ?? data?.id;

      const isPickup =
        data?.screen === "pickup" ||
        data?.type === "pickup" ||
        data?.type === "pickup_assigned" ||
        data?.target === "pickup" ||
        Boolean(data?.pickupId) ||
        Boolean(data?.pickup_id);

      const pickupId = data?.pickupId ?? data?.pickup_id ?? orderId;

      if (isPickup && pickupId) {
        router.push(`/(rider)/order/pickup/${String(pickupId)}`);
        return;
      }

      if (orderId) {
        router.push(`/(rider)/order/delivered/${String(orderId)}`);
        return;
      }

      if (data?.deep_link) {
        router.push(String(data.deep_link) as any);
        return;
      }
    } catch (err) {
      console.warn("handleNavigationFromData error:", err);
    }
  };

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const init = async () => {
      if (!user || !token) return;
      if (registeredUserRef.current === user._id) return;

      try {
        await setupNotificationChannel();

        const fcmToken = await registerForPushNotifications();
        if (!fcmToken) return;

        fcmTokenRef.current = fcmToken;
        registeredUserRef.current = user._id;

        await fetch(`${API_V1_BASE_URL}/rider/push-tokens`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            token: fcmToken,
            platform: "android",
          }),
        });
      } catch (err) {
        console.warn("Notification registration failed:", err);
      }
    };

    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        if (mounted) init();
      }, 1500);
    });

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      task.cancel();
    };
  }, [user?._id, token]);

  useEffect(() => {
    if (user || token) return;

    const cleanup = async () => {
      const t = fcmTokenRef.current;
      if (!t) return;

      try {
        await fetch(`${API_V1_BASE_URL}/rider/push-tokens`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            // no auth header because token is gone; if you require auth, handle this from logout flow instead
          },
          body: JSON.stringify({ token: t }),
        });
      } catch (err) {
        console.warn("Failed to remove push token on logout:", err);
      } finally {
        fcmTokenRef.current = null;
        registeredUserRef.current = null;
      }
    };

    cleanup();
  }, [user, token]);

  useEffect(() => {
    // 1. Listen for push token rotation / refresh
    const tokenSub = Notifications.addPushTokenListener(async (tokenData) => {
      if (!user?._id || !token || !tokenData?.data) return;
      try {
        fcmTokenRef.current = tokenData.data;
        await fetch(`${API_V1_BASE_URL}/rider/push-tokens`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            token: tokenData.data,
            platform: "android",
          }),
        });
      } catch (e) {
        console.warn("Failed to update push token on rotation:", e);
      }
    });

    // 2. Notification received (foreground or background wake)
    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("🔥 RECEIVED RAW:", notification);

        const content = notification.request.content;

        // ✅ HANDLE BOTH TYPES
        const title = content.title || content.data?.title || "Notification";

        const message = content.body || content.data?.message || "";

        const data = content.data || {};

        // 🔥 Refresh active trip and tasks in real time when notification arrives
        if (user?._id && refreshActiveTrip) {
          refreshActiveTrip(user._id, user.email);
        }

        // 🔥 FORCE UI UPDATE
        notify({
          title,
          message,
          data,
          duration: 3000,
        });

        playNotificationSound().catch(() => { });
      },
    );

    // 3. User clicked/tapped notification (from system tray or toast)
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (user?._id && refreshActiveTrip) {
          refreshActiveTrip(user._id, user.email);
        }
        const data = response.notification.request.content.data;
        handleNavigationFromData(data);
      },
    );

    return () => {
      tokenSub.remove();
      receivedSub.remove();
      responseSub.remove();
    };
  }, [user?._id, user?.email, token, refreshActiveTrip]);

  useEffect(() => {
    if (!user?._id) return;
    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchLatest = async () => {
      try {
        const res = await fetch(
          `https://api.shiptos.com/api/v1/notifications/${user._id}`,
        );

        const data = await res.json();

        if (data?.data?.length) {
          const latest = data.data[0];

          // check if already exists
          setNotifications((prev) => {
            const exists = prev.find((n) => n._id === latest._id);
            if (exists) return prev;

            // 🔥 ADD NEW NOTIFICATION
            return [latest, ...prev];
          });
        }
      } catch (err) {
        console.log("Polling error:", err);
      }
    };

    const timer = setTimeout(() => {
      fetchLatest();
      interval = setInterval(fetchLatest, 30000);
    }, 10000);

    return () => {
      clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [user?._id]);

  return (
    <NotificationContext.Provider
      value={{ notify, hide, notifications, addNotification }}
    >
      {children}

      <InAppToast
        visible={visible}
        title={title}
        message={message}
        duration={duration}
        onClose={hide}
      />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error("useNotification must be used inside NotificationProvider");
  return ctx;
};
