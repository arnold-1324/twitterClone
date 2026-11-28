import express from "express";
import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, statfs, truncate, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { isAppOwner as allowed } from "../lib/adminAccess.js";
import { protectRoute } from "../middleware/protectRoute.js";
import { limitResource } from "../lib/rateLimits.js";
import { importStickerPack } from "../lib/stickerPack.js";
import { musicCategories } from "../models/musicLibrary.model.js";
import { importError, importFileType, importMusicArchive, requireMusicBucket } from "../lib/musicArchive.js";

const router = express.Router();
const MiB = 1024 * 1024;
const chunkBytes = 4 * MiB;
const maxZip = 1024 * MiB;
const maxAudio = 128 * MiB;
const idle = 30 * 60 * 1000;
let job;
let creating = false;

const present = ({ id, name, bytes, received, stage, result, error }) => ({
  id, name, bytes, received, stage, result, error, chunkBytes,
});

function removeScratch(current) {
  clearTimeout(current.timer);
  return rm(current.directory, { recursive: true, force: true });
}

function expire(current) {
  clearTimeout(current.timer);
  current.timer = setTimeout(() => {
    if (job !== current || current.stage !== "uploading") return;
    if (current.writing) return expire(current);
    job = undefined;
    void removeScratch(current).catch(() => {});
  }, idle);
  current.timer.unref();
}

router.get("/access", protectRoute, limitResource, (req, res) => res.json({ allowed: allowed(req.user) }));
router.use(protectRoute, (req, res, next) => allowed(req.user) ? next() : res.sendStatus(404));

router.get("/imports", limitResource, (_req, res) => res.json(job ? present(job) : null));

router.post("/imports", limitResource, async (req, res, next) => {
  const { filename, bytes, category, pack = "music" } = req.body ?? {};
  const name = typeof filename === "string" ? basename(filename.replace(/\\/g, "/")).trim() : "";
  const type = importFileType(name);
  if (!["music", "stickers"].includes(pack) || (pack === "stickers" && type !== ".zip") || !type || name.length > 180 || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > (type === ".zip" ? maxZip : maxAudio)
    || (pack === "music" && !musicCategories.includes(category))) return next(importError("Choose an audio file or ZIP within the upload limit."));
  if (creating || ["uploading", "processing"].includes(job?.stage)) return next(importError("Another music import is active.", 409));
  creating = true;
  let directory;
  try {
    const storage = await requireMusicBucket();
    const space = await statfs(tmpdir());
    if (space.bavail * space.bsize < bytes + 180 * MiB) throw importError("There is insufficient temporary import space.", 503);
    directory = await mkdtemp(join(tmpdir(), "social-music-upload-"));
    const upload = join(directory, "upload");
    await writeFile(upload, "", { mode: 0o600 });
    job = { id: randomUUID(), name, bytes, received: 0, category, pack, directory, upload, storage, stage: "uploading" };
    expire(job);
    return res.status(201).json(present(job));
  } catch (error) {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
    return next(error);
  } finally {
    creating = false;
  }
});

router.put("/imports/:id/chunks/:offset", async (req, res, next) => {
  const current = job;
  if (!current || current.id !== req.params.id) return res.sendStatus(404);
  const offset = /^\d+$/.test(req.params.offset) ? Number(req.params.offset) : -1;
  const length = Math.min(chunkBytes, current.bytes - current.received);
  if (current.stage !== "uploading" || current.writing || offset !== current.received) {
    return res.status(409).json(present(current));
  }
  if (length <= 0 || !req.is("application/octet-stream") || (req.headers["content-length"] !== undefined && Number(req.headers["content-length"]) !== length)) {
    return next(importError("Send the next complete upload chunk."));
  }
  current.writing = true;
  let bytes = 0;
  const count = new Transform({
    transform(chunk, _encoding, done) {
      bytes += chunk.length;
      done(bytes > length ? importError("Upload chunk is too large.") : null, chunk);
    },
  });
  try {
    await pipeline(req, count, createWriteStream(current.upload, { flags: "r+", start: offset }));
    if (bytes !== length) throw importError("Upload chunk was incomplete.");
    current.received += bytes;
    expire(current);
    return res.json(present(current));
  } catch (error) {
    await truncate(current.upload, current.received).catch(() => {});
    if (!res.destroyed) return next(error);
  } finally {
    current.writing = false;
  }
});

router.post("/imports/:id/process", limitResource, (req, res, next) => {
  const current = job;
  if (!current || current.id !== req.params.id) return res.sendStatus(404);
  if (current.stage === "processing" || current.stage === "finished") return res.json(present(current));
  if (current.stage !== "uploading" || current.writing || current.received !== current.bytes) {
    return next(importError("Finish uploading the file first.", 409));
  }
  current.stage = "processing";
  clearTimeout(current.timer);
  const processUpload = current.pack === "stickers" ? importStickerPack : importMusicArchive;
  void processUpload({ ...current, onProgress: (result) => { current.result = result; } })
    .then((result) => {
      current.result = result;
      current.stage = "finished";
    })
    .catch((error) => {
      current.error = error.status ? error.message : "The music import failed.";
      current.stage = "failed";
    })
    .finally(() => removeScratch(current).catch(() => {}));
  return res.status(202).json(present(current));
});

router.delete("/imports/:id", limitResource, async (req, res, next) => {
  const current = job;
  if (!current || current.id !== req.params.id) return res.sendStatus(404);
  if (current.stage === "processing" || current.writing) return next(importError("The current operation is still running.", 409));
  job = undefined;
  await removeScratch(current).catch(() => {});
  return res.sendStatus(204);
});

export default router;
