import Note from './models/Note.js';
import NoteChunk from './models/NoteChunk.js';
import { embed } from './llm.js';
export function chunk(text) {
  const pieces = [];
  for (let start = 0; start < text.length; start += 400) {
    pieces.push(text.slice(start, start + 500));
    if (start + 500 >= text.length) break;
  }
  return pieces;
}
export function cosine(a, b) {
  if (!a.length || a.length !== b.length) return 0;
  const length = Math.hypot(...a) * Math.hypot(...b);
  return length ? a.reduce((sum, value, i) => sum + value * b[i], 0) / length : 0;
}
export async function prepareChunks(note) {
  const pieces = chunk(note.content).map(text => `Title: ${note.title}\nSubject: ${note.subject}\n${text}`);
  const vectors = await embed(pieces);
  return pieces.map((text, i) => ({ noteId: note._id, text, embedding: vectors[i], embeddingModel: process.env.EMBED_MODEL || 'nomic-embed-text' }));
}
export async function searchNotes(question, userId) {
  // Resolve ownership BEFORE loading vectors. The caller never supplies an owner ID.
  const notes = await Note.find({ createdBy: userId, indexed: true }).lean();
  if (!notes.length) return [];
  const chunks = await NoteChunk.find({ noteId: { $in: notes.map(n => n._id) }, embeddingModel: process.env.EMBED_MODEL || 'nomic-embed-text' }).lean();
  if (!chunks.length) return [];
  const [vector] = await embed([question]);
  return chunks.map(c => ({ ...c, title: notes.find(n => String(n._id) === String(c.noteId)).title, score: cosine(vector, c.embedding) }))
    .filter(c => c.score >= 0.35).sort((a, b) => b.score - a.score).slice(0, 3);
}
