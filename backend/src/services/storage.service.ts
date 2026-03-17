import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET_NAME } from '../config/aws';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as Sentry from '@sentry/node';

export class StorageService {
  /**
   * Upload a file to S3 and return the public URL
   */
  async uploadFile(file: Express.Multer.File): Promise<string> {
    if (!S3_BUCKET_NAME) {
      throw new Error('AWS_S3_BUCKET is not defined in environment variables');
    }

    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const key = `posts/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read', // Assuming we want the files to be publicly accessible
    });

    try {
      await s3Client.send(command);
      
      // Return the public URL
      // NOTE: This URL structure may vary depending on the bucket settings (e.g., if using a custom domain or CloudFront)
      // Standard format: https://bucket-name.s3.region.amazonaws.com/key
      const region = await s3Client.config.region();
      return `https://${S3_BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
    } catch (error) {
      Sentry.captureException(error);
      throw new Error('Failed to upload file to storage');
    }
  }
}

export const storageService = new StorageService();
