import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET || "harbourlight";
const client = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

for (let attempt = 1; attempt <= 20; attempt += 1) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`Bucket ${bucket} is ready.`);
    process.exit(0);
  } catch {
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log(`Created bucket ${bucket}.`);
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.name : "storage";
      console.log(`Waiting for object storage (${attempt}): ${message}`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}

console.error("Object storage did not become ready.");
process.exit(1);
