import { S3Client, CreateBucketCommand, PutBucketPolicyCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" }); // Explicitly load .env from project root

const Region = process.env.REGION;
const accessKey = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_KEY;
const bucketName = process.env.BUCKET_NAME;

const s3 = new S3Client({
  region: Region,
  credentials: {
    accessKeyId: accessKey,
    secretAccessKey: secretAccessKey,
  },
});

// Function to check if the bucket exists
const bucketExists = async () => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`Bucket "${bucketName}" already exists.`);
    return true;
  } catch (error) {
    if (error.name === "NotFound") {
      return false;
    }
    throw error;
  }
};

const createBucket = async () => {
  try {
    if (!bucketName) {
      throw new Error("BUCKET_NAME is not defined in environment variables.");
    }
    const exists = await bucketExists();
    if (!exists) {
      // Create the bucket if it doesn't exist
      const createBucketCommand = new CreateBucketCommand({ Bucket: bucketName });
      await s3.send(createBucketCommand);
      console.log(`Bucket "${bucketName}" created successfully.`);
    }

    // Define the bucket policy for public read access
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

    // Try to apply the bucket policy
    try {
      const putBucketPolicyCommand = new PutBucketPolicyCommand({
        Bucket: bucketName,
        Policy: JSON.stringify(bucketPolicy),
      });
      await s3.send(putBucketPolicyCommand);
      console.log(`Bucket policy for "${bucketName}" set successfully.`);
    } catch (policyError) {
      if (
        policyError.Code === "AccessDenied" &&
        String(policyError.message || "").includes("BlockPublicPolicy")
      ) {
        console.error(
          `AccessDenied: BlockPublicPolicy is enabled for this bucket. ` +
          `To allow public access, go to the AWS S3 console, select your bucket, ` +
          `and disable "Block all public access" under "Permissions > Block public access".`
        );
      } else {
        console.error("Error setting bucket policy:", policyError.message || policyError);
      }
    }
  } catch (error) {
    console.error("Error creating bucket or setting policy:", error.message || error);
  }
};

createBucket();
