import { Router } from 'express';
import multer from 'multer';
import { uploadController } from '../controllers/upload.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

/**
 * @route POST /upload
 * @desc Upload a file to S3
 * @access
 */
router.post('/', authMiddleware, upload.single('file'), uploadController.uploadFile);

export default router;
