const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    title: { type: String, default: 'Generated Document' },
    prompt: { type: String, required: true },
    content: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', DocumentSchema);
