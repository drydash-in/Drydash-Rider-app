import { apiClient, API_BASE_URL } from "@/constants/axiosInstance";

export type VRPStopType = "depot" | "pickup" | "delivery";

export type VRPStop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: VRPStopType;
  price: number;
  item_types: string[];
  delivery_weight: number;
  index: number;
  status?: string;
  completed?: boolean;
  address?: string;
  contact?: string;
  slot?: string;
  pickupDate?: string;
  deliveryDate?: string;
  pickupDelay?: any;
  deliveryEstimation?: any;
  isRescheduled?: boolean;
  rescheduledDate?: string;
  raw?: any;
};

export type VRPRiderInfo = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  plantName: string;
};

export type VRPTrip = {
  _id: string;
  batchId: string;
  rosterId: string;
  riderId: VRPRiderInfo;
  routeIndex: number;
  stopCount: number;
  distanceKm: number;
  durationHours: number;
  stops: VRPStop[];
  status: "assigned" | "in_progress" | "completed" | string;
  assignedAt: string;
  completedAt?: string | null;
};

export type VRPTripResponse = {
  status: string;
  count: number;
  data: VRPTrip[];
};

export const vrpTripService = {
  /**
   * Fetch assigned VRP trip for a rider, falling back to ERP assigned tasks/deliveries if VRP is empty
   * 1. GET api.shiptos.com/api/v1/vrp-trips/rider/{{riderId}}
   * 2. Fallback GET api.shiptos.com/api/v1/tasks/pickup/assigned?email={{email}}
   * 3. Fallback GET api.shiptos.com/api/v1/getOrdersByFilter?email={{email}}&status=delivery+rider+assigned&limit=100&page=1
   */
  async getAssignedTrip(riderId: string, email?: string): Promise<VRPTrip | null> {
    try {
      const response = await apiClient.get<VRPTripResponse>(
        `/vrp-trips/rider/${riderId}`
      );

      if (
        response.data &&
        response.data.data &&
        response.data.data.length > 0 &&
        response.data.data[0].stops &&
        response.data.data[0].stops.some((s) => s.type !== "depot")
      ) {
        console.log("VRP Trip Data Received:", response.data);
        return response.data.data[0];
      }

      console.log("No VRP trip data found, attempting ERP fallback for email:", email);
      return await this.getFallbackTrip(riderId, email);
    } catch (error) {
      console.warn("vrpTripService.getAssignedTrip error, attempting ERP fallback:", error);
      return await this.getFallbackTrip(riderId, email);
    }
  },

  /**
   * ERP Fallback: Fetch manually assigned Pickups and Deliveries and map to unified VRPTrip format
   */
  async getFallbackTrip(riderId: string, email?: string): Promise<VRPTrip | null> {
    if (!email) return null;
    try {
     

      console.log("encode email+++++++++++++",email)

      // Fetch assigned pickups and deliveries in parallel
      const [pickupRes, deliveryRes] = await Promise.all([
        fetch(`${API_BASE_URL}/rider/getRiderPickups?email=${email}`, {
          headers: { "Content-Type": "application/json", "x-client-type": "mobile" },
        }).then((r) => r.json()).catch(() => null),

        fetch(`${API_BASE_URL}/getOrdersByFilter?email=${email}&status=delivery+rider+assigned&limit=100&page=1`, {
          headers: { "Content-Type": "application/json", "x-client-type": "mobile" },
        }).then((r) => r.json()).catch(() => null),
      ]);

      console.log("this is the pickupRes and deliveryRes",pickupRes,deliveryRes)

      const pickupItems = pickupRes?.Pickups || pickupRes?.data || [];
      const deliveryItems = deliveryRes?.orders || deliveryRes?.data?.orders || deliveryRes?.data || [];

      if (!pickupItems.length && !deliveryItems.length) {
        console.log("No ERP fallback pickups or deliveries found for email:", email);
        return null;
      }

      const stops: VRPStop[] = [];
      let index = 1;

      // Map ERP Pickups to VRPStop format
      pickupItems.forEach((p: any) => {
        const statusStr = (p.PickupStatus || p.status || "").toString().toLowerCase().trim();
        const isDone =
          statusStr === "complete" ||
          statusStr === "completed" ||
          statusStr === "picked_up" ||
          statusStr === "picked-up" ||
          statusStr === "picked up" ||
          statusStr === "done" ||
          p.completed === true;
        stops.push({
          id: p._id,
          name: p.Name || "Pickup Task",
          lat: p.pickupLocation?.latitude || 0,
          lng: p.pickupLocation?.longitude || 0,
          type: "pickup",
          price: p.totalAmount || 0,
          item_types: Array.isArray(p.items) ? p.items.map((i: any) => i.label || i.type || "") : [],
          delivery_weight: 0,
          index: index++,
          status: isDone ? "completed" : "pending",
          completed: isDone,
          address: p.Address || p.deliveryAddress || "Pickup Location Address",
          contact: p.Contact || p.contactPhone || "",
          slot: p.slot || p.pickupDelay?.revisedSlot || p.pickupDelay?.originalSlot || undefined,
          pickupDate: p.pickup_date || undefined,
          pickupDelay: p.pickupDelay || undefined,
          deliveryEstimation: p.deliveryEstimation || undefined,
          isRescheduled: p.isRescheduled || false,
          rescheduledDate: p.rescheduledDate || undefined,
          raw: p,
        });
      });

      // Map ERP Deliveries to VRPStop format
      deliveryItems.forEach((d: any) => {
        const statusStr = (d.status || "").toString().toLowerCase().trim();
        const isDone =
          statusStr === "delivered" ||
          statusStr === "complete" ||
          statusStr === "completed" ||
          statusStr === "done" ||
          d.completed === true;
        stops.push({
          id: d._id || d.order_id,
          name: d.customerName || d.Name || "Delivery Task",
          lat: d.deliveryLocation?.latitude || d.location?.latitude || 0,
          lng: d.deliveryLocation?.longitude || d.location?.longitude || 0,
          type: "delivery",
          price: d.totalAmount || d.price || 0,
          item_types: Array.isArray(d.items) ? d.items.map((i: any) => i.label || i.type || "") : [],
          delivery_weight: 0,
          index: index++,
          status: isDone ? "completed" : "pending",
          completed: isDone,
          address: d.address || d.Address || "Delivery Location Address",
          contact: d.contactNo || d.Contact || "",
          slot: d.deliveryTimeSlot || d.slot || d.deliveryEstimation?.estimatedDeliveryTime || undefined,
          deliveryDate: d.deliveryDate || undefined,
          deliveryEstimation: d.deliveryEstimation || undefined,
          isRescheduled: d.isRescheduled || false,
          rescheduledDate: d.rescheduledDate || undefined,
          raw: d,
        });
      });

      console.log(`Mapped ${stops.length} ERP tasks into unified VRP structure`);

      return {
        _id: "manual_erp_trip_" + riderId,
        batchId: "manual_batch",
        rosterId: "manual_roster",
        riderId: {
          _id: riderId,
          name: "Rider",
          email: email,
          phone: "",
          role: "rider",
          plantName: "",
        },
        routeIndex: 1,
        stopCount: stops.length,
        distanceKm: 0,
        durationHours: 0,
        stops: stops,
        status: "in_progress",
        assignedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error("vrpTripService.getFallbackTrip error:", err);
      return null;
    }
  },

  /**
   * Get stops filtered by type from a trip
   */
  getPickups(trip: VRPTrip | null): VRPStop[] {
    if (!trip || !trip.stops) return [];
    return trip.stops.filter((s) => s.type === "pickup");
  },

  getDeliveries(trip: VRPTrip | null): VRPStop[] {
    if (!trip || !trip.stops) return [];
    return trip.stops.filter((s) => s.type === "delivery");
  },

  getDepots(trip: VRPTrip | null): VRPStop[] {
    if (!trip || !trip.stops) return [];
    return trip.stops.filter((s) => s.type === "depot");
  },
};
