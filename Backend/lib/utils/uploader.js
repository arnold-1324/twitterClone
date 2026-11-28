import multer from "multer";

const storage = multer.memoryStorage();
export const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 30 } });
const messageLimit = 25 * 1024 * 1024;
const messageBytes = Symbol("message bytes");
const messageStorage = {
  _handleFile(req, file, done) {
    const chunks = [];
    let size = 0;
    let rejected = false;
    file.stream.on("data", (chunk) => {
      if (rejected) return;
      req[messageBytes] = (req[messageBytes] || 0) + chunk.length;
      if (req[messageBytes] > messageLimit) {
        rejected = true;
        chunks.length = 0;
        done(new multer.MulterError("LIMIT_FILE_SIZE", file.fieldname));
        return;
      }
      size += chunk.length;
      chunks.push(chunk);
    });
    file.stream.on("end", () => {
      if (!rejected) done(null, { buffer: Buffer.concat(chunks, size), size });
    });
  },
  _removeFile(_req, file, done) {
    delete file.buffer;
    done(null);
  },
};
export const uploadMessageMedia = multer({
  storage: messageStorage,
  limits: { fileSize: messageLimit + 1, files: 6, fields: 10, fieldSize: 24000, parts: 17 },
}).array("media", 6);

export const uploadPostImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 12, fieldSize: 16 * 1024, parts: 14 },
  fileFilter(_req, file, callback) {
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.mimetype)) {
      return callback(Object.assign(new Error("Choose a JPEG, PNG, GIF or WebP photo."), { status: 415 }));
    }
    return callback(null, true);
  },
});

export const uploadCarousel = multer({
  storage, limits: { fileSize: 4 * 1024 * 1024, files: 6, fields: 4, parts: 11, fieldSize: 4096 },
}).fields([{ name: "image", maxCount: 1 }, { name: "media", maxCount: 6 }]);

export const uploadReel = multer({
  storage, limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 4, parts: 6, fieldSize: 4096 },
}).single("video");

export function isImage({ buffer, mimetype }) {
  const starts = (hex) => buffer.subarray(0, hex.length / 2).toString("hex") === hex;
  return (mimetype === "image/jpeg" && starts("ffd8ff"))
    || (mimetype === "image/png" && starts("89504e470d0a1a0a"))
    || (mimetype === "image/gif" && /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString("ascii")))
    || (mimetype === "image/webp" && starts("52494646") && buffer.subarray(8, 12).toString("ascii") === "WEBP");
}

export function validateImageBytes(req, res, next) {
  if (!req.file || isImage(req.file)) return next();
  return res.status(415).json({ error: "The selected file does not match its image format." });
}

export function isVideo({ buffer, mimetype }) {
  return (mimetype === "video/mp4" && buffer.subarray(4, 8).toString("ascii") === "ftyp")
    || (mimetype === "video/webm" && buffer.subarray(0, 4).toString("hex") === "1a45dfa3");
}
