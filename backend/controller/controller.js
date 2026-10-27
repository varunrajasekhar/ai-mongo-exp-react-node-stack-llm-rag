import Note from '../models/Note.js';
import NoteChunk from '../models/NoteChunk.js';
import { prepareChunks, searchNotes } from '../rag.js';
import { chat } from '../llm.js';
export async function listNotes(req, res) {
  res.json(await Note.find({ createdBy: req.user._id, indexed: true }).sort({ createdAt: -1 }));
}
export async function addNote(req, res) {
  const { title, subject, content } = req.body || {};
  if ([[title,150],[subject,100],[content,12000]].some(([value,max]) => typeof value !== 'string' || !value.trim() || value.trim().length > max)) {
    return res.status(400).json({ error: 'Title, subject and content are required (maximum 150, 100 and 12000 characters).' });
  }
  const note = new Note({ title: title.trim(), subject: subject.trim(), content: content.trim(), createdBy: req.user._id });
  // Embed first; do not save a note if the model is unavailable. Publish only once indexed.
  const chunks = await prepareChunks(note);
  try {
    await note.save();
    await NoteChunk.insertMany(chunks);
    note.indexed = true;
    await note.save();
  } catch (error) {
    await NoteChunk.deleteMany({ noteId: note._id });
    await Note.deleteOne({ _id: note._id, createdBy: req.user._id });
    throw error;
  }
  res.status(201).json(note);
}
export async function ask(req, res) {
  const { question, includePractice = false } = req.body || {};
  if (typeof question !== 'string' || !question.trim() || question.length > 2000 || typeof includePractice !== 'boolean') return res.status(400).json({ error: 'Provide a question up to 2000 characters and a boolean includePractice.' });
  const context = req.user.role === 'admin' ? await searchNotes(question.trim(), req.user._id) : [];
  const quiz = req.path === '/study/quiz' || includePractice;
  res.json({ ...await chat(question.trim(), context, quiz), sources: [...new Map(context.map(c => [String(c.noteId), { noteId: String(c.noteId), title: c.title }])).values()] });
}
