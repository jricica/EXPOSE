import {
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { s3Client, S3_BUCKET_NAME } from './aws';

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

const mimeToExtension: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const uploadAvatar = async (
  fileBuffer: Buffer,
  mimeType: string
) => {
  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error('Tipo de archivo no permitido');
  }

  const ext = mimeToExtension[mimeType];
  if (!ext) {
    throw new Error('Extensión no soportada');
  }

  const randomName = crypto.randomBytes(16).toString('hex');
  const key = `avatars/${randomName}${ext}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType, 
  });

  await s3Client.send(command);

  return key;
};

export const getAvatarUrl = async (key: string) => {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
};