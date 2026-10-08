// app/(rider)/(tabs)/tasks/index.tsx
import { useAuth } from "@/context/useAuth";
import { useRiderData } from "@/context/RiderDataContext";
import { VRPStop } from "@/services/api/vrpTripService";
import { openMapsNavigation } from "@/utils/navigationHelper";
import { setMiniWindowSuppressed } from "@/services/OverlayManager";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../../context/ThemeContext";
import {
  getPickupSlotAndDelayInfo,
  getDeliverySlotAndDelayInfo,
} from "@/utils/slotDelayHelper";

export default function TasksScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { activeTrip, refreshActiveTrip } = useRiderData();

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showAllRemaining, setShowAllRemaining] = useState<boolean>(false);

  const fetchTrip = useCallback(async () => {
    if (user?._id) {
      await refreshActiveTrip(user._id, user.email);
    }
  }, [user?._id, user?.email, refreshActiveTrip]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTrip();
    setRefreshing(false);
  };

  const isDone = (s: VRPStop) => {
    if (!s) return false;
    if (s.completed === true) return true;
    const st = (s.status || (s as any).PickupStatus || "").toString().toLowerCase().trim();
    if (s.type === "pickup") {
      return (
        st === "complete" ||
        st === "completed" ||
        st === "picked_up" ||
        st === "picked-up" ||
        st === "picked up" ||
        st === "done"
      );
    }
    if (s.type === "delivery") {
      return (
        st === "delivered" ||
        st === "complete" ||
        st === "completed" ||
        st === "done"
      );
    }
    return (
      st === "delivered" ||
      st === "complete" ||
      st === "completed" ||
      st === "picked_up" ||
      st === "picked-up" ||
      st === "done"
    );
  };

  const stops = activeTrip?.stops || [];
  const taskStops = stops.filter((s) => s.type !== "depot");
  const currentTask = taskStops.find((s) => !isDone(s));
  const remainingStops = taskStops.filter((s) => s !== currentTask && !isDone(s));
  const completedStops = taskStops.filter((s) => isDone(s));

  console.log("Trip Task Breakdown -> Total:", taskStops.length, "Current:", currentTask?.name, "Remaining:", remainingStops.length, "Completed:", completedStops.length);

  const handleStartTask = (stop: VRPStop) => {
    if (stop.type === "depot") return;
    setMiniWindowSuppressed(true);
    setTimeout(() => {
      setMiniWindowSuppressed(false);
    }, 2500);

    const targetId = stop.id || (stop as any)._id || "";
    if (stop.type === "pickup") {
      router.push({
        pathname: "/(rider)/order/pickup/[orderId]",
        params: { orderId: targetId },
      });
    } else {
      router.push({
        pathname: "/(rider)/order/delivered/[orderId]",
        params: { orderId: targetId },
      });
    }
  };

  const handleCall = (phone?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Linking.openURL("tel:100");
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
        />
      }
    >
      {/* ROUTE STATS CARD FROM FIGMA */}
      {activeTrip && (
        <View
          style={[
            styles.statsCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {activeTrip.stopCount}
            </Text>
            <Text style={[styles.statLabel, { color: theme.subText }]}>Total Stops</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {activeTrip.distanceKm} km
            </Text>
            <Text style={[styles.statLabel, { color: theme.subText }]}>Distance</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {activeTrip.durationHours} hrs
            </Text>
            <Text style={[styles.statLabel, { color: theme.subText }]}>Est. Time</Text>
          </View>
        </View>
      )}

      {/* SECTION: CURRENT TASK */}
      {currentTask && (() => {
        const isPickup = currentTask.type === "pickup";
        const slotInfo = isPickup
          ? getPickupSlotAndDelayInfo(currentTask)
          : getDeliverySlotAndDelayInfo(currentTask);
        return (
          <View style={styles.section}>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>Current Task</Text>

            <View
              style={[
                styles.currentTaskCard,
                {
                  backgroundColor: theme.card,
                  borderColor: slotInfo.isDelayed ? "#EF4444" : theme.border,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <View style={[styles.seqBadge, { backgroundColor: theme.primary }]}>
                    <Text style={styles.seqText}>#{currentTask.index}</Text>
                  </View>
                  <View style={[styles.typeBadge, { backgroundColor: theme.primarySoft }]}>
                    <Text style={[styles.typeBadgeText, { color: theme.primary }]}>
                      {currentTask.type.toUpperCase()}
                    </Text>
                  </View>
                  {slotInfo.isDelayed && (
                    <View style={{ backgroundColor: "#FEE2E2", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="alert-circle" size={12} color="#DC2626" />
                      <Text style={{ fontSize: 10, fontWeight: "800", color: "#DC2626" }}>
                        {slotInfo.delayText || "DELAYED"}
                      </Text>
                    </View>
                  )}
                </View>

                {currentTask.price > 0 && (
                  <Text style={[styles.priceTag, { color: theme.primary }]}>
                    {currentTask.type === "pickup" ? "Estimated :" : "Collect :"} ₹{currentTask.price.toLocaleString("en-IN")}
                  </Text>
                )}
              </View>

              <Text style={[styles.customerName, { color: theme.text }]}>{currentTask.name}</Text>

              {/* SLOT AND DELAY BADGE */}
              {slotInfo.slotText && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, backgroundColor: slotInfo.isDelayed ? (isDark ? "#3B0707" : "#FEF2F2") : (isDark ? "#1E293B" : "#F8FAFC"), paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                  <Ionicons name="time-outline" size={15} color={slotInfo.isDelayed ? "#EF4444" : theme.primary} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: slotInfo.isDelayed ? "#EF4444" : theme.text }}>
                    {isPickup ? "Pickup Slot:" : "Delivery Slot:"} {slotInfo.slotText}
                  </Text>
                  {slotInfo.reason && (
                    <Text style={{ fontSize: 11, color: theme.subText }} numberOfLines={1}>
                      ({slotInfo.reason})
                    </Text>
                  )}
                </View>
              )}
              
              {/* ENHANCED ADDRESS DISPLAY */}
              <View style={[styles.addressBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Ionicons name="location" size={16} color={theme.primary} style={{ marginTop: 2 }} />
                <Text style={[styles.addressText, { color: theme.text }]} numberOfLines={2}>
                  {currentTask.address || `Stop #${currentTask.index} Location Address`}
                </Text>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.callBtn, { borderColor: theme.border }]}
                  onPress={() => handleCall(currentTask.contact)}
                >
                  <Ionicons name="call-outline" size={18} color={theme.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.callBtn, { borderColor: theme.border, backgroundColor: theme.primarySoft }]}
                  onPress={() => openMapsNavigation(currentTask.lat, currentTask.lng, currentTask.address, currentTask.name)}
                >
                  <Ionicons name="navigate-outline" size={18} color={theme.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.startBtn, { backgroundColor: theme.primary }]}
                  onPress={() => handleStartTask(currentTask)}
                >
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  <Text style={styles.startBtnText}>Start Workflow</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })()}

      {/* SECTION: REMAINING TASKS TIMELINE */}
      {remainingStops.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Remaining Route Tasks</Text>

          <View style={styles.timelineList}>
            {(showAllRemaining ? remainingStops : remainingStops.slice(0, 2)).map((stop, idx) => {
              const stopDone = isDone(stop);
              const isPickup = stop.type === "pickup";
              const slotInfo = isPickup
                ? getPickupSlotAndDelayInfo(stop)
                : getDeliverySlotAndDelayInfo(stop);

              return (
                <TouchableOpacity
                  key={`${stop.id}_${idx}`}
                  style={[
                    styles.timelineCard,
                    {
                      backgroundColor: stopDone ? (isDark ? "#1E293B" : "#F1F5F9") : theme.card,
                      borderColor: slotInfo.isDelayed && !stopDone ? "#EF4444" : (stopDone ? "#CBD5E1" : theme.border),
                      opacity: stopDone ? 0.65 : 1,
                    },
                  ]}
                  onPress={() => handleStartTask(stop)}
                  disabled={stopDone}
                  activeOpacity={stopDone ? 1 : 0.7}
                >
                  <View style={styles.timelineHeader}>
                    <View style={styles.badgeRow}>
                      <View
                        style={[
                          styles.seqBadge,
                          { backgroundColor: stopDone ? "#94A3B8" : "#64748B" },
                        ]}
                      >
                        <Text style={styles.seqText}>#{stop.index}</Text>
                      </View>
                      <View
                        style={[
                          styles.typeBadge,
                          { backgroundColor: stopDone ? "#E2E8F0" : (isDark ? "#334155" : "#F1F5F9") },
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeBadgeText,
                            { color: stopDone ? "#64748B" : theme.text },
                          ]}
                        >
                          {stop.type.toUpperCase()}
                        </Text>
                      </View>
                      {slotInfo.isDelayed && !stopDone && (
                        <View style={{ backgroundColor: "#FEE2E2", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 3 }}>
                          <Ionicons name="alert-circle" size={11} color="#DC2626" />
                          <Text style={{ fontSize: 9, fontWeight: "800", color: "#DC2626" }}>
                            {slotInfo.delayText || "DELAYED"}
                          </Text>
                        </View>
                      )}
                    </View>
                    {stopDone ? (
                      <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                    ) : stop.price > 0 ? (
                      <Text style={[styles.priceTag, { color: theme.text }]}>
                        {stop.type === "pickup" ? "Estimated :" : "Collect :"} ₹{stop.price.toLocaleString("en-IN")}
                      </Text>
                    ) : null}
                  </View>

                  <Text style={[styles.customerName, { color: stopDone ? theme.subText : theme.text }]}>
                    {stop.name}
                  </Text>

                  {slotInfo.slotText && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <Ionicons name="time-outline" size={12} color={slotInfo.isDelayed && !stopDone ? "#EF4444" : theme.subText} />
                      <Text style={{ fontSize: 11, fontWeight: "600", color: slotInfo.isDelayed && !stopDone ? "#EF4444" : theme.subText }}>
                        Slot: {slotInfo.slotText}
                      </Text>
                    </View>
                  )}
                  
                  {/* ENHANCED ADDRESS DISPLAY */}
                  <View style={[styles.addressBoxSmall, { backgroundColor: theme.background }]}>
                    <Ionicons name="location-outline" size={14} color={theme.subText} />
                    <Text style={[styles.addressTextSmall, { color: theme.subText, flex: 1 }]} numberOfLines={1}>
                      {stop.address || `Stop #${stop.index} Address`}
                    </Text>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        openMapsNavigation(stop.lat, stop.lng, stop.address, stop.name);
                      }}
                      style={{ paddingHorizontal: 4 }}
                    >
                      <Ionicons name="navigate-circle" size={20} color={theme.primary} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {remainingStops.length > 2 && (
            <TouchableOpacity
              style={[styles.viewAllBtn, { borderColor: theme.border }]}
              onPress={() => setShowAllRemaining(!showAllRemaining)}
            >
              <Text style={[styles.viewAllText, { color: theme.subText }]}>
                {showAllRemaining
                  ? "Show fewer tasks"
                  : `View all remaining tasks (${remainingStops.length})`}
              </Text>
              <Ionicons
                name={showAllRemaining ? "chevron-up" : "chevron-down"}
                size={16}
                color={theme.subText}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ALL TASKS COMPLETED BANNER */}
      {!currentTask && remainingStops.length === 0 && completedStops.length > 0 && (
        <View
          style={[
            styles.allCompletedBanner,
            {
              backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
              borderColor: isDark ? "#065F46" : "#A7F3D0",
            },
          ]}
        >
          <Ionicons name="checkmark-done-circle" size={32} color="#10B981" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.allCompletedTitle, { color: isDark ? "#34D399" : "#065F46" }]}>
              All Route Tasks Completed 🎉
            </Text>
            <Text style={[styles.allCompletedSub, { color: isDark ? "#A7F3D0" : "#047857" }]}>
              You've finished all {completedStops.length} pickup & delivery tasks in this trip route.
            </Text>
          </View>
        </View>
      )}

      {/* COMPLETED SECTION AT BOTTOM OF PAGE */}
      {completedStops.length > 0 && (
        <View style={[styles.section, { marginTop: 8, marginBottom: 40 }]}>
          <View style={styles.completedHeaderRow}>
            <Ionicons name="checkmark-circle-outline" size={20} color={theme.success} />
            <Text style={[styles.sectionHeading, { color: theme.text, marginBottom: 0 }]}>
              Completed Tasks ({completedStops.length})
            </Text>
          </View>

          {completedStops.map((stop, idx) => {
            const isPickup = stop.type === "pickup";
            const slotInfo = isPickup
              ? getPickupSlotAndDelayInfo(stop)
              : getDeliverySlotAndDelayInfo(stop);

            return (
              <TouchableOpacity
                key={`comp_${stop.id}_${idx}`}
                style={[
                  styles.completedCard,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
                onPress={() => handleStartTask(stop)}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-circle" size={22} color={theme.success} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={[styles.completedText, { color: theme.text }]}>
                      #{stop.index} — {stop.name}
                    </Text>
                    <View style={[styles.typeBadge, { backgroundColor: theme.primarySoft }]}>
                      <Text style={[styles.typeBadgeText, { color: theme.primary }]}>
                        {stop.type.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  {slotInfo.slotText && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="time-outline" size={12} color={theme.subText} />
                      <Text style={{ fontSize: 11, color: theme.subText }}>
                        Slot: {slotInfo.slotText}
                      </Text>
                    </View>
                  )}
                  {stop.address && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="location-outline" size={12} color={theme.subText} />
                      <Text style={{ fontSize: 12, color: theme.subText }} numberOfLines={1}>
                        {stop.address}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <View style={styles.completedStatusBadge}>
                    <Text style={styles.completedStatusBadgeText}>COMPLETED</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.muted} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* EMPTY TASKS STATE */}
      {!currentTask && remainingStops.length === 0 && completedStops.length === 0 && (
        <View
          style={[
            styles.emptyStateCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={[styles.emptyIconBg, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name="clipboard-outline" size={38} color={theme.primary} />
          </View>
          <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
            No Tasks Assigned Right Now
          </Text>
          <Text style={[styles.emptyStateSubtitle, { color: theme.subText }]}>
            You currently have no active or completed pickup/delivery tasks. Pull down to refresh or check back later.
          </Text>
          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: theme.primary }]}
            onPress={onRefresh}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
            <Text style={styles.refreshBtnText}>Refresh Tasks</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },

  statItem: {
    alignItems: "center",
  },

  statValue: {
    fontSize: 18,
    fontWeight: "900",
  },

  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },

  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#EBE2E2",
  },

  section: {
    marginBottom: 24,
  },

  sectionHeading: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 12,
  },

  currentTaskCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  seqBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  seqText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  typeBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },

  priceTag: {
    fontSize: 14,
    fontWeight: "900",
  },

  customerName: {
    fontSize: 17,
    fontWeight: "800",
  },

  addressBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },

  addressText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },

  addressBoxSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 2,
  },

  addressTextSmall: {
    fontSize: 12,
    flex: 1,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },

  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  startBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  startBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  timelineList: {
    gap: 10,
  },

  timelineCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },

  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },

  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
  },

  completedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },

  completedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },

  completedText: {
    fontSize: 14,
    fontWeight: "700",
  },

  completedStatusBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },

  completedStatusBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#15803D",
    letterSpacing: 0.3,
  },

  allCompletedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },

  allCompletedTitle: {
    fontSize: 15,
    fontWeight: "900",
  },

  allCompletedSub: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },

  emptyStateCard: {
    padding: 32,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 40,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },

  emptyIconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },

  emptyStateSubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 12,
  },

  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },

  refreshBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
