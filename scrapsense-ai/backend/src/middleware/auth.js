import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { query } from '../database/pool.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
    if (!token) throw new AppError(401, 'Authentication required');
    const decoded = jwt.verify(token, env.jwtSecret);
    const result = await query('SELECT user_id, employee_code, full_name, email, role FROM users WHERE user_id = $1 AND is_active = true', [decoded.sub]);
    if (!result.rowCount) throw new AppError(401, 'Invalid session');
    req.user = result.rows[0];
    next();
  } catch (error) {
    next(error.status ? error : new AppError(401, 'Invalid or expired token'));
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new AppError(403, 'Forbidden'));
    next();
  };
}
