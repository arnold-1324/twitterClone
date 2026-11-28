import { measureObjectStorage } from "./requestMetrics.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { getLibraryAudio, isLibraryId } from "./hostedMusic.js";
import { musicBucket } from "./musicStorage.js";
import { bucketStorage } from "./legacyMedia.js";

export const libraryDirectory = () => resolve(process.env.MEDIA_DIR || ".dayline-media", "music-library");
const onVolume = /^volume\/([a-f0-9]{64}\.mp3)$/;

function rangeFor(value, bytes) {
  if (typeof value !== "string") return undefined;
  const parts = /^bytes=(\d{0,15})-(\d{0,15})$/.exec(value);
  if (!parts || (!parts[1] && !parts[2])) return null;
  const start = parts[1] ? Number(parts[1]) : Math.max(0, bytes - Number(parts[2]));
  const end = parts[1] && parts[2] ? Math.min(bytes - 1, Number(parts[2])) : bytes - 1;
  return start <= end ? { start, end } : null;
}

export async function streamLibraryAudio(req, res, next) {
  const id = `library:${req.params.id}`;
  if (!isLibraryId(id)) return res.sendStatus(404);
  const abort = new AbortController();
  const cancel = () => abort.abort();
  res.once("close", cancel);
  try {
    const track = await getLibraryAudio(id);
    if (!track) return res.sendStatus(404);
    const local = onVolume.exec(track.objectKey)?.[1];
    if (local) return res.set("Content-Type", "audio/mpeg").sendFile(join(libraryDirectory(), local), {
      maxAge: "1d",
    }, (error) => { if (error) next(error); });
    const range = rangeFor(req.headers.range, track.bytes);
    const headers = {
      "Accept-Ranges": "bytes", "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=86400, no-transform",
    };
    if (range === null) return res.set("Content-Range", `bytes */${track.bytes}`).sendStatus(416);
    const storage = track.objectKey.startsWith("music/audio/") ? musicBucket() : bucketStorage();
    if (!storage) return res.status(503).json({ error: "Music playback is temporarily unavailable." });
    const rangeHeader = range ? `bytes=${range.start}-${range.end}` : undefined;
    const status = range ? 206 : 200;
    if (req.method === "HEAD") {
      if (range) headers["Content-Range"] = `${rangeHeader.replace("=", " ")}/${track.bytes}`;
      headers["Content-Length"] = range ? range.end - range.start + 1 : track.bytes;
      return res.set(headers).status(status).end();
    }
    const timer = setTimeout(cancel, 8000);
    let object;
    try {
      object = await measureObjectStorage(() => storage.client.send(new GetObjectCommand({
        Bucket: storage.bucket, Key: track.objectKey, Range: rangeHeader,
      }), { abortSignal: abort.signal }));
    } finally {
      clearTimeout(timer);
    }
    if (object.ContentRange) headers["Content-Range"] = object.ContentRange;
    headers["Content-Length"] = object.ContentLength;
    res.set(headers).status(status);
    await pipeline(object.Body, res, { signal: abort.signal });
  } catch (error) {
    if (res.headersSent || res.destroyed) return;
    if (error.name === "AbortError" || error.$metadata) {
      return res.status(503).json({ error: "Music playback is temporarily unavailable." });
    }
    return next(error);
  } finally {
    res.off("close", cancel);
  }
}

export function streamLibraryArtwork(req, res, next) {
  return streamArtwork(req, res, next, "music/artwork");
}

export function streamStickerArtwork(req, res, next) {
  return streamArtwork(req, res, next, "stickers");
}

async function streamArtwork(req, res, next, prefix) {
  const { file } = req.params;
  if (!/^[a-f0-9]{64}\.webp$/.test(file)) return res.sendStatus(404);
  const storage = musicBucket();
  if (!storage) return res.sendStatus(404);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const timeout = setTimeout(cancel, 8000);
  res.once("close", cancel);
  try {
    const object = await measureObjectStorage(() => storage.client.send(new GetObjectCommand({
      Bucket: storage.bucket, Key: `${prefix}/${file}`,
    }), { abortSignal: controller.signal }));
    res.set({ "Content-Type": "image/webp", "Content-Length": object.ContentLength,
      "Cache-Control": "public, max-age=31536000, immutable" });
    await pipeline(object.Body, res, { signal: controller.signal });
  } catch (error) {
    if (res.headersSent || res.destroyed) return;
    if (error.$metadata?.httpStatusCode === 404) return res.sendStatus(404);
    if (error.$metadata || error.name === "AbortError") return res.sendStatus(503);
    return next(error);
  } finally {
    clearTimeout(timeout);
    res.off("close", cancel);
  }
}
