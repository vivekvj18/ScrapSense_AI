import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../database/pool.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

export async function login(identifier, password) {
  const result = await query(
    'SELECT user_id, employee_code, full_name, email, password_hash, role FROM users WHERE (lower(email)=lower($1) OR employee_code=$1) AND is_active=true',
    [identifier]
  );
  if (!result.rowCount) throw new AppError(401, 'Invalid credentials');
  const user = result.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new AppError(401, 'Invalid credentials');
  const token = jwt.sign({ sub: user.user_id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  delete user.password_hash;
  return { token, user };
}
