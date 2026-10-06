"use client";

import UniversalLoader from "@/components/Loader/UniversalLoader";
import ConfirmModal from "@/components/Modals/ConfirmModal";
import { useAuth } from "@/context/useAuth";
import { openMapsNavigation } from "@/utils/navigationHelper";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Audio } from "expo-av";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { SaveFormat } from "expo-image-manipulator";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import moment from "moment";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../../context/ThemeContext";

const API_URL = "https://api.shiptos.com/api/v1";
const PAGE_LIMIT = 100;

const SERVICE_OPTIONS = [
  { slug: "laundry", label: "Laundry", icon: "shirt-outline" },
  { slug: "shoespa", label: "Shoe Spa", icon: "footsteps-outline" },
  { slug: "dryclean", label: "Dry Clean", icon: "sparkles-outline" },
  { slug: "leather", label: "Leather Items", icon: "briefcase-outline" },
] as const;

type ServiceSlug = (typeof SERVICE_OPTIONS)[number]["slug"];

type PickupData = {
  Name?: string;
  Address?: string;
  Contact?: string;
  plantName?: string;
  status?: string;
  completed?: boolean;
  pickupLocation?: {
    latitude?: number;
    longitude?: number;
  };
  deliveryLocation?: {
    latitude?: number;
    longitude?: number;
  };
  items?: {
    label: string;
    quantity: number;
    price: number;
    itemId?: {
      _id?: string;
      images?: { url?: string }[];
    };
  }[];
};

type CatalogItem = {
  _id: string;
  label: string;
  price: number;
  unit?: string;
  type?: string;
  images?: { url?: string }[];
  sku?: string;
};

type ServiceState = {
  items: CatalogItem[];
  page: number;
  hasNextPage: boolean;
  loading: boolean;
};

type CapturedItem = {
  scopeKey: string;
  itemId: string;
  label: string;
  price: number;
  unit?: string;
  type?: string;
  sku?: string;
  photos: string[];
};

const EMPTY_SERVICE_STATE: ServiceState = {
  items: [],
  page: 0,
  hasNextPage: true,
  loading: false,
};

const formatCurrency = (amount: number) => `₹${Math.round(amount)}`;

