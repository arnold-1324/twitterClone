import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, statfs, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { isImage, isVideo } from "./utils/uploader.js";
import { legacyMediaUrl, deleteLegacyMedia } from "./legacyMedia.js";
import { transcodeVideo } from "./videoPipeline.js";

const localId = /^[a-f0-9]{64}$/;
const localKey = /^local\/([a-f0-9]{64})$/;
const remoteUrl = /^https?:\/\//i;
const assetTypes = {
  "master.m3u8": "application/vnd.apple.mpegurl",
  "video.mp4": "video/mp4",
};
const defaultDirectory = fileURLToPath(new URL("../../.dayline-media", import.meta.url));
const storageRoot = () => resolve(process.env.MEDIA_DIR || defaultDirectory);
let videosInProgress = 0;

export async function mediaUrl(key) {
  if (typeof key !== "string" || !key) return "";
  if (remoteUrl.test(key)) return key;
  if (key.startsWith("/api/media/")) return key;
  if (localKey.test(key)) return `/api/media/${key.slice(6)}`;
  return legacyMediaUrl(key);
}

export function streamUrl(key) {
  const id = typeof key === "string" && localKey.exec(key)?.[1];
  return id ? `/api/media/${id}/master.m3u8` : undefined;
}

function audioMime({ buffer, mimetype }) {
  const mime = mimetype.split(";")[0];
  if (mime === "audio/webm" && buffer.subarray(0, 4).toString("hex") === "1a45dfa3") return mime;
  if (mime === "audio/ogg" && buffer.subarray(0, 4).toString("ascii") === "OggS") return mime;
  if (mime === "audio/mp4" && buffer.subarray(4, 8).toString("ascii") === "ftyp") return mime;
  if (["audio/wav", "audio/x-wav"].includes(mime) && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WAVE") return "audio/wav";
  if (mime === "audio/mpeg" && (buffer.subarray(0, 3).toString("ascii") === "ID3"
    || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0))) return mime;
  return "";
}

export async function saveMedia(file, { kind, conversationId, messageId, groupId } = {}) {
  const isChat = Boolean(conversationId && messageId);
  const uploadKind = kind || (isImage(file) ? "image" : isVideo(file) ? "video" : audioMime(file) ? "audio" : "file");
  const isVideoUpload = uploadKind === "video";
  if (isVideoUpload && videosInProgress >= 2) {
    throw Object.assign(new Error("Video processing is busy. Try again shortly."), { status: 503 });
  }
  if (isVideoUpload) videosInProgress++;
  let temporary;
  try {
    const id = randomBytes(32).toString("hex");
    const root = storageRoot();
    await mkdir(root, { recursive: true, mode: 0o700 });
    const free = await statfs(root);
    if (free.bavail * free.bsize < 256 * 1024 * 1024) throw Object.assign(new Error("Media storage is full."), { status: 503 });
    temporary = await mkdtemp(join(root, ".upload-"));
    let source = "content";
    let contentType = "application/octet-stream";
    if (uploadKind === "image") {
      const image = sharp(file.buffer, { animated: true, limitInputPixels: 36_000_000 });
      let encoded;
      let metadata;
      try {
        if (!isImage(file)) throw new Error("Unsupported image format.");
        metadata = await image.metadata();
        if (metadata.width * (metadata.pageHeight || metadata.height) * (metadata.pages || 1) > 36_000_000) {
          throw new Error("Image exceeds the resolution limit.");
        }
        encoded = await image.autoOrient().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80, effort: 3 }).toBuffer();
      } catch {
        throw Object.assign(new Error("Choose a readable image within the resolution limit."), { status: 415 });
      }
      const keepJpeg = metadata.format === "jpeg" && file.buffer.length < encoded.length
        && Math.max(metadata.width, metadata.height) <= 1800 && !metadata.exif && !metadata.iptc && !metadata.xmp;
      source += keepJpeg ? ".jpg" : ".webp";
      contentType = keepJpeg ? "image/jpeg" : "image/webp";
      await writeFile(join(temporary, source), keepJpeg ? file.buffer : encoded, { mode: 0o600 });
    } else if (isVideoUpload) {
      await transcodeVideo(file, temporary);
      source = "video.mp4";
      contentType = "video/mp4";
    } else {
      if (uploadKind === "audio") contentType = audioMime(file);
      await writeFile(join(temporary, source), file.buffer, { mode: 0o600 });
    }
    const download = uploadKind === "file" ? (file.originalname || "attachment").replace(/[\u0000-\u001f\u007f/\\]/g, "").slice(0, 160) || "attachment" : undefined;
    const metadata = {
      kind: uploadKind, source, contentType, download,
      ...(isChat && { conversationId: String(conversationId), messageId: String(messageId) }),
      ...(groupId && { groupId: String(groupId) }),
    };
    await writeFile(join(temporary, "metadata.json"), JSON.stringify(metadata), { mode: 0o600 });
    await rename(temporary, join(root, id));
    temporary = undefined;
    return { key: `local/${id}`, kind: uploadKind };
  } catch (error) {
    if (["EACCES", "ENOSPC", "EROFS", "EIO"].includes(error.code)) {
      throw Object.assign(new Error("Media storage is temporarily unavailable."), { status: 503 });
    }
    throw error;
  } finally {
    if (isVideoUpload) videosInProgress--;
    if (temporary) await rm(temporary, { recursive: true, force: true }).catch(() => {});
  }
}

export async function findMedia(id, asset) {
  if (!localId.test(id)) return null;
  const directory = join(storageRoot(), id);
  let metadata;
  try {
    metadata = JSON.parse(await readFile(join(directory, "metadata.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (!asset) return { ...metadata, path: join(directory, metadata.source) };
  if (metadata.kind !== "video") return null;
  const type = Object.hasOwn(assetTypes, asset) ? assetTypes[asset]
    : /^(low|medium|high)\.m3u8$/.test(asset) ? "application/vnd.apple.mpegurl"
      : /^(low|medium|high)-\d{4}\.ts$/.test(asset) ? "video/mp2t" : null;
  return type ? { ...metadata, path: join(directory, asset), contentType: type } : null;
}

export async function removeMedia(keys) {
  const distinct = [...new Set(keys)].filter((key) => typeof key === "string" && key && !remoteUrl.test(key));
  await Promise.all(distinct.map(async (key) => {
    try {
      const id = localKey.exec(key)?.[1];
      if (id) await rm(join(storageRoot(), id), { recursive: true, force: true });
      else await deleteLegacyMedia(key);
    } catch (error) {
      console.error("Media cleanup failed:", error.code || error.name);
    }
  }));
}
