import express from 'express';
import { asyncHandler } from '../../utils/errors.js';
import { requireAuth } from '../../middleware/auth.js';
import { login } from './authService.js';

export const authRouter = express.Router();

authRouter.post('/login', asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  res.json(await login(identifier, password));
}));

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
