import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { query } from "../db/index.js";
import { verifyAdminToken } from "./auth.js";

export const MAX_DISTANCE_METRES = 50;
export const MAX_ACCURACY_METRES = 65;
export const CUSTOMER_ACCESS_COOKIE = "customer_access";

const JWT_SECRET = process.env.JWT_SECRET || "customer-location-gate-secret-key-default";

/**
 * Computes great-circle distance in metres between two coordinates using the Haversine formula.
 */
export function calculateDistanceMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export interface CafeCoordinates {
  isConfigured: boolean;
  latitude: number | null;
  longitude: number | null;
  restaurantName: string;
  address: string | null;
}

/**
 * Fetches the configured café coordinates from restaurant_settings.
 */
export async function getCafeCoordinates(): Promise<CafeCoordinates> {
  const res = await query(
    "SELECT restaurant_name, address, latitude, longitude FROM restaurant_settings LIMIT 1"
  );
  if (res.rows.length === 0) {
    return {
      isConfigured: false,
      latitude: null,
      longitude: null,
      restaurantName: "Kusum Kunja Café",
      address: null,
    };
  }

  const row = res.rows[0];
  const isConfigured =
    row.latitude !== null &&
    row.latitude !== undefined &&
    row.longitude !== null &&
    row.longitude !== undefined;

  return {
    isConfigured,
    latitude: isConfigured ? Number(row.latitude) : null,
    longitude: isConfigured ? Number(row.longitude) : null,
    restaurantName: row.restaurant_name || "Kusum Kunja Café",
    address: row.address || null,
  };
}

export interface LocationVerificationResult {
  valid: boolean;
  reason?: "NOT_CONFIGURED" | "OUT_OF_RANGE" | "POOR_ACCURACY" | "INVALID_COORDINATES";
  message: string;
  distance?: number;
  accuracy?: number;
  cafeLat?: number | null;
  cafeLon?: number | null;
  directionsUrl?: string;
}

/**
 * Verifies reported device coordinates against the café's configured location.
 * Does NOT persist or retain device coordinates.
 */
