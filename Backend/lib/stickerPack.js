import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { tmpdir } from "node:os";
import mongoose from "mongoose";
import sharp from "sharp";
import { importError, storeMusicObject, zipMedia } from "./musicArchive.js";
import { validateImageContainer } from "./uploadSafety.js";
import { createReadCache } from "./readCache.js";

const cache = createReadCache({ maxEntries: 1, ttlMs: 60_000 });
const collection = () => mongoose.connection.db.collection("stickerpacks");

export function activeStickerPack() {
  return cache.read("active", async () => (await collection().findOne({ _id: "active" }, {
    projection: { _id: 0, stickers: 1 },
  }))?.stickers ?? []);
}

export async function importStickerPack({ storage, upload, onProgress }) {
  const files = await zipMedia("stickers", upload);
  const directory = await mkdtemp(join(tmpdir(), "sticker-pack-"));
  const result = { total: files.length, imported: 0, failed: 0, errors: [] };
  const items = new Map();
  try {
    for (const [index, file] of files.entries()) {
      const raw = join(directory, "raw");
      await zipMedia("sticker-entry", upload, file, raw);
      const original = await readFile(raw);
      await rm(raw);
      const label = basename(file, extname(file)).replace(/[\u0000-\u001f\u202a-\u202e]/g, "").slice(0, 80) || `Sticker ${index + 1}`;
      let clean;
      try {
        validateImageContainer(original);
        const image = sharp(original, { animated: true, limitInputPixels: 20_000_000 });
        const { width, height, pageHeight, pages = 1 } = await image.metadata();
        if (pages > 150 || width * (pageHeight || height) * pages > 20_000_000) {
          throw importError("Sticker exceeds the animation or pixel limit.");
        }
        clean = await image.resize(320, 320, { fit: "inside", withoutEnlargement: true }).webp({ quality: 83 }).toBuffer();
      } catch (error) {
        result.failed++;
        result.errors.push({ title: basename(file).slice(0, 100), message: error.status ? error.message : "Image could not be decoded or exceeds the pixel limit." });
        onProgress?.({ ...result });
        continue;
      }
      const id = createHash("sha256").update(clean).digest("hex");
      if (!items.has(id)) {
        const target = join(directory, id);
        await writeFile(target, clean, { mode: 0o600 });
        items.set(id, { id, label, target, size: clean.length });
      }
    }
    if (!items.size) {
      const first = result.errors[0];
      throw importError(first ? `No usable stickers. ${first.title}: ${first.message}` : "No usable stickers in the ZIP.");
    }
    for (const { id, target, size } of items.values()) {
      await storeMusicObject(storage, `stickers/${id}.webp`, target, size, "image/webp");
      result.imported++;
      onProgress?.({ ...result });
    }
    const stickers = [...items.values()].map(({ id, label }) => ({ id, label }));
    await collection().replaceOne({ _id: "active" }, { _id: "active", stickers, updatedAt: new Date() }, { upsert: true });
    cache.invalidate("active");
    return result;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
