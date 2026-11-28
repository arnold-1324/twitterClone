import { decrypt, encrypt } from "./utils/Msg_encryption/encrypt.js";

export const liveLocationDuration = 15 * 60 * 1000;

export function readCoordinates(value) {
  const { latitude, longitude } = value ?? {};
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90
    || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;
  return { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) };
}

export function sealCoordinates(coordinates) {
  const { iv, encryptedData } = encrypt(JSON.stringify(coordinates));
  return { iv, encryptedData };
}

export function presentLocation(location, now = Date.now()) {
  if (!location) return undefined;
  const { mode, updatedAt, expiresAt, stoppedAt, revision } = location;
  const result = { mode, updatedAt, expiresAt, stoppedAt, revision };
  if (mode === "live" && (stoppedAt || !(new Date(expiresAt).getTime() > now))) return result;
  try {
    const coordinates = readCoordinates(JSON.parse(decrypt(location)));
    return { ...result, ...coordinates };
  } catch {
    return result;
  }
}
