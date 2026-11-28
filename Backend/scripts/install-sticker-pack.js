import mongoose from "mongoose";
import connectMongoDB from "../DB/ConnectMongodb.js";
import { requireMusicBucket } from "../lib/musicArchive.js";
import { importStickerPack } from "../lib/stickerPack.js";

const [upload] = process.argv.slice(2);
if (!upload) throw new Error("Provide the path to a sticker ZIP.");

try {
  await connectMongoDB();
  const storage = await requireMusicBucket();
  const result = await importStickerPack({
    storage,
    upload,
    onProgress({ imported, total }) {
      if (imported && imported % 25 === 0) console.log(`Stored ${imported} of ${total} sticker entries.`);
    },
  });
  console.log(`Sticker pack active: ${result.imported} stickers, ${result.failed} rejected.`);
  for (const { title, message } of result.errors) console.log(JSON.stringify({ title, message }));
} catch (error) {
  console.error(error.status ? error.message : "Sticker installation failed.", error.name);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
