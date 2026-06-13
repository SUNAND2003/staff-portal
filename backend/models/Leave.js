const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    employeeId: { type: String },

    type: {
      type: String,
      enum: ['casual', 'sick', 'annual', 'maternity', 'paternity', 'unpaid', 'comp_off'],
      required: true,
    },

    startDate: { type: Date, required: true },
    endDate:   { type: Date, required: true },
    days:      { type: Number, required: true },

    reason: { type: String, required: true },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },

    // Admin action
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt:  { type: Date },
    adminNote:   { type: String, default: '' },
  },
  { timestamps: true }
);

leaveSchema.index({ employee: 1, status: 1 });
leaveSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('Leave', leaveSchema);