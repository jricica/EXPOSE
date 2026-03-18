import { Request, Response } from 'express';

export const uploadImage = (req: Request, res: Response) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    res.status(200).json({
      message: 'File uploaded successfully',
      filePath: `/uploads/${file.filename}`,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading file' });
  }
};