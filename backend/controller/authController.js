import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
export const publicUser = u => ({ id: String(u._id), name: u.name, email: u.email, role: u.role });
const session = u => ({ user: publicUser(u), token: jwt.sign({ sub: String(u._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '2h' }) });
export const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export async function register(req, res) {
  const { name, email, password } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || !validEmail(email) ||
      typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: 'Provide a name, valid email and password of at least 8 characters (maximum 72 UTF-8 bytes).' });
  }
  // Public registration ALWAYS creates learners, even when a role is submitted.
  const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), password: await bcrypt.hash(password, 12), role: 'user' });
  res.status(201).json(session(user));
}
export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!validEmail(email) || typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) return res.status(400).json({ error: 'Provide a valid email and password.' });
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  if (!user || !await bcrypt.compare(password, user.password)) return res.status(401).json({ error: 'Incorrect email or password.' });
  res.json(session(user));
}
