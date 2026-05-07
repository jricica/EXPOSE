import { GetPublicAccessBlockCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./src/config/aws";

async function checkPublicAccess() {
    const bucket = "social-media-expose";
    try {
        const response = await s3Client.send(new GetPublicAccessBlockCommand({ Bucket: bucket }));
        console.log("Public Access Block:", JSON.stringify(response.PublicAccessBlockConfiguration, null, 2));
    } catch (err) {
        console.error("Failed to check public access block");
        console.error(err);
    }
}

checkPublicAccess();
