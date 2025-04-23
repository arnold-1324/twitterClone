import{S3Client,CreateBucketCommand,PutPublicAccessBlockCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";


  const REGION = "";            
  const BUCKET = ""; 
  
  const s3 = new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: "",
      secretAccessKey: "",
    },
  });
  
  (async () => {
    // 1) Create bucket if needed
    try {
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
      console.log(`✅ Bucket ${BUCKET} created`);
    } catch (err) {
      if (err.name === "BucketAlreadyOwnedByYou") {
        console.log(`ℹ️ Bucket ${BUCKET} already exists`);
      } else {
        console.error("❌ createBucket error:", err);
        return;
      }
    }
  
    // 2) Disable the public‐block settings *for this bucket*
    try {
      await s3.send(new PutPublicAccessBlockCommand({
        Bucket: BUCKET,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: false,
          IgnorePublicAcls: false,
          BlockPublicPolicy: false,
          RestrictPublicBuckets: false,
        },
      }));
      console.log("🔓 Public access block disabled on bucket");
    } catch (err) {
      console.error("❌ putPublicAccessBlock error:", err);
      return;
    }
  
  
    const publicPolicy = {
      Version: "2012-10-17",
      Statement: [{
        Sid: "PublicReadGetObject",
        Effect: "Allow",
        Principal: "*",
        Action: "s3:GetObject",
        Resource: `arn:aws:s3:::${BUCKET}/*`,
      }],
    };
  
    try {
      await s3.send(new PutBucketPolicyCommand({
        Bucket: BUCKET,
        Policy: JSON.stringify(publicPolicy),
      }));
      console.log("🔓 Bucket policy set to public-read");
    } catch (err) {
      console.error("❌ putBucketPolicy error:", err);
    }
  })();
  