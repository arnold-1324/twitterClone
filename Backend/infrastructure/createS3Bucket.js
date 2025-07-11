import { S3Client, CreateBucketCommand, PutBucketPolicyCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

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
    const exists = await bucketExists();
    if (!exists) {
      // Create the bucket if it doesn't exist
      const createBucketCommand = new CreateBucketCommand({ Bucket: bucketName });
      await s3.send(createBucketCommand);
      console.log(`Bucket "${bucketName}" created successfully.`);
    }

    // Define the bucket policy
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

    // Apply the bucket policy
    const putBucketPolicyCommand = new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(bucketPolicy),
    });
    await s3.send(putBucketPolicyCommand);
    console.log(`Bucket policy for "${bucketName}" set successfully.`);
  } catch (error) {
    console.error("Error creating bucket or setting policy:", error);
  }
};

createBucket();
