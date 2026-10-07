import { AuthProvider } from "@/context/AuthContext";
import "@/services/backgroundLocationTask";
import "@/services/notifications";
import { setupNotificationChannel } from "@/services/notificationSetup";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

export default function RootLayout() {
  useEffect(() => {
    setupNotificationChannel();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
