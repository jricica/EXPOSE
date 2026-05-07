import { GetBucketCorsCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./src/config/aws";

async function checkCors() {
    const bucket = process.env.AWS_S3_BUCKET || "social-media-expose";
    console.log(`Checking CORS for bucket: ${bucket}`);
    try {
        const response = await s3Client.send(new GetBucketCorsCommand({ Bucket: bucket }));
        console.log("✅ CORS Configuration found:");
        console.log(JSON.stringify(response.CORSRules, null, 2));
    } catch (err: any) {
        if (err.name === 'NoSuchCORSConfiguration') {
            console.log("❌ No CORS configuration found on this bucket.");
        } else {
            console.error("❌ Failed to check CORS!");
            console.error(err);
        }
    }
}

checkCors();
