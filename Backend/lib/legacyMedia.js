import { DeleteObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client;

function legacyStorage() {
  const { BUCKET_NAME, REGION, S3_ENDPOINT, S3_FORCE_PATH_STYLE } = process.env;
  const accessKeyId = process.env.ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  if (!BUCKET_NAME || !REGION || !accessKeyId || !secretAccessKey) return null;

  // The previous uploader used this endpoint when one wasn't specified.
  const endpoint = S3_ENDPOINT || "https://t3.storageapi.dev";
  client ??= new S3Client({
    region: REGION, endpoint,
    forcePathStyle: S3_FORCE_PATH_STYLE === "true" || endpoint !== `https://s3.${REGION}.amazonaws.com`,
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: 1,
  });
  return { client, bucket: BUCKET_NAME };
}

export async function legacyMediaUrl(key) {
  const storage = legacyStorage();
  if (!storage) return "";
  return getSignedUrl(storage.client, new GetObjectCommand({ Bucket: storage.bucket, Key: key }), { expiresIn: 900 })
    .catch(() => "");
}

export async function deleteLegacyMedia(key) {
  const storage = legacyStorage();
  if (!storage) return;
  await storage.client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }), {
    abortSignal: AbortSignal.timeout(3000),
  });
}
