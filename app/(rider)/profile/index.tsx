import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";

export default function RiderProfile() {
  const { theme, isDark } = useTheme();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
            router.replace("/(auth)/rider-login");
          } catch (error) {
            console.log("Logout error:", error);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* PROFILE HEADER CARD */}
      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
      >
        <View
          style={[
            styles.avatarLarge,
            {
              backgroundColor: theme.primary,
            },
          ]}
        >
          <Text style={styles.avatarText}>
            {(user?.name || "R")?.slice(0, 1).toUpperCase()}
          </Text>
        </View>

        <Text style={[styles.name, { color: theme.text }]}>{user?.name || "Rider User"}</Text>
        <Text style={[styles.phone, { color: theme.subText }]}>{user?.phone || "+91 9876543210"}</Text>

        <View style={[styles.plantBadge, { backgroundColor: theme.primarySoft }]}>
          <Ionicons name="location-outline" size={14} color={theme.primary} />
          <Text style={[styles.plantText, { color: theme.primary }]}>
            Assigned Plant: {user?.plantName || "Delhi Central"}
          </Text>
        </View>
      </View>

      {/* RIDER PERFORMANCE STATS */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.statValue, { color: theme.text }]}>1,247</Text>
          <Text style={[styles.statLabel, { color: theme.subText }]}>Total Orders</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.statValue, { color: theme.text }]}>98.5%</Text>
          <Text style={[styles.statLabel, { color: theme.subText }]}>On-Time Delivery</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.statValue, { color: theme.text }]}>4.9 ★</Text>
          <Text style={[styles.statLabel, { color: theme.subText }]}>Rider Rating</Text>
        </View>
      </View>

      {/* QUICK ACTIONS MENU */}
      <View style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => router.push("/(rider)/wallet")}
        >
          <View style={styles.menuLeft}>
            <View style={[styles.iconBg, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="wallet-outline" size={20} color={theme.primary} />
            </View>
            <Text style={[styles.menuLabel, { color: theme.text }]}>Wallet & Payouts</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.subText} />
        </TouchableOpacity>

        <View style={styles.menuDivider} />

        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => router.navigate("/(rider)/notifications")}
        >
          <View style={styles.menuLeft}>
            <View style={[styles.iconBg, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="notifications-outline" size={20} color={theme.primary} />
            </View>
            <Text style={[styles.menuLabel, { color: theme.text }]}>Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.subText} />
        </TouchableOpacity>

        <View style={styles.menuDivider} />

        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => router.push("/(rider)/settings/index" as any)}
        >
          <View style={styles.menuLeft}>
            <View style={[styles.iconBg, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="settings-outline" size={20} color={theme.primary} />
            </View>
            <Text style={[styles.menuLabel, { color: theme.text }]}>App Settings</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.subText} />
        </TouchableOpacity>
      </View>

      {/* LOGOUT BUTTON */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
        <Text style={styles.logoutText}>Log Out Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 16,
  },

  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  avatarText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  name: {
    fontSize: 20,
    fontWeight: "900",
  },

  phone: {
    fontSize: 14,
    marginTop: 2,
  },

  plantBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },

  plantText: {
    fontSize: 12,
    fontWeight: "700",
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
  },

  statValue: {
    fontSize: 16,
    fontWeight: "900",
  },

  statLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
  },

  menuCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
  },

  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },

  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  menuLabel: {
    fontSize: 15,
    fontWeight: "700",
  },

  menuDivider: {
    height: 1,
    backgroundColor: "#EBE2E2",
    marginHorizontal: 16,
  },

  logoutBtn: {
    backgroundColor: "#EB3B2F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
  },

  logoutText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
