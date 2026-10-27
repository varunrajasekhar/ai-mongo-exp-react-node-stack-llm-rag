import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 150 },
  subject: { type: String, required: true, maxlength: 100 },
  content: { type: String, required: true, maxlength: 12000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  indexed: { type: Boolean, default: false }
}, { timestamps: true });
export default mongoose.model('Note', schema);
