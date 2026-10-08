import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { API_AUTH_URL } from "@/constants/apiConfig";

const API_URL = API_AUTH_URL;

export default function RiderLogin() {
  const { theme } = useTheme();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Smooth Entry Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGetOtp = async () => {
    if (phone.length !== 10) {
      Alert.alert(
        "Invalid Mobile Number",
        "Please enter a valid 10-digit mobile number."
      );
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/loginthroughotp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
        body: JSON.stringify({
          phone: phone.trim(),
          phoneNumber: phone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to send OTP");
      }
      router.push({
        pathname: "/(auth)/rider-otp",
        params: { phone },
      });
    } catch (error: any) {
      Alert.alert(
        "Unable to Send OTP",
        error.message || "Please try again after some time."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.background} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* BRAND LOGO BADGE */}
            <View style={[styles.logoBadge, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="bicycle" size={32} color={theme.primary} />
            </View>

            <Text style={[styles.title, { color: theme.text }]}>Welcome to Shiptos</Text>
            <Text style={[styles.subtitle, { color: theme.subText }]}>
              Enter your registered phone number to log in as a Rider
            </Text>

            {/* INPUT BOX WITH FLAG BADGE */}
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.background,
                  borderColor: isFocused ? theme.primary : theme.border,
                },
              ]}
            >
              <View style={styles.countryCode}>
                <Text style={styles.flagIcon}>🇮🇳</Text>
                <Text style={[styles.countryCodeText, { color: theme.text }]}>+91</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="10-digit Mobile Number"
                placeholderTextColor={theme.muted}
                keyboardType="number-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
            </View>

            {/* CTA BUTTON */}
            <TouchableOpacity
              style={[
                styles.btn,
                { backgroundColor: theme.primary },
                loading && styles.btnDisabled,
              ]}
              onPress={handleGetOtp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.btnText}>Get OTP</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },

  card: {
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },

  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 20,
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    height: 56,
    width: "100%",
    marginBottom: 20,
  },

  countryCode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
  },

  flagIcon: {
    fontSize: 18,
  },

  countryCodeText: {
    fontWeight: "800",
    fontSize: 15,
  },

  divider: {
    width: 1,
    height: 24,
  },

  input: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "700",
  },

  btn: {
    height: 52,
    borderRadius: 16,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  btnDisabled: {
    opacity: 0.7,
  },

  btnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});