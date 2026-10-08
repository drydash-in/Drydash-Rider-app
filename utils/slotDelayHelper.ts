import moment from "moment";

export interface PickupSlotDelayInfo {
  slotText: string | null;
  isDelayed: boolean;
  delayText: string | null;
  originalSlotText: string | null;
  revisedSlotText: string | null;
  reason: string | null;
  category: string | null;
  formattedPickupDate: string | null;
}

export interface DeliverySlotDelayInfo {
  slotText: string | null;
  isDelayed: boolean;
  delayText: string | null;
  originalSlotText: string | null;
  revisedSlotText: string | null;
  reason: string | null;
  formattedDeliveryDate: string | null;
}

export const getPickupSlotAndDelayInfo = (item: any): PickupSlotDelayInfo => {
  if (!item) {
    return {
      slotText: null,
      isDelayed: false,
      delayText: null,
      originalSlotText: null,
      revisedSlotText: null,
      reason: null,
      category: null,
      formattedPickupDate: null,
    };
  }

  const raw = item.raw || item;
  const delayObj = raw.pickupDelay || item.pickupDelay;

  const isDelayed = Boolean(
    delayObj?.isDelayed ||
    (typeof delayObj?.delayMinutes === "number" && delayObj.delayMinutes > 0) ||
    (typeof delayObj?.delayHours === "number" && delayObj.delayHours > 0)
  );

  const rawSlot = item.slot || raw.slot;
  const originalSlot = delayObj?.originalSlot || rawSlot;
  const revisedSlot = delayObj?.revisedSlot || delayObj?.revisedLabel || delayObj?.extendedEndTime;

  let delayText: string | null = null;
  if (isDelayed) {
    const hours = delayObj?.delayHours || 0;
    const mins = delayObj?.delayMinutes || 0;
    if (hours > 0 && mins > 0) {
      delayText = `+${hours}h ${mins % 60}m`;
    } else if (hours > 0) {
      delayText = `+${hours}h`;
    } else if (mins > 0) {
      delayText = `+${mins}m`;
    } else {
      delayText = "Delayed";
    }
  }

  const mainSlot = (revisedSlot && revisedSlot !== "NA" ? revisedSlot : null) ||
                   (rawSlot && rawSlot !== "NA" ? rawSlot : null) ||
                   (originalSlot && originalSlot !== "NA" ? originalSlot : null);

  const pickupDate = raw.pickup_date || item.pickupDate || delayObj?.originalPickupDate;
  const formattedPickupDate = pickupDate ? moment(pickupDate).format("DD MMM YYYY") : null;

  return {
    slotText: mainSlot || null,
    isDelayed,
    delayText,
    originalSlotText: originalSlot && originalSlot !== "NA" ? originalSlot : null,
    revisedSlotText: revisedSlot && revisedSlot !== "NA" ? revisedSlot : null,
    reason: delayObj?.reason || null,
    category: delayObj?.category || null,
    formattedPickupDate,
  };
};

export const getDeliverySlotAndDelayInfo = (item: any): DeliverySlotDelayInfo => {
  if (!item) {
    return {
      slotText: null,
      isDelayed: false,
      delayText: null,
      originalSlotText: null,
      revisedSlotText: null,
      reason: null,
      formattedDeliveryDate: null,
    };
  }

  const raw = item.raw || item;
  const estimation = raw.deliveryEstimation || item.deliveryEstimation;

  const isDelayed = Boolean(
    estimation?.isSlotDelayed ||
    (typeof estimation?.delayHours === "number" && estimation.delayHours > 0)
  );

  const rawSlot = item.slot || raw.deliveryTimeSlot || raw.slot || estimation?.estimatedDeliveryTime;
  const originalSlot = estimation?.originalDeliveryTime || estimation?.originalDeliveryLabel || rawSlot;
  const estimatedTime = estimation?.estimatedDeliveryTime || estimation?.deliveryLabel || rawSlot;

  let delayText: string | null = null;
  if (isDelayed) {
    const hours = estimation?.delayHours || 0;
    delayText = hours > 0 ? `+${hours}h Delay` : "Delayed";
  }

  const delayHistory = estimation?.delayHistory || [];
  const latestReason = delayHistory.length > 0 ? delayHistory[delayHistory.length - 1]?.reason : null;

  const deliveryDate = raw.deliveryDate || item.deliveryDate || estimation?.estimatedDeliveryDate;
  const formattedDeliveryDate = deliveryDate ? moment(deliveryDate).format("DD MMM YYYY") : null;

  return {
    slotText: estimatedTime || rawSlot || null,
    isDelayed,
    delayText,
    originalSlotText: originalSlot || null,
    revisedSlotText: estimatedTime || null,
    reason: latestReason || null,
    formattedDeliveryDate,
  };
};
