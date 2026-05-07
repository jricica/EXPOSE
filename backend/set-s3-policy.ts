import { PutBucketPolicyCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./src/config/aws";

async function setBucketPolicy() {
    const bucket = "social-media-expose";
    const policy = {
        Version: "2012-10-17",
        Statement: [
            {
                Sid: "PublicReadGetObject",
                Effect: "Allow",
                Principal: "*",
                Action: "s3:GetObject",
                Resource: `arn:aws:s3:::${bucket}/avatars/*`
            }
        ]
    };

    try {
        await s3Client.send(new PutBucketPolicyCommand({
            Bucket: bucket,
            Policy: JSON.stringify(policy)
        }));
        console.log("✅ Bucket policy applied successfully! /avatars/* is now public.");
    } catch (err) {
        console.error("❌ Failed to set bucket policy!");
        console.error(err);
    }
}

setBucketPolicy();
