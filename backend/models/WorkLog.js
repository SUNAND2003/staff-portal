const mongoose = require('mongoose');

const workLogSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    employeeId: { type: String },

    title:       { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    date: { type: String },           // "YYYY-MM-DD"

    startTime: { type: Date, default: Date.now },
    endTime:   { type: Date, default: null },

    durationSeconds: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['in_progress', 'completed'],
      default: 'in_progress',
    },

    tags: [{ type: String }],
  },
  { timestamps: true }
);

workLogSchema.index({ employee: 1, date: 1 });

module.exports = mongoose.model('WorkLog', workLogSchema);