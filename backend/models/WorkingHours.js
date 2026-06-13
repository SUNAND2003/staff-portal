const mongoose = require('mongoose');

const workingHoursSchema = new mongoose.Schema(
  {
    // Company-wide working hours configuration
    punchInTime: {
      type: String,
      default: '09:00', // HH:mm format (9:00 AM)
      required: true,
    },
    punchOutTime: {
      type: String,
      default: '20:00', // HH:mm format (8:00 PM)
      required: true,
    },
    lateThresholdMinutes: {
      type: Number,
      default: 15, // Minutes after punch in time to mark as late
    },
    // Additional config
    breakDurationMinutes: {
      type: Number,
      default: 60,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Keep only one record per configuration
workingHoursSchema.index({ _id: 1 }, { unique: true });

module.exports = mongoose.model('WorkingHours', workingHoursSchema);