export async function verifyDeviceLocation(
  lat: any,
  lon: any,
  accuracy: any
): Promise<LocationVerificationResult> {
  const cafe = await getCafeCoordinates();

  if (!cafe.isConfigured || cafe.latitude === null || cafe.longitude === null) {
    return {
      valid: false,
      reason: "NOT_CONFIGURED",
      message: "Café coordinates are not yet configured. Customer location gate is active (closed).",
      cafeLat: null,
      cafeLon: null,
    };
  }

  const userLat = parseFloat(String(lat));
  const userLon = parseFloat(String(lon));
  const userAcc = accuracy !== undefined && accuracy !== null ? parseFloat(String(accuracy)) : 10;

  if (isNaN(userLat) || isNaN(userLon) || userLat < -90 || userLat > 90 || userLon < -180 || userLon > 180) {
    return {
      valid: false,
      reason: "INVALID_COORDINATES",
      message: "Invalid device coordinates reported.",
      cafeLat: cafe.latitude,
      cafeLon: cafe.longitude,
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${cafe.latitude},${cafe.longitude}`,
    };
  }

  // Check accuracy threshold: if accuracy circle is too large, it cannot prove proximity within 50m
  if (!isNaN(userAcc) && userAcc > MAX_ACCURACY_METRES) {
    return {
      valid: false,
      reason: "POOR_ACCURACY",
      message: `Device location accuracy is ±${Math.round(userAcc)}m, which is too poor to verify you are within 50 metres of the café.`,
      accuracy: Math.round(userAcc),
      cafeLat: cafe.latitude,
      cafeLon: cafe.longitude,
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${cafe.latitude},${cafe.longitude}`,
    };
  }

  const distance = calculateDistanceMetres(cafe.latitude, cafe.longitude, userLat, userLon);

  if (distance > MAX_DISTANCE_METRES) {
    return {
      valid: false,
      reason: "OUT_OF_RANGE",
      message: "Please visit our café to see the menu and place orders.",
      distance,
      accuracy: Math.round(userAcc),
      cafeLat: cafe.latitude,
      cafeLon: cafe.longitude,
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${cafe.latitude},${cafe.longitude}`,
    };
  }

  return {
    valid: true,
    message: "Device is within 50 metres of the café.",
    distance,
    accuracy: Math.round(userAcc),
    cafeLat: cafe.latitude,
    cafeLon: cafe.longitude,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${cafe.latitude},${cafe.longitude}`,
  };
}

export interface CustomerAccessPayload {
  type: "customer_location_verified";
  tableNumber: string | null;
  verifiedAt: number;
}

/**
 * Signs an opaque short-lived customer access token (30-minute validity).
 */
export function signCustomerAccessToken(tableNumber?: string | null): string {
  const payload: CustomerAccessPayload = {
    type: "customer_location_verified",
    tableNumber: tableNumber ? String(tableNumber).trim() : null,
    verifiedAt: Date.now(),
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30m" });
}

/**
 * Verifies a customer access token.
 */
export function verifyCustomerAccessToken(token: string): CustomerAccessPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded && decoded.type === "customer_location_verified") {
      return decoded as CustomerAccessPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sets the customer access token in an HttpOnly cookie.
 */
export function setCustomerAccessCookie(res: Response, token: string) {
  res.cookie(CUSTOMER_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Helper to check if a request comes from an authenticated admin.
 */
export function checkIsAdminRequest(req: Request): boolean {
  const token = req.cookies?.admin_session || req.headers.authorization?.replace(/^Bearer\s+/, "");
  if (!token) return false;
  const payload = verifyAdminToken(token);
  return payload?.role === "admin";
}

/**
 * Express middleware: requires valid customer location access OR admin authentication.
 * If location check fails or token is missing/expired, responds with 403 Forbidden.
 */
export async function requireCustomerLocationOrAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // 1. Admin bypass: Admin authentication remains completely separate
  if (checkIsAdminRequest(req)) {
    return next();
  }

  // 2. Check for fresh coordinates sent via headers (re-verifies on sensitive actions)
  const headerLat = req.headers["x-customer-lat"];
  const headerLon = req.headers["x-customer-lng"];
  const headerAcc = req.headers["x-customer-acc"];

  if (headerLat !== undefined && headerLon !== undefined) {
    const locResult = await verifyDeviceLocation(headerLat, headerLon, headerAcc);
    if (!locResult.valid) {
      res.status(403).json({
        error: "LOCATION_REQUIRED",
        reason: locResult.reason,
        message: locResult.message,
        distance: locResult.distance,
        directionsUrl: locResult.directionsUrl,
      });
      return;
    }
    // Location is freshly verified
    return next();
  }

  // 3. Check for verified customer access token in cookies or header
  const token =
    req.cookies?.[CUSTOMER_ACCESS_COOKIE] ||
    (req.headers["x-customer-token"] as string) ||
    req.headers.authorization?.replace(/^Customer\s+/, "");

  if (token) {
    const payload = verifyCustomerAccessToken(token);
    if (payload) {
      (req as any).customerAccess = payload;
      return next();
    }
  }

  // 4. Denied access
  const cafe = await getCafeCoordinates();
  res.status(403).json({
    error: "LOCATION_REQUIRED",
    reason: cafe.isConfigured ? "LOCATION_REQUIRED" : "NOT_CONFIGURED",
    message: cafe.isConfigured
      ? "Please visit our café to see the menu."
      : "Café coordinates are not yet configured. Please ask staff for assistance.",
    directionsUrl: cafe.isConfigured
      ? `https://www.google.com/maps/dir/?api=1&destination=${cafe.latitude},${cafe.longitude}`
      : undefined,
  });
}

