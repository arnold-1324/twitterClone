import { S3Client } from "@aws-sdk/client-s3";
import { bucketStorage } from "./legacyMedia.js";

let musicStorage;

export function musicBucket() {
  const { MUSIC_S3_BUCKET: bucket, MUSIC_S3_REGION: region, MUSIC_S3_ENDPOINT: endpoint,
    MUSIC_S3_ACCESS_KEY: accessKeyId, MUSIC_S3_SECRET_KEY: secretAccessKey } = process.env;
  if (!bucket) return bucketStorage();
  if (!region || !endpoint || !accessKeyId || !secretAccessKey) return null;
  musicStorage ??= { bucket, client: new S3Client({
    region, endpoint, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey }, maxAttempts: 2,
  }) };
  return musicStorage;
}
