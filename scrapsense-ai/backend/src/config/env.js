import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/scrapsense_ai',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  aiMode: (process.env.AI_MODE || 'MOCK').toUpperCase(),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
};
