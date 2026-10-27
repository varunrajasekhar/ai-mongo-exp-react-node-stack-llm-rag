import express from 'express';
import cors from 'cors';
import { register, login, publicUser } from './controller/authController.js';
import { requireAuth, requireAdmin } from './controller/authMiddleware.js';
import { listNotes, addNote, ask } from './controller/controller.js';
export function createApp() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-')) throw new Error('Set JWT_SECRET to a random secret of at least 32 characters.');
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '64kb' }));
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.post('/auth/register', register);
  app.post('/auth/login', login);
  app.use(requireAuth);
  app.get('/auth/me', (req, res) => res.json({ user: publicUser(req.user) }));
  app.get('/notes', requireAdmin, listNotes);
  app.post('/notes', requireAdmin, addNote);
  app.post('/study/ask', ask);
  app.post('/study/quiz', ask);
  app.use((req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
  app.use((error, req, res, next) => {
    if (error.code === 11000) return res.status(409).json({ error: 'Email is already registered.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Send valid JSON.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    if (error.status === 502) return res.status(502).json({ error: error.message });
    console.error(error.name, error.message);
    res.status(500).json({ error: 'Request failed. Please try again.' });
  });
  return app;
}