const formatDuration = (seconds: number | null) => {
  if (!seconds || seconds <= 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

type Props = {
  orderId: string;
  initialType?: string;
};

import { useRiderData } from "@/context/RiderDataContext";

export default function PickupWorkflowScreen({
  orderId: propOrderId,
  initialType = "laundry",
}: Partial<Props>) {
  const routeParams = useLocalSearchParams<{ orderId?: string }>();
  const orderId = propOrderId || routeParams?.orderId || "";
  const { theme, isDark } = useTheme();
  const { activeTrip, checkIsTripStartedToday } = useRiderData();
  const insets = useSafeAreaInsets();

  const matchedStop = activeTrip?.stops?.find(
    (s) => String(s.id) === String(orderId) || String((s as any)._id) === String(orderId)
  );

  const [pickup, setPickup] = useState<PickupData | null>(null);
  const [pickupLoading, setPickupLoading] = useState(true);

  const isPickupCompleted =
    matchedStop?.status === "complete" ||
    matchedStop?.status === "completed" ||
    (matchedStop as any)?.PickupStatus === "complete" ||
    (matchedStop as any)?.PickupStatus === "completed" ||
    matchedStop?.completed === true ||
    pickup?.status === "complete" ||
    pickup?.status === "completed" ||
    (pickup as any)?.PickupStatus === "complete" ||
    (pickup as any)?.PickupStatus === "completed" ||
    pickup?.completed === true;
  const [servicesBySlug, setServicesBySlug] = useState<
    Record<string, ServiceState>
  >({});
  const [selectedService, setSelectedService] = useState<ServiceSlug>(
    SERVICE_OPTIONS.some((service) => service.slug === initialType)
      ? (initialType as ServiceSlug)
      : "laundry",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<
    string | null
  >(null);
  const [selectedCatalogItemOverride, setSelectedCatalogItemOverride] =
    useState<CatalogItem | null>(null);
  const [draftPhotos, setDraftPhotos] = useState<string[]>([]);
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [customerItemsCollapsed, setCustomerItemsCollapsed] = useState(false);

  const [locationCoords, setLocationCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationChecked, setLocationChecked] = useState(false);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [pendingRescheduleDate, setPendingRescheduleDate] = useState<Date | null>(null);
  const [rescheduleConfirmModalVisible, setRescheduleConfirmModalVisible] = useState(false);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scopeCounter, setScopeCounter] = useState(0);

  const { user } = useAuth();
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [cancelRecording, setCancelRecording] =
    useState<Audio.Recording | null>(null);
  const [cancelRecordedUri, setCancelRecordedUri] = useState<string | null>(
    null,
  );
  const [cancelIsRecording, setCancelIsRecording] = useState(false);
  const cancelSoundRef = useRef<Audio.Sound | null>(null);
  const [cancelIsPlaying, setCancelIsPlaying] = useState(false);
  const [isRemovingCancelAudio, setIsRemovingCancelAudio] = useState(false);

  const currentService = servicesBySlug[selectedService] ?? EMPTY_SERVICE_STATE;

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return currentService.items.filter((item) => {
      if (!query) return false;
      return (
        item.label.toLowerCase().includes(query) ||
        item.type?.toLowerCase().includes(query) ||
        item.sku?.toLowerCase().includes(query)
      );
    });
  }, [currentService.items, searchQuery]);

  const selectedCatalogItem = useMemo(
    () =>
      selectedCatalogItemOverride ||
      currentService.items.find((item) => item._id === selectedCatalogItemId) ||
      null,
    [currentService.items, selectedCatalogItemId, selectedCatalogItemOverride],
  );

  const handleSelectCustomerItem = (item: any) => {
    const targetId = typeof item.itemId === "object" ? item.itemId?._id : item.itemId;
    const foundCatalogItem =
      currentService.items.find(
        (ci) =>
          (targetId && ci._id === targetId) ||
          ci.label?.toLowerCase().trim() === item.label?.toLowerCase().trim()
      ) || null;

    const catalogItem: CatalogItem = foundCatalogItem || {
      _id: targetId || `cust_${Date.now()}`,
      label: item.label || "Customer Item",
      price: item.price || item.itemId?.price || 0,
      unit: item.unit || "pc",
      type: item.type || selectedService,
      sku: item.sku || item.itemId?.sku || "",
    };

    setSelectedCatalogItemOverride(catalogItem);
    setSelectedCatalogItemId(catalogItem._id);
    setDraftPhotos([]);
    setCameraModalVisible(true);
  };

  const totalAmount = capturedItems.reduce((sum, item) => sum + item.price, 0);
  const totalItems = capturedItems.length;

  const fetchPickupById = useCallback(async () => {
    if (!orderId) {
      setPickupLoading(false);
      return;
    }

    setPickupLoading(true);
    try {
      const res = await fetch(`${API_URL}/pickupbyId/${orderId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
      });


      const json = await res.json().catch(() => null);
      console.log("this is the dataa------>>>>>>>>>>",json)
      if (!res.ok) {
        throw new Error(
          json?.message || `Failed to load pickup (${res.status})`,
        );
      }

      const pickupData = json?.data ?? null;

      console.log('this is the pickupData==>',pickupData)
      setPickup(pickupData);

      if (
        pickupData?.deliveryLocation?.latitude != null &&
        pickupData?.deliveryLocation?.longitude != null
      ) {
        setLocationCoords({
          latitude: pickupData.deliveryLocation.latitude,
          longitude: pickupData.deliveryLocation.longitude,
        });
      }
    } catch (error: any) {
      console.warn("Pickup load error:", error?.message || "Failed to load pickup");
      setPickup(null);
    } finally {
      setPickupLoading(false);
    }
  }, [orderId]);

  const customerItems =
    Array.isArray((pickup as any)?.items) && (pickup as any).items.length > 0;

  const fetchSelectedService = useCallback(
    async (slug: ServiceSlug, page = 1) => {
      const current = servicesBySlug[slug] ?? EMPTY_SERVICE_STATE;
      if (current.loading) return;

      setServicesBySlug((prev) => ({
        ...prev,
        [slug]: {
          ...current,
          loading: true,
        },
      }));

      try {
        const res = await fetch(
          `${API_URL}/catalog/${slug}?isActive=true&page=${page}&limit=${PAGE_LIMIT}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "x-client-type": "mobile",
            },
          },
        );

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            json?.message || `Failed to load ${slug} items (${res.status})`,
          );
        }

        const incoming = Array.isArray(json?.data?.items)
          ? json.data.items
          : [];
        const pagination = json?.pagination ?? {};

        setServicesBySlug((prev) => ({
          ...prev,
          [slug]: {
            items: page === 1 ? incoming : [...current.items, ...incoming],
            page,
            hasNextPage:
              typeof pagination.hasNextPage === "boolean"
                ? pagination.hasNextPage
                : incoming.length >= PAGE_LIMIT,
            loading: false,
          },
        }));
      } catch (error) {
        console.error(`Failed to fetch ${slug} catalog`, error);
        setServicesBySlug((prev) => ({
          ...prev,
          [slug]: {
            ...current,
            loading: false,
          },
        }));
      }
    },
    [servicesBySlug],
  );

  useEffect(() => {
    fetchPickupById();
  }, [fetchPickupById]);

  useEffect(() => {
    const current = servicesBySlug[selectedService];
    if (!current || current.page === 0) {
      fetchSelectedService(selectedService, 1);
    }
  }, [fetchSelectedService, selectedService, servicesBySlug]);

  useEffect(() => {
    const preloadLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!locationChecked) {
            Alert.alert(
              "Location needed",
              "Please enable location so pickup completion can use your current position.",
            );
          }
          return;
        }

        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown?.coords) {
          setLocationCoords({
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          });
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (current?.coords) {
          setLocationCoords({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          });
        }
      } catch (error) {
        console.log("Location preload failed", error);
        if (!locationChecked) {
          Alert.alert(
            "Location unavailable",
            "We could not fetch location in the background. Please enable it and try again.",
          );
        }
      } finally {
        setLocationChecked(true);
      }
    };

    preloadLocation();
  }, [locationChecked]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => { });
      }
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => { });
      }
      if (cancelSoundRef.current) {
        cancelSoundRef.current.unloadAsync().catch(() => { });
        cancelSoundRef.current = null;
      }
      if (cancelRecording) {
        cancelRecording.stopAndUnloadAsync().catch(() => { });
      }
    };
  }, [recording, sound, cancelRecording]);

  const loadMoreItems = () => {
    if (currentService.loading || !currentService.hasNextPage) return;
    fetchSelectedService(selectedService, currentService.page + 1);
  };

  const handleCall = () => {
    if (!pickup?.Contact) return;
    Linking.openURL(`tel:${pickup.Contact}`);
  };

  const handleWhatsApp = () => {
    if (!pickup?.Contact) return;
    const message = encodeURIComponent(
      "Hello, I am your pickup rider. I have arrived for your laundry pickup.",
    );
    Linking.openURL(`https://wa.me/${pickup.Contact}?text=${message}`);
  };

  const openReschedulePicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode: "date",
        minimumDate: new Date(),
        onChange: (_event, date) => {
          if (date) {
            setSelectedDate(date);
            setPendingRescheduleDate(date);
            setRescheduleConfirmModalVisible(true);
          }
        },
      });
      return;
    }

    setShowDatePicker(true);
  };

  const reschedulePickup = async (date: Date) => {
    setRescheduleSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/rider/reschedulePickup/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-client-type": "mobile",
        },
        body: JSON.stringify({
          newDate: moment(date).format("YYYY-MM-DD"),
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.message || `Failed to reschedule pickup (${res.status})`,
        );
      }

      Alert.alert(
        "Success",
        json?.message || "Pickup rescheduled successfully",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (error: any) {
      Alert.alert("Error2", error?.message || "Failed to reschedule pickup");
    } finally {
      setRescheduleSubmitting(false);
      setShowDatePicker(false);
    }
  };

  const handleCancelPress = () => {
    setCancelModalVisible(true);
  };

  async function startCancelRecording() {
    try {
      if (cancelRecordedUri) {
        await removeCancelRecording();
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission required", "Microphone permission is needed.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        undefined,
        300,
      );
      setCancelRecording(rec);
      setCancelIsRecording(true);
    } catch (error) {
      console.error("Recording start error:", error);
      Alert.alert("Recording failed", "Could not start recording.");
    }
  }

  async function stopCancelRecording() {
    if (!cancelRecording) return;
    setCancelIsRecording(false);
    try {
      await cancelRecording.stopAndUnloadAsync();
      const uri = cancelRecording.getURI();
      if (uri) setCancelRecordedUri(uri);
    } catch (error) {
      console.error("Stop recording error:", error);
      Alert.alert("Error3", "Failed to stop recording");
    } finally {
      setCancelRecording(null);
    }
  }

  const toggleCancelPlayPause = async () => {
    if (!cancelRecordedUri) return;
    try {
      if (cancelSoundRef.current) {
        const status = await cancelSoundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await cancelSoundRef.current.pauseAsync();
            setCancelIsPlaying(false);
            return;
          } else {
            await cancelSoundRef.current.playAsync();
            setCancelIsPlaying(true);
            return;
          }
        } else {
          await cancelSoundRef.current.unloadAsync().catch(() => { });
          cancelSoundRef.current = null;
        }
      }
      const { sound } = await Audio.Sound.createAsync({
        uri: cancelRecordedUri,
      });
      cancelSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status) return;
        if (status.isLoaded) {
          setCancelIsPlaying(status.isPlaying ?? false);
          if (status.didJustFinish) {
            setCancelIsPlaying(false);
            sound.unloadAsync().catch(() => { });
            cancelSoundRef.current = null;
          }
        } else {
          setCancelIsPlaying(false);
        }
      });
      await sound.playAsync();
      setCancelIsPlaying(true);
    } catch (error) {
      console.error("Playback error:", error);
      Alert.alert("Playback error", "Unable to play/pause recording.");
      setCancelIsPlaying(false);
    }
  };

  const removeCancelRecording = async () => {
    if (!cancelRecordedUri) return;
    setIsRemovingCancelAudio(true);
    try {
      if (cancelSoundRef.current) {
        try {
          const status = await cancelSoundRef.current.getStatusAsync();
          if (status.isLoaded) {
            await cancelSoundRef.current.stopAsync().catch(() => { });
          }
        } catch (error) {
          console.warn("Sound cleanup error:", error);
        }
        await cancelSoundRef.current.unloadAsync().catch(() => { });
        cancelSoundRef.current = null;
      }
    } catch (error) {
      console.error("Error in removeCancelRecording:", error);
    } finally {
      setCancelRecordedUri(null);
      setCancelIsPlaying(false);
      setIsRemovingCancelAudio(false);
    }
  };

  const cancelPickup = async (note: string, voiceUri: string | null) => {
    if (!orderId) {
      Alert.alert("Error4", "Missing order id");
      return;
    }
    if (!user?.name || !user?.role) {
      Alert.alert("Error5", "User information missing. Please log in again.");
      return;
    }

    setCancelSubmitting(true);
    try {
      const formData = new FormData();
      if (note.trim()) {
        formData.append("note", note.trim());
      }
      if (voiceUri) {
        const filename = voiceUri.split("/").pop() || "recording.m4a";
        const mimeType = filename.endsWith(".mp3")
          ? "audio/mpeg"
          : "audio/mp4";
        formData.append("voice", {
          uri: voiceUri,
          type: mimeType,
          name: filename,
        } as any);
      }
      formData.append("userName", user.name);
      formData.append("userRole", user.role);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${API_URL}/deletePickup/${orderId}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "x-client-type": "mobile",
        },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json?.message || `Failed to cancel pickup (${res.status})`,
        );
      }

      Alert.alert("Success", json?.message || "Pickup cancelled");

      // Reset modal state
      setCancelModalVisible(false);
      setCancelNote("");
      setCancelRecordedUri(null);
      setCancelIsRecording(false);
      if (cancelRecording) {
        try {
          await cancelRecording.stopAndUnloadAsync();
        } catch { }
        setCancelRecording(null);
      }
      if (cancelSoundRef.current) {
        try {
          await cancelSoundRef.current.unloadAsync();
        } catch { }
        cancelSoundRef.current = null;
      }
      setCancelIsPlaying(false);

      router.back();
    } catch (err: any) {
      if (err.name === "AbortError") {
        Alert.alert(
          "Error",
          "Request timed out. Please check your connection.",
        );
      } else {
        Alert.alert("Error6", err?.message || "Failed to cancel pickup");
      }
    } finally {
      setCancelSubmitting(false);
    }
  };

  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert("Permission required", "Camera permission is required.");
        return;
      }
    }
    setCameraModalVisible(true);
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      setIsCompressingPhoto(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 540 } }],
        {
          compress: 0.6,
          format: SaveFormat.JPEG,
        },
      );

      setDraftPhotos((prev) => [...prev, manipulated.uri]);
    } catch (error) {
      console.error("Photo capture failed", error);
      Alert.alert("Error7", "Failed to capture image");
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  const removeDraftPhoto = (uri: string) => {
    setDraftPhotos((prev) => prev.filter((photo) => photo !== uri));
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: nextRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      if (sound) {
        await sound.unloadAsync().catch(() => { });
        setSound(null);
        setIsPlaying(false);
      }

      setRecording(nextRecording);
      setAudioUri(null);
      setAudioDuration(null);
    } catch (error) {
      Alert.alert("Error", "Could not start recording");
      console.error(error);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) return;

      setAudioUri(uri);
      const { sound: tempSound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false },
      );
      const durationMillis =
        typeof (status as any)?.durationMillis === "number"
          ? (status as any).durationMillis
          : 0;
      setAudioDuration(Math.round(durationMillis / 1000));
      await tempSound.unloadAsync();
    } catch (error) {
      Alert.alert("Error", "Could not finish recording");
      console.error(error);
    }
  };

  const playAudio = async () => {
    if (!audioUri) return;
    try {
      if (!sound) {
        const { sound: nextSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
        );
        setSound(nextSound);
        setIsPlaying(true);

        nextSound.setOnPlaybackStatusUpdate((status) => {
          if (!("isLoaded" in status) || !status.isLoaded) return;
          setIsPlaying(Boolean(status.isPlaying));
          if (status.didJustFinish) {
            nextSound.unloadAsync().catch(() => { });
            setSound(null);
            setIsPlaying(false);
          }
        });
        return;
      }

      const status = await sound.getStatusAsync();
      if ("isPlaying" in status && status.isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Playback error", "Unable to play the voice note.");
    }
  };

  const removeAudio = async () => {
    setAudioUri(null);
    setAudioDuration(null);
    setIsPlaying(false);
    if (sound) {
      await sound.unloadAsync().catch(() => { });
      setSound(null);
    }
  };

  const addDraftAsCapturedItem = () => {
    if (!selectedCatalogItem) {
      Alert.alert("Select item", "Choose an item for these photos.");
      return;
    }
    if (!draftPhotos.length) {
      Alert.alert("Capture photos", "Take at least one photo first.");
      return;
    }

    const nextIndex = scopeCounter + 1;
    const scopeKey = `${selectedCatalogItem.sku || selectedCatalogItem._id}-${nextIndex}`;

    setCapturedItems((prev) => [
      ...prev,
      {
        scopeKey,
        itemId: selectedCatalogItem._id,
        label: selectedCatalogItem.label,
        price: selectedCatalogItem.price,
        unit: selectedCatalogItem.unit,
        type: selectedCatalogItem.type || selectedService,
        sku: selectedCatalogItem.sku,
        photos: [...draftPhotos],
      },
    ]);
    setScopeCounter(nextIndex);
    setDraftPhotos([]);
    setSelectedCatalogItemId(null);
    setSelectedCatalogItemOverride(null);
    setSearchQuery("");
  };

  const removeCapturedItem = (scopeKey: string) => {
    setCapturedItems((prev) =>
      prev.filter((item) => item.scopeKey !== scopeKey),
    );
  };

  const uriToBlob = (uri: string): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new Error("Failed to load file"));
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });

  const submitPickup = async () => {
    if (!capturedItems.length) {
      Alert.alert(
        "No items",
        "Capture at least one item before completing pickup.",
      );
      return;
    }

    if (!locationCoords) {
      Alert.alert(
        "Location not ready",
        "Location is still unavailable. Please enable it and wait a moment before completing pickup.",
      );
      return;
    }

    if (user?._id) {
      const isTripStarted = await checkIsTripStartedToday(user._id);
      if (!isTripStarted) {
        Alert.alert(
          "Trip / Shift Not Started 🛑",
          "You cannot complete a pickup until you start your trip for today. Please go to the Dashboard to enter your starting Odometer reading.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Start Trip Now",
              onPress: () => router.push("/(rider)/(tabs)/dashboard"),
            },
          ]
        );
        return;
      }
    }

    setSubmitting(true);
    const form = new FormData();
    form.append(
      "items",
      JSON.stringify(
        capturedItems.map((item) => ({
          itemId: item.itemId,
          quantity: 1,
          scopeKey: item.scopeKey,
        })),
      ),
    );
    form.append("location", JSON.stringify(locationCoords));

    const isWeb = Platform.OS === "web";

    for (const item of capturedItems) {
      for (const photoUri of item.photos) {
        const filename = photoUri.split("/").pop() || `${item.scopeKey}.jpg`;
        try {
          if (isWeb) {
            const blob = await uriToBlob(photoUri);
            form.append(`itemImages[${item.scopeKey}]`, blob as any, filename);
          } else {
            form.append(`itemImages[${item.scopeKey}]`, {
              uri: photoUri,
              name: filename,
              type: "image/jpeg",
            } as any);
          }
        } catch (error) {
          console.error("Failed to attach image", error);
        }
      }
    }

    if (audioUri) {
      const audioName = audioUri.split("/").pop() || "voice.m4a";
      try {
        if (isWeb) {
          const blob = await uriToBlob(audioUri);
          form.append("voice", blob as any, audioName);
        } else {
          form.append("voice", {
            uri: audioUri,
            name: audioName,
            type: "audio/m4a",
          } as any);
        }
      } catch (error) {
        console.error("Failed to attach voice", error);
      }
    }

    try {
      const res = await fetch(`${API_URL}/rider/uploadFiles/${orderId}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "x-client-type": "mobile",
        },
        body: form,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || `Upload failed (${res.status})`);
      }

      Alert.alert(
        "Success",
        json?.message || "Pickup completed successfully.",
        [
          {
            text: "OK",
            onPress: () =>
              router.replace({
                pathname: "/(rider)/(tabs)/tasks",
                params: { completedOrderId: orderId },
              }),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert("Error122", error?.message || "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (pickupLoading) {
    return <UniversalLoader fullscreen />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 150,
        }}
        onScroll={({ nativeEvent }) => {
          const nearBottom =
            nativeEvent.layoutMeasurement.height +
            nativeEvent.contentOffset.y >=
            nativeEvent.contentSize.height - 180;
          if (nearBottom) {
            loadMoreItems();
          }
        }}
        scrollEventThrottle={200}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.card,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerIcon}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Pickup
            </Text>
          </View>
          <View style={styles.headerIcon} />
        </View>

        <View style={{ padding: 16, gap: 16 }}>
          {isPickupCompleted && (
            <View
              style={{
                backgroundColor: "#DCFCE7",
                borderColor: "#86EFAC",
                borderWidth: 1,
                borderRadius: 16,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Ionicons name="checkmark-circle" size={24} color="#166534" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#166534", fontSize: 14, fontWeight: "800" }}>
                  Pickup Completed ✓
                </Text>
                <Text style={{ color: "#15803D", fontSize: 12, marginTop: 2 }}>
                  This pickup has been processed. Items and details are viewable in read-only mode.
                </Text>
              </View>
            </View>
          )}

          <View
            style={[
              styles.orderCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.orderCode, { color: theme.text }]}>
              {pickup?.Name || "Pickup details"}
            </Text>

            <View style={styles.actionGrid}>
              {/* ROW 1: Quick Communication & Navigation */}
              <View style={styles.actionRowPrimary}>
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: theme.primarySoft }]}
                  onPress={handleCall}
                  disabled={!pickup?.Contact}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call-outline" size={18} color={theme.primary} />
                  <Text style={[styles.primaryActionText, { color: theme.primary }]}>Call</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: "#DCFCE7" }]}
                  onPress={handleWhatsApp}
                  disabled={!pickup?.Contact}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#166534" />
                  <Text style={[styles.primaryActionText, { color: "#166534" }]}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: "#DBEAFE" }]}
                  onPress={() =>
                    openMapsNavigation(
                      pickup?.pickupLocation?.latitude || pickup?.deliveryLocation?.latitude || locationCoords?.latitude,
                      pickup?.pickupLocation?.longitude || pickup?.deliveryLocation?.longitude || locationCoords?.longitude,
                      pickup?.Address,
                      pickup?.Name,
                    )
                  }
                  activeOpacity={0.8}
                >
                  <Ionicons name="navigate-outline" size={18} color="#1E40AF" />
                  <Text style={[styles.primaryActionText, { color: "#1E40AF" }]}>Navigate</Text>
                </TouchableOpacity>
              </View>

              {/* ROW 2: Task Status Actions */}
              <View style={styles.actionRowSecondary}>
                <TouchableOpacity
                  style={[
                    styles.secondaryActionBtn,
                    {
                      backgroundColor: isPickupCompleted ? (isDark ? "#1E293B" : "#F1F5F9") : (isDark ? "#332900" : "#FEF3C7"),
                      borderColor: isPickupCompleted ? theme.border : (isDark ? "#78350F" : "#FDE68A"),
                    },
                  ]}
                  onPress={openReschedulePicker}
                  disabled={isPickupCompleted || rescheduleSubmitting}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={isPickupCompleted ? theme.subText : (isDark ? "#FBBF24" : "#B45309")}
                  />
                  <Text
                    style={[
                      styles.secondaryActionText,
                      { color: isPickupCompleted ? theme.subText : (isDark ? "#FBBF24" : "#B45309") },
                    ]}
                  >
                    Reschedule
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.secondaryActionBtn,
                    {
                      backgroundColor: isPickupCompleted ? (isDark ? "#1E293B" : "#F1F5F9") : (isDark ? "#3B0707" : "#FEE2E2"),
                      borderColor: isPickupCompleted ? theme.border : (isDark ? "#991B1B" : "#FCA5A5"),
                    },
                  ]}
                  onPress={handleCancelPress}
                  disabled={isPickupCompleted || cancelSubmitting}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="close-outline"
                    size={16}
                    color={isPickupCompleted ? theme.subText : (isDark ? "#F87171" : "#991B1B")}
                  />
                  <Text
                    style={[
                      styles.secondaryActionText,
                      { color: isPickupCompleted ? theme.subText : (isDark ? "#F87171" : "#991B1B") },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                1. Capture Item Photos
              </Text>
              <TouchableOpacity
                onPress={openCamera}
                style={[
                  styles.inlinePrimaryBtn,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Ionicons name="camera-outline" size={16} color="#fff" />
                <Text style={styles.inlinePrimaryBtnText}>Open Camera</Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.captureBox,
                {
                  backgroundColor: isDark ? theme.primarySoft : "#F7FBFA",
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons
                name="images-outline"
                size={22}
                color={theme.primaryDark}
              />
              <Text style={[styles.captureText, { color: theme.text }]}>
                {draftPhotos.length
                  ? `${draftPhotos.length} photo${draftPhotos.length > 1 ? "s" : ""} ready`
                  : "No photos captured yet"}
              </Text>
            </View>

            {isCompressingPhoto ? (
              <View style={styles.compressingRow}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text
                  style={[
                    styles.helper,
                    { color: theme.subText, marginTop: 0 },
                  ]}
                >
                  Compressing photo...
                </Text>
              </View>
            ) : null}

            {draftPhotos.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.previewStrip}
              >
                {draftPhotos.map((uri) => (
                  <View key={uri} style={styles.previewWrap}>
                    <Image source={{ uri }} style={styles.previewImage} />
                    <TouchableOpacity
                      style={styles.previewDelete}
                      onPress={() => removeDraftPhoto(uri)}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            {customerItems && customerItemsCollapsed && (
              <TouchableOpacity
                onPress={() => setCustomerItemsCollapsed(false)}
                style={{
                  marginBottom: 0,
                  paddingVertical: 0,
                  alignItems: "flex-end",
                }}
              >
                <Text
                  style={{
                    color: theme.primary,
                    fontWeight: "700",
                  }}
                >
                  Show
                </Text>
              </TouchableOpacity>
            )}

            {customerItems && !customerItemsCollapsed && (
              <View style={{ marginBottom: 20 }}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Customer Items
                  </Text>

                  <TouchableOpacity
                    onPress={() => setCustomerItemsCollapsed(true)}
                  >
                    <Text
                      style={{
                        color: theme.primary,
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                    >
                      Hide
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <Ionicons name="sparkles" size={14} color={theme.primary} />
                  <Text
                    style={[
                      styles.helper,
                      {
                        color: theme.subText,
                        marginBottom: 0,
                        fontSize: 12,
                        fontWeight: "600",
                      },
                    ]}
                  >
                    Tap any item below to snap photo & add it to pickup:
                  </Text>
                </View>

                <View style={{ gap: 10 }}>
                  {pickup?.items?.map((item: any, index: number) => {
                    const targetId = typeof item.itemId === "object" ? item.itemId?._id : item.itemId;
                    const addedCount = capturedItems.filter(
                      (ci) =>
                        (targetId && ci.itemId === targetId) ||
                        ci.label?.toLowerCase().trim() === item.label?.toLowerCase().trim()
                    ).length;

                    const isItemAdded = addedCount > 0;

                    return (
                      <TouchableOpacity
                        key={`${targetId || item.label}-${index}`}
                        activeOpacity={isItemAdded ? 1 : 0.8}
                        disabled={isItemAdded}
                        style={[
                          styles.capturedCard,
                          {
                            backgroundColor: isItemAdded
                              ? (isDark ? "#064E3B20" : "#ECFDF5")
                              : (isDark ? "#1E293B" : "#F8FAFC"),
                            borderColor: isItemAdded
                              ? "#10B981"
                              : theme.border,
                            borderWidth: isItemAdded ? 1.5 : 1,
                          },
                        ]}
                        onPress={() => !isItemAdded && handleSelectCustomerItem(item)}
                      >
                        <Image
                          source={{
                            uri:
                              item.itemId?.images?.[0]?.url ||
                              "https://via.placeholder.com/80?text=Item",
                          }}
                          style={styles.capturedThumb}
                        />

                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[styles.itemTitle, { color: theme.text }]}>
                            {item.label}
                          </Text>

                          <Text style={[styles.itemMeta, { color: theme.subText }]}>
                            Qty: {item.quantity || 1}
                          </Text>
                        </View>

                        {isItemAdded ? (
                          <View style={styles.completedItemBadge}>
                            <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                            <Text style={styles.completedItemBadgeText}>Added</Text>
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.customerItemActionBtn,
                              { backgroundColor: theme.primary },
                            ]}
                          >
                            <Ionicons name="camera" size={15} color="#FFFFFF" />
                            <Text style={styles.customerItemActionBtnText}>Add</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Select Item
            </Text>

            <View style={styles.serviceGrid}>
              {SERVICE_OPTIONS.map((service) => {
                const active = service.slug === selectedService;
                return (
                  <TouchableOpacity
                    key={service.slug}
                    style={[
                      styles.serviceTab,
                      {
                        backgroundColor: active
                          ? theme.primary
                          : isDark
                          ? "#1E293B"
                          : "#F8FAFC",
                        borderColor: active ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => {
                      setSelectedService(service.slug);
                      setSelectedCatalogItemId(null);
                      setSearchQuery("");
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={service.icon as any}
                      size={18}
                      color={active ? "#fff" : theme.primary}
                    />
                    <Text
                      style={[
                        styles.serviceTabText,
                        {
                          color: active ? "#fff" : theme.text,
                          fontWeight: active ? "800" : "700",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {service.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View
              style={[
                styles.searchInputWrap,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                },
              ]}
            >
              <Ionicons name="search-outline" size={18} color={theme.subText} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search item (e.g. Shoes)"
                placeholderTextColor={theme.subText}
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>

            <View style={{ gap: 10, marginTop: 14 }}>
              {!searchQuery.trim() ? null : currentService.loading &&
                currentService.page === 0 ? (
                <Text style={[styles.helper, { color: theme.subText }]}>
                  Loading items...
                </Text>
              ) : filteredItems.length === 0 ? (
                <Text style={[styles.helper, { color: theme.subText }]}>
                  No items found.
                </Text>
              ) : (
                filteredItems.slice(0, 10).map((item) => {
                  const active = item._id === selectedCatalogItemId;
                  return (
                    <TouchableOpacity
                      key={item._id}
                      style={[
                        styles.itemOption,
                        {
                          backgroundColor: active
                            ? theme.primarySoft
                            : theme.background,
                          borderColor: active ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={() => setSelectedCatalogItemId(item._id)}
                    >
                      <Image
                        source={{
                          uri:
                            item.images?.[0]?.url ||
                            "https://via.placeholder.com/80?text=Item",
                        }}
                        style={styles.itemThumb}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemTitle, { color: theme.text }]}>
                          {item.label}
                        </Text>
                        <Text
                          style={[styles.itemMeta, { color: theme.subText }]}
                        >
                          {item.sku || item.type || selectedService} •{" "}
                          {formatCurrency(item.price)}
                        </Text>
                      </View>
                      {active ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={theme.primary}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            <TouchableOpacity
              onPress={addDraftAsCapturedItem}
              disabled={!draftPhotos.length || !selectedCatalogItem}
              style={[
                styles.saveItemBtn,
                {
                  backgroundColor:
                    !draftPhotos.length || !selectedCatalogItem
                      ? theme.muted
                      : theme.primary,
                },
              ]}
            >
              <Text style={styles.saveItemBtnText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Summary
              </Text>
              <Text style={[styles.countText, { color: theme.subText }]}>
                {totalItems} item{totalItems === 1 ? "" : "s"}
              </Text>
            </View>

            {capturedItems.length === 0 ? (
              <Text style={[styles.helper, { color: theme.subText }]}>
                No items added
              </Text>
            ) : (
              <View style={{ gap: 12 }}>
                {capturedItems.map((item) => (
                  <View
                    key={item.scopeKey}
                    style={[
                      styles.capturedCard,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: item.photos[0] }}
                      style={styles.capturedThumb}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.itemMeta, { color: theme.subText }]}>
                        {item.photos.length} photo
                        {item.photos.length > 1 ? "s" : ""} •{" "}
                        {formatCurrency(item.price)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteIconBtn}
                      onPress={() => removeCapturedItem(item.scopeKey)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={theme.danger}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Voice Instructions
            </Text>
            <View
              style={[
                styles.voiceRow,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                },
              ]}
            >
              <TouchableOpacity
                onPress={recording ? stopRecording : startRecording}
                style={[
                  styles.recordBtn,
                  { backgroundColor: recording ? theme.danger : theme.primary },
                ]}
              >
                <Ionicons
                  name={recording ? "square" : "mic"}
                  size={18}
                  color="#fff"
                />
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={[styles.audioTime, { color: theme.text }]}>
                  {audioUri
                    ? `${formatDuration(audioDuration)} recorded`
                    : "No voice note"}
                </Text>
                <Text style={[styles.helper, { color: theme.subText }]}>
                  Optional note for the processing team.
                </Text>
              </View>

              <TouchableOpacity
                onPress={playAudio}
                disabled={!audioUri}
                style={styles.audioIconBtn}
              >
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={18}
                  color={audioUri ? theme.primaryDark : theme.muted}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={removeAudio}
                disabled={!audioUri}
                style={styles.audioIconBtn}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={audioUri ? theme.danger : theme.muted}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.card,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, 14),
          },
        ]}
      >
        <View>
          <Text style={[styles.footerMeta, { color: theme.subText }]}>
            Total Items: {totalItems}
          </Text>
          <Text style={[styles.footerAmount, { color: theme.text }]}>
            {formatCurrency(totalAmount)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={submitPickup}
          disabled={isPickupCompleted || !capturedItems.length || submitting}
          style={[
            styles.completeBtn,
            {
              backgroundColor:
                isPickupCompleted
                  ? "#94A3B8"
                  : !capturedItems.length || submitting
                  ? theme.muted
                  : theme.primary,
            },
          ]}
        >
          {submitting ? (
            <View style={styles.buttonSpinnerRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.completeBtnText}>Uploading...</Text>
            </View>
          ) : (
            <Text style={styles.completeBtnText}>
              {isPickupCompleted ? "Pickup Completed ✓" : "Complete Pickup"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* RESCHEDULE CONFIRMATION MODAL */}
      <ConfirmModal
        visible={rescheduleConfirmModalVisible}
        title="Confirm Pickup Reschedule?"
        message={
          pendingRescheduleDate
            ? `Are you sure you want to reschedule this pickup to ${moment(pendingRescheduleDate).format("DD MMMM YYYY")}?`
            : "Are you sure you want to reschedule this pickup?"
        }
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={async () => {
          if (pendingRescheduleDate) {
            setRescheduleConfirmModalVisible(false);
            await reschedulePickup(pendingRescheduleDate);
          }
        }}
        onCancel={() => setRescheduleConfirmModalVisible(false)}
      />

      <Modal
        visible={cameraModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCameraModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.cameraModal,
              { backgroundColor: "#000000", borderColor: theme.border },
            ]}
          >
            <View style={styles.cameraHeaderRow}>
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
                Capture Items
              </Text>
              <TouchableOpacity onPress={() => setCameraModalVisible(false)}>
                <Ionicons name="close-circle-outline" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {cameraPermission?.granted ? (
              <CameraView ref={cameraRef} style={styles.cameraView} />
            ) : (
              <View
                style={[
                  styles.cameraView,
                  {
                    backgroundColor: "#1E293B",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <Text style={{ color: "#94A3B8", fontSize: 14 }}>
                  Camera permission required.
                </Text>
              </View>
            )}

            {/* FIGMA CAMERA CONTROLS AREA */}
            <View style={styles.cameraControlsArea}>
              <TouchableOpacity
                onPress={takePhoto}
                disabled={isCompressingPhoto}
                style={[
                  styles.captureCircleBtn,
                  { backgroundColor: isCompressingPhoto ? "#64748B" : theme.primary },
                ]}
                activeOpacity={0.8}
              >
                {isCompressingPhoto ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={28} color="#FFFFFF" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setCameraModalVisible(false)}
                disabled={!draftPhotos.length || isCompressingPhoto}
                style={[
                  styles.confirmPhotosBtn,
                  {
                    backgroundColor:
                      !draftPhotos.length || isCompressingPhoto
                        ? "#475569"
                        : theme.primary,
                    opacity: !draftPhotos.length || isCompressingPhoto ? 0.55 : 1,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmPhotosBtnText}>
                  {draftPhotos.length > 0
                    ? `Confirm Photos (${draftPhotos.length})`
                    : "Confirm Photos"}
                </Text>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.card, width: "100%" },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Cancel Pickup
            </Text>

            <TextInput
              style={[
                styles.searchInputWrap,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                  height: 80,
                  marginTop: 14,
                  paddingTop: 10,
                  alignItems: "flex-start",
                },
              ]}
              placeholder="Enter reason OR record voice (one required)"
              placeholderTextColor={theme.subText}
              value={cancelNote}
              onChangeText={setCancelNote}
              multiline
              numberOfLines={3}
            />

            <View
              style={[
                styles.voiceRow,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.recordBtn,
                  {
                    backgroundColor: cancelIsRecording
                      ? theme.danger
                      : theme.primary,
                  },
                ]}
                onPress={
                  cancelIsRecording ? stopCancelRecording : startCancelRecording
                }
                disabled={cancelSubmitting || isRemovingCancelAudio}
              >
                <Ionicons
                  name={cancelIsRecording ? "square" : "mic"}
                  size={18}
                  color="#fff"
                />
              </TouchableOpacity>

              <Text style={[styles.audioTime, { color: theme.text }]}>
                {cancelIsRecording
                  ? "Recording..."
                  : cancelRecordedUri
                    ? "Voice recorded"
                    : "No voice note"}
              </Text>

              {cancelRecordedUri &&
                !cancelIsRecording &&
                !isRemovingCancelAudio && (
                  <>
                    <TouchableOpacity
                      style={styles.audioIconBtn}
                      onPress={toggleCancelPlayPause}
                    >
                      <Ionicons
                        name={cancelIsPlaying ? "pause" : "play"}
                        size={18}
                        color={theme.primaryDark}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.audioIconBtn}
                      onPress={removeCancelRecording}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={theme.danger}
                      />
                    </TouchableOpacity>
                  </>
                )}
              {isRemovingCancelAudio && (
                <ActivityIndicator size="small" color={theme.primary} />
              )}
            </View>

            {!cancelNote.trim() && !cancelRecordedUri && (
              <Text
                style={{ color: theme.danger, fontSize: 12, marginBottom: 8 }}
              >
                Add a note or record a voice message to cancel the pickup.
              </Text>
            )}

            <View style={[styles.modalActions, { marginTop: 6 }]}>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    if (cancelRecording)
                      await cancelRecording.stopAndUnloadAsync();
                  } catch { }
                  try {
                    if (cancelSoundRef.current) {
                      await cancelSoundRef.current.unloadAsync();
                      cancelSoundRef.current = null;
                    }
                  } catch { }
                  setCancelRecording(null);
                  setCancelIsRecording(false);
                  setCancelIsPlaying(false);
                  setCancelModalVisible(false);
                  setCancelNote("");
                  setCancelRecordedUri(null);
                }}
                disabled={cancelSubmitting}
                style={[
                  styles.modalSecondaryBtn,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={[styles.modalSecondaryBtnText, { color: theme.text }]}
                >
                  Close
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  cancelPickup(cancelNote.trim(), cancelRecordedUri)
                }
                disabled={
                  (!cancelNote.trim() && !cancelRecordedUri) ||
                  cancelSubmitting ||
                  isRemovingCancelAudio
                }
                style={[
                  styles.modalPrimaryBtn,
                  {
                    backgroundColor: theme.danger,
                    opacity:
                      (!cancelNote.trim() && !cancelRecordedUri) ||
                        cancelSubmitting ||
                        isRemovingCancelAudio
                        ? 0.5
                        : 1,
                  },
                ]}
              >
                {cancelSubmitting ? (
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.modalPrimaryBtnText}>
                      Cancelling...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.modalPrimaryBtnText}>Confirm Cancel</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showDatePicker && Platform.OS !== "android" && (
        <Modal transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.dateModal,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <DateTimePicker
                value={selectedDate}
                mode="date"
                minimumDate={new Date()}
                display="spinner"
                onChange={(_, date) => {
                  if (date) setSelectedDate(date);
                }}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={[
                    styles.modalSecondaryBtn,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modalSecondaryBtnText,
                      { color: theme.text },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => reschedulePickup(selectedDate)}
                  style={[
                    styles.modalPrimaryBtn,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <Text style={styles.modalPrimaryBtnText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  color,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color: string;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionButton, disabled && { opacity: 0.45 }]}
    >
      <View style={[styles.actionIconCircle, { backgroundColor: color }]}>
        <Ionicons name={icon} size={16} color="#fff" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === "ios" ? 52 : 24,
    paddingHorizontal: 16,
    paddingBottom: 0,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  orderCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  orderCode: {
    fontSize: 20,
    fontWeight: "800",
  },
  orderAddress: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  actionGrid: {
    marginTop: 14,
    gap: 10,
  },
  actionRowPrimary: {
    flexDirection: "row",
    gap: 8,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionRowSecondary: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionButton: {
    alignItems: "center",
    gap: 6,
    width: 72,
  },
  actionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  inlinePrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inlinePrimaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  captureBox: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
  },
  captureText: {
    fontSize: 14,
    fontWeight: "600",
  },
  compressingRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewStrip: {
    gap: 10,
    paddingTop: 12,
  },
  previewWrap: {
    position: "relative",
  },
  previewImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  previewDelete: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
  },
  serviceTab: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  serviceTabText: {
    fontSize: 13,
    fontWeight: "700",
  },
  searchInputWrap: {
    marginTop: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  itemOption: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  itemMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  saveItemBtn: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveItemBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  countText: {
    fontSize: 12,
  },
  capturedCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  capturedThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
  },
  deleteIconBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceRow: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recordBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  audioTime: {
    fontSize: 14,
    fontWeight: "600",
  },
  audioIconBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  footerMeta: {
    fontSize: 12,
  },
  footerAmount: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 2,
  },
  completeBtn: {
    minWidth: 150,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  completeBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  buttonSpinnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  cameraModal: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  cameraView: {
    width: "100%",
    height: 380,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  modalSecondaryBtn: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalPrimaryBtn: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  modalPrimaryBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  dateModal: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  cameraHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  cameraControlsArea: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 16,
  },
  captureCircleBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmPhotosBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  confirmPhotosBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  addedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  addedBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803D",
  },
  customerItemActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  customerItemActionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  completedItemBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  completedItemBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#15803D",
  },
});
