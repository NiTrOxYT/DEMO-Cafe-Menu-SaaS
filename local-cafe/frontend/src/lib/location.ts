/**
 * Customer Location Gate Utilities for Local Café
 * Enforces 50m radius check over HTTPS Geolocation.
 * Coordinates are verified on the fly and never stored or retained.
 */

export const MAX_DISTANCE_METRES = 50;
export const MAX_ACCURACY_METRES = 65;

export interface DeviceCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export type LocationErrorReason =
  | "NOT_CONFIGURED"
  | "PERMISSION_DENIED"
  | "POSITION_UNAVAILABLE"
  | "TIMEOUT"
  | "ACCURACY_TOO_LOW"
  | "OUT_OF_RANGE"
  | "UNKNOWN";

export interface LocationCheckResult {
  allowed: boolean;
  reason?: LocationErrorReason;
  message?: string;
  distance?: number;
  accuracy?: number;
  directionsUrl?: string | null;
}

/**
 * Calculates surface distance in metres between two coordinate pairs using Haversine formula.
 */
export function calculateHaversineDistance(
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

  return Math.round(R * c);
}

/**
 * Requests device coordinates from browser Geolocation API with high accuracy.
 */
export function getDeviceCoordinates(): Promise<DeviceCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject({
        code: "UNSUPPORTED",
        message: "Geolocation is not supported by your browser.",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 10,
        });
      },
      (err) => {
        let reason: LocationErrorReason = "UNKNOWN";
        let message = "Unable to retrieve device location.";

        switch (err.code) {
          case err.PERMISSION_DENIED:
            reason = "PERMISSION_DENIED";
            message = "Location access was denied. Please allow location permissions to view the café menu.";
            break;
          case err.POSITION_UNAVAILABLE:
            reason = "POSITION_UNAVAILABLE";
            message = "Location signal is currently unavailable. Please check your device GPS / location settings.";
            break;
          case err.TIMEOUT:
            reason = "TIMEOUT";
            message = "Location check timed out. Please retry in a moment.";
            break;
        }

        reject({ reason, message, rawCode: err.code });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

