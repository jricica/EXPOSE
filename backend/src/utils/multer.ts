import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { UPLOAD_DIR, MAX_FILE_SIZE } from '../config/env';

// Tipos permitidos
export const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

// Mapeo seguro de MIME → extensión
const mimeToExtension: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

// Asegurar que el directorio exista
const uploadPath = path.resolve(UPLOAD_DIR);
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Validación de archivos
const fileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Tipo de archivo no permitido'));
  }
  cb(null, true);
};

// Storage seguro
const storage: multer.StorageEngine = multer.diskStorage({
    destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = mimeToExtension[file.mimetype];

    if (!ext) {
      return cb(new Error('Extensión no soportada'));
    }

    const randomName = crypto.randomBytes(16).toString('hex');

    cb(null, `${randomName}${ext}`);
  },
});

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});