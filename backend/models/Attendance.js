const mongoose = require('mongoose');

const breakSchema = new mongoose.Schema(
  {
    start: { type: Date, required: true },
    end:   { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    employeeId: { type: String },   // denormalized for fast queries
    date: {
      type: String,                 // "YYYY-MM-DD"
      required: true,
    },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },

    status: {
      type: String,
      enum: ['working', 'on_break', 'checked_out', 'absent', 'on_leave'],
      default: 'absent',
    },

    breaks: [breakSchema],

    workSeconds: { type: Number, default: 0 },   // total work time (excl. breaks)
    breakSeconds: { type: Number, default: 0 },  // total break time

    // Derived fields updated on checkOut
    totalHours: { type: Number, default: 0 },
    isLate: { type: Boolean, default: false },

    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Unique per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);