import crypto from "node:crypto";
import "dotenv/config";

const secret = process.env.ENCRYPTION_SECRET;
const key = crypto.createHash("sha256").update("dayline:message:v2\0").update(secret).digest();
const legacyKey = Buffer.from(crypto.createHash("sha256").update(secret).digest("base64").slice(0, 32));
const legacyAlgorithm = process.env.ENCRYPTION_ALGO || "aes-256-cbc";

export function encrypt(text) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  const encryptedData = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]).toString("hex");
  return { iv: `v2:${nonce.toString("hex")}:${cipher.getAuthTag().toString("hex")}`, encryptedData };
}

export function decrypt({ iv, encryptedData }) {
  const versioned = /^v2:([a-f0-9]{24}):([a-f0-9]{32})$/.exec(iv);
  if (versioned) {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(versioned[1], "hex"));
    decipher.setAuthTag(Buffer.from(versioned[2], "hex"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedData, "hex")), decipher.final()]).toString("utf8");
  }
  if (typeof iv !== "string" || !/^[a-f0-9]{32}$/.test(iv)) throw new Error("Invalid message encryption metadata");
  const decipher = crypto.createDecipheriv(legacyAlgorithm, legacyKey, Buffer.from(iv, "hex"));
  return decipher.update(encryptedData, "hex", "utf8") + decipher.final("utf8");
}
