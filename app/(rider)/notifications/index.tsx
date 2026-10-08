import { RiderHeader } from "@/components/layout/RiderHeader";
import { useNotification } from "@/context/NotificationContext";
import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import { API_V1_BASE_URL } from "@/constants/apiConfig";

const API_URL = API_V1_BASE_URL;

export default function Notifications() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { notifications: liveNotifications } = useNotification();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  /* ================= FETCH ================= */

  const fetchNotifications = async () => {
    if (!user?._id) return;

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/notifications/${user._id}`);
      const data = await res.json();

      // Merge API + live notifications
      // const merged = [...(data.data || []), ...liveNotifications];
      const merged = [...(data.data || [])];

      const unique = merged.filter(
        (item, index, self) =>
          index === self.findIndex((t) => t._id === item._id),
      );

      setNotifications(unique);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.log("Notification fetch error", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [user?._id, liveNotifications]),
  );

  /* ================= MARK READ ================= */

  const markAsRead = async (id: string) => {
    try {
      await fetch(`${API_URL}/notifications/read/${id}`, {
        method: "PATCH",
      });

      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
      );
    } catch (err) {
      console.log("Mark read error", err);
    }
  };

  /* ================= OPEN ================= */

  const openNotification = (notification: any) => {
    markAsRead(notification._id);

    const data = notification.data;

    if (data?.pickupId) {
      router.push(`/(rider)/order/pickup/${data.pickupId}`);
      return;
    }

    if (data?.orderId) {
      router.push(`/(rider)/order/delivered/${data.orderId}`);
      return;
    }
  };

  /* ================= UI ================= */

  return (
    <>
      <RiderHeader />

      {/* EMPTY STATE */}
      {!loading && notifications.length === 0 ? (
        <View style={[styles.emptyWrap, { backgroundColor: theme.background }]}>
          <Ionicons
            name="notifications-outline"
            size={50}
            color={theme.subText}
          />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No notifications yet
          </Text>
          <Text style={[styles.emptySub, { color: theme.subText }]}>
            New pickup or delivery alerts will appear here
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.background }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchNotifications();
              }}
              tintColor={theme.primary}
            />
          }
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingTop: 10,
              backgroundColor: theme.background,
            }}
          >
            {/* Back Button */}
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>

            {/* Title */}
            <Text
              style={{
                fontSize: 18,
                fontWeight: "900",
                marginLeft: 12,
                color: theme.text,
              }}
            >
              Notifications
            </Text>
          </View>

          {notifications.map((n) => {
            const isPickup = n.type === "pickup_assigned";

            return (
              <TouchableOpacity
                key={n._id}
                activeOpacity={0.9}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    opacity: n.isRead ? 0.6 : 1,
                  },
                ]}
                onPress={() => openNotification(n)}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={isPickup ? "cube" : "bicycle"}
                    size={20}
                    color={theme.primary}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.titleText, { color: theme.text }]}>
                    {n.title}
                  </Text>

                  <Text style={[styles.message, { color: theme.subText }]}>
                    {n.message}
                  </Text>

                  <Text style={[styles.time, { color: theme.subText }]}>
                    {new Date(n.createdAt).toLocaleString()}
                  </Text>
                </View>

                {!n.isRead && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  title: {
    fontSize: 20,
    fontWeight: "900",
  },

  badge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginLeft: 10,
  },

  badgeText: {
    fontWeight: "800",
    color: "#16A34A",
    fontSize: 12,
  },

  card: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
  },

  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFEFF",
    marginRight: 12,
  },

  titleText: {
    fontWeight: "800",
    fontSize: 14,
    marginBottom: 4,
  },

  message: {
    fontSize: 13,
    marginBottom: 4,
  },

  time: {
    fontSize: 11,
  },

  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: "#16A34A",
    alignSelf: "center",
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 10,
  },

  emptySub: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
});
