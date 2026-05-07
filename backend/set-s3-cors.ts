import { PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./src/config/aws";

async function setCors() {
    const bucket = process.env.AWS_S3_BUCKET || "social-media-expose";
    console.log(`Setting CORS for bucket: ${bucket}`);
    
    const corsConfiguration = {
        CORSRules: [
            {
                AllowedHeaders: ["*"],
                AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
                AllowedOrigins: ["*"], // En producción deberías restringir esto
                ExposeHeaders: ["ETag"],
                MaxAgeSeconds: 3000
            }
        ]
    };

    try {
        await s3Client.send(new PutBucketCorsCommand({
            Bucket: bucket,
            CORSConfiguration: corsConfiguration
        }));
        console.log("✅ CORS configuration applied successfully!");
    } catch (err) {
        console.error("❌ Failed to set CORS!");
        console.error(err);
    }
}

setCors();
