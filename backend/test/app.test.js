import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import User from '../models/User.js';
import Note from '../models/Note.js';
import NoteChunk from '../models/NoteChunk.js';
import { chunk, cosine } from '../rag.js';
let db, model, app, lastInput, failEmbeddings = false, invalidChat = false;
before(async () => {
  process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters';
  db = await MongoMemoryServer.create();
  await mongoose.connect(db.getUri()); await User.init();
  // Real HTTP boundary, deterministic model responses. No actual Ollama in this test.
  model = http.createServer(async (req, res) => {
    let body = ''; for await (const data of req) body += data;
    const input = JSON.parse(body); res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/embed') {
      if (failEmbeddings) { res.statusCode = 503; return res.end('{}'); }
      return res.end(JSON.stringify({ embeddings: input.input.map(() => [1, 0, 0]) }));
    }
    lastInput = JSON.parse(input.messages[1].content);
    const quiz = input.messages[0].content.includes('exactly three');
    res.end(JSON.stringify({ message: { content: invalidChat ? 'invalid' : JSON.stringify({ answer: 'Photosynthesis converts light into chemical energy.', practiceQuestions: quiz ? ['What is chlorophyll?', 'Why is light needed?', 'What is produced?'] : [] }) } }));
  });
  await new Promise(resolve => model.listen(0, '127.0.0.1', resolve));
  process.env.OLLAMA_URL = `http://127.0.0.1:${model.address().port}`;
  app = createApp();
});
after(async () => { await mongoose.disconnect(); if (db) await db.stop(); if (model) await new Promise(resolve => model.close(resolve)); });
const auth = token => ({ Authorization: `Bearer ${token}` });
async function register(email) { return (await request(app).post('/auth/register').send({ name: 'Student', email, password: 'password123', role: 'admin' }).expect(201)).body; }
async function admin(email) { const data = await register(email); await User.updateOne({ _id: data.user.id }, { role: 'admin' }); return data; }
test('chunking keeps overlap and cosine rejects incompatible dimensions', () => {
  const pieces = chunk('a'.repeat(900)); assert.equal(pieces.length, 2); assert.equal(pieces[0].length, 500); assert.equal(pieces[1].length, 500);
  assert.equal(cosine([1, 0], [1, 0]), 1); assert.equal(cosine([1], [1, 0]), 0); assert.equal(cosine([0], [0]), 0);
});
test('registration validates, hashes, ignores submitted role, and rejects duplicates', async () => {
  await request(app).post('/auth/register').send({ name: '', email: 'bad', password: 'tiny' }).expect(400);
  await request(app).post('/auth/register').send({ name: 'Test', email: 'long@test.com', password: '😀'.repeat(30) }).expect(400);
  const data = await register('learner@test.com'); assert.equal(data.user.role, 'user'); assert.equal(data.user.password, undefined);
  const stored = await User.findById(data.user.id).select('+password'); assert.notEqual(stored.password, 'password123'); assert.ok(await bcrypt.compare('password123', stored.password));
  assert.equal(jwt.verify(data.token, process.env.JWT_SECRET).sub, data.user.id);
  await request(app).post('/auth/register').send({ name: 'Test', email: 'LEARNER@test.com', password: 'password123' }).expect(409);
  await request(app).post('/auth/login').send({ email: 'learner@test.com', password: 'wrong' }).expect(401);
  await request(app).post('/auth/login').send({ email: 'LEARNER@test.com', password: 'password123' }).expect(200);
});
test('protected endpoints reject missing, invalid and expired JWTs; learners cannot manage notes', async () => {
  for (const path of ['/notes', '/auth/me']) await request(app).get(path).expect(401);
  await request(app).post('/study/ask').send({ question: 'biology' }).expect(401);
  await request(app).get('/notes').set(auth('bad')).expect(401);
  const learner = await register('access@test.com');
  const expired = jwt.sign({ sub: learner.user.id }, process.env.JWT_SECRET, { expiresIn: -1 });
  await request(app).get('/notes').set(auth(expired)).expect(401);
  await request(app).get('/notes').set(auth(learner.token)).expect(403);
  await request(app).post('/notes').set(auth(learner.token)).send({}).expect(403);
});
test('private RAG isolates two admins and never supplies notes to learners', async () => {
  const a = await admin('admina@test.com'), b = await admin('adminb@test.com'), learner = await register('raglearner@test.com');
  const saved = await request(app).post('/notes').set(auth(a.token)).send({ title: 'Private Biology A', subject: 'Biology', content: 'Private A marker: photosynthesis uses chlorophyll.', createdBy: b.user.id }).expect(201);
  assert.equal(saved.body.createdBy, a.user.id);
  await request(app).post('/notes').set(auth(b.token)).send({ title: 'Private Biology B', subject: 'Biology', content: 'Private B marker: a leaf captures sunlight.' }).expect(201);
  const listB = await request(app).get('/notes').set(auth(b.token)).expect(200); assert.equal(listB.body.length, 1); assert.equal(listB.body[0].title, 'Private Biology B');
  const answerA = await request(app).post('/study/ask').set(auth(a.token)).send({ question: 'photosynthesis', userId: b.user.id }).expect(200);
  assert.equal(answerA.body.sources[0].title, 'Private Biology A'); assert.ok(JSON.stringify(lastInput).includes('Private A marker')); assert.ok(!JSON.stringify(lastInput).includes('Private B marker'));
  await request(app).post('/study/ask').set(auth(b.token)).send({ question: 'photosynthesis', createdBy: a.user.id }).expect(200);
  assert.ok(!JSON.stringify(lastInput).includes('Private A marker')); assert.ok(JSON.stringify(lastInput).includes('Private B marker'));
  const general = await request(app).post('/study/ask').set(auth(learner.token)).send({ question: 'photosynthesis' }).expect(200); assert.deepEqual(general.body.sources, []); assert.deepEqual(lastInput.notes, []);
  const quiz = await request(app).post('/study/quiz').set(auth(learner.token)).send({ question: 'photosynthesis' }).expect(200); assert.equal(quiz.body.practiceQuestions.length, 3);
});
test('bad input and model failures produce errors without partially saved notes', async () => {
  const a = await admin('fail@test.com');
  await request(app).post('/study/ask').set(auth(a.token)).send({ question: {} }).expect(400);
  await request(app).post('/study/ask').set(auth(a.token)).send({ question: 'biology', includePractice: 'yes' }).expect(400);
  await request(app).post('/notes').set(auth(a.token)).send({ title: 'Blank', subject: 'Biology', content: ' ' }).expect(400);
  failEmbeddings = true;
  await request(app).post('/notes').set(auth(a.token)).send({ title: 'Not saved', subject: 'Biology', content: 'content' }).expect(502);
  assert.equal(await Note.countDocuments({ createdBy: a.user.id }), 0); failEmbeddings = false;
  invalidChat = true;
  await request(app).post('/study/ask').set(auth(a.token)).send({ question: 'biology' }).expect(502); invalidChat = false;
  await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{').expect(400);
  assert.ok(await NoteChunk.countDocuments() > 0);
});
