const mongoose = require('mongoose');

const punchSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    action: {
      type: String,
      enum: ['Punch In', 'Punch Out', 'Break Start', 'Break End'],
      required: true,
    },
    status: {
      type: String,
      enum: ['Working', 'On Break', 'Completed'],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    date: {
      type: String, // "YYYY-MM-DD"
      required: true,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
punchSchema.index({ employee: 1, date: 1 });
punchSchema.index({ date: 1 });
punchSchema.index({ timestamp: -1 });
punchSchema.index({ employeeId: 1 });

module.exports = mongoose.model('Punch', punchSchema);
