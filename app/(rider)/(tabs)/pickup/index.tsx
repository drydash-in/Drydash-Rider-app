import { useRiderData } from "@/context/RiderDataContext";
import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../../context/ThemeContext";
import { getPickupSlotAndDelayInfo } from "@/utils/slotDelayHelper";

/* ---------- TYPES ---------- */
type Pickup = {
  _id: string;
  Name: string;
  Address: string;
  slot?: string;
  pickupDelay?: any;
};

const API_URL = "https://api.shiptos.com/api/v1/rider";

/* ================= SCREEN ================= */

export default function Pickup() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();

  const { completedOrderId } = useLocalSearchParams<{
    completedOrderId?: string;
  }>();

  const [loading, setLoading] = useState(false);
  // const [pickups, setPickups] = useState<Pickup[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const { pickups, setPickups } = useRiderData();

  /* ---------- FETCH PICKUPS ---------- */
  const getPickups = async () => {
    if (!user?.email) return;

    setRefreshing(true); // ✅ not loading
    try {
      const res = await fetch(
        `${API_URL}/getriderpickups?email=${encodeURIComponent(user.email)}`,
        { headers: { "Content-Type": "application/json" } },
      );

      const data = await res.json();

      if (data && Array.isArray(data.Pickups)) {
        setPickups([
          ...data.Pickups.map((el: any) => {
            return {
              ...el,
              _id: el?._id,
              Name: el?.Name,
              Address: el.Address,
            };
          }),
        ]);
      } else {
        setPickups([]);
      }
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (completedOrderId) {
        setPickups((prev: any) =>
          prev.filter((p: any) => p?._id !== completedOrderId),
        );
        router.setParams({ completedOrderId: undefined });
      }

      if (user?.email) {
        getPickups();
      }
    }, [user?.email, completedOrderId]),
  );

  // console.log("this is userrrr",user)
  // useEffect(() => {
  //   const riderId = user?._id;

  //   console.log("🟡 [SOCKET] useEffect triggered");
  //   console.log("🟡 [SOCKET] riderId =>", riderId);

  //   if (!riderId) {
  //     console.log("🔴 [SOCKET] riderId missing, returning...");
  //     return;
  //   }

  //   console.log("🟡 [SOCKET] connecting socket...");

  //   // connect socket
  //   socket.connect();

  //   // connection logs
  //   socket.on("connect", () => {
  //     console.log("✅ [SOCKET] connected successfully");
  //     console.log("✅ [SOCKET] socket.id =>", socket.id);

  //     // join room
  //     console.log("🟢 [SOCKET] emitting joinRider with riderId:", riderId);
  //     socket.emit("joinRider", { riderId });
  //   });

  //   socket.on("connect_error", (err) => {
  //     console.log("❌ [SOCKET] connect_error =>", err?.message || err);
  //   });

  //   socket.on("disconnect", (reason) => {
  //     console.log("⚠️ [SOCKET] disconnected =>", reason);
  //   });

  //   // listen realtime assignment
  //   socket.on("riderAssignedPickup", ({ pickup }) => {
  //     console.log("🔥 [SOCKET] riderAssignedPickup received");
  //     console.log("🔥 [SOCKET] pickup =>", pickup);

  //     setPickups((prev) => {
  //       const exists = prev.some((p) => p._id === pickup._id);
  //       if (exists) {
  //         console.log("🟠 [SOCKET] pickup already exists in list:", pickup._id);
  //         return prev;
  //       }

  //       console.log("🟢 [SOCKET] adding new pickup to list:", pickup._id);
  //       return [pickup, ...prev];
  //     });
  //   });

  //   return () => {
  //     console.log("🧹 [SOCKET] cleanup running (removing listeners)");

  //     socket.off("connect");
  //     socket.off("connect_error");
  //     socket.off("disconnect");
  //     socket.off("riderAssignedPickup");
  //   };
  // }, [user?._id]);

  // /* ---------- SOCKET: HANDLE APP FOREGROUND ---------- */
  // useEffect(() => {
  //   console.log("🟡 [APPSTATE] listener added");

  //   const subscription = AppState.addEventListener("change", (state) => {
  //     console.log("🟣 [APPSTATE] state changed =>", state);

  //     if (state === "active") {
  //       const riderId = user?._id;
  //       console.log("🟣 [APPSTATE] app active, riderId =>", riderId);

  //       if (!riderId) {
  //         console.log("🔴 [APPSTATE] riderId missing, skipping socket reconnect");
  //         return;
  //       }

  //       console.log("🟣 [APPSTATE] socket.connected =>", socket.connected);

  //       if (!socket.connected) {
  //         console.log("🟡 [APPSTATE] reconnecting socket...");
  //         socket.connect();

  //         console.log("🟢 [APPSTATE] emitting joinRider again:", riderId);
  //         socket.emit("joinRider", { riderId });
  //       }
  //     }
  //   });

  //   return () => {
  //     console.log("🧹 [APPSTATE] listener removed");
  //     subscription.remove();
  //   };
  // }, [user?._id]);

  /* ---------- LOADING ---------- */
  if (loading) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: 16 }}
      >
        <SkeletonHeader />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    );
  }

  /* ================= EMPTY STATE ================= */
  if (!loading && pickups.length === 0) {
    return (
      <View style={[styles.emptyWrap, { backgroundColor: theme.background }]}>
        <Ionicons
          name="cube-outline"
          size={48}
          color={theme.subText}
          style={{ marginBottom: 12 }}
        />

        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          No pickups for now
        </Text>

        <Text style={[styles.emptySub, { color: theme.subText }]}>
          You’re all caught up. New pickups will appear here when assigned.
        </Text>
      </View>
    );
  }

  const isDone = (p: any) => {
    if (!p) return false;
    if (p.completed === true) return true;
    const st = (p.status || p.PickupStatus || "").toString().toLowerCase().trim();
    return (
      st === "complete" ||
      st === "completed" ||
      st === "delivered" ||
      st === "picked_up" ||
      st === "picked-up" ||
      st === "picked up" ||
      st === "done"
    );
  };

  const activePickups = pickups.filter((p: any) => !isDone(p));
  const completedPickups = pickups.filter((p: any) => isDone(p));

  /* ---------- UI ---------- */
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingTop: 16, paddingBottom: 140 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            getPickups();
          }}
          tintColor={theme.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Assigned Pickups
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{activePickups.length}</Text>
        </View>
      </View>

      {activePickups.length === 0 && (
        <View style={styles.emptyWrap}>
          <Ionicons name="cube-outline" size={48} color={theme.subText} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No pending pickups
          </Text>
          <Text style={[styles.emptySub, { color: theme.subText }]}>
            You're all caught up with pending pickups.
          </Text>
        </View>
      )}

      {activePickups.map((item: any) => {
        const slotInfo = getPickupSlotAndDelayInfo(item);
        return (
          <View key={item._id}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: slotInfo.isDelayed ? "#EF4444" : theme.border },
              ]}
              onPress={() =>
                router.push(`/(rider)/order/pickup/navigation/${item._id}`)
              }
            >
              <View style={styles.iconWrap}>
                <Ionicons name="location" size={20} color={theme.primary} />
              </View>

              <View style={styles.cardBody}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={[styles.orderId, { color: theme.primary }]}>
                    {item._id
                      ? `WZP-${item._id.slice(-5)}`.toUpperCase()
                      : "WZP-----"}
                  </Text>
                  {slotInfo.isDelayed && (
                    <View style={{ backgroundColor: "#FEE2E2", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="alert-circle" size={12} color="#DC2626" />
                      <Text style={{ fontSize: 10, fontWeight: "800", color: "#DC2626" }}>
                        {slotInfo.delayText || "DELAYED"}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.name, { color: theme.subText }]}>
                  {item.Name || "Customer"}
                </Text>

                <View style={styles.addressRow}>
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color={theme.subText}
                  />
                  <Text
                    style={[styles.address, { color: theme.subText }]}
                    numberOfLines={2}
                  >
                    {item.Address || "Address not available"}
                  </Text>
                </View>

                {slotInfo.slotText && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, backgroundColor: slotInfo.isDelayed ? (isDark ? "#3B0707" : "#FEF2F2") : (isDark ? "#1E293B" : "#F8FAFC"), paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                    <Ionicons name="time-outline" size={13} color={slotInfo.isDelayed ? "#EF4444" : theme.primary} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: slotInfo.isDelayed ? "#EF4444" : theme.text }}>
                      Slot: {slotInfo.slotText}
                    </Text>
                    {slotInfo.reason && (
                      <Text style={{ fontSize: 10, color: theme.subText }} numberOfLines={1}>
                        ({slotInfo.reason})
                      </Text>
                    )}
                  </View>
                )}
              </View>

              <View
                style={[styles.actionBtn, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="chevron-forward" size={18} color="#000" />
              </View>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* COMPLETED PICKUPS SECTION AT BOTTOM */}
      {completedPickups.length > 0 && (
        <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
          <View style={[styles.sectionHeader, { paddingHorizontal: 0, marginBottom: 12 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="checkmark-circle-outline" size={20} color={theme.success} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Completed Pickups ({completedPickups.length})
              </Text>
            </View>
          </View>

          {completedPickups.map((item: any) => {
            const slotInfo = getPickupSlotAndDelayInfo(item);
            return (
              <TouchableOpacity
                key={`comp_${item._id}`}
                activeOpacity={0.8}
                style={[
                  styles.card,
                  {
                    marginHorizontal: 0,
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
                onPress={() =>
                  router.push(`/(rider)/order/pickup/[orderId]?orderId=${item._id}`)
                }
              >
                <View style={[styles.iconWrap, { backgroundColor: "#DCFCE7" }]}>
                  <Ionicons name="checkmark-circle" size={22} color={theme.success} />
                </View>

                <View style={styles.cardBody}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={[styles.orderId, { color: theme.text }]}>
                      {item._id
                        ? `WZP-${item._id.slice(-5)}`.toUpperCase()
                        : "WZP-----"}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: "900", color: theme.success }}>
                      COMPLETED
                    </Text>
                  </View>

                  <Text style={[styles.name, { color: theme.subText }]}>
                    {item.Name || "Customer"}
                  </Text>

                  <View style={styles.addressRow}>
                    <Ionicons
                      name="location-outline"
                      size={14}
                      color={theme.subText}
                    />
                    <Text
                      style={[styles.address, { color: theme.subText }]}
                      numberOfLines={1}
                    >
                      {item.Address || "Address not available"}
                    </Text>
                  </View>

                  {slotInfo.slotText && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <Ionicons name="time-outline" size={13} color={theme.subText} />
                      <Text style={{ fontSize: 11, fontWeight: "600", color: theme.subText }}>
                        Slot: {slotInfo.slotText}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={{ justifyContent: "center", paddingLeft: 8 }}>
                  <Ionicons name="chevron-forward" size={18} color={theme.muted} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

/* ---------- SKELETON ---------- */

function SkeletonHeader() {
  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonSub} />
    </View>
  );
}

function SkeletonCard() {
  return <View style={styles.skeletonCard} />;
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  pageHeader: { paddingHorizontal: 16, marginBottom: 14 },
  pageTitle: { fontSize: 22, fontWeight: "900" },
  pageSub: { fontSize: 13, marginTop: 4 },

  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },

  badge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
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
    backgroundColor: "#ECFEFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  cardBody: { flex: 1 },
  orderId: { fontWeight: "800", fontSize: 14, marginBottom: 4 },
  name: { fontSize: 14, fontWeight: "700", marginBottom: 6 },

  addressRow: { flexDirection: "row", gap: 6 },
  address: { fontSize: 12, lineHeight: 16, flex: 1 },

  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  skeletonTitle: {
    width: 160,
    height: 22,
    borderRadius: 8,
    backgroundColor: "#CBD5E1",
    opacity: 0.3,
    marginBottom: 8,
  },
  skeletonSub: {
    width: 220,
    height: 14,
    borderRadius: 6,
    backgroundColor: "#CBD5E1",
    opacity: 0.25,
  },
  skeletonCard: {
    height: 86,
    borderRadius: 16,
    backgroundColor: "#CBD5E1",
    opacity: 0.3,
    marginHorizontal: 16,
    marginBottom: 12,
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
    marginBottom: 6,
  },

  emptySub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
