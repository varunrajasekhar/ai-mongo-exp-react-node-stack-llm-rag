import mongoose from 'mongoose';
import { connectDB } from '../db.js';
import User from '../models/User.js';
try {
  const email = process.argv[2];
  if (!email) throw new Error('Usage: npm run admin -w backend -- your@email.com');
  await connectDB();
  const user = await User.findOneAndUpdate({ email: email.trim().toLowerCase() }, { role: 'admin' }, { new: true });
  if (!user) throw new Error('Register this account in the app first.');
  console.log('Admin enabled for', user.email, '— log in again.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
