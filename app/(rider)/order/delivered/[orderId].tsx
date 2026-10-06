// app/(rider)/order/delivered/[orderId].tsx
import CaptureImageModal from "@/components/Modals/CaptureImageModal";
import ConfirmModal from "@/components/Modals/ConfirmModal";
import FollowupPickupModal from "@/components/Modals/FollowupPickupModal";
import { useAuth } from "@/context/useAuth";
import { openMapsNavigation } from "@/utils/navigationHelper";
import { setMiniWindowSuppressed } from "@/services/OverlayManager";
import { createFollowupPickupApi } from "@/services/api/followupPickup";
import { socket } from "@/services/socket";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import * as ImageManipulator from "expo-image-manipulator";
import { SaveFormat } from "expo-image-manipulator";
import { router, useLocalSearchParams } from "expo-router";
import LottieView from "lottie-react-native";
import moment from "moment";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../../context/ThemeContext";

/* ===================== INTERFACES ===================== */

interface StatusHistory {
  intransit: string | null;
  reprocessing: string | null;
  processing: string | null;
  readyForDelivery: string | null;
  deliveryriderassigned: string | null;
  delivered: string | null;
  cancelled: string | null;
}

interface OrderItem {
  lineId?: string;
  itemId: {
    _id: string;
    type: string;
    images: string[];
    videos: string[];
  };

  label: string;
  price: number;
  unit: string;
  quantity: number;
  intransitImages?: string[];
  readyForDeliveryImages?: string[];
}

interface OrderLocation {
  latitude: number;
  longitude: number;
}

interface OrderDetails {
  _id: string;
  order_id: string;
  customerName: string;
  contactNo: string;
  address: string;
  items: OrderItem[];
  price: number;
  totalAmount: number;
  discountAmount: number;
  status: string;
  statusHistory: StatusHistory;
  orderLocation?: OrderLocation;
  createdAt: string;
  updatedAt: string;
  riderName: string;
  riderDate: string;
  rescheduledDate?: string | null;
  intransitImage?: string[];
  ready_for_delivery_images?: string[];
  isPaid?: boolean;
}

interface QrPaymentPayload {
  qrId: string;
  qrImageUrl: string;
  qrString: string;
  amount: number;
  generatedAt?: string;
  expiresAt?: string;
  remainingSeconds?: number;
}

type DeliveryActionMode = "deliver" | "cash" | null;

/* ===================== COMPONENT ===================== */

import { useRiderData } from "@/context/RiderDataContext";

