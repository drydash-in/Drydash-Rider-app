import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";

export function RiderHeader() {
  const insets = useSafeAreaInsets();
  const { theme, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const lastNavTimeRef = React.useRef(0);

  const handleOpenNotifications = () => {
    const now = Date.now();
    if (now - lastNavTimeRef.current < 800) return;
    lastNavTimeRef.current = now;
    router.navigate("/(rider)/notifications");
  };

  const handleOpenProfile = () => {
    const now = Date.now();
    if (now - lastNavTimeRef.current < 800) return;
    lastNavTimeRef.current = now;
    router.navigate("/(rider)/profile");
  };

  const logoSource = isDark 
    ? require("../../assets/images/shiptos_red_logo_new.png") 
    : require("../../assets/images/shiptos_red_logo_new.png");

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          backgroundColor: theme.card,
          borderBottomColor: theme.border,
        },
      ]}
    >
      {/* LEFT */}
      <View style={styles.left}>
        <Image source={logoSource} style={styles.logo} />
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: theme.text }]}>Shiptos</Text>
          {user?.plantName ? (
            <View style={[styles.plantBadge, { backgroundColor: theme.primarySoft }]}>
              <Text style={[styles.plantText, { color: theme.primary }]}>{user.plantName}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* RIGHT */}
      <View style={styles.right}>
        <TouchableOpacity 
          style={[styles.iconBtn, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }]}
          onPress={handleOpenNotifications}
        >
          <Ionicons
            name="notifications-outline"
            size={18}
            color={theme.text}
          />
        </TouchableOpacity>

        {/* THEME TOGGLE */}
        <TouchableOpacity
          onPress={toggleTheme}
          style={[
            styles.iconBtn,
            {
              backgroundColor: theme.primarySoft,
            },
          ]}
        >
          <Ionicons
            name={isDark ? "sunny" : "moon"}
            size={18}
            color={theme.primary}
          />
        </TouchableOpacity>

        {/* AVATAR */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleOpenProfile}
          style={[styles.avatar, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.avatarText}>{(user?.name || "R")?.slice(0, 1).toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 100,
  },

  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  logo: {
    width: 28,
    height: 28,
    resizeMode: "contain",
  },

  title: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  plantBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },

  plantText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontWeight: "800",
    fontSize: 14,
    color: "#FFFFFF",
  },
});
