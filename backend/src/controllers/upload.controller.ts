import { Request, Response } from 'express';
import { storageService } from '../services/storage.service';
import * as Sentry from '@sentry/node';

export class UploadController {
  async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const key = await storageService.uploadAvatar(req.file);
      const url = await storageService.getPublicUrl(key);

      res.status(200).json({
        key,
        url,
      });
    } catch (error) {
      Sentry.captureException(error);
      res.status(500).json({ error: 'Internal server error during upload' });
    }
  }

  async getUploadUrl(req: Request, res: Response): Promise<void> {
    try {
      const { mimeType } = req.body;

      if (!mimeType) {
        res.status(400).json({ error: 'mimeType is required' });
        return;
      }

      const { uploadUrl, key } = await storageService.generateUploadUrl(mimeType);

      res.status(200).json({
        uploadUrl,
        key,
      });
    } catch (error) {
      Sentry.captureException(error);
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  }
}

export const uploadController = new UploadController();