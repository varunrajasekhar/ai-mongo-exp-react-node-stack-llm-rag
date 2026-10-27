import mongoose from 'mongoose';
import { connectDB } from './db.js';
import { createApp } from './app.js';
try {
  const app = createApp();
  await connectDB();
  const server = app.listen(process.env.PORT || 3000, () => console.log('Study API ready on port', process.env.PORT || 3000));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await mongoose.disconnect(); process.exit(0); }));
} catch (error) { console.error('Startup failed:', error.message); process.exitCode = 1; }
