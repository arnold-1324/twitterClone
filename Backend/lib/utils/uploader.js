import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from 'multer';
import dotenv from "dotenv";
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const storage = multer.memoryStorage();
export const upload = multer({ storage: storage });

const Region = process.env.REGION;
const accessKey = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_KEY;
const endpoint = process.env.S3_ENDPOINT || "https://t3.storageapi.dev";
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true" || endpoint !== `https://s3.${Region}.amazonaws.com`;

export const s3 = new S3Client({
  region: Region,
  endpoint,
  forcePathStyle,
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretAccessKey,
  },
});

export const getS3PublicUrl = (key) => {
  const bucketName = process.env.BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing BUCKET_NAME environment variable");
  }

  const normalizedEndpoint = endpoint.replace(/\/+$/, "");

  if (forcePathStyle) {
    return `${normalizedEndpoint}/${bucketName}/${key}`;
  }

  const parsed = new URL(normalizedEndpoint);
  return `https://${bucketName}.${parsed.host}/${key}`;
};

export const getPresignedUrl = async (key, expiresIn = 3600) => {
  if (!key) return "";
  const bucketName = process.env.BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing BUCKET_NAME environment variable");
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  return await getSignedUrl(s3, command, { expiresIn });
};

export const generateFileName = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");









