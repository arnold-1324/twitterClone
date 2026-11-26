import { afterEach, beforeEach, expect, test } from "@jest/globals";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import request from "supertest";
import { findMedia, mediaUrl, removeMedia, saveMedia } from "../lib/mediaStore.js";

process.env.ENCRYPTION_SECRET = "test-encryption-secret";
const { default: app } = await import("../app.js");

let directory;
let previousDirectory;

beforeEach(async () => {
  previousDirectory = process.env.MEDIA_DIR;
  directory = await mkdtemp(join(tmpdir(), "dayline-test-"));
  process.env.MEDIA_DIR = directory;
});

afterEach(async () => {
  if (previousDirectory === undefined) delete process.env.MEDIA_DIR;
  else process.env.MEDIA_DIR = previousDirectory;
  await rm(directory, { recursive: true, force: true });
});

test("compresses an image and serves the same local URL until deletion", async () => {
  const buffer = await sharp({ create: { width: 900, height: 450, channels: 3, background: "#714154" } }).png().toBuffer();
  const { key } = await saveMedia({ buffer, mimetype: "image/png" });
  const url = await mediaUrl(key);
  const media = await findMedia(key.slice(6));
  const compressed = await readFile(media.path);
  expect(compressed.length).toBeLessThan(buffer.length);
  expect(await sharp(compressed).metadata()).toMatchObject({ width: 900, height: 450, format: "webp" });
  await request(app).get(url).expect(200).expect("Content-Type", "image/webp");
  await request(app).get(url).set("Range", "bytes=0-7").expect(206).expect("Content-Range", /^bytes 0-7\//);
  await request(app).get(url + "/metadata.json").expect(404);
  await removeMedia([key]);
  await request(app).get(url).expect(404);
});

test("requires authentication for chat and group media and cleans failed writes", async () => {
  const buffer = Buffer.from("test attachment");
  const { key } = await saveMedia({ buffer, mimetype: "text/plain", originalname: "example.txt" }, {
    conversationId: "68235a2b97abbb8e9cd037c8", messageId: "68235a2b97abbb8e9cd037c9",
  });
  await request(app).get(await mediaUrl(key)).expect(401).expect("Cache-Control", "no-store");

  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
  const group = await saveMedia({ buffer: png, mimetype: "image/png" }, { groupId: "68235a2b97abbb8e9cd037ca" });
  await request(app).get(await mediaUrl(group.key)).expect(401);
  await expect(saveMedia({ buffer, mimetype: "image/png" }, { kind: "image" })).rejects.toMatchObject({ status: 415 });
  expect(await readdir(directory)).toHaveLength(2);
});
