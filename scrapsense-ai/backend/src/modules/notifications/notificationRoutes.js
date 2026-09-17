import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/errors.js';
import { query } from '../../database/pool.js';

export const notificationRouter = express.Router();

notificationRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30', [req.user.user_id]);
  res.json({ notifications: result.rows });
}));

notificationRouter.patch('/:id/read', requireAuth, asyncHandler(async (req, res) => {
  const result = await query('UPDATE notifications SET read_at=now() WHERE notification_id=$1 AND user_id=$2 RETURNING *', [req.params.id, req.user.user_id]);
  res.json({ notification: result.rows[0] || null });
}));
