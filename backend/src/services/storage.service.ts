import {
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'; // still used by generateUploadUrl
import { s3Client, S3_BUCKET_NAME } from '../config/aws';
import crypto from 'crypto';
import * as Sentry from '@sentry/node';

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

const mimeToExtension: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export class StorageService {
  async uploadAvatar(file: Express.Multer.File): Promise<string> {
    if (!S3_BUCKET_NAME) {
      throw new Error('AWS_S3_BUCKET is not defined');
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error('Tipo de archivo no permitido');
    }

    const ext = mimeToExtension[file.mimetype];
    if (!ext) {
      throw new Error('Extensión no soportada');
    }

    const randomName = crypto.randomBytes(16).toString('hex');
    const key = `avatars/${randomName}${ext}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await s3Client.send(command);
      return key;
    } catch (error) {
      Sentry.captureException(error);
      throw new Error('Failed to upload file');
    }
  }

  async generateUploadUrl(mimeType: string): Promise<{ uploadUrl: string; key: string }> {
    if (!S3_BUCKET_NAME) {
      throw new Error('AWS_S3_BUCKET is not defined');
    }

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
      ContentType: mimeType,
    });

    try {
      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 60, 
      });

      return { uploadUrl, key };
    } catch (error) {
      Sentry.captureException(error);
      throw new Error('Failed to generate upload URL');
    }
  }

  async getPublicUrl(key: string): Promise<string> {
    if (process.env.CDN_BASE_URL) {
      return `${process.env.CDN_BASE_URL}/${key}`;
    }

    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${S3_BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
  }
}

export const storageService = new StorageService();