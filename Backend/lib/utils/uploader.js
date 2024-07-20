import { S3Client } from "@aws-sdk/client-s3";
import multer from 'multer';
import dotenv from "dotenv";
import crypto from 'crypto';

dotenv.config();

const storage= multer.memoryStorage();
export const upload = multer({ storage: storage});

const Region=process.env.REGION;
const accessKey=process.env.ACCESS_KEY;
const secretAccessKey=process.env.SECRET_KEY;

export const s3 = new S3Client({
  region: Region,
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretAccessKey
  }
});

export const generateFileName = (bytes=32) => crypto.randomBytes(bytes).toString('hex')









