import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const allowed = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

fs.mkdirSync(env.uploadDir, { recursive: true });

export const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, env.uploadDir),
    filename: (req, file, cb) => cb(null, `${uuid()}${allowed.get(file.mimetype) || path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowed.has(file.mimetype)) return cb(new AppError(400, 'Only JPG, PNG, and WEBP images are supported'));
    cb(null, true);
  }
});