export default function DeliveredOrderDetails() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { activeTrip, checkIsTripStartedToday } = useRiderData();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderDetails | null>(null);

  const matchedStop = activeTrip?.stops?.find(
    (s) => String(s.id) === String(orderId) || String((s as any)._id) === String(orderId)
  );

  console.log("this is the matchedStop=====>>>>>>>>>>",matchedStop)

  const isDelivered =
    matchedStop?.status === "completed" ||
    matchedStop?.completed === true ||
    order?.status === "delivered" ||
    order?.status === "completed" 
    // (order as any)?.statusHistory?.delivered != null;
  const [showConfirm, setShowConfirm] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [deliveryImage, setDeliveryImage] = useState<string | null>(null);
  const [showPaymentSuccessMedia, setShowPaymentSuccessMedia] = useState(false);
  const [showFollowupPickupPrompt, setShowFollowupPickupPrompt] =
    useState(false);
  const [creatingFollowupPickup, setCreatingFollowupPickup] = useState(false);
  const [paymentOptionVisible, setPaymentOptionVisible] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrCancelling, setQrCancelling] = useState(false);
  const [qrRemainingSeconds, setQrRemainingSeconds] = useState(0);
  const [qrPayment, setQrPayment] = useState<QrPaymentPayload | null>(null);
  const [actionMode, setActionMode] = useState<DeliveryActionMode>(null);

  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [orderToReschedule, setOrderToReschedule] =
    useState<OrderDetails | null>(null);
  const [rescheduleConfirmVisible, setRescheduleConfirmVisible] = useState(false);
  const [pendingDeliveryReschedule, setPendingDeliveryReschedule] = useState<{
    chosenDate: Date | null;
    answered: boolean;
  } | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [returnVisible, setReturnVisible] = useState(false);
  const [returningOrder, setReturningOrder] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);

  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const { theme, isDark } = useTheme();
  const { user } = useAuth();

  const API_URL = "https://api.shiptos.com/api/v1/auth";
  const base_url = "https://api.shiptos.com/api/v1";
  const wattiUri = "https://live-server-101289.wati.io/api/v1";
  const token =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1bmlxdWVfbmFtZSI6ImF5dXNoc2luZ2g4NDIwMThAZ21haWwuY29tIiwibmFtZWlkIjoiYXl1c2hzaW5naDg0MjAxOEBnbWFpbC5jb20iLCJlbWFpbCI6ImF5dXNoc2luZ2g4NDIwMThAZ21haWwuY29tIiwiYXV0aF90aW1lIjoiMTIvMDgvMjAyNSAwNzoyMzo1MyIsInRlbmFudF9pZCI6IjEwMTI4OSIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOlsiVEVNUExBVEVfTUFOQUdFUiIsIkRFVkVMT1BFUiIsIkFVVE9NQVRJT05fTUFOQUdFUiJdLCJleHAiOjI1MzQwMjMwMDgwMCwiaXNzIjoiQ2xhcmVfQUkiLCJhdWQiOiJDbGFyZV9BSSJ9.NpVe1fi-RXRuNgCAGzFQLZT6dE7Y-rvlx1SYxLKZ_m4";
  const successGreen = "#22C55E";
  const paymentSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const beforeImages =
    order?.intransitImage?.length
      ? order.intransitImage
      : order?.items?.flatMap((item) => item.intransitImages || []) || [];
  const afterImages =
    order?.ready_for_delivery_images?.length
      ? order.ready_for_delivery_images
      : order?.items?.flatMap((item) => item.readyForDeliveryImages || []) ||
        [];

  /* ===================== HELPERS ===================== */

  // Helper: convert uri -> Blob (works on web & file URIs)
  const uriToBlob = (uri: string): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        reject(new Error("Failed to load file: " + (e as any)?.toString()));
      };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });

  const normalizePhoneForWhatsApp = (raw: any) => {
    if (!raw) return null;
    let digits = String(raw).replace(/\D/g, "");
    if (digits.length === 10) digits = "91" + digits;
    if (digits.length < 11) return null;
    return digits;
  };

  const sendWhatsAppTemplateDelivered = async () => {
    try {
      const phone = normalizePhoneForWhatsApp(order?.contactNo);
      if (!phone) return false;

      const templatePayload = {
        template_name: "delivery_success",
        broadcast_name: `delivery_success_${orderId}_${Date.now()}`,
        parameters: [
          { name: "name", value: order?.customerName || "Customer" },
        ],
      };

      const sendRes = await fetch(
        `${wattiUri}/sendTemplateMessage?whatsappNumber=${phone}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(templatePayload),
        },
      );

      return sendRes.ok;
    } catch (err) {
      console.error("Error sending delivered template:", err);
      return false;
    }
  };

  const sendWhatsAppTemplateRescheduleNoCall = async (
    orderIdParam?: string,
  ) => {
    try {
      const phone = normalizePhoneForWhatsApp(order?.contactNo);
      if (!phone) return false;

      const templatePayload = {
        template_name: "delivery_rescheduled__unable_to_reach_customer_",
        broadcast_name: `delivery_rescheduled__unable_to_reach_customer_${orderId}_${Date.now()}`,
        parameters: [{ name: "name", value: order?.customerName }],
      };

      const sendRes = await fetch(
        `${wattiUri}/sendTemplateMessage?whatsappNumber=${phone}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(templatePayload),
        },
      );

      return sendRes.ok;
    } catch (err) {
      console.error("Error sending reschedule no-call template:", err);
      return false;
    }
  };

  const sendWhatsAppTemplateRescheduleWithCall = async (
    orderIdParam?: string,
    chosenDate?: Date,
  ) => {
    try {
      const rescheduleDate = chosenDate
        ? moment(chosenDate).format("MMMM Do YYYY")
        : moment(order?.rescheduledDate).format("MMMM Do YYYY");

      const phone = normalizePhoneForWhatsApp(order?.contactNo);
      if (!phone) return false;

      const templatePayload = {
        template_name: "delivery__rescheduling_notification",
        broadcast_name: `delivery__rescheduling_notification_${orderId}_${Date.now()}`,
        parameters: [
          { name: "name", value: order?.customerName },
          {
            name: "delivery_rescheduled_date",
            value: rescheduleDate,
          },
        ],
      };

      const sendRes = await fetch(
        `${wattiUri}/sendTemplateMessage?whatsappNumber=${phone}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(templatePayload),
        },
      );

      return sendRes.ok;
    } catch (error) {
      console.error("Error sending reschedule with-call template:", error);
      return false;
    }
  };

  /* ===================== API ===================== */

  const getOrderDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/getOrderById/${orderId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error((json && json.message) || "Failed to fetch order");
      }

      setOrder(json);
      setLoading(false);
    } catch (error) {
      console.log("Order fetch error:", error);
      setLoading(false);
    }
  };

  const updateStatusTo = async (id: string | undefined, status: string) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_URL}/updateOrderStatus/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || "Failed to update order status");
      }
      console.log("Update status response:", json);
    } catch (error) {
      console.log("Order status update error:", error);
      throw error;
    }
  };

  const navigateToDeliveredTab = () => {
    router.replace({
      pathname: "/(rider)/(tabs)/tasks",
      params: { completedOrderId: orderId },
    });
  };

  const uploadDeliveryProof = async () => {
    if (!deliveryImage || deliveryImage === "uri") {
      throw new Error("Delivery image is required");
    }

    const formData = new FormData();
    const isWeb = Platform.OS === "web";
    const filename =
      deliveryImage.split("/").pop() || `delivery_${Date.now()}.jpg`;

    if (isWeb) {
      const blob = await uriToBlob(deliveryImage);
      formData.append("image", blob as any, filename);
    } else {
      formData.append("image", {
        uri: deliveryImage,
        name: filename,
        type: "image/jpeg",
      } as any);
    }

    const res = await fetch(`${base_url}/rider/uploadDeliverImage/${orderId}`, {
      method: "POST",
      body: formData,
      headers: {
        "x-client-type": "mobile",
        Accept: "application/json",
      },
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(json?.message || "Failed to upload image");
    }

    return json;
  };

  const markCashPaymentPaid = async () => {
    if (!order?.order_id) {
      throw new Error("Order ID missing");
    }

    const res = await fetch(
      `${base_url}/payments/${order.order_id}/mark-paid`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
        body: JSON.stringify({ paymentMode: "cash" }),
      },
    );

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(json?.message || "Failed to mark cash payment as paid");
    }

    return json;
  };

  const handleSkipFollowupPickup = () => {
    setShowFollowupPickupPrompt(false);
    navigateToDeliveredTab();
  };

  const handleCreateFollowupPickup = async () => {
    if (!user?._id || !user?.name || !orderId) {
      Alert.alert("Unable to create pickup", "Rider details are missing.");
      return;
    }

    try {
      setCreatingFollowupPickup(true);

      await createFollowupPickupApi({
        apiBaseUrl: base_url,
        orderId,
        riderId: user._id,
        riderName: user.name,
      });

      setShowFollowupPickupPrompt(false);
      router.replace({
        pathname: "/(rider)/(tabs)/tasks",
        params: { createdFromOrderId: orderId },
      });
    } catch (error) {
      console.error("Follow-up pickup creation error:", error);
      Alert.alert(
        "Unable to create pickup",
        error instanceof Error
          ? error.message
          : "Please try again in a moment.",
      );
    } finally {
      setCreatingFollowupPickup(false);
    }
  };

  const completeDeliveredFlow = async ({
    requireProofImage = false,
    markCashPaid = false,
  }: {
    requireProofImage?: boolean;
    markCashPaid?: boolean;
  }) => {
    if (user?._id) {
      const isTripStarted = await checkIsTripStartedToday(user._id);
      if (!isTripStarted) {
        setShowConfirm(false);
        setPaymentOptionVisible(false);
        setQrVisible(false);
        Alert.alert(
          "Trip / Shift Not Started 🛑",
          "You cannot complete a delivery until you start your trip for today. Please go to the Dashboard to enter your starting Odometer reading.",
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

    try {
      setDelivering(true);
      setShowConfirm(false);
      setPaymentOptionVisible(false);
      setQrVisible(false);

      if (requireProofImage) {
        await uploadDeliveryProof();
      }

      if (markCashPaid) {
        await markCashPaymentPaid();
      }

      await updateStatusTo(orderId, "delivered");
      // await sendWhatsAppTemplateDelivered();   // don't want to send whatsapp template for delivered flow as per new requirement
      await getOrderDetails();
      setShowFollowupPickupPrompt(true);
    } catch (error) {
      console.log("Delivered flow error:", error);
      throw error;
    } finally {
      setDelivering(false);
      setActionMode(null);
      setDeliveryImage(null);
    }
  };

  const generateQrPayment = async () => {
    if (!order?.order_id) return;

    try {
      setQrLoading(true);

      const res = await fetch(`${base_url}/qr/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
        body: JSON.stringify({ orderId: order.order_id }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.message || "Failed to generate QR");
      }

      setQrPayment(json);
      setQrRemainingSeconds(Number(json?.remainingSeconds || 0));
      setPaymentOptionVisible(false);
      setQrVisible(true);
    } catch (error) {
      console.error("QR generation error:", error);
    } finally {
      setQrLoading(false);
    }
  };

  const closeQrPayment = async () => {
    if (!qrPayment?.qrId) {
      setQrVisible(false);
      setQrPayment(null);
      setQrRemainingSeconds(0);
      return;
    }

    try {
      setQrCancelling(true);

      const res = await fetch(`${base_url}/qr/cancel/${qrPayment.qrId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-type": "mobile",
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.message || "Failed to cancel QR");
      }

      setQrVisible(false);
      setQrPayment(null);
      setQrRemainingSeconds(0);
    } catch (error) {
      console.error("QR cancel error:", error);
      Alert.alert("Unable to close QR", "Please try again in a moment.");
    } finally {
      setQrCancelling(false);
    }
  };

  const openMoreMenu = () => {
    setMoreVisible(true);
  };

  const openImages = () => {
    setMoreVisible(false);
    setGalleryIndex(0);
    setGalleryVisible(true);
  };

  const openReturnConfirm = () => {
    setMoreVisible(false);
    setReturnVisible(true);
  };

  const markAsReturn = async () => {
    setReturningOrder(true);
    try {
      await updateStatusTo(orderId, "reprocessing");

      setReturnVisible(false);
      router.replace({
        pathname: "/(rider)/(tabs)/tasks",
        params: { completedOrderId: orderId },
      });
    } catch (err) {
      console.error("Error marking order as return:", err);
    } finally {
      setReturningOrder(false);
    }
  };

  const openReschedule = (ord: OrderDetails) => {
    setOrderToReschedule(ord);
    setRescheduleVisible(true);
  };

  const rescheduleOrder = async (
    orderIdParam: string,
    newDate: Date | null,
    answered: boolean,
  ) => {
    setRescheduling(true);
    try {
      const dateToSend = newDate ? newDate.toISOString() : null;

      const res = await fetch(
        `${base_url}/rider/rescheduleorder/${orderIdParam}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ newDate: dateToSend }),
        },
      );

      const json = await res.json();
      console.log("rescheduleApiResp", json);

      if (!res.ok) {
        throw new Error(json.message || "Failed to reschedule");
      }

      // 1️⃣ Update status
      await updateStatusTo(orderIdParam, "ready for delivery");

      // 2️⃣ Send WhatsApp
      if (answered) {
        // await sendWhatsAppTemplateRescheduleWithCall(
        //   orderIdParam,
        //   newDate ?? undefined,
        // );  ///
        console.log("reschedule and customer picked the call");
      } else {
        // await sendWhatsAppTemplateRescheduleNoCall(orderIdParam);
        console.log("reschedule and customer did not pick the call");
      }

      // ✅ 3️⃣ Navigate back with completed order id
      router.replace({
        pathname: "/(rider)/(tabs)/tasks",
        params: { completedOrderId: orderIdParam },
      });
    } catch (err) {
      console.error("Error rescheduling (RN):", err);
    } finally {
      setRescheduleVisible(false);
      setOrderToReschedule(null);
      setRescheduling(false);
    }
  };

  /* ===================== LIFECYCLE ===================== */

  useEffect(() => {
    setMiniWindowSuppressed(true);
    const timer = setTimeout(() => {
      setMiniWindowSuppressed(false);
    }, 2500);
    return () => {
      clearTimeout(timer);
      setMiniWindowSuppressed(false);
    };
  }, []);

  useEffect(() => {
    getOrderDetails();
  }, [orderId]);

  useEffect(() => {
    const liveOrderId = order?.order_id ? String(order.order_id) : null;
    if (!liveOrderId) return;

    const joinOrderRoom = () => {
      socket.emit("joinOrder", { orderId: liveOrderId });
    };

    const handlePaymentUpdate = (payload: {
      orderId?: string;
      paymentStatus?: string;
      isPaid?: boolean;
    }) => {
      if (String(payload?.orderId) !== liveOrderId) return;

      const nextPaid = Boolean(payload?.isPaid);
      const shouldShowSuccess = !Boolean(order?.isPaid) && nextPaid;

      setOrder((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          isPaid: nextPaid,
        };
      });

      if (!shouldShowSuccess) return;

      setQrVisible(false);
      setQrPayment(null);
      setQrRemainingSeconds(0);
      setShowPaymentSuccessMedia(true);

      if (paymentSuccessTimeoutRef.current) {
        clearTimeout(paymentSuccessTimeoutRef.current);
      }

      paymentSuccessTimeoutRef.current = setTimeout(() => {
        setShowPaymentSuccessMedia(false);
        paymentSuccessTimeoutRef.current = null;
      }, 3000);
    };

    if (!socket.connected) {
      socket.connect();
    }

    joinOrderRoom();
    socket.on("connect", joinOrderRoom);
    socket.on("paymentUpdate", handlePaymentUpdate);

    return () => {
      socket.off("connect", joinOrderRoom);
      socket.off("paymentUpdate", handlePaymentUpdate);

      if (paymentSuccessTimeoutRef.current) {
        clearTimeout(paymentSuccessTimeoutRef.current);
        paymentSuccessTimeoutRef.current = null;
      }
    };
  }, [order?.order_id, order?.isPaid]);
  useEffect(() => {
    if (!qrVisible || !qrPayment) return;

    const expiresAtMs = qrPayment.expiresAt
      ? new Date(qrPayment.expiresAt).getTime()
      : null;
    const initialRemaining = Number(qrPayment.remainingSeconds || 0);

    const getRemainingFromServerTime = () => {
      if (!expiresAtMs) return null;
      return Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000));
    };

    const firstRemaining = getRemainingFromServerTime();
    setQrRemainingSeconds(firstRemaining ?? initialRemaining);

    const intervalId = setInterval(() => {
      const serverRemaining = getRemainingFromServerTime();

      if (serverRemaining !== null) {
        setQrRemainingSeconds(serverRemaining);
        if (serverRemaining <= 0) {
          clearInterval(intervalId);
        }
        return;
      }

      setQrRemainingSeconds((prev) => {
        const updated = prev > 0 ? prev - 1 : 0;
        if (updated <= 0) {
          clearInterval(intervalId);
        }
        return updated;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [qrVisible, qrPayment]);
  useEffect(() => {
    const onBackPress = () => {
      if (returnVisible) {
        setReturnVisible(false);
        return true;
      }
      if (rescheduleVisible) {
        setRescheduleVisible(false);
        setOrderToReschedule(null);
        return true;
      }
      if (showCamera) {
        setShowCamera(false);
        return true;
      }
      if (showConfirm) {
        setShowConfirm(false);
        return true;
      }
      if (showFollowupPickupPrompt) {
        handleSkipFollowupPickup();
        return true;
      }
      if (galleryVisible) {
        setGalleryVisible(false);
        return true;
      }

      router.back();
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [
    returnVisible,
    rescheduleVisible,
    showCamera,
    showConfirm,
    showFollowupPickupPrompt,
    galleryVisible,
  ]);

  useEffect(() => {
    if (qrRemainingSeconds <= 0) {
      setQrVisible(false);
    }
  }, [qrRemainingSeconds]);
  // When CaptureImageModal returns a captured image URI, compress/manipulate it first
  const onImageCaptured = async (uri: string) => {
    try {
      // compress/resize similar to SelectItems
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        {
          compress: 0.8,
          format: SaveFormat.JPEG,
        },
      );

      setDeliveryImage(manipulated.uri);
      setShowCamera(false);
      setShowConfirm(true);
    } catch (err) {
      console.error("Failed to compress/manipulate captured image:", err);
      // fallback: set original uri
      setDeliveryImage(uri);
      setShowCamera(false);
      setShowConfirm(true);
    }
  };

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

  /* ===================== LOADING ===================== */

  if (loading || !order) {
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
        <SkeletonCard />
      </ScrollView>
    );
  }

  const openDeliveredConfirmation = () => {
    setActionMode("deliver");
    setShowConfirm(true);
  };

  const openPaymentOptions = () => {
    setPaymentOptionVisible(true);
  };

  const onCashPaymentPress = () => {
    setPaymentOptionVisible(false);
    setActionMode("cash");
    setDeliveryImage(null);
    setShowCamera(true);
  };

  const skipCapture = () => {
    if (actionMode === "cash") {
      return;
    }

    setDeliveryImage("uri");
    setShowCamera(false);
    setShowConfirm(true);
  };

  const confirmPaidDelivery = async () => {
    try {
      await completeDeliveredFlow({
        requireProofImage: false,
        markCashPaid: false,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const confirmCashCollection = async () => {
    try {
      await completeDeliveredFlow({
        requireProofImage: true,
        markCashPaid: true,
      });
    } catch (err) {
      console.error(err);
    }
  };
  const phoneNumber = order?.contactNo;

  const handleCall = () => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleWhatsApp = () => {
    const phone = normalizePhoneForWhatsApp(phoneNumber);
    if (!phone) return;

    const message = encodeURIComponent(
      "Hello, I am your delivery rider. I am on the way to deliver your order.",
    );

    Linking.openURL(`https://wa.me/${phone}?text=${message}`);
  };

  const parseNumber = (v: any) =>
    Number(String(v).replace(/[^\d.-]/g, "")) || 0;

  const subtotal = order?.price;

  const fmtINR = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n);

  const formatCountdown = (seconds: number) => {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const remaining = safeSeconds % 60;
    return `${minutes}:${String(remaining).padStart(2, "0")}`;
  };

  const paid = parseNumber(order.totalAmount);
  const discountAmount = order.discountAmount;

  const isPaid = !!order.isPaid;

  /* ===================== UI ===================== */

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDark ? theme.card : theme.primary,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons
            name="arrow-back"
            size={22}
            color={isDark ? theme.text : "#fff"}
          />
        </TouchableOpacity>

        <Text
          style={[styles.headerTitle, { color: isDark ? theme.text : "#fff" }]}
        >
          Shiptos
        </Text>

        <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
          <Text style={[styles.avatarText, { color: theme.primary }]}>
            {user?.name?.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* STATUS */}
      <View style={styles.statusWrap}>
        <Text style={[styles.orderId, { color: theme.text }]}>
          {order.order_id}
        </Text>
      </View>

      {isDelivered && (
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
            marginBottom: 16,
          }}
        >
          <Ionicons name="checkmark-circle" size={24} color="#166534" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#166534", fontSize: 14, fontWeight: "800" }}>
              Delivery Completed ✓
            </Text>
            <Text style={{ color: "#15803D", fontSize: 12, marginTop: 2 }}>
              This delivery has been completed. Items and payment summary are viewable in read-only mode.
            </Text>
          </View>
        </View>
      )}

      {/* DELIVERY DETAILS */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={[styles.heading, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Details</Text>

          <TouchableOpacity onPress={openMoreMenu} activeOpacity={0.8}>
            <Ionicons
              name="ellipsis-vertical"
              size={18}
              color={theme.primary}
            />
          </TouchableOpacity>
        </View>

        <DetailRow
          icon="person-outline"
          label=""
          value={order.customerName}
          theme={theme}
        />

        <DetailRow
          icon="location-outline"
          label=""
          value={order.address}
          theme={theme}
        />

        <DetailRow
          icon="time-outline"
          label=""
          value={moment(order.updatedAt).format("DD MMM, hh:mm A")}
          theme={theme}
        />
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#10B981" }]}
            onPress={handleCall}
          >
            <Ionicons name="call-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#10B981" }]}
            onPress={handleWhatsApp}
          >
            <Ionicons name="logo-whatsapp" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#2563EB" }]}
            onPress={() =>
              openMapsNavigation(
                (order as any)?.deliveryLocation?.latitude || (order as any)?.location?.latitude,
                (order as any)?.deliveryLocation?.longitude || (order as any)?.location?.longitude,
                order.address,
                order.customerName,
              )
            }
          >
            <Ionicons name="navigate-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Navigate</Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* ITEMS */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Items</Text>

        {order.items.map((item, index) => (
          <ItemRow
            key={item.itemId?._id || index}
            label={`${item.label}`}
            price={`₹${item.price}`}
            theme={theme}
          />
        ))}
      </View>

      {/* PAYMENT */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Payment Summary
        </Text>
        <View
          style={[
            styles.paymentBanner,
            {
              backgroundColor: isPaid ? "#F0FDF4" : "#FFFBEB",
              borderLeftColor: isPaid ? "#22C55E" : "#F59E0B",
            },
          ]}
        >
          <View
            style={[
              styles.paymentIconWrap,
              {
                backgroundColor: isPaid ? "#DCFCE7" : "#FEF3C7",
              },
            ]}
          >
            <Ionicons
              name={isPaid ? "checkmark-circle" : "cash"}
              size={24}
              color={isPaid ? "#16A34A" : "#D97706"}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.paymentBannerTitle,
                {
                  color: isPaid ? "#15803D" : "#B45309",
                },
              ]}
            >
              {isPaid ? "PREPAID ORDER" : "PAYMENT DUE"}
            </Text>
            <Text
              style={[
                styles.paymentBannerSubtitle,
                {
                  color: isPaid ? "#166534" : "#92400E",
                },
              ]}
            >
              {isPaid
                ? "No Collection Required"
                : `${fmtINR(paid)} to be collected`}
            </Text>
          </View>
        </View>

        <SummaryRow label="Subtotal" price={fmtINR(subtotal)} theme={theme} />
        <SummaryRow label="Discount" price={"- " + fmtINR(discountAmount)} theme={theme} />
        <SummaryRow label="Total" price={fmtINR(paid)} bold theme={theme} />
      </View>

      {/* ACTION BUTTONS */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          Delivery Action
        </Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.deliveredBtn,
              isDelivered && { backgroundColor: "#94A3B8" },
            ]}
            activeOpacity={0.8}
            onPress={isPaid ? openDeliveredConfirmation : openPaymentOptions}
            disabled={isDelivered || delivering || qrLoading}
          >
            <Ionicons
              name={isDelivered ? "checkmark-circle" : isPaid ? "checkmark-circle-outline" : "wallet-outline"}
              size={15}
              color="#fff"
            />
            <Text style={styles.actionBtnText}>
              {isDelivered
                ? "Delivery Completed"
                : delivering
                ? "Processing..."
                : isPaid
                ? "Mark as Delivered"
                : qrLoading
                ? "Preparing QR..."
                : "Collect Payment"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.rescheduleBtn,
              isDelivered && { backgroundColor: "#CBD5E1", opacity: 0.6 },
            ]}
            activeOpacity={0.8}
            onPress={() => openReschedule(order)}
            disabled={isDelivered}
          >
            <Ionicons name="calendar-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Reschedule</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modals */}
      <ImageGalleryModal
        visible={galleryVisible}
        beforeImages={beforeImages}
        afterImages={afterImages}
        onClose={() => setGalleryVisible(false)}
      />

      <CaptureImageModal
        visible={showCamera}
        onCancel={() => setShowCamera(false)}
        onImageCaptured={onImageCaptured}
        skipCapture={skipCapture}
        allowSkip={actionMode !== "cash"}
      />

      <Modal
        visible={paymentOptionVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentOptionVisible(false)}
      >
        <View style={styles.paymentOptionBackdrop}>
          <View style={styles.paymentOptionSheet}>
            <Text style={styles.paymentOptionTitle}>Collect Payment</Text>
            <Text style={styles.paymentOptionSubtitle}>
              Choose how you want to collect payment for this order.
            </Text>

            <TouchableOpacity
              style={[
                styles.paymentOptionButton,
                { backgroundColor: "#16A34A" },
              ]}
              activeOpacity={0.85}
              onPress={onCashPaymentPress}
            >
              <Ionicons name="cash-outline" size={20} color="#fff" />
              <Text style={styles.paymentOptionButtonText}>Cash Payment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.paymentOptionButton,
                { backgroundColor: theme.primary },
              ]}
              activeOpacity={0.85}
              onPress={generateQrPayment}
              disabled={qrLoading}
            >
              <Ionicons name="qr-code-outline" size={20} color="#fff" />
              <Text style={styles.paymentOptionButtonText}>
                {qrLoading ? "Generating QR..." : "Generate QR"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.paymentOptionCancel}
              activeOpacity={0.85}
              onPress={() => setPaymentOptionVisible(false)}
            >
              <Text style={styles.paymentOptionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={qrVisible}
        transparent
        animationType="fade"
        onRequestClose={closeQrPayment}
      >
        <View style={styles.qrBackdrop}>
          <View style={styles.qrSheet}>
            <Text style={styles.qrTitle}>Scan To Pay</Text>
            <Text style={styles.qrSubtitle}>
              Ask the customer to scan this QR for{" "}
              {fmtINR(qrPayment?.amount || paid)}.
            </Text>

            {qrPayment?.qrImageUrl ? (
              <Image
                source={{ uri: qrPayment.qrImageUrl }}
                style={styles.qrImage}
              />
            ) : null}

            <View style={styles.qrTimerRow}>
              <View
                style={[
                  styles.qrTimerDot,
                  {
                    backgroundColor:
                      qrRemainingSeconds <= 0
                        ? "#EF4444"
                        : qrRemainingSeconds <= 60
                          ? "#F59E0B"
                          : "#22C55E",
                  },
                ]}
              />
              <Text style={styles.qrExpiryText}>
                {qrRemainingSeconds > 0
                  ? `Expires in ${formatCountdown(qrRemainingSeconds)}`
                  : "QR Expired"}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.qrCloseButton,
                qrCancelling && styles.qrCloseButtonDisabled,
              ]}
              activeOpacity={0.85}
              onPress={closeQrPayment}
              disabled={qrCancelling}
            >
              <Text style={styles.qrCloseButtonText}>
                {qrCancelling ? "Closing..." : "Close"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPaymentSuccessMedia}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPaymentSuccessMedia(false)}
      >
        <View style={styles.paymentSuccessBackdrop}>
          <View style={styles.paymentSuccessSheet}>
            <LottieView
              source={require("../../../../assets/animations/payment-success.json")}
              style={styles.paymentSuccessVideo}
              autoPlay
              loop
            />
          </View>
        </View>
      </Modal>

      <FollowupPickupModal
        visible={showFollowupPickupPrompt}
        customerName={order.customerName}
        loading={creatingFollowupPickup}
        onCreatePickup={handleCreateFollowupPickup}
        onSkip={handleSkipFollowupPickup}
      />

      <ConfirmModal
        visible={showConfirm}
        title={
          actionMode === "cash"
            ? "Collect Cash & Deliver?"
            : "Mark as Delivered?"
        }
        message={
          actionMode === "cash"
            ? `Confirm cash collection of ${fmtINR(paid)} and mark this order as delivered?`
            : "Are you sure you want to mark this delivery as delivered?"
        }
        confirmText={
          actionMode === "cash" ? "Collect & Deliver" : "Yes, Delivered"
        }
        cancelText="Cancel"
        onConfirm={
          actionMode === "cash" ? confirmCashCollection : confirmPaidDelivery
        }
        onCancel={() => setShowConfirm(false)}
      />

      <Modal
        visible={moreVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreVisible(false)}
      >
        <View style={menuStyles.backdrop}>
          <View style={[menuStyles.sheet, { backgroundColor: theme.card }]}>
            <TouchableOpacity
              onPress={() => setMoreVisible(false)}
              style={menuStyles.closeIconBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="close"
                size={20}
                color={theme.subText || "#6B7280"}
              />
            </TouchableOpacity>
            <TouchableOpacity style={menuStyles.menuItem} onPress={openImages}>
              <Ionicons name="images-outline" size={18} color={theme.text} />
              <Text style={[menuStyles.menuText, { color: theme.text }]}>
                View Images
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={menuStyles.menuItem}
              onPress={openReturnConfirm}
            >
              <Ionicons
                name="return-down-back-outline"
                size={18}
                color="#EF4444"
              />
              <Text style={[menuStyles.menuText, { color: "#EF4444" }]}>
                Mark as Return
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={returnVisible}
        title="Mark as Return?"
        message="Are you sure you want to mark this order as returned?"
        confirmText="Yes, Mark Return"
        cancelText="Cancel"
        onConfirm={markAsReturn}
        onCancel={() => setReturnVisible(false)}
      />

      <RescheduleModalRN
        visible={rescheduleVisible}
        onClose={() => {
          setRescheduleVisible(false);
          setOrderToReschedule(null);
        }}
        order={orderToReschedule}
        onConfirm={async (chosenDate, answered) => {
          if (!orderToReschedule) return;
          setRescheduleVisible(false);
          setPendingDeliveryReschedule({ chosenDate, answered });
          setRescheduleConfirmVisible(true);
        }}
        loading={rescheduling}
      />

      {/* RESCHEDULE CONFIRMATION MODAL */}
      <ConfirmModal
        visible={rescheduleConfirmVisible}
        title="Confirm Delivery Reschedule?"
        message={
          pendingDeliveryReschedule?.chosenDate
            ? `Are you sure you want to reschedule this delivery to ${moment(pendingDeliveryReschedule.chosenDate).format("DD MMMM YYYY")}?`
            : "Are you sure you want to reschedule this delivery?"
        }
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={async () => {
          if (orderToReschedule && pendingDeliveryReschedule) {
            setRescheduleConfirmVisible(false);
            await rescheduleOrder(
              orderToReschedule._id,
              pendingDeliveryReschedule.chosenDate,
              pendingDeliveryReschedule.answered,
            );
          }
        }}
        onCancel={() => setRescheduleConfirmVisible(false)}
      />
    </ScrollView>
  );
}

