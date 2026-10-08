// app/(rider)/(tabs)/dashboard/index.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import moment from "moment";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/useAuth";
import { useLocation } from "@/context/LocationContext";
import { useRiderData } from "@/context/RiderDataContext";
import { VRPStop } from "@/services/api/vrpTripService";
import { openMapsNavigation } from "@/utils/navigationHelper";
import { API_V1_BASE_URL } from "@/constants/apiConfig";
import { setCameraActive, openOverlaySettingsDirectly, setMiniWindowSuppressed } from "@/services/OverlayManager";
import {
  getPickupSlotAndDelayInfo,
  getDeliverySlotAndDelayInfo,
} from "@/utils/slotDelayHelper";

const { height } = Dimensions.get("window");

export default function Dashboard() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { activeTrip, refreshActiveTrip } = useRiderData();

  // Location context tracking state
  const {
    isTracking,
    toggleTracking,
    lastLocation,
    error: locationError,
  } = useLocation();

  // Dashboard UI states
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Tracking Setup Guide Modal state
  const [showTrackingGuide, setShowTrackingGuide] = useState<boolean>(false);
  const [isSavingGuide, setIsSavingGuide] = useState<boolean>(false);

  // Odometer / Trip Modal states
  const [showTripModal, setShowTripModal] = useState<boolean>(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [startKm, setStartKm] = useState<string>("");
  const [endKm, setEndKm] = useState<string>("");
  const [startImage, setStartImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [endImage, setEndImage] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isStartingTrip, setIsStartingTrip] = useState<boolean>(false);
  const [isEndingTrip, setIsEndingTrip] = useState<boolean>(false);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);

  // Realtime clock interval
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch active trip from rider data context
  const fetchTripData = useCallback(async () => {
    if (user?._id) {
      await refreshActiveTrip(user._id, user.email);
    }
  }, [user?._id, user?.email, refreshActiveTrip]);

  useEffect(() => {
    fetchTripData();
  }, [fetchTripData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTripData();
    await restoreOpenTrip();
    setRefreshing(false);
  };

  // Restore open Odometer trip if exists
  const restoreOpenTrip = useCallback(async () => {
    try {
      if (!user?._id) return;

      const res = await fetch(`${API_V1_BASE_URL}/shifts/active/${user._id}`);
      if (!res.ok) return;

      const json = await res.json();
      if (json.hasActiveTrip && json.trip) {
        setTripId(json.trip._id);
        setStartKm(String(json.trip.startKm));
        if (json.trip.startImage) {
          setStartImage({
            uri: json.trip.startImage,
            fileSize: 0,
            width: 0,
            height: 0,
          } as any);
        }
      } else {
        setTripId(null);
        setStartKm("");
        setStartImage(null);
      }
    } catch (err) {
      console.warn("Error restoring open trip:", err);
    }
  }, [user?._id]);

  useEffect(() => {
    restoreOpenTrip();
  }, [restoreOpenTrip]);

  // Check tracking setup guide status
  const trackingGuideKey = user?._id
    ? `tracking_setup_seen_${user._id}`
    : null;

  useEffect(() => {
    let cancelled = false;

    const checkTrackingGuide = async () => {
      if (!trackingGuideKey) return;
      try {
        const seen = await AsyncStorage.getItem(trackingGuideKey);
        if (!cancelled && seen !== "true") {
          setShowTrackingGuide(true);
        }
      } catch (err) {
        console.warn("Failed to read tracking guide flag:", err);
      }
    };

    checkTrackingGuide();
    return () => {
      cancelled = true;
    };
  }, [trackingGuideKey]);

  const dismissTrackingGuide = async () => {
    if (!trackingGuideKey) return;
    try {
      setIsSavingGuide(true);
      await AsyncStorage.setItem(trackingGuideKey, "true");
      setShowTrackingGuide(false);
    } catch (err) {
      console.warn("Failed to persist tracking guide flag:", err);
    } finally {
      setIsSavingGuide(false);
    }
  };

  // Photo Capture & Compression for Odometer with Camera Active flag (prevents PiP fluctuation)
  const compressImage = async (image: ImagePicker.ImagePickerAsset) => {
    try {
      setIsCompressing(true);
      const originalSize = image.fileSize || 0;

      const manipResult = await manipulateAsync(
        image.uri,
        [{ resize: { width: 900 } }],
        {
          compress: 0.5,
          format: SaveFormat.JPEG,
        }
      );

      const compressedSize =
        manipResult.width * (manipResult.height || 600) * 0.5;
      const savedPercentage = originalSize
        ? Math.round(((originalSize - compressedSize) / originalSize) * 100)
        : 0;

      console.log(`Image compressed: ${savedPercentage}% size reduction`);

      return {
        uri: manipResult.uri,
        width: manipResult.width,
        height: manipResult.height,
        fileSize: compressedSize,
      };
    } catch (error) {
      console.error("Image compression error:", error);
      return image;
    } finally {
      setIsCompressing(false);
    }
  };

  const clickPhoto = async (setter: any) => {
    try {
      // Set camera active flag to suppress PiP/Overlay during camera launch
      setCameraActive(true);

      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Camera access is required to capture odometer photos"
        );
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        quality: 0.4,
        cameraType: ImagePicker.CameraType.back,
        allowsEditing: false,
      });

      if (!res.canceled && res.assets?.length) {
        const original = res.assets[0];
        setter(original);
        compressImage(original).then((compressed) => {
          setter(compressed);
        });
      }
    } catch (err) {
      console.warn("Camera launch error:", err);
    } finally {
      // Reset camera active flag after a delay to ensure app state transition settles
      setTimeout(() => {
        setCameraActive(false);
      }, 1500);
    }
  };

  // Odometer Start/End Handlers (automatically triggers Location Tracking)
  const handleStartTrip = async () => {
    if (!startKm || !startImage || !user?._id) {
      Alert.alert(
        "Missing Information",
        "Please enter start KM and capture odometer photo"
      );
      return;
    }

    setIsStartingTrip(true);
    const form = new FormData();
    form.append("riderId", user._id);
    form.append("startKm", startKm);
    form.append("image", {
      uri: startImage.uri,
      name: "start.jpg",
      type: "image/jpeg",
    } as any);

    try {
      const res = await fetch(`${API_V1_BASE_URL}/shifts/start`, {
        method: "POST",
        body: form,
      });

      const json = await res.json();
      if (res.ok) {
        setTripId(json.trip?._id || json._id);
        setShowTripModal(false);

        // Automatically start live location tracking when odometer trip is started
        if (!isTracking) {
          await toggleTracking();
        }

        Alert.alert(
          "Trip Started",
          "Odometer trip started & live location tracking activated!"
        );
      } else {
        Alert.alert("Error", json.message || "Failed to start trip");
      }
    } catch (error) {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsStartingTrip(false);
    }
  };

  const handleEndTrip = async () => {
    if (!endKm || !endImage || !tripId) {
      Alert.alert(
        "Missing Information",
        "Please enter end KM and capture odometer photo"
      );
      return;
    }

    setIsEndingTrip(true);
    const form = new FormData();
    form.append("endKm", endKm);
    form.append("image", {
      uri: endImage.uri,
      name: "end.jpg",
      type: "image/jpeg",
    } as any);

    try {
      const res = await fetch(`${API_V1_BASE_URL}/shifts/${tripId}/end`, {
        method: "PUT",
        body: form,
      });

      const json = await res.json();
      if (res.ok) {
        // Automatically stop live location tracking when odometer trip is ended
        if (isTracking) {
          await toggleTracking();
        }

        Alert.alert(
          "Trip Completed",
          `Distance covered: ${json.trip?.distance || 0} km\n\nLive location tracking stopped. Great work!`
        );
        setTripId(null);
        setStartKm("");
        setEndKm("");
        setStartImage(null);
        setEndImage(null);
        setShowTripModal(false);
      } else {
        Alert.alert("Error", json.message || "Failed to end trip");
      }
    } catch (error) {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsEndingTrip(false);
    }
  };

  const handleStartWorkflow = (stop: VRPStop) => {
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

  const getTimeIndicator = (date: Date) => {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) {
      return { label: "Morning", icon: "sunny-outline", color: "#F59E0B" };
    } else if (hour >= 12 && hour < 17) {
      return { label: "Afternoon", icon: "sunny", color: "#F97316" };
    } else if (hour >= 17 && hour < 20) {
      return { label: "Evening", icon: "partly-sunny-outline", color: "#E11D48" };
    } else {
      return { label: "Night", icon: "moon-outline", color: "#6366F1" };
    }
  };

  const timeInfo = getTimeIndicator(currentTime);

  const isStopCompleted = (s: VRPStop) => {
    if (!s) return false;
    if (s.completed === true) return true;
    const st = (s.status || (s as any).PickupStatus || "").toString().toLowerCase().trim();
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
  const nonDepotStops =
    activeTrip?.stops?.filter((s) => s.type !== "depot") || [];
  const currentTask =
    nonDepotStops.find((s) => !isStopCompleted(s)) || nonDepotStops[0];
  const taskIsDone = currentTask ? isStopCompleted(currentTask) : false;

  // Professional, Compact Location Tracking & Trip Control Card
  const renderLocationStatus = () => (
    <View
      style={[
        styles.trackingCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      {/* Header Row: Title & Small Status Badge */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="speedometer-outline" size={18} color={theme.primary} />
          <Text style={[styles.cardTitleText, { color: theme.text }]}>
            Odometer & Location
          </Text>
        </View>

        {/* Small Status Pill */}
        <View
          style={[
            styles.smallStatusPill,
            {
              backgroundColor: isTracking ? "#10B98118" : (isDark ? "#334155" : "#F1F5F9"),
              borderColor: isTracking ? "#10B98140" : theme.border,
            },
          ]}
        >
          <View
            style={[
              styles.smallStatusDot,
              { backgroundColor: isTracking ? "#10B981" : "#94A3B8" },
            ]}
          />
          <Text
            style={[
              styles.smallStatusText,
              { color: isTracking ? "#059669" : theme.subText },
            ]}
          >
            {isTracking ? "Tracking Active" : "Tracking Off"}
          </Text>
        </View>
      </View>

      {/* Main Odometer Trip Action Box */}
      <View
        style={[
          styles.tripActionBox,
          {
            backgroundColor: tripId
              ? (isDark ? "#1E293B" : "#F8FAFC")
              : (isDark ? "#0F172A" : "#FAFAFA"),
            borderColor: tripId ? "#10B98160" : theme.border,
          },
        ]}
      >
        <View
          style={[
            styles.tripIconCircle,
            { backgroundColor: tripId ? "#10B9811A" : theme.primary + "1A" },
          ]}
        >
          <Ionicons
            name={tripId ? "bicycle" : "navigate-circle"}
            size={24}
            color={tripId ? "#10B981" : theme.primary}
          />
        </View>

        <View style={styles.tripActionInfo}>
          <Text style={[styles.tripActionTitle, { color: theme.text }]}>
            {tripId ? "Active Odometer Trip" : "Start Odometer Trip"}
          </Text>
          <Text style={[styles.tripActionSub, { color: theme.subText }]}>
            {tripId
              ? `Start KM: ${startKm || "Recorded"} • Tap to end`
              : "Record odometer & start live GPS"}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.tripActionButton,
            { backgroundColor: tripId ? "#EF4444" : "#10B981" },
          ]}
          onPress={() => setShowTripModal(true)}
          activeOpacity={0.85}
        >
          <Ionicons
            name={tripId ? "stop-circle-outline" : "play-outline"}
            size={16}
            color="#FFFFFF"
          />
          <Text style={styles.tripActionButtonText}>
            {tripId ? "End Trip" : "Start Trip"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Footer Info Row */}
      <View style={styles.cardFooterRow}>
        <View style={styles.gpsRow}>
          <Ionicons
            name="radio-outline"
            size={13}
            color={isTracking ? "#10B981" : theme.subText}
          />
          <Text style={[styles.lastUpdateText, { color: theme.subText }]}>
            {lastLocation
              ? `GPS: ${moment(lastLocation.timestamp).format("hh:mm:ss A")}`
              : isTracking
              ? "Syncing location..."
              : "GPS ready"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.setupLinkBtn}
          onPress={() => router.push("/(rider)/settings/location" as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={13} color={theme.subText} />
          <Text style={[styles.setupLinkBtnText, { color: theme.subText }]}>
            Setup
          </Text>
        </TouchableOpacity>
      </View>

      {locationError && (
        <Text style={styles.errorText}>⚠️ {locationError}</Text>
      )}
    </View>
  );

  // One-time Tracking Setup Guide Modal
  // const renderTrackingGuide = () => (
  //   <Modal
  //     visible={showTrackingGuide}
  //     transparent
  //     animationType="fade"
  //     onRequestClose={() => setShowTrackingGuide(false)}
  //   >
  //     <View style={styles.guideOverlay}>
  //       <View style={[styles.guideCard, { backgroundColor: theme.card }]}>
  //         <View style={styles.guideHeader}>
  //           <View style={[styles.guideIcon, { backgroundColor: "#10B98118" }]}>
  //             <Ionicons name="shield-checkmark" size={22} color="#10B981" />
  //           </View>
  //           <View style={{ flex: 1 }}>
  //             <Text style={[styles.guideTitle, { color: theme.text }]}>
  //               Keep live tracking running
  //             </Text>
  //             <Text style={[styles.guideSub, { color: theme.subText }]}>
  //               One-time phone setup for Android 13 and Vivo / iQOO devices.
  //             </Text>
  //           </View>
  //         </View>

  //         <View style={styles.guideStepRow}>
  //           <View style={styles.guideBullet} />
  //           <Text style={[styles.guideStepText, { color: theme.subText }]}>
  //             Open Tracking Setup from Profile and allow location "All the time".
  //           </Text>
  //         </View>
  //         <View style={styles.guideStepRow}>
  //           <View style={styles.guideBullet} />
  //           <Text style={[styles.guideStepText, { color: theme.subText }]}>
  //             Set battery for this app to Unrestricted / Don't optimize.
  //           </Text>
  //         </View>
  //         <View style={styles.guideStepRow}>
  //           <View style={styles.guideBullet} />
  //           <Text style={[styles.guideStepText, { color: theme.subText }]}>
  //             On Vivo / iQOO, also allow Auto-start or App launch if it appears.
  //           </Text>
  //         </View>
  //         <View style={styles.guideStepRow}>
  //           <View style={styles.guideBullet} />
  //           <Text style={[styles.guideStepText, { color: theme.subText }]}>
  //             Allow "Display Over Other Apps" permission for floating mini tracking window.
  //           </Text>
  //         </View>

  //         <TouchableOpacity
  //           style={[
  //             styles.guideAction,
  //             { borderColor: theme.primary, backgroundColor: theme.primary + "10", marginBottom: 12 },
  //           ]}
  //           onPress={openOverlaySettingsDirectly}
  //           activeOpacity={0.85}
  //         >
  //           <Ionicons name="layers-outline" size={18} color={theme.primary} />
  //           <Text style={[styles.guideActionText, { color: theme.primary }]}>
  //             Allow Display Over Other Apps
  //           </Text>
  //         </TouchableOpacity>

  //         <View style={styles.guideActions}>
  //           <TouchableOpacity
  //             style={[styles.guideAction, { borderColor: theme.border }]}
  //             onPress={() => {
  //               setShowTrackingGuide(false);
  //               router.push("/(rider)/settings/location" as any);
  //             }}
  //             activeOpacity={0.85}
  //           >
  //             <Ionicons name="settings-outline" size={18} color={theme.text} />
  //             <Text style={[styles.guideActionText, { color: theme.text }]}>
  //               Open Setup
  //             </Text>
  //           </TouchableOpacity>

  //           <TouchableOpacity
  //             style={[styles.guidePrimary, { backgroundColor: "#10B981" }]}
  //             onPress={dismissTrackingGuide}
  //             activeOpacity={0.85}
  //             disabled={isSavingGuide}
  //           >
  //             {isSavingGuide ? (
  //               <ActivityIndicator color="#fff" />
  //             ) : (
  //               <>
  //                 <Ionicons name="checkmark" size={18} color="#fff" />
  //                 <Text style={styles.guidePrimaryText}>Got it</Text>
  //               </>
  //             )}
  //           </TouchableOpacity>
  //         </View>
  //       </View>
  //     </View>
  //   </Modal>
  // );

  // Odometer Start/End Trip Modal
  const renderTripModal = () => (
    <Modal
      visible={showTripModal}
      animationType="slide"
      transparent={true}
      statusBarTranslucent={true}
      onRequestClose={() => setShowTripModal(false)}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          // style={{ flex: 1, width: "100%" }}
          activeOpacity={1}
          onPress={() => setShowTripModal(false)}
        />
        <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {tripId ? "End Odometer Trip" : "Start Odometer Trip"}
              </Text>
              <Text style={[styles.modalSubtitle, { color: theme.subText }]}>
                {tripId
                  ? "Record final odometer reading & stop location tracking"
                  : "Record starting odometer reading & start location tracking"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowTripModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {/* Odometer Input */}
            <View style={styles.inputSection}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Odometer Reading (KM)
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  { borderColor: theme.border, backgroundColor: theme.background },
                ]}
              >
                <Ionicons
                  name="speedometer-outline"
                  size={20}
                  color={theme.primary}
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder={tripId ? "Enter ending KM" : "Enter starting KM"}
                  placeholderTextColor={theme.subText}
                  keyboardType="numeric"
                  value={tripId ? endKm : startKm}
                  onChangeText={tripId ? setEndKm : setStartKm}
                  style={[styles.textInput, { color: theme.text }]}
                />
              </View>
            </View>

            {/* Photo Section */}
            <View style={styles.photoSection}>
              <View style={styles.photoLabelRow}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Odometer Photo
                </Text>
                {isCompressing && (
                  <View style={styles.compressingBadge}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text
                      style={[styles.compressingText, { color: theme.primary }]}
                    >
                      Compressing...
                    </Text>
                  </View>
                )}
              </View>

              {(tripId ? endImage : startImage) ? (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: (tripId ? endImage : startImage)?.uri }}
                    style={styles.imagePreview}
                  />
                  <View style={styles.imageInfoOverlay}>
                    <View style={styles.compressionBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color="#10b981"
                      />
                      <Text style={styles.compressionText}>Compressed</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.retakeButton}
                    onPress={() =>
                      clickPhoto(tripId ? setEndImage : setStartImage)
                    }
                  >
                    <Ionicons name="camera" size={16} color="#fff" />
                    <Text style={styles.retakeText}>Retake Photo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.photoButton,
                    { borderColor: theme.border, backgroundColor: theme.background },
                  ]}
                  onPress={() =>
                    clickPhoto(tripId ? setEndImage : setStartImage)
                  }
                  disabled={isCompressing}
                >
                  <View
                    style={[
                      styles.cameraIconWrapper,
                      { backgroundColor: theme.primary + "20" },
                    ]}
                  >
                    <Ionicons name="camera" size={32} color={theme.primary} />
                  </View>
                  <Text style={[styles.photoButtonText, { color: theme.text }]}>
                    Capture Odometer
                  </Text>
                  <Text
                    style={[
                      styles.photoButtonSubtext,
                      { color: theme.subText },
                    ]}
                  >
                    Take a clear photo of your odometer reading
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: theme.border }]}
                onPress={() => setShowTripModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: tripId ? "#ef4444" : theme.primary },
                ]}
                onPress={tripId ? handleEndTrip : handleStartTrip}
                disabled={isStartingTrip || isEndingTrip || isCompressing}
              >
                {isStartingTrip || isEndingTrip ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.submitButtonText}>Processing...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name={tripId ? "stop-circle" : "play-circle"}
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.submitButtonText}>
                      {tripId ? "End Trip & Stop Tracking" : "Start Trip & Track Location"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

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
      {/* GREETING & REALTIME TIME CARD FROM FIGMA */}
      <View
        style={[
          styles.greetingCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.greetingHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greetingTitle, { color: theme.text }]}>
              Hello, {user?.name || "Rider"}
            </Text>

            {/* REALTIME CLOCK & SUN/MOON INDICATOR */}
            <View style={styles.clockRow}>
              <Ionicons
                name={timeInfo.icon as any}
                size={16}
                color={timeInfo.color}
              />
              <Text style={[styles.clockText, { color: theme.text }]}>
                {moment(currentTime).format("hh:mm:ss A")}
              </Text>
              <View
                style={[
                  styles.timeTag,
                  { backgroundColor: `${timeInfo.color}15` },
                ]}
              >
                <Text style={[styles.timeTagText, { color: timeInfo.color }]}>
                  {timeInfo.label}
                </Text>
              </View>
            </View>

            <Text style={[styles.greetingSubtitle, { color: theme.subText }]}>
              Ready to manage active delivery tasks
            </Text>
          </View>
        </View>
      </View>

      {/* CONTINUOUS LOCATION TRACKING & TRIP MANAGEMENT CARD */}
      {renderLocationStatus()}

      {/* ROUTE SUMMARY STATS CARD */}
      {activeTrip ? (
        <View
          style={[
            styles.statsCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.statsHeader}>
            <Text style={[styles.statsTitle, { color: theme.text }]}>
              Assigned Route #{activeTrip.routeIndex || 1}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: theme.primarySoft },
              ]}
            >
              <Text
                style={[styles.statusBadgeText, { color: theme.primary }]}
              >
                {activeTrip.status.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {activeTrip.distanceKm} km
              </Text>
              <Text style={[styles.statLabel, { color: theme.subText }]}>
                Total Distance
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {activeTrip.durationHours} hrs
              </Text>
              <Text style={[styles.statLabel, { color: theme.subText }]}>
                Est. Duration
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {activeTrip.stopCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.subText }]}>
                Total Stops
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Ionicons name="bicycle-outline" size={40} color={theme.muted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No Active Trip Assigned
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.subText }]}>
            Pull down to refresh or wait for dispatcher assignment.
          </Text>
        </View>
      )}

      {/* CURRENT ACTIVE TASK CARD WITH ADDRESS */}
      {currentTask && (() => {
        const isPickup = currentTask.type === "pickup";
        const slotInfo = isPickup
          ? getPickupSlotAndDelayInfo(currentTask)
          : getDeliverySlotAndDelayInfo(currentTask);

        return (
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Current Active Task
            </Text>

            <View
              style={[
                styles.taskCard,
                {
                  backgroundColor: taskIsDone
                    ? isDark
                      ? "#1E293B"
                      : "#F1F5F9"
                    : theme.card,
                  borderColor: slotInfo.isDelayed && !taskIsDone ? "#EF4444" : (taskIsDone ? "#CBD5E1" : theme.border),
                  opacity: taskIsDone ? 0.65 : 1,
                },
              ]}
            >
              <View style={styles.taskCardHeader}>
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.sequenceBadge,
                      { backgroundColor: taskIsDone ? "#64748B" : theme.primary },
                    ]}
                  >
                    <Text style={styles.sequenceText}>
                      #{currentTask.index || 1}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor: taskIsDone
                          ? "#E2E8F0"
                          : theme.primarySoft,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        { color: taskIsDone ? "#64748B" : theme.primary },
                      ]}
                    >
                      {currentTask.type.toUpperCase()}
                    </Text>
                  </View>

                  {slotInfo.isDelayed && !taskIsDone && (
                    <View style={{ backgroundColor: "#FEE2E2", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="alert-circle" size={12} color="#DC2626" />
                      <Text style={{ fontSize: 10, fontWeight: "800", color: "#DC2626" }}>
                        {slotInfo.delayText || "DELAYED"}
                      </Text>
                    </View>
                  )}
                </View>

                {taskIsDone ? (
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={theme.success}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: theme.success,
                      }}
                    >
                      COMPLETED
                    </Text>
                  </View>
                ) : currentTask.price > 0 ? (
                  <Text style={[styles.taskPrice, { color: theme.primary }]}>
                    {currentTask.type === "pickup" ? "Estimated :" : "Collect :"} ₹
                    {currentTask.price.toLocaleString("en-IN")}
                  </Text>
                ) : null}
              </View>

              <Text
                style={[
                  styles.taskName,
                  { color: taskIsDone ? theme.subText : theme.text },
                ]}
              >
                {currentTask.name}
              </Text>

              {slotInfo.slotText && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, backgroundColor: slotInfo.isDelayed && !taskIsDone ? (isDark ? "#3B0707" : "#FEF2F2") : (isDark ? "#1E293B" : "#F8FAFC"), paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                  <Ionicons name="time-outline" size={15} color={slotInfo.isDelayed && !taskIsDone ? "#EF4444" : theme.primary} />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: slotInfo.isDelayed && !taskIsDone ? "#EF4444" : theme.text }}>
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
            <View
              style={[
                styles.addressBox,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons
                name="location"
                size={16}
                color={taskIsDone ? "#94A3B8" : theme.primary}
                style={{ marginTop: 2 }}
              />
              <Text
                style={[
                  styles.addressText,
                  { color: taskIsDone ? theme.subText : theme.text },
                ]}
                numberOfLines={2}
              >
                {currentTask.address ||
                  `Stop #${currentTask.index} Location Address`}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                style={[
                  styles.workflowBtn,
                  {
                    flex: 1,
                    backgroundColor: theme.primarySoft,
                    borderWidth: 1,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() =>
                  openMapsNavigation(
                    currentTask.lat,
                    currentTask.lng,
                    currentTask.address,
                    currentTask.name
                  )
                }
                activeOpacity={0.8}
              >
                <Ionicons
                  name="navigate-circle"
                  size={18}
                  color={theme.primary}
                />
                <Text
                  style={[styles.workflowBtnText, { color: theme.primary }]}
                >
                  Navigate
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.workflowBtn,
                  {
                    flex: 1.5,
                    backgroundColor: taskIsDone ? "#64748B" : theme.primary,
                  },
                ]}
                onPress={() => handleStartWorkflow(currentTask)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={taskIsDone ? "eye-outline" : "arrow-forward"}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.workflowBtnText}>
                  {taskIsDone ? "View Details" : "Start Workflow"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    })()}

      {/* MODALS */}
      {/* {renderTrackingGuide()} */}
      {renderTripModal()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  greetingCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },

  greetingHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  greetingTitle: {
    fontSize: 20,
    fontWeight: "900",
  },

  clockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 4,
  },

  clockText: {
    fontSize: 13,
    fontWeight: "800",
  },

  timeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },

  timeTagText: {
    fontSize: 10,
    fontWeight: "800",
  },

  greetingSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },

  // Professional, Compact Location Tracking & Trip Card
  trackingCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  cardTitleText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  smallStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },

  smallStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  smallStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  tripActionBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },

  tripIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  tripActionInfo: {
    flex: 1,
  },

  tripActionTitle: {
    fontSize: 14,
    fontWeight: "800",
  },

  tripActionSub: {
    fontSize: 11,
    marginTop: 2,
  },

  tripActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },

  tripActionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
  },

  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  lastUpdateText: {
    fontSize: 11,
    fontWeight: "600",
  },

  setupLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },

  setupLinkBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },

  errorText: {
    fontSize: 11,
    color: "#ef4444",
    fontWeight: "600",
  },

  // Stats Card
  statsCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },

  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  statsTitle: {
    fontSize: 16,
    fontWeight: "800",
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },

  statsGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
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

  emptyCard: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 12,
  },

  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },

  sectionContainer: {
    marginBottom: 32,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },

  taskCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
  },

  taskCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  sequenceBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  sequenceText: {
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

  taskPrice: {
    fontSize: 14,
    fontWeight: "900",
  },

  taskName: {
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

  workflowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 6,
  },

  workflowBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  // Guide Modal
  guideOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 16,
  },

  guideCard: {
    borderRadius: 18,
    padding: 18,
  },

  guideHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 14,
  },

  guideIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  guideTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },

  guideSub: {
    fontSize: 13,
    lineHeight: 18,
  },

  guideStepRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 10,
  },

  guideBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: "#10B981",
  },

  guideStepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },

  guideActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  guideAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  guideActionText: {
    fontSize: 13,
    fontWeight: "800",
  },

  guidePrimary: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  guidePrimaryText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },

  // Modal / General
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },

  modalContent: {
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 16,
    maxHeight: height * 0.88,
    minHeight: 650,
    elevation: 10,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
  },

  modalSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },

  closeButton: {
    padding: 4,
  },

  inputSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 56,
  },

  inputIcon: {
    marginRight: 10,
  },

  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },

  photoSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  photoLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  compressingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },

  compressingText: {
    fontSize: 11,
    fontWeight: "700",
  },

  photoButton: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  cameraIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  photoButtonText: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },

  photoButtonSubtext: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 8,
  },

  imagePreviewContainer: {
    position: "relative",
  },

  imagePreview: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    resizeMode: "cover",
  },

  imageInfoOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
  },

  compressionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },

  compressionText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  retakeButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },

  retakeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  actionButtons: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 12,
  },

  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },

  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
