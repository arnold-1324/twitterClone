import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, statfs } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import mongoose from "mongoose";
import connectMongoDB from "../DB/ConnectMongodb.js";
import { importMusicArchive, requireMusicBucket } from "../lib/musicArchive.js";

const url = "https://github.com/arnold-1324/twitterClone/releases/download/music-library-v1/local_library.zip";
const size = 534_706_568;
const digest = "65db0ce0d6fe3d00d588c290ece3ae6c067d943dbd6d3cf6e943fe6e5f246e62";
let directory;
try {
  const storage = await requireMusicBucket();
  const space = await statfs(tmpdir());
  if (space.bavail * space.bsize < size + 180 * 1024 * 1024) throw new Error("Insufficient temporary space for the music release.");
  directory = await mkdtemp(join(tmpdir(), "social-music-release-"));
  const upload = join(directory, "local_library.zip");
  const signal = AbortSignal.timeout(240_000);
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) throw new Error(`GitHub release download failed (HTTP ${response.status}).`);
  const hash = createHash("sha256");
  let received = 0;
  const verify = new Transform({
    transform(chunk, _encoding, done) {
      received += chunk.length;
      hash.update(chunk);
      done(received > size ? new Error("Music release exceeded its expected size.") : null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body), verify, createWriteStream(upload, { mode: 0o600 }), { signal });
  if (received !== size || hash.digest("hex") !== digest) throw new Error("The music release checksum differs from the requested archive.");
  await connectMongoDB();
  const result = await importMusicArchive({ storage, upload, name: "local_library.zip", category: "tamil",
    onProgress: ({ imported, failed, total }) => {
      if ((imported + failed) % 10 === 0) console.log(`Music release: ${imported} imported, ${failed} failed, ${total} total`);
    },
  });
  console.log(`Music release complete: ${result.imported} imported, ${result.failed} failed.`);
  for (const { title, message } of result.errors) console.warn(`Music release: ${title}: ${message}`);
  if (result.failed) process.exitCode = 1;
} catch (error) {
  console.error("Music release:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
}