function ImageGalleryModal({
  visible,
  beforeImages,
  afterImages,
  onClose,
}: {
  visible: boolean;
  beforeImages: string[];
  afterImages: string[];
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"before" | "after">("before");

  // Reset tab whenever modal opens
  useEffect(() => {
    if (visible) {
      // If no before images but after images exist, open After tab by default
      if ((beforeImages?.length || 0) === 0 && (afterImages?.length || 0) > 0) {
        setActiveTab("after");
      } else {
        setActiveTab("before");
      }
    }
  }, [visible, beforeImages, afterImages]);

  const currentImages =
    activeTab === "before" ? beforeImages || [] : afterImages || [];

  const hasImages =
    (beforeImages?.length || 0) > 0 || (afterImages?.length || 0) > 0;

  const renderTab = (key: "before" | "after", label: string, count: number) => {
    const isActive = activeTab === key;
    const isDisabled = count === 0;

    return (
      <TouchableOpacity
        key={key}
        activeOpacity={0.8}
        disabled={isDisabled}
        onPress={() => setActiveTab(key)}
        style={{
          flex: 1,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: "center",
          backgroundColor: isActive ? "#10B981" : "transparent",
          opacity: isDisabled ? 0.4 : 1,
        }}
      >
        <Text
          style={{
            color: isActive ? "#FFFFFF" : "#9CA3AF",
            fontWeight: "900",
            fontSize: 14,
          }}
        >
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={modalStyles.backdrop}>
        <View
          style={[
            modalStyles.gallerySheet,
            {
              height: Dimensions.get("window").height * 0.85,
            },
          ]}
        >
          {/* Header */}
          <View style={modalStyles.galleryHeader}>
            <Text style={[modalStyles.title, { color: "#FFFFFF" }]}>
              Order Images
            </Text>

            <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {hasImages ? (
            <>
              {/* Tabs */}
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: "#1F2937",
                  borderRadius: 14,
                  padding: 4,
                  marginBottom: 20,
                }}
              >
                {renderTab("before", "Before", beforeImages?.length || 0)}
                {renderTab("after", "After", afterImages?.length || 0)}
              </View>

              {/* Images */}
              {currentImages.length > 0 ? (
                <FlatList
                  data={currentImages}
                  keyExtractor={(item, index) => `${activeTab}-${index}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingBottom: 24,
                  }}
                  renderItem={({ item }) => (
                    <View style={{ marginRight: 12 }}>
                      <Image
                        source={{ uri: item }}
                        style={{
                          width: 260,
                          height: 360,
                          borderRadius: 14,
                          backgroundColor: "#111827",
                        }}
                        resizeMode="contain"
                      />
                    </View>
                  )}
                />
              ) : (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#9CA3AF" }}>No images available</Text>
                </View>
              )}
            </>
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#9CA3AF" }}>No images available</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function RescheduleModalRN({
  visible,
  onClose,
  order,
  onConfirm,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  order: OrderDetails | null;
  onConfirm: (date: Date | null, answered: boolean) => Promise<void>;
  loading?: boolean;
}) {
  const [step, setStep] = useState<"CHOICE" | "ANSWERED" | "NO_ANSWER">(
    "CHOICE",
  );
  const [date, setDate] = useState<Date>(new Date());
  const [showIOSPicker, setShowIOSPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep("CHOICE");
      setDate(new Date());
      setShowIOSPicker(false);
    }
  }, [visible]);

  const openAndroidPicker = () => {
    DateTimePickerAndroid.open({
      value: date,
      mode: "date",
      minimumDate: new Date(),
      onChange: (_, selectedDate) => {
        if (selectedDate) setDate(selectedDate);
      },
    });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.sheet}>
          <Text style={modalStyles.title}>Reschedule Delivery</Text>

          {step === "CHOICE" && (
            <>
              <Text style={modalStyles.sub}>
                Did the customer answer your call?
              </Text>

              <View style={modalStyles.actionsRow}>
                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#22C55E" }]}
                  onPress={() => setStep("ANSWERED")}
                >
                  <Text style={modalStyles.actionTextWhite}>Answered</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#FACC15" }]}
                  onPress={() => setStep("NO_ANSWER")}
                >
                  <Text style={modalStyles.actionTextDark}>Not Answered</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={onClose}
                style={modalStyles.cancelBtn}
                activeOpacity={0.8}
              >
                <Text style={modalStyles.cancelTextDark}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {step === "ANSWERED" && (
            <>
              <Text style={modalStyles.sub}>
                Select a new delivery date & time
              </Text>

              <TouchableOpacity
                style={modalStyles.dateBtn}
                onPress={() =>
                  Platform.OS === "android"
                    ? openAndroidPicker()
                    : setShowIOSPicker(true)
                }
              >
                <Text style={modalStyles.dateText}>
                  {moment(date).format("dddd, MMM D, YYYY - hh:mm A")}
                </Text>
              </TouchableOpacity>

              {Platform.OS === "ios" && showIOSPicker && (
                <DateTimePicker
                  value={date}
                  mode="datetime"
                  display="inline"
                  minimumDate={new Date()}
                  onChange={(_, d) => d && setDate(d)}
                />
              )}

              <View style={modalStyles.actionsRow}>
                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#22C55E" }]}
                  disabled={loading}
                  onPress={() => onConfirm(date, true)}
                >
                  <Text style={modalStyles.actionText}>
                    {loading ? "Please wait..." : "Confirm"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#E5E7EB" }]}
                  onPress={() => setStep("CHOICE")}
                >
                  <Text style={[modalStyles.actionText, { color: "#000" }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === "NO_ANSWER" && (
            <>
              <Text style={modalStyles.sub}>
                Customer did not answer. Delivery will be rescheduled to:
              </Text>

              <Text style={modalStyles.dateText}>
                {moment().add(1, "day").format("dddd, MMM D, YYYY")}
              </Text>

              <View style={modalStyles.actionsRow}>
                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#F59E0B" }]}
                  disabled={loading}
                  onPress={() =>
                    onConfirm(moment().add(1, "day").toDate(), false)
                  }
                >
                  <Text style={modalStyles.actionText}>
                    {loading ? "Please wait..." : "Confirm"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[modalStyles.action, { backgroundColor: "#E5E7EB" }]}
                  onPress={() => setStep("CHOICE")}
                >
                  <Text style={[modalStyles.actionText, { color: "#000" }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ icon, label, value, theme, onPress, isLink }: any) {
  return (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.detailRow}
    >
      <Ionicons name={icon} size={18} color={theme.primary} />

      <View style={styles.detailContent}>
        {label ? (
          <Text style={[styles.detailLabel, { color: theme.subText }]}>
            {label}
          </Text>
        ) : null}

        <Text
          style={[
            styles.detailValue,
            { color: isLink ? theme.primary : theme.text },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {value}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ItemRow({ label, price, theme }: any) {
  return (
    <View style={styles.itemRow}>
      <Text style={[styles.itemLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.itemPrice, { color: theme.text }]}>{price}</Text>
    </View>
  );
}

function SummaryRow({
  label,
  price,
  bold,
  theme,
}: {
  label: string;
  price: string;
  bold?: boolean;
  theme: any;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: theme.subText }]}>
        {label}
      </Text>

      <Text
        style={[
          styles.summaryPrice,
          { color: theme.text },
          bold && { fontWeight: "900" },
        ]}
      >
        {price}
      </Text>
    </View>
  );
}

function ConfirmRow({ icon, text, theme }: any) {
  return (
    <View style={styles.confirmRow}>
      <Ionicons name={icon} size={20} color={theme.primary} />
      <Text style={[styles.confirmText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  headerTitle: { fontWeight: "900", fontSize: 16 },

  paymentBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderLeftWidth: 5,
    marginBottom: 16,
  },

  paymentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  paymentBannerTitle: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  paymentOptionBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },

  paymentOptionSheet: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 12,
  },

  paymentOptionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#0F172A",
  },

  paymentOptionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
    marginBottom: 4,
  },

  paymentOptionButton: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  paymentOptionButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  paymentOptionCancel: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2E8F0",
  },

  paymentOptionCancelText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },

  qrBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  qrSheet: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    alignItems: "center",
  },

  qrTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#0F172A",
  },

  qrSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  },

  qrImage: {
    width: 300,
    height: 320,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 18,
  },

  qrTimerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  qrTimerDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },

  qrExpiryText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "700",
  },

  qrCloseButton: {
    marginTop: 18,
    minWidth: 120,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
  },

  qrCloseButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  qrCloseButtonDisabled: {
    opacity: 0.7,
  },

  paymentSuccessBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  paymentSuccessSheet: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#052E16",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    elevation: 10,
  },

  paymentSuccessVideo: {
    width: "100%",
    height: 220,
    backgroundColor: "#052E16",
  },
  paymentBannerSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800" },
  statusWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    margin: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: { fontWeight: "900", fontSize: 13 },
  orderId: { fontSize: 20, fontWeight: "900", marginTop: 6 },

  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 18,
  },
  cardTitle: { fontSize: 16, fontWeight: "900", marginBottom: 12 },
  cardTitle2: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,

    paddingHorizontal: 8,
    paddingVertical: 4,

    borderRadius: 999,
    borderWidth: 1,

    alignSelf: "flex-start",
  },

  heading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 8,
    paddingRight: 8,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },

  detailContent: {
    flex: 1,
    marginLeft: 10,
  },

  detailLabel: {
    fontSize: 12,
  },

  detailValue: {
    fontSize: 14,
    fontWeight: "700",
    flexWrap: "wrap",
  },

  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  itemLabel: { fontSize: 14, fontWeight: "700" },
  itemPrice: { fontSize: 14, fontWeight: "800" },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 14 },
  summaryPrice: { fontSize: 14, fontWeight: "800" },

  divider: { height: 1, marginVertical: 10 },

  confirmRow: { flexDirection: "row", gap: 10 },
  confirmText: { fontWeight: "700", fontSize: 14 },

  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },

  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  deliveredBtn: {
    backgroundColor: "#22C55E", // green
  },

  rescheduleBtn: {
    backgroundColor: "#F59E0B", // amber
  },

  returnBtn: {
    backgroundColor: "#EF4444",
  },

  navigateBtn: {
    marginTop: 14,
    height: 40,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  navigateText: { fontWeight: "900", color: "#fff" },

  actionBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
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
});

const menuStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#00000055",
    justifyContent: "flex-start",
    paddingTop: 110,
    paddingRight: 16,
    alignItems: "flex-end",
  },

  sheet: {
    width: 160,
    borderRadius: 14,
    padding: 12,
    paddingTop: 12,
    elevation: 6,
  },

  closeIconBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
    padding: 4,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },

  menuText: {
    fontSize: 14,
    fontWeight: "700",
  },

  closeBtn: {
    marginTop: 6,
    paddingVertical: 10,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  closeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#00000066",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },
  sub: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 12,
  },
  dateBtn: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  dateText: {
    fontSize: 14,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },

  action: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  actionText: {
    color: "#fff",
    fontWeight: "800",
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },

  cancelTextDark: {
    color: "#374151",
    fontWeight: "900",
    fontSize: 14,
  },

  actionTextWhite: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },

  actionTextDark: {
    color: "#000",
    fontWeight: "900",
    fontSize: 14,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },

  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },

  gallerySheet: {
    backgroundColor: "#0B0B0C",
    paddingTop: 12,
    paddingHorizontal: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  galleryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  galleryFooter: {
    alignItems: "center",
    paddingVertical: 12,
  },
  closeIconBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
    padding: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: "#94A3B8",
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: "#ffffff",
  },
});

