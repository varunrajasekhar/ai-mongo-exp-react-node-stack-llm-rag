import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Note from '../models/Note.js';
import NoteChunk from '../models/NoteChunk.js';
import { createApp } from '../app.js';
import { chunk, cosine, searchNotes } from '../rag.js';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-characters';
const app = createApp();
const idA = 'aaaaaaaaaaaaaaaaaaaaaaaa', idB = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const user = { _id: idA, name: 'A', email: 'a@test.com', role: 'admin' };
const token = jwt.sign({ sub: idA }, process.env.JWT_SECRET);
afterEach(() => mock.restoreAll());
test('chunk overlap, cosine ranking and dimension checks', () => {
  const text = Array.from({ length: 900 }, (_, i) => String(i % 10)).join('');
  const parts = chunk(text); assert.equal(parts.length, 2); assert.equal(parts[0].slice(400), parts[1].slice(0, 100));
  assert.equal(cosine([1,0],[1,0]),1); assert.equal(cosine([0,1],[1,0]),0); assert.equal(cosine([1],[1,0]),0);
});
test('public registration hashes password and ignores admin role', async () => {
  let record;
  mock.method(User, 'create', async input => { record = input; return { ...input, _id: idA }; });
  const res = await request(app).post('/auth/register').send({ name: 'A', email: 'A@test.com', password: 'password123', role: 'admin' }).expect(201);
  assert.equal(record.role, 'user'); assert.ok(await bcrypt.compare('password123', record.password)); assert.equal(record.email, 'a@test.com');
  assert.equal(res.body.user.password, undefined); assert.equal(jwt.verify(res.body.token, process.env.JWT_SECRET).sub, idA);
});
test('invalid registration and credentials, duplicate email and malformed JSON are handled', async () => {
  await request(app).post('/auth/register').send({ name:'A', email:'bad', password:'short' }).expect(400);
  mock.method(User, 'create', async () => { throw { code: 11000 }; });
  await request(app).post('/auth/register').send({ name:'A', email:'a@test.com', password:'password123' }).expect(409);
  mock.method(User, 'findOne', () => ({ select: async () => null }));
  await request(app).post('/auth/login').send({ email:'a@test.com', password:'wrong' }).expect(401);
  await request(app).post('/auth/login').set('Content-Type','application/json').send('{').expect(400);
});
test('JWT and roles protect APIs independently of frontend', async () => {
  await request(app).get('/notes').expect(401);
  await request(app).post('/study/ask').send({question:'hello'}).expect(401);
  await request(app).get('/notes').set('Authorization','Bearer invalid').expect(401);
  const expired = jwt.sign({sub:idA},process.env.JWT_SECRET,{expiresIn:-1});
  await request(app).get('/notes').set('Authorization',`Bearer ${expired}`).expect(401);
  mock.method(User,'findById',async () => ({...user,role:'user'}));
  await request(app).get('/notes').set('Authorization',`Bearer ${token}`).expect(403);
  await request(app).post('/notes').set('Authorization',`Bearer ${token}`).send({}).expect(403);
});
test('RAG queries select owner before chunks and exclude other admins', async () => {
  const own = { _id: 'noteA', title:'Private A' };
  mock.method(Note,'find',filter => { assert.deepEqual(filter,{createdBy:idA,indexed:true}); return {lean:async () => [own]}; });
  mock.method(NoteChunk,'find',filter => { assert.deepEqual(filter.noteId,{$in:['noteA']}); return {lean:async () => [{noteId:'noteA',text:'private A passage',embedding:[1,0]}]}; });
  mock.method(globalThis,'fetch',async () => ({ok:true,json:async () => ({embeddings:[[1,0]]})}));
  const results = await searchNotes('biology',idA); assert.equal(results[0].title,'Private A'); assert.equal(results.length,1);
});
test('learner study bypasses note retrieval, validates output and supports quiz', async () => {
  mock.method(User,'findById',async () => ({...user,role:'user'}));
  mock.method(Note,'find',() => { throw new Error('Learners must never retrieve notes'); });
  mock.method(globalThis,'fetch',async (url,options) => {
    const body=JSON.parse(options.body), data=JSON.parse(body.messages[1].content); assert.deepEqual(data.notes,[]);
    return {ok:true,json:async () => ({message:{content:JSON.stringify({answer:'An explanation',practiceQuestions:body.messages[0].content.includes('exactly three')?['Q1','Q2','Q3']:[]})}})};
  });
  const res=await request(app).post('/study/ask').set('Authorization',`Bearer ${token}`).send({question:'biology',createdBy:idB}).expect(200); assert.deepEqual(res.body.sources,[]);
  const quiz=await request(app).post('/study/quiz').set('Authorization',`Bearer ${token}`).send({question:'biology'}).expect(200); assert.equal(quiz.body.practiceQuestions.length,3);
  await request(app).post('/study/ask').set('Authorization',`Bearer ${token}`).send({question:{}}).expect(400);
});
test('Ollama failures and malformed responses return actionable 502', async () => {
  mock.method(User,'findById',async () => ({...user,role:'user'}));
  const fetchMock=mock.method(globalThis,'fetch',async () => ({ok:false,status:503}));
  await request(app).post('/study/ask').set('Authorization',`Bearer ${token}`).send({question:'biology'}).expect(502);
  fetchMock.mock.mockImplementation(async () => ({ok:true,json:async () => ({message:{content:'not json'}})}));
  await request(app).post('/study/ask').set('Authorization',`Bearer ${token}`).send({question:'biology'}).expect(502);
});
