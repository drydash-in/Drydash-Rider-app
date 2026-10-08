import { useNotification } from "@/context/NotificationContext";
import { useRiderData } from "@/context/RiderDataContext";
import { useAuth } from "@/context/useAuth";
import { playNotificationSound } from "@/services/notificationSound";
import { socket } from "@/services/socket";
import { API_RIDER_URL, API_V1_BASE_URL } from "@/constants/apiConfig";
import { useEffect } from "react";
import { AppState, InteractionManager } from "react-native";

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const { setPickups, setDeliveries, refreshActiveTrip } = useRiderData();
  const API_URL = API_RIDER_URL;
  const API_URL_ORDER = API_V1_BASE_URL;

  const getPickups = async () => {
    if (!user?.email) return;

    try {
      const res = await fetch(
        `${API_URL}/getriderpickups?email=${encodeURIComponent(user.email)}`,
        { headers: { "Content-Type": "application/json" } },
      );

      const data = await res.json();
      if (data && Array.isArray(data.Pickups)) {
        const filteredPickups = data.Pickups.filter((el: any) => {
          const elRiderId =
            el?.riderId?.toString() ||
            el?.assignedRider?.pickup?.riderId?.toString() ||
            el?.assignedRider?.riderId?.toString();
          if (elRiderId && user?._id) {
            return elRiderId === user._id.toString();
          }
          if (el?.riderName && user?.name) {
            return el.riderName.trim().toLowerCase() === user.name.trim().toLowerCase();
          }
          return false;
        });
        setPickups([...filteredPickups]);
      }
    } catch (err) {
      console.warn("getPickups error:", err);
    }
  };

  const getDelivery = async () => {
    if (!user?.email) return;

    try {
      const res = await fetch(
        `${API_URL_ORDER}/getOrdersByFilter?email=${encodeURIComponent(
          user.email,
        )}&status=delivery+rider+assigned&limit=1000&page=1`,
        { headers: { "Content-Type": "application/json" } },
      );

      const Orderdata = await res.json();
      if (Orderdata && Array.isArray(Orderdata.orders)) {
        const filteredOrders = Orderdata.orders.filter((el: any) => {
          const elRiderId =
            el?.riderId?.toString() ||
            el?.assignedRider?.delivery?.riderId?.toString() ||
            el?.assignedRider?.riderId?.toString();
          if (elRiderId && user?._id) {
            return elRiderId === user._id.toString();
          }
          if (el?.riderName && user?.name) {
            return el.riderName.trim().toLowerCase() === user.name.trim().toLowerCase();
          }
          return false;
        });
        const mapOrder = filteredOrders.map((el: any) => {
          return {
            id: el?._id,
            orderId: el?.order_id,
            name: el?.customerName,
            address: el?.address,
          };
        });
        setDeliveries([...mapOrder]);
      }
    } catch (err) {
      console.warn("getDelivery error:", err);
    }
  };

  useEffect(() => {
    const riderId = user?._id;
    if (!riderId) return;

    let isMounted = true;

    const handlePickupAssigned = async (payload: any) => {
      if (!isMounted) return;

      const pickup = payload?.pickup || payload;
      if (!pickup) return;

      console.log(
        "🔥 [SocketProvider] pickup assigned received:",
        pickup,
      );

      const pickupRiderId =
        payload?.riderId?.toString() ||
        pickup?.riderId?.toString() ||
        pickup?.assignedRider?.pickup?.riderId?.toString() ||
        pickup?.assignedRider?.riderId?.toString();

      const pickupRiderName = (
        payload?.riderName ||
        pickup?.riderName ||
        pickup?.assignedRider?.pickup?.riderName ||
        ""
      )
        .trim()
        .toLowerCase();

      const currentRiderId = user?._id ? user._id.toString() : null;
      const currentRiderName = user?.name ? user.name.trim().toLowerCase() : null;

      // Must be explicitly assigned to the currently logged in rider
      const isForCurrentRider = Boolean(
        (currentRiderId && pickupRiderId && currentRiderId === pickupRiderId) ||
        (currentRiderName && pickupRiderName && currentRiderName === pickupRiderName)
      );

      if (!isForCurrentRider) {
        console.log(
          "ℹ️ [SocketProvider] Pickup not for current rider. Pickup rider:",
          pickupRiderName || pickupRiderId,
          "Current user:",
          currentRiderName || currentRiderId,
        );
        return;
      }

      const shortId = pickup?._id
        ? String(pickup._id).slice(-5).toUpperCase()
        : "-----";

      // Immediately refresh active trip and tasks in real time
      if (user?._id) {
        refreshActiveTrip(user._id, user.email);
      }
      getPickups();

      notify?.({
        title: "New Pickup Assigned 🚀",
        message: `Pickup ID: WZP-${shortId}`,
        duration: 5000,
        data: {
          type: "pickup",
          pickupId: pickup._id,
          screen: "pickup",
        },
      });

      try {
        await playNotificationSound?.();
      } catch (e) {
        console.warn("🔊 play sound failed", e);
      }
    };

    console.log("🔌 [SocketProvider] Initializing socket for rider:", riderId);

    // helper to safely (re)attach a listener (removes previous to avoid duplicates)
    const safeOn = (event: string, handler: (...args: any[]) => void) => {
      try {
        socket.off(event);
        socket.on(event, handler);
      } catch (err) {
        console.warn(`[SocketProvider] safeOn error for ${event}:`, err);
      }
    };

    // --- Connection lifecycle handlers ---
    safeOn("connect", () => {
      if (!isMounted) return;
      console.log("✅ [SocketProvider] connected:", socket.id);
      socket.emit("joinRider", { riderId });
      console.log("✅ [SocketProvider] joinRider emitted:", riderId);
    });

    safeOn("connect_error", (err: any) => {
      console.error("❌ [SocketProvider] connect_error:", err?.message ?? err);
      setTimeout(() => {
        if (!socket.connected) {
          console.log("🔄 [SocketProvider] attempting manual reconnect...");
          socket.connect();
        }
      }, 3000);
    });

    safeOn("disconnect", (reason: any) => {
      console.log("⚠️ [SocketProvider] disconnected:", reason);
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    safeOn("reconnect", (attemptNumber: number) => {
      console.log(
        `🔄 [SocketProvider] reconnected after ${attemptNumber} attempts`,
      );
      if (user?._id) {
        socket.emit("joinRider", { riderId: user._id });
        refreshActiveTrip(user._id, user.email);
        getPickups();
        getDelivery();
      }
    });

    safeOn("reconnect_attempt", (attempt: number) =>
      console.log(`🔄 reconnect attempt ${attempt}`),
    );
    safeOn("reconnect_error", (err: any) =>
      console.error("❌ reconnect_error:", err),
    );
    safeOn("reconnect_failed", () => console.error("❌ reconnect_failed"));

    // --- Domain events ---
    safeOn("riderAssignedPickup", handlePickupAssigned); // room-based (targeted to rider)
    safeOn("assignedPickup", handlePickupAssigned); // when admin assigns pickup to rider

    safeOn("assignOrder", async ({ order }: { order: any }) => {
      if (!isMounted || !order) return;
      try {
        console.log("🔥 [SocketProvider] assignOrder received:", order);

        const orderRiderId =
          order?.riderId?.toString() ||
          order?.assignedRider?.delivery?.riderId?.toString() ||
          order?.assignedRider?.riderId?.toString();

        const orderRiderName = (
          order?.riderName ||
          order?.assignedRider?.delivery?.riderName ||
          ""
        )
          .trim()
          .toLowerCase();

        const currentRiderId = user?._id ? user._id.toString() : null;
        const currentRiderName = user?.name ? user.name.trim().toLowerCase() : null;

        // Must be explicitly assigned to current rider
        const isForCurrentRider = Boolean(
          (currentRiderId && orderRiderId && currentRiderId === orderRiderId) ||
          (currentRiderName && orderRiderName && currentRiderName === orderRiderName)
        );

        if (!isForCurrentRider) {
          console.log(
            "ℹ️ [SocketProvider] Order not for current rider. Order rider:",
            orderRiderName || orderRiderId,
            "Current user:",
            currentRiderName || currentRiderId,
          );
          return;
        }

        const mapped = {
          id: order._id,
          orderId: order.order_id,
          name: order.customerName,
          phone: order.contactNo,
          address: order.address,
        };

        // Immediately refresh active trip and tasks in real time
        if (user?._id) {
          refreshActiveTrip(user._id, user.email);
        }
        getDelivery();

        notify?.({
          title: "New Delivery Assigned 📦",
          message: `Order ID: ${mapped.orderId ?? mapped.id?.slice(-5)}`,
          duration: 5000,
          data: {
            type: "delivery",
            orderId: mapped.id,
            screen: "delivery",
          },
        });

        try {
          await playNotificationSound?.();
        } catch (e) {
          console.warn("🔊 play sound failed", e);
        }
      } catch (err) {
        console.error("❌ Error handling assignOrder:", err);
      }
    });

    safeOn("trip_assigned", () => {
      if (user?._id) refreshActiveTrip(user._id, user.email);
    });
    safeOn("trip_updated", () => {
      if (user?._id) refreshActiveTrip(user._id, user.email);
    });
    safeOn("pickup_rescheduled", () => {
      if (user?._id) refreshActiveTrip(user._id, user.email);
      getPickups();
    });
    safeOn("pickupCancelled", () => {
      if (user?._id) refreshActiveTrip(user._id, user.email);
      getPickups();
    });

    safeOn(
      "locationUpdateAck",
      ({ success, message }: { success: boolean; message?: string }) => {
        if (!isMounted) return;
        if (success) {
          console.log("📍 [SocketProvider] locationUpdateAck:", message);
        } else {
          console.warn("⚠️ [SocketProvider] locationUpdate failed:", message);
        }
      },
    );

    let connectTimer: ReturnType<typeof setTimeout> | null = null;
    const connectTask = InteractionManager.runAfterInteractions(() => {
      connectTimer = setTimeout(() => {
        if (!isMounted) return;

        // Make sure socket is connected (avoid double connect)
        if (!socket.connected) {
          console.log("🔌 [SocketProvider] connecting socket...");
          socket.connect();
        } else {
          // Re-join rooms if the socket was already connected (e.g. hot reload)
          socket.emit("joinRider", { riderId });
          socket.emit("joinAdmin");
        }

      }, 1000);
    });

    // cleanup
    return () => {
      isMounted = false;
      if (connectTimer) clearTimeout(connectTimer);
      connectTask.cancel();
      console.log("🧹 [SocketProvider] cleaning up socket listeners");
      [
        "connect",
        "connect_error",
        "disconnect",
        "reconnect",
        "reconnect_attempt",
        "reconnect_error",
        "reconnect_failed",
        "riderAssignedPickup",
        "assignedPickup",
        "addPickup",
        "assignOrder",
        "trip_assigned",
        "trip_updated",
        "pickup_rescheduled",
        "pickupCancelled",
        "locationUpdateAck",
      ].forEach((ev) => {
        try {
          socket.off(ev);
        } catch (e) {
          /* ignore */
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, user?.name, user?.email, socket]);

  // Handle app foreground reconnect & fresh sync
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        const riderId = user?._id;
        if (!riderId) return;

        if (!socket.connected) {
          socket.connect();
          socket.emit("joinRider", { riderId });
        }

        // 🔥 Seamlessly sync active trip and tasks when rider returns to app
        refreshActiveTrip(riderId, user.email);
        getPickups();
        getDelivery();
      }
    });

    return () => sub.remove();
  }, [user?._id, user?.email]);

  return <>{children}</>;
};