import jwt from 'jsonwebtoken';
import User from '../models/User.js';
export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return res.status(401).json({ error: 'Please log in.' });
  let decoded;
  try { decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }); }
  catch { return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' }); }
  const user = typeof decoded.sub === 'string' && /^[a-f\d]{24}$/i.test(decoded.sub) ? await User.findById(decoded.sub) : null;
  if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
  req.user = user;
  next();
}
export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}
