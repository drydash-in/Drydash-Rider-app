const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");


export const API_BASE_URL = trimTrailingSlash(
  process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.shiptos.com"
);

export const API_V1_BASE_URL = `${API_BASE_URL}/api/v1`;
export const API_AUTH_URL = `${API_V1_BASE_URL}/auth`;
export const API_RIDER_URL = `${API_V1_BASE_URL}/rider`;

export const WATI_BASE_URL =
  process.env.EXPO_PUBLIC_WATI_BASE_URL || "https://live-server-101289.wati.io/api/v1";

export const WATI_TOKEN =
  process.env.EXPO_PUBLIC_WATI_TOKEN ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1bmlxdWVfbmFtZSI6ImF5dXNoc2luZ2g4NDIwMThAZ21haWwuY29tIiwibmFtZWlkIjoiYXl1c2hzaW5naDg0MjAxOEBnbWFpbC5jb20iLCJlbWFpbCI6ImF5dXNoc2luZ2g4NDIwMThAZ21haWwuY29tIiwiYXV0aF90aW1lIjoiMTIvMDgvMjAyNSAwNzoyMzo1MyIsInRlbmFudF9pZCI6IjEwMTI4OSIsImRiX25hbWUiOiJtdC1wcm9kLVRlbmFudHMiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOlsiVEVNUExBVEVfTUFOQUdFUiIsIkRFVkVMT1BFUiIsIkFVVE9NQVRJT05fTUFOQUdFUiJdLCJleHAiOjI1MzQwMjMwMDgwMCwiaXNzIjoiQ2xhcmVfQUkiLCJhdWQiOiJDbGFyZV9BSSJ9.NpVe1fi-RXRuNgCAGzFQLZT6dE7Y-rvlx1SYxLKZ_m4";

export const S3_IMAGES_BASE_URL =
  process.env.EXPO_PUBLIC_S3_IMAGES_BASE_URL ||
  "https://drydash-app-images.s3.ap-south-1.amazonaws.com/rider-images/washrzimages/";
