import {
  S3Client,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  HeadBucketCommand,
  PutPublicAccessBlockCommand
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" }); // Load env

// Env vars
const Region = process.env.REGION;
const accessKey = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_KEY;
const baseBucketName = process.env.BUCKET_NAME;

// Validation
if (!Region || !accessKey || !secretAccessKey || !baseBucketName) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

// Ensure unique bucket name (optional)
const bucketName = `${baseBucketName}-${Date.now()}`.toLowerCase();

// Create client
const s3 = new S3Client({
  region: Region,
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretAccessKey,
  },
});

console.log("Initializing S3 client with:");
console.log(`- Region: ${Region}`);
console.log(`- Bucket: ${bucketName}`);

// Check if bucket exists
const bucketExists = async () => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`Bucket "${bucketName}" already exists.`);
    return true;
  } catch (err) {
    if (err.name === "NotFound") return false;
    return false;
  }
};

// Disable Block Public Access
const disableBlockPublicAccess = async () => {
  const command = new PutPublicAccessBlockCommand({
    Bucket: bucketName,
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: false,
      IgnorePublicAcls: false,
      BlockPublicPolicy: false,
      RestrictPublicBuckets: false,
    },
  });
  await s3.send(command);
  console.log(`Public access block disabled for "${bucketName}".`);
};

// Create/Update bucket
const createBucket = async () => {
  try {
    const exists = await bucketExists();
    if (!exists) {
      const createBucketCommand = new CreateBucketCommand({
        Bucket: bucketName,
        CreateBucketConfiguration:
          Region !== "us-east-1" ? { LocationConstraint: Region } : undefined,
      });
      await s3.send(createBucketCommand);
      console.log(`Bucket "${bucketName}" created successfully.`);
    }

    // Step 1: Disable block public access
    await disableBlockPublicAccess();

    // Step 2: Define and apply (override) bucket policy
    const bucketPolicy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublicReadGetObject",
          Effect: "Allow",
          Principal: "*",
          Action: "s3:GetObject",
          Resource: `arn:aws:s3:::${bucketName}/*`,
        },
      ],
    };

    const putBucketPolicyCommand = new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(bucketPolicy),
    });
    await s3.send(putBucketPolicyCommand);

    console.log(`✅ Bucket policy for "${bucketName}" set (overridden successfully).`);
  } catch (error) {
    console.error("❌ Error creating bucket or setting policy:");
    console.error(error);
    process.exit(1);
  }
};

createBucket();
