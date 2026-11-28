import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { basename, extname, join } from "node:path";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { HeadBucketCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { validateImageContainer } from "./uploadSafety.js";
import { musicBucket } from "./musicStorage.js";
import { LibraryTrack, musicCategories } from "../models/musicLibrary.model.js";
import { invalidateMusicCatalog, musicWords } from "./hostedMusic.js";

const run = promisify(execFile);
const zipTool = fileURLToPath(new URL("../scripts/music-zip.py", import.meta.url));
const ff = ["-v", "error", "-protocol_whitelist", "file,pipe"];
const audioExtensions = [".mp3", ".flac", ".m4a", ".wav", ".ogg", ".opus", ".aac"];
const hash = (value) => createHash("sha256").update(value).digest("hex");
export const importError = (message, status = 400) => Object.assign(new Error(message), { status });
export const importFileType = (name) => {
  const extension = extname(name).toLowerCase();
  return extension === ".zip" || audioExtensions.includes(extension) ? extension : null;
};

export async function requireMusicBucket() {
  const storage = musicBucket();
  if (!storage) throw importError("Connect an S3 bucket to import music.", 503);
  try {
    await storage.client.send(new HeadBucketCommand({ Bucket: storage.bucket }), { abortSignal: AbortSignal.timeout(8000) });
  } catch {
    throw importError("The music bucket is unavailable. Check its Railway credentials.", 503);
  }
  return storage;
}

export async function zipMedia(command, archive, ...args) {
  try {
    const { stdout } = await run("python3", [zipTool, command, archive, ...args], { timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
    return ["plan", "stickers"].includes(command) ? JSON.parse(stdout) : undefined;
  } catch (error) {
    const reason = error.stderr?.trim().slice(0, 250);
    throw importError(error.killed ? "ZIP exceeded the inspection deadline." :
      reason || "Could not inspect the ZIP. Check its structure and compression type.");
  }
}

async function audioMetadata(target, format) {
  const { stdout } = await run("ffprobe", [...ff, "-f", format, "-show_format", "-show_streams", "-of", "json", target],
    { timeout: 15000, maxBuffer: 1024 * 1024 });
  const probe = JSON.parse(stdout);
  const audio = probe.streams?.find(({ codec_type }) => codec_type === "audio");
  const duration = Math.floor(Number(probe.format?.duration));
  if (probe.streams?.some((stream) => stream.codec_type !== "audio" && !stream.disposition?.attached_pic)) {
    throw importError("Audio file contains an unexpected non-audio stream.");
  }
  if (!audio || !Number.isFinite(duration) || duration < 5 || duration > 20 * 60) {
    throw importError("Use an audio recording between 5 seconds and 20 minutes.");
  }
  return { duration, audio, tags: { ...audio.tags, ...probe.format?.tags },
    cover: probe.streams?.find((stream) => stream.disposition?.attached_pic)?.index };
}

function line(value, limit = 180) {
  return (Array.isArray(value) ? value.filter((item) => typeof item === "string").join(", ") : typeof value === "string" || typeof value === "number" ? String(value) : "")
    .replace(/[\u0000-\u001f]/g, " ").trim().slice(0, limit);
}

function webUrl(value) {
  try {
    const result = new URL(value);
    if (result.protocol === "https:" && !result.username && !result.password) return result.href;
  } catch { /* Optional metadata. */ }
  return undefined;
}

function catalogFields(row, tags, chosenCategory) {
  const tag = Object.fromEntries(Object.entries({ ...tags, ...(row.tags && !Array.isArray(row.tags) ? row.tags : {}) })
    .map(([key, value]) => [key.toLowerCase(), line(value)]));
  const title = line(row.title) || tag.title || line(basename(row.file, extname(row.file)));
  const artist = line(row.artists ?? row.artist) || tag.artist || tag.album_artist || "Unknown artist";
  const album = line(row.album) || tag.album || "";
  const composer = line(row.composer) || tag.composer || "";
  const year = (line(row.year) || tag.date || tag.year || "").match(/^(?:18|19|20)\d{2}/)?.[0];
  const genre = tag.genre || "";
  const language = musicWords(tag.language || genre);
  const category = musicCategories.includes(row.category) ? row.category
    : ["tamil", "hindi", "english", "malayalam"].includes(language) ? language : chosenCategory;
  const labels = [...new Set([genre, tag.language, tag.lyricist,
    ...(Array.isArray(row.tags) ? row.tags.slice(0, 10).map((item) => line(item, 60)) : [])].filter(Boolean))];
  const searchText = musicWords([title, artist, album, composer, year, category, ...labels].filter(Boolean).join(" "));
  const metadata = Object.fromEntries(["albumartist", "tracknumber", "discnumber", "lyricist", "conductor", "author",
    "language", "date", "bpm", "compilation", "version"].filter((name) => tag[name]).map((name) => [name, tag[name]]));
  return { title, artist, album, composer, year, genre, category, tags: labels, metadata, searchText,
    license: line(row.license, 60) || "Library upload", source: webUrl(row.source), licenseUrl: webUrl(row.licenseUrl) };
}

export async function storeMusicObject(storage, key, file, bytes, contentType) {
  const request = { Bucket: storage.bucket, Key: key };
  try {
    const head = await storage.client.send(new HeadObjectCommand(request), { abortSignal: AbortSignal.timeout(10000) });
    if (head.ContentLength === bytes) return;
  } catch (error) {
    if (error.$metadata?.httpStatusCode !== 404) throw error;
  }
  await storage.client.send(new PutObjectCommand({ ...request, ContentLength: bytes, ContentType: contentType,
    Body: createReadStream(file) }), { abortSignal: AbortSignal.timeout(35000) });
}

async function fileHash(file) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest("hex");
}

async function saveArtwork(storage, archive, path, audio, cover, directory) {
  const input = join(directory, "cover");
  const output = join(directory, "artwork.webp");
  if (path) await zipMedia("entry", archive, path, input);
  else if (cover !== undefined) {
    await run("ffmpeg", [...ff, "-nostdin", "-i", audio, "-map", `0:${cover}`, "-frames:v", "1",
      "-vf", "scale='min(768,iw)':-2", "-f", "image2", "-c:v", "mjpeg", input], { timeout: 12000 });
  } else return null;
  const original = await readFile(input);
  validateImageContainer(original);
  const image = sharp(original, { limitInputPixels: 24_000_000 });
  const picture = await image.autoOrient()
    .resize(512, 512, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  await writeFile(output, picture);
  const key = `music/artwork/${hash(picture)}.webp`;
  await storeMusicObject(storage, key, output, picture.length, "image/webp");
  return key;
}

async function importTrack({ storage, upload, row, isZip, category, artwork, scratch }) {
  const directory = await mkdtemp(join(scratch, "track-"));
  try {
    const input = isZip ? join(directory, "input") : upload;
    if (isZip) await zipMedia("entry", upload, row.file, input);
    const digest = await fileHash(input);
    if (/^[a-f0-9]{64}$/i.test(row._id ?? "") && row._id.toLowerCase() !== digest) {
      throw importError("Track checksum does not match tracks.json.");
    }
    const id = `library:${digest.slice(0, 32)}`;
    const formats = { ".mp3": "mp3", ".flac": "flac", ".m4a": "mov", ".wav": "wav", ".ogg": "ogg", ".opus": "ogg", ".aac": "aac" };
    const format = formats[extname(row.file).toLowerCase()];
    const { duration, tags, cover } = await audioMetadata(input, format)
      .catch((error) => { throw error.status ? error : importError("Audio is damaged or does not match its declared format."); });
    const track = catalogFields(row, tags, category);
    const target = join(directory, "audio.mp3");
    await run("ffmpeg", [...ff, "-nostdin", "-f", format, "-i", input, "-map", "0:a:0", "-map_metadata", "-1",
      "-map_chapters", "-1", "-c:a", "libmp3lame", "-b:a", "128k", "-ac", "2", target],
      { timeout: 70000, maxBuffer: 1024 * 1024 });
    const bytes = (await stat(target)).size;
    const objectKey = `music/audio/${digest}.mp3`;
    let artworkKey = artwork.get(row.image);
    if (!artworkKey && (row.image || cover !== undefined)) {
      artworkKey = await saveArtwork(storage, upload, row.image, input, cover, directory);
      if (row.image && artworkKey) artwork.set(row.image, artworkKey);
    }
    await storeMusicObject(storage, objectKey, target, bytes, "audio/mpeg");
    await LibraryTrack.updateOne({ _id: id }, { $set: { ...track, objectKey, bytes, duration,
      ...(artworkKey && { artworkKey }) } }, { upsert: true, runValidators: true });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function importMusicArchive({ storage, upload, name, category, onProgress = () => {} }) {
  if (!importFileType(name) || !musicCategories.includes(category)) throw importError("Choose a supported file and category.");
  const isZip = importFileType(name) === ".zip";
  const rows = isZip ? await zipMedia("plan", upload) : [{ file: basename(name) }];
  const result = { total: rows.length, imported: 0, failed: 0, errors: [] };
  onProgress(result);
  const scratch = await mkdtemp(join(tmpdir(), "social-music-work-"));
  const artwork = new Map();
  try {
    for (const row of rows) {
      try {
        await importTrack({ storage, upload, row, isZip, category, artwork, scratch });
        result.imported++;
      } catch (error) {
        result.failed++;
        if (result.errors.length < 12) {
          result.errors.push({ title: line(row.title) || basename(row.file),
            message: error.status ? error.message : error.$metadata ? "Storage rejected the track." : "Could not read the recording." });
        }
      }
      onProgress(result);
    }
    return result;
  } finally {
    invalidateMusicCatalog();
    await rm(scratch, { recursive: true, force: true });
  }
}
