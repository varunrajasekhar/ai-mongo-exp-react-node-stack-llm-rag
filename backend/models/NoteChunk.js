import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true, index: true },
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
  embeddingModel: { type: String, required: true }
});
export default mongoose.model('NoteChunk', schema);
