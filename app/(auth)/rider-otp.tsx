import { useAuth } from "@/context/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
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

export default function RiderOTP() {
  const { theme } = useTheme();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const { login } = useAuth();

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [message, setMessage] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  // Entry Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    if (message) {
      Animated.sequence([
        Animated.spring(successAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.delay(2500),
        Animated.timing(successAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setMessage(""));
    }
  }, [message]);

  // Resend OTP handler
  const handleGetOtp = async () => {
    try {
      setResendLoading(true);
      setMessage("");

      const res = await fetch(`${API_URL}/loginthroughotp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
        body: JSON.stringify({
          phone: phone?.trim(),
          phoneNumber: phone?.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to resend OTP");
      }

      setTimer(30);
      setOtp("");
      setMessage("OTP sent successfully ✓");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to resend OTP");
    } finally {
      setResendLoading(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (timer === 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Verify OTP handler
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert("Invalid OTP", "Please enter a valid 6-digit OTP");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/verifyOtp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
        body: JSON.stringify({
          phone: phone?.trim(),
          phoneNumber: phone?.trim(),
          otp: otp.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "OTP verification failed");
      }

      await login(
        {
          _id: data.data.user._id,
          name: data.data.user.name,
          email: data.data.user.email,
          phone: data.data.user.phone,
          role: data.data.user.role,
          plantName: data.data.user.plantName,
        },
        data.tokens.accessToken
      );

      router.replace("/(rider)/(tabs)/dashboard");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Invalid OTP code");
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
          {/* BACK BUTTON */}
          <TouchableOpacity
            style={[
              styles.backBtn,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>

          {/* PAGE TITLE */}
          <Animated.View
            style={[
              styles.headerSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={[styles.pageTitle, { color: theme.text }]}>Verify OTP</Text>
            <Text style={[styles.pageSubtitle, { color: theme.subText }]}>
              Enter the 6-digit code sent to your mobile number
            </Text>
          </Animated.View>

          {/* PHONE DISPLAY CARD */}
          <Animated.View
            style={[
              styles.phoneSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View
              style={[
                styles.phoneCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.phoneInfo}>
                <Text style={[styles.phoneLabel, { color: theme.subText }]}>
                  MOBILE NUMBER
                </Text>
                <View style={styles.phoneRow}>
                  <Text style={styles.flagEmoji}>🇮🇳</Text>
                  <Text style={[styles.phoneNumber, { color: theme.primary }]}>
                    +91 {phone}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.editBtn, { backgroundColor: theme.primarySoft }]}
                onPress={() => router.back()}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* SUCCESS NOTICE */}
          {message && (
            <Animated.View
              style={[
                styles.successCard,
                {
                  backgroundColor: theme.primarySoft,
                  borderColor: theme.primary,
                  opacity: successAnim,
                  transform: [
                    { scale: successAnim },
                    {
                      translateY: successAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-10, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
              <Text style={[styles.successText, { color: theme.primary }]}>
                {message}
              </Text>
            </Animated.View>
          )}

          {/* OTP INPUT CARD */}
          <Animated.View
            style={[
              styles.otpCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.otpHeader}>
              <Text style={[styles.otpLabel, { color: theme.subText }]}>
                ENTER 6-DIGIT CODE
              </Text>
            </View>

            <TextInput
              placeholder="000000"
              placeholderTextColor={theme.muted}
              style={[
                styles.otpInput,
                {
                  backgroundColor: theme.background,
                  borderColor: isFocused ? theme.primary : theme.border,
                  color: theme.text,
                },
              ]}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              autoFocus
            />

            {/* OTP DOTS */}
            <View style={styles.otpDots}>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      borderColor: otp.length > index ? theme.primary : theme.border,
                      backgroundColor:
                        otp.length > index ? theme.primary : theme.background,
                    },
                  ]}
                />
              ))}
            </View>

            {/* VERIFY BUTTON */}
            <TouchableOpacity
              style={[
                styles.verifyBtn,
                { backgroundColor: theme.primary },
                loading && styles.verifyBtnDisabled,
              ]}
              onPress={handleVerifyOtp}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.verifyBtnText}>Verify & Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* RESEND SECTION */}
          <Animated.View
            style={[
              styles.resendSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={[styles.resendQuestion, { color: theme.subText }]}>
              Didn't receive the code?
            </Text>
            <TouchableOpacity
              onPress={handleGetOtp}
              disabled={timer > 0 || resendLoading}
              style={styles.resendBtn}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.resendText,
                  { color: timer > 0 || resendLoading ? theme.muted : theme.primary },
                ]}
              >
                {resendLoading
                  ? "Sending OTP..."
                  : timer > 0
                  ? `Resend in ${timer}s`
                  : "Resend OTP"}
              </Text>
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
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },

  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  headerSection: {
    marginBottom: 24,
  },

  pageTitle: {
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 6,
  },

  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },

  phoneSection: {
    marginBottom: 20,
  },

  phoneCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },

  phoneInfo: {
    flex: 1,
  },

  phoneLabel: {
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 4,
    letterSpacing: 0.5,
  },

  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  flagEmoji: {
    fontSize: 18,
  },

  phoneNumber: {
    fontSize: 17,
    fontWeight: "800",
  },

  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  successCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },

  successText: {
    fontWeight: "700",
    fontSize: 14,
  },

  otpCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    marginBottom: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },

  otpHeader: {
    marginBottom: 12,
  },

  otpLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  otpInput: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 10,
    marginBottom: 18,
  },

  otpDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },

  verifyBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  verifyBtnDisabled: {
    opacity: 0.7,
  },

  verifyBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  resendSection: {
    alignItems: "center",
    marginBottom: 20,
  },

  resendQuestion: {
    fontSize: 13,
    marginBottom: 6,
  },

  resendBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  resendText: {
    fontSize: 15,
    fontWeight: "800",
  },
});