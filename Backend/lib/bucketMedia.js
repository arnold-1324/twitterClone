import { measureObjectStorage } from "./requestMetrics.js";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { musicBucket } from "./musicStorage.js";
import { createReadCache } from "./readCache.js";

const metadataName = "metadata.json";
const cache = createReadCache({ maxEntries: 256, ttlMs: 20_000 });
const objectKey = (id, file) => `uploads/v1/${id}/${file}`;
const unavailable = () => Object.assign(new Error("Media storage is temporarily unavailable."), { status: 503 });
const missing = (error) => error.$metadata?.httpStatusCode === 404;

async function object(Command, id, name, input = {}, signal = AbortSignal.timeout(10_000)) {
  const storage = musicBucket();
  if (!storage) throw unavailable();
  return measureObjectStorage(() => storage.client.send(new Command({ Bucket: storage.bucket, Key: objectKey(id, name), ...input }), { abortSignal: signal }));
}

function contentType(file, metadata) {
  if (file === metadata.source) return metadata.contentType;
  return file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
}

async function deleteFiles(id, names) {
  const storage = musicBucket();
  if (!storage) throw unavailable();
  const result = await storage.client.send(new DeleteObjectsCommand({ Bucket: storage.bucket,
    Delete: { Quiet: true, Objects: names.map((name) => ({ Key: objectKey(id, name) })) },
  }), { abortSignal: AbortSignal.timeout(15_000) });
  if (result.Errors?.length) throw unavailable();
}

export async function saveBucketMedia(id, directory, metadata, signal) {
  const files = await readdir(directory);
  try {
    for (let index = 0; index < files.length; index += 6) {
      const batch = await Promise.allSettled(files.slice(index, index + 6).map(async (file) => {
        const path = join(directory, file);
        await object(PutObjectCommand, id, file, { Body: createReadStream(path),
          ContentLength: (await stat(path)).size, ContentType: contentType(file, metadata),
        }, signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000));
      }));
      if (batch.some((result) => result.status === "rejected")) throw unavailable();
    }
    signal?.throwIfAborted();
    const body = Buffer.from(JSON.stringify({ ...metadata, files }));
    await object(PutObjectCommand, id, metadataName, { Body: body, ContentType: "application/json" });
  } catch (error) {
    await deleteFiles(id, [...files, metadataName]).catch(() => {});
    console.warn("Bucket media upload failed:", error.name, error.$metadata?.httpStatusCode);
    throw unavailable();
  }
}

export async function bucketMediaMetadata(id) {
  return cache.read(id, async () => {
    try {
      const result = await object(GetObjectCommand, id, metadataName);
      return JSON.parse(await result.Body.transformToString());
    } catch (error) {
      if (missing(error)) return null;
      throw unavailable();
    }
  });
}

export async function removeBucketMedia(id) {
  cache.invalidate(id);
  const metadata = await bucketMediaMetadata(id);
  if (!metadata) return;
  await deleteFiles(id, metadata.files);
  await deleteFiles(id, [metadataName]);
  cache.invalidate(id);
}

export async function sendBucketMedia(media, req, res, next) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const timer = setTimeout(cancel, 10_000);
  res.once("close", cancel);
  try {
    const head = req.method === "HEAD";
    const result = await object(head ? HeadObjectCommand : GetObjectCommand,
      media.bucketId, media.file, { Range: req.headers.range }, controller.signal);
    clearTimeout(timer);
    if (result.ContentRange) res.set("Content-Range", result.ContentRange);
    if (result.ContentLength !== undefined) res.set("Content-Length", String(result.ContentLength));
    res.set("Accept-Ranges", "bytes").status(result.ContentRange ? 206 : 200);
    if (head) return res.end();
    await pipeline(result.Body, res, { signal: controller.signal });
  } catch (error) {
    if (res.headersSent || res.destroyed) return;
    for (const header of ["Content-Type", "Content-Disposition", "Content-Length"]) res.removeHeader(header);
    res.set("Cache-Control", "no-store");
    if (missing(error)) return res.sendStatus(404);
    if (error.$metadata?.httpStatusCode === 416) return res.sendStatus(416);
    return next(unavailable());
  } finally {
    clearTimeout(timer);
    res.off("close", cancel);
  }
}
