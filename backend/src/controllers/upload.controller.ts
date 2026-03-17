import { Request, Response, NextFunction } from 'express';
import { storageService } from '../services/storage.service';
import * as Sentry from '@sentry/node';

export class UploadController {
  async uploadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const mediaUrl = await storageService.uploadFile(req.file);

      res.status(200).json({ 
        url: mediaUrl,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    } catch (error) {
      Sentry.captureException(error);
      res.status(500).json({ error: 'Internal server error during upload' });
    }
  }
}

export const uploadController = new UploadController();
