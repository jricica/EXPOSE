import { Request, Response, NextFunction } from 'express';
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
      const url = await storageService.getSignedUrl(key);
  
      res.status(200).json({
        key,
        url,
      });
    } catch (error) {
      Sentry.captureException(error);
      res.status(500).json({ error: 'Internal server error during upload' });
    }
  }
}

export const uploadController = new UploadController();
