import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rename, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { HeadBucketCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import mongoose from "mongoose";
import connectMongoDB from "../DB/ConnectMongodb.js";
import { LibraryTrack, musicCategories } from "../models/musicLibrary.model.js";
import { bucketStorage } from "../lib/legacyMedia.js";
import { musicWords } from "../lib/hostedMusic.js";
import { libraryDirectory } from "../lib/libraryAudio.js";

const run = promisify(execFile);
const maxBytes = 48 * 1024 * 1024;
const usage = "Usage: node Backend/scripts/import-music.js MANIFEST.json [--volume]";
const license = /^(?:CC BY [1-4]\.0|CC0 1\.0|Public domain|Licensed)$/;

function https(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Expected an HTTPS source or license URL.");
  return url;
}

function validate(row) {
  if (!row || !musicCategories.includes(row.category) || !license.test(row.license)
    || [row.title, row.artist].some((text) => typeof text !== "string" || !text.trim() || text.length > 180)
    || Boolean(row.audio) === Boolean(row.file)) throw new Error("Invalid title, artist, category, license, or audio input.");
  https(row.source);
  https(row.licenseUrl);
  const tags = row.tags ?? [];
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string" || tag.length > 60) || tags.length > 16) {
    throw new Error("Invalid tags.");
  }
  if (row.album !== undefined && (typeof row.album !== "string" || row.album.length > 180)) throw new Error("Invalid album.");
}

async function sourceFor(row, directory, target) {
  if (row.file) return resolve(directory, row.file);
  const url = https(row.audio);
  if (url.host !== "upload.wikimedia.org" || !url.pathname.startsWith("/wikipedia/commons/") || url.search || url.hash) {
    throw new Error("Use a local licensed recording or a Wikimedia Commons audio URL.");
  }
  const signal = AbortSignal.timeout(35_000);
  const result = await fetch(url, { signal, redirect: "error",
    headers: { "User-Agent": "SocialAppMusic/1.0 (+https://twitterclone-production-67bad283.up.railway.app/)" } });
  if (!result.ok || !result.body || Number(result.headers.get("content-length")) > maxBytes) {
    await result.body?.cancel();
    throw new Error(`Audio download rejected (HTTP ${result.status}).`);
  }
  let bytes = 0;
  const bounded = new Transform({
    transform(chunk, _encoding, done) {
      bytes += chunk.length;
      done(bytes > maxBytes ? new Error("Recording is too large.") : null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(result.body), bounded, createWriteStream(target), { signal });
  return target;
}

async function prepare(row, manifest, directory) {
  const source = await sourceFor(row, dirname(manifest), join(directory, "source"));
  if ((await stat(source)).size > maxBytes) throw new Error("Recording is too large.");
  const target = join(directory, "track.mp3");
  const options = { timeout: 70_000, maxBuffer: 1024 * 1024 };
  const ff = ["-v", "error", "-protocol_whitelist", "file,pipe"];
  const data = await run("ffprobe", [...ff, "-show_entries", "format=duration", "-of", "csv=p=0", source], options);
  const duration = Math.floor(Number(data.stdout.trim()));
  if (!Number.isFinite(duration) || duration < 5 || duration > 20 * 60) throw new Error("Use a recording between 5 seconds and 20 minutes.");
  await run("ffmpeg", [...ff, "-nostdin", "-i", source, "-map", "0:a:0", "-map_metadata", "-1", "-t", String(duration),
    "-codec:a", "libmp3lame", "-b:a", "128k", "-y", target], options);
  const { size: bytes } = await stat(target);
  const checksum = createHash("sha256").update(await readFile(target)).digest("hex");
  const _id = `library:${createHash("sha256").update(row.source + "\n" + checksum).digest("hex").slice(0, 32)}`;
  return { _id, checksum, target, duration, bytes };
}

async function storeAudio(storage, key, prepared, localDirectory) {
  if (localDirectory) {
    const pending = join(localDirectory, `.${process.pid}-${prepared.checksum}`);
    try {
      await copyFile(prepared.target, pending);
      await rename(pending, join(localDirectory, `${prepared.checksum}.mp3`));
    } finally {
      await rm(pending, { force: true });
    }
    return;
  }
  const { client, bucket: Bucket } = storage;
  const request = { Bucket, Key: key };
  try {
    const head = await client.send(new HeadObjectCommand(request), { abortSignal: AbortSignal.timeout(12_000) });
    if (head.ContentLength === prepared.bytes) return;
  } catch (error) {
    if (error.$metadata?.httpStatusCode !== 404) throw error;
  }
  await client.send(new PutObjectCommand({
    ...request, Body: createReadStream(prepared.target), ContentLength: prepared.bytes, ContentType: "audio/mpeg",
  }), { abortSignal: AbortSignal.timeout(40_000) });
}

async function main(manifest, volume) {
  if (!manifest) throw new Error(usage);
  const entries = JSON.parse(await readFile(manifest, "utf8"));
  if (!Array.isArray(entries) || !entries.length || entries.length > 5000) throw new Error("Choose a manifest containing 1 to 5000 recordings.");
  entries.forEach(validate);
  const storage = volume ? null : bucketStorage();
  const localDirectory = volume ? libraryDirectory() : null;
  if (volume) {
    await mkdir(localDirectory, { recursive: true });
  } else {
    if (!storage) throw new Error("S3 bucket credentials are unavailable.");
    await storage.client.send(new HeadBucketCommand({ Bucket: storage.bucket }), { abortSignal: AbortSignal.timeout(12_000) });
  }
  await connectMongoDB();
  await LibraryTrack.init();
  let failures = 0;
  for (const row of entries) {
    const directory = await mkdtemp(join(tmpdir(), "music-import-"));
    try {
      const { _id, checksum, duration, bytes, target } = await prepare(row, resolve(manifest), directory);
      const objectKey = `${volume ? "volume" : "music"}/${checksum}.mp3`;
      await storeAudio(storage, objectKey, { checksum, target, bytes }, localDirectory);
      const { title, artist, album, category, tags = [], license, licenseUrl, source } = row;
      const searchText = musicWords([title, artist, album, category, ...tags].filter(Boolean).join(" "));
      await LibraryTrack.updateOne({ _id }, { $set: {
        title, artist, album, category, tags, license, licenseUrl, source, duration, objectKey, bytes, searchText,
      } }, { upsert: true, runValidators: true });
      console.log(`Imported ${category} · ${title}`);
    } catch (error) {
      failures++;
      console.error(`Import failed for ${row.title}:`, error.$metadata ? `${error.name} (HTTP ${error.$metadata.httpStatusCode})` : error.message);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  console.log("Catalog totals:", Object.fromEntries((await LibraryTrack.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ])).map(({ _id, count }) => [_id, count])));
  if (failures) process.exitCode = 1;
}

try {
  const [, , manifest, option] = process.argv;
  if (option && option !== "--volume") throw new Error(usage);
  await main(manifest, option === "--volume");
} catch (error) {
  console.error("Catalog import:", error.$metadata ? `${error.name} (HTTP ${error.$metadata.httpStatusCode})` : error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
