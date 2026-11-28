import mongoose from "mongoose";
import { basename } from "node:path";
import connectMongoDB from "../DB/ConnectMongodb.js";
import { importMusicArchive, requireMusicBucket } from "../lib/musicArchive.js";

try {
  const [, , upload, category = "tamil"] = process.argv;
  if (!upload) throw new Error("Usage: node Backend/scripts/import-music-archive.js <file> [category]");
  const storage = await requireMusicBucket();
  await connectMongoDB();
  const result = await importMusicArchive({ storage, upload, name: basename(upload), category,
    onProgress: ({ imported, failed, total }) => {
      if ((imported + failed) % 20 === 0) console.log(`Music archive: ${imported} imported, ${failed} failed, ${total} total`);
    },
  });
  console.log(JSON.stringify(result));
  if (result.failed) process.exitCode = 1;
} catch (error) {
  console.error(error.status ? error.message : `Music import failed: ${error.name}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
