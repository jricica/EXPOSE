import { Router } from 'express';
import { uploadImage } from '../controllers/upload.controller';
import { upload } from '../utils/multer';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', authMiddleware, upload.single('image'), uploadImage);

export default router;