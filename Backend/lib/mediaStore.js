import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, statfs, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { isImage, isVideo } from "./utils/uploader.js";
import { legacyMediaUrl, deleteLegacyMedia } from "./legacyMedia.js";
import { transcodeAudio, transcodeVideo } from "./videoPipeline.js";
import { musicBucket } from "./musicStorage.js";
import { bucketMediaMetadata, removeBucketMedia, saveBucketMedia } from "./bucketMedia.js";
import { validateDocument, validateImageContainer } from "./uploadSafety.js";
import { attachmentDetails } from "./filePreview.js";

const localId = /^[a-f0-9]{64}$/;
const localKey = /^local\/([a-f0-9]{64})$/;
const bucketKey = /^bucket\/([a-f0-9]{64})$/;
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
  if (bucketKey.test(key)) return `/api/media/${key}`;
  if (localKey.test(key)) return `/api/media/${key.slice(6)}`;
  return legacyMediaUrl(key);
}

export function streamUrl(key) {
  return typeof key === "string" && (localKey.test(key) || bucketKey.test(key))
    ? `/api/media/${key.replace(/^local\//, "")}/master.m3u8` : undefined;
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

export async function saveMedia(file, { kind, conversationId, messageId, groupId, storyId, chatBackground = false, signal } = {}) {
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
    const bucket = process.env.MUSIC_S3_BUCKET && musicBucket();
    let useBucket = Boolean(storyId && bucket);
    if (!useBucket) {
      await mkdir(root, { recursive: true, mode: 0o700 });
      const free = await statfs(root);
      if (free.bavail * free.bsize < 256 * 1024 * 1024) {
        if (!bucket) throw Object.assign(new Error("Media storage is full."), { status: 503 });
        useBucket = true;
      }
    }
    temporary = await mkdtemp(join(useBucket ? tmpdir() : root, ".upload-"));
    let source = "content";
    let contentType = "application/octet-stream";
    const attachment = uploadKind === "file" ? attachmentDetails(file.originalname, file.buffer.length) : undefined;
    signal?.throwIfAborted();
    if (uploadKind === "image") {
      const image = sharp(file.buffer, { animated: !chatBackground, limitInputPixels: 36_000_000 });
      let encoded;
      let metadata;
      try {
        if (!isImage(file)) throw new Error("Unsupported image format.");
        metadata = await image.metadata();
        validateImageContainer(file.buffer, metadata.format);
        if (chatBackground && (metadata.pages ?? 1) > 1) {
          throw Object.assign(new Error("Choose a still image for the chat background."), { status: 415 });
        }
        if (metadata.width * (metadata.pageHeight || metadata.height) * (metadata.pages || 1) > 36_000_000) {
          throw new Error("Image exceeds the resolution limit.");
        }
        encoded = await image.autoOrient().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80, effort: 3 }).toBuffer();
      } catch (error) {
        if (error.status) throw error;
        throw Object.assign(new Error("Choose a readable image within the resolution limit."), { status: 415 });
      }
      source += ".webp";
      contentType = "image/webp";
      await writeFile(join(temporary, source), encoded, { mode: 0o600 });
    } else if (isVideoUpload) {
      await transcodeVideo(file, temporary, storyId ? 60 : 180, signal);
      source = "video.mp4";
      contentType = "video/mp4";
    } else {
      if (uploadKind === "audio") {
        if (!audioMime(file)) throw Object.assign(new Error("Audio signature does not match the uploaded file."), { status: 415 });
        await transcodeAudio(file, temporary, signal);
        source = "audio.mp3";
        contentType = "audio/mpeg";
      } else {
        await validateDocument(file, attachment, temporary, signal);
        await rm(join(temporary, "pdf-inspect"), { force: true });
        await writeFile(join(temporary, source), file.buffer, { mode: 0o600 });
      }
    }
    const download = attachment?.name;
    const metadata = {
      kind: uploadKind, source, contentType, download, attachment,
      ...(isChat && { conversationId: String(conversationId), messageId: String(messageId) }),
      ...(chatBackground && { conversationId: String(conversationId), chatBackground: true }),
      ...(groupId && { groupId: String(groupId) }),
      ...(storyId && { storyId: String(storyId) }),
    };
    if (useBucket) {
      await saveBucketMedia(id, temporary, metadata, signal);
      return { key: `bucket/${id}`, kind: uploadKind, attachment };
    }
    await writeFile(join(temporary, "metadata.json"), JSON.stringify(metadata), { mode: 0o600 });
    await rename(temporary, join(root, id));
    temporary = undefined;
    return { key: `local/${id}`, kind: uploadKind, attachment };
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

export async function findMedia(id, asset, inBucket = false) {
  if (!localId.test(id)) return null;
  const directory = join(storageRoot(), id);
  let metadata;
  try {
    metadata = inBucket ? await bucketMediaMetadata(id) : JSON.parse(await readFile(join(directory, "metadata.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (!metadata) return null;
  const key = `${inBucket ? "bucket" : "local"}/${id}`;
  const location = (file) => inBucket ? { file, bucketId: id } : { path: join(directory, file) };
  if (!asset) return { ...metadata, key, ...location(metadata.source) };
  if (metadata.kind !== "video") return null;
  const type = Object.hasOwn(assetTypes, asset) ? assetTypes[asset]
    : /^(low|medium|high)\.m3u8$/.test(asset) ? "application/vnd.apple.mpegurl"
      : /^(low|medium|high)-\d{4}\.ts$/.test(asset) ? "video/mp2t" : null;
  return type && (!inBucket || metadata.files.includes(asset))
    ? { ...metadata, key, ...location(asset), contentType: type } : null;
}

export async function describeAttachment(key) {
  const remote = typeof key === "string" && bucketKey.exec(key);
  const id = remote?.[1] || (typeof key === "string" && localKey.exec(key)?.[1]);
  if (!id) return attachmentDetails("Attachment");
  const media = await findMedia(id, undefined, Boolean(remote));
  return media?.attachment ?? attachmentDetails(media?.download);
}

export async function removeMedia(keys) {
  const distinct = [...new Set(keys)].filter((key) => typeof key === "string" && key && !remoteUrl.test(key));
  const removed = await Promise.all(distinct.map(async (key) => {
    try {
      const id = localKey.exec(key)?.[1];
      const remote = bucketKey.exec(key)?.[1];
      if (remote) await removeBucketMedia(remote);
      else if (id) await rm(join(storageRoot(), id), { recursive: true, force: true });
      else await deleteLegacyMedia(key);
      return true;
    } catch (error) {
      console.error("Media cleanup failed:", error.code || error.name);
      return false;
    }
  }));
  return removed.every(Boolean);
}
