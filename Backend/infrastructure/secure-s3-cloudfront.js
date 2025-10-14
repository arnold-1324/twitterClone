// secure-s3-cloudfront.js
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutPublicAccessBlockCommand,
  PutBucketPolicyCommand
} from "@aws-sdk/client-s3";
import {
  CloudFrontClient,
  CreateOriginAccessControlCommand,
  CreateDistributionCommand
} from "@aws-sdk/client-cloudfront";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const Region = process.env.REGION;
const accessKey = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_KEY;
const baseBucketName = process.env.BUCKET_NAME;

if (!Region || !accessKey || !secretAccessKey || !baseBucketName) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

const bucketName = `${baseBucketName}-${Date.now()}`.toLowerCase();

const s3 = new S3Client({
  region: Region,
  credentials: { accessKeyId: accessKey, secretAccessKey: secretAccessKey },
});

const cloudfront = new CloudFrontClient({
  region: "us-east-1", // CloudFront APIs are global; region value is OK to keep as us-east-1
  credentials: { accessKeyId: accessKey, secretAccessKey: secretAccessKey },
});

const sts = new STSClient({
  region: Region,
  credentials: { accessKeyId: accessKey, secretAccessKey: secretAccessKey },
});

const bucketExists = async () => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`Bucket "${bucketName}" already exists.`);
    return true;
  } catch (err) {
    return false;
  }
};

const enableBlockPublicAccess = async () => {
  const command = new PutPublicAccessBlockCommand({
    Bucket: bucketName,
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      IgnorePublicAcls: true,
      BlockPublicPolicy: true,
      RestrictPublicBuckets: true,
    },
  });
  await s3.send(command);
  console.log(`S3 Block Public Access enabled for "${bucketName}".`);
};

const createBucketIfMissing = async () => {
  const exists = await bucketExists();
  if (!exists) {
    const createBucketCommand = new CreateBucketCommand({
      Bucket: bucketName,
      CreateBucketConfiguration:
        Region !== "us-east-1" ? { LocationConstraint: Region } : undefined,
    });
    await s3.send(createBucketCommand);
    console.log(`Bucket "${bucketName}" created.`);
  }
};

const createOAC = async () => {
  const name = `twitterclone-oac-${Date.now()}`;
  const resp = await cloudfront.send(
    new CreateOriginAccessControlCommand({
      OriginAccessControlConfig: {
        Name: name,
        Description: "OAC for TwitterClone (private S3 origin)",
        OriginAccessControlOriginType: "s3",
        SigningProtocol: "sigv4",
        SigningBehavior: "always", // sign all origin requests
      },
    })
  );
  const oac = resp.OriginAccessControl;
  console.log("Created OAC:", oac?.Id);
  return oac;
};

const createDistribution = async (oac) => {
  // Use the virtual-hosted style domain for S3. This usually works across regions.
  const domainName = `${bucketName}.s3.amazonaws.com`;
  const originId = `S3-${bucketName}`;

  const distConfig = {
    CallerReference: `${Date.now()}`,
    Enabled: true,
    Origins: {
      Quantity: 1,
      Items: [
        {
          Id: originId,
          DomainName: domainName,
          S3OriginConfig: { OriginAccessIdentity: "" }, // required when using OAC
          OriginAccessControlId: oac.Id,
        },
      ],
    },
    DefaultCacheBehavior: {
      TargetOriginId: originId,
      ViewerProtocolPolicy: "redirect-to-https",
      AllowedMethods: {
        Quantity: 2,
        Items: ["GET", "HEAD"],
        // If you need PUT/POST for uploads through CloudFront, add them here
      },
      ForwardedValues: {
        QueryString: false,
        Cookies: { Forward: "none" },
      },
      MinTTL: 0,
      DefaultTTL: 86400,
      MaxTTL: 31536000,
    },
    Comment: "TwitterClone CDN (private S3 origin via OAC)",
    PriceClass: "PriceClass_All",
  };

  const resp = await cloudfront.send(
    new CreateDistributionCommand({ DistributionConfig: distConfig })
  );

  const distribution = resp.Distribution;
  console.log("Created CloudFront distribution:", distribution?.Id);
  return distribution;
};

const updateBucketPolicyForCloudFront = async (accountId, distributionId) => {
  // Allow only CloudFront service to GetObject for this distribution
  const distributionArn = `arn:aws:cloudfront::${accountId}:distribution/${distributionId}`;

  const bucketPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "AllowCloudFrontServiceRead",
        Effect: "Allow",
        Principal: { Service: "cloudfront.amazonaws.com" },
        Action: "s3:GetObject",
        Resource: `arn:aws:s3:::${bucketName}/*`,
        Condition: {
          StringEquals: { "AWS:SourceArn": distributionArn },
        },
      },
    ],
  };

  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(bucketPolicy),
    })
  );
  console.log("Bucket policy updated to restrict access to CloudFront distribution only.");
};

const run = async () => {
  try {
    await createBucketIfMissing();

    // Make bucket private & block public access
    await enableBlockPublicAccess();

    // Create OAC
    const oac = await createOAC();

    // Create CloudFront distribution (referencing the OAC)
    const dist = await createDistribution(oac);
    const distId = dist?.Id;
    const distDomain = dist?.DomainName;
    console.log("Distribution created:", distId, distDomain);

    // Get account id to build distribution ARN for the bucket policy condition
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    const accountId = identity.Account;
    if (!accountId || !distId) {
      console.warn("Missing accountId or distributionId — cannot set bucket policy automatically.");
      return;
    }

    // Update bucket policy so only CloudFront distribution can read objects
    await updateBucketPolicyForCloudFront(accountId, distId);

    console.log("✅ Setup complete.");
    console.log("CloudFront domain (use this as your CDN endpoint):", distDomain);
    console.log("Remember: attach a custom domain + ACM cert if you need nicer URLs.");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
};

run();
