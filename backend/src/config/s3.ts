import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET_NAME } from './aws';

export const uploadAvatar = async (
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
) => {
  const key = `avatars/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);

  return key;
};

export const getAvatarUrl = (key: string) => {
  return `https://${S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;
};