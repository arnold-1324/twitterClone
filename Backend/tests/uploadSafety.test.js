import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { validateDocument, validateImageContainer } from "../lib/uploadSafety.js";

test("accepts a complete raster and rejects trailing bytes even with a repeated end marker", async () => {
  const raster = await sharp({ create: { width: 8, height: 8, channels: 3, background: "teal" } }).png().toBuffer();
  expect(() => validateImageContainer(raster)).not.toThrow();
  expect(() => validateImageContainer(Buffer.concat([raster, Buffer.from("extra"), raster.subarray(-12)])))
    .toThrow(/end marker/);
  expect(() => validateImageContainer(Buffer.from("<svg/>"))).toThrow(/Image signature/);
});

test("checks supported UTF-8 attachments and rejects active markup and generic archives", async () => {
  const directory = await mkdtemp(join(tmpdir(), "upload-safety-"));
  try {
    await expect(validateDocument({ buffer: Buffer.from("hello") }, { extension: "txt" }, directory)).resolves.toBeUndefined();
    await expect(validateDocument({ buffer: Buffer.from("&lt;script&gt;marker&lt;/script&gt;") },
      { extension: "txt" }, directory)).rejects.toThrow(/active markup/);
    await expect(validateDocument({ buffer: Buffer.from("archive") }, { extension: "zip" }, directory))
      .rejects.toThrow(/dedicated music or sticker/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
