const Leave = require('../models/Leave');
const User  = require('../models/User');
const { countWorkingDays } = require('../utils/dateHelpers');

// ─── POST /api/leaves ─────────────────────────────────────────────────────────
exports.applyLeave = async (req, res) => {
  try {
    const { type, startDate, endDate, reason } = req.body;

    if (!type || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: 'type, startDate, endDate, and reason are required.' });
    }

    const start = new Date(startDate);
    const end   = new Date(endDate);

    if (end < start) {
      return res.status(400).json({ message: 'End date cannot be before start date.' });
    }

    const days = countWorkingDays(start, end);

    // Check leave balance (skip for unpaid)
    if (type !== 'unpaid') {
      const user = await User.findById(req.user._id);
      const balance = user.leaveBalance[type] ?? 0;
      if (balance < days) {
        return res.status(400).json({
          message: `Insufficient ${type} leave balance. Available: ${balance}, Required: ${days}`,
        });
      }
    }

    // Check for overlapping pending/approved leaves
    const overlap = await Leave.findOne({
      employee: req.user._id,
      status:   { $in: ['pending', 'approved'] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } },
      ],
    });
    if (overlap) {
      return res.status(409).json({ message: 'Leave overlaps with an existing request.' });
    }

    const leave = await Leave.create({
      employee:   req.user._id,
      employeeId: req.user.employeeId,
      type,
      startDate:  start,
      endDate:    end,
      days,
      reason,
    });

    res.status(201).json(leave);
  } catch (err) {
    console.error('Apply leave error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── GET /api/leaves/my ───────────────────────────────────────────────────────
exports.getMyLeaves = async (req, res) => {
  try {
    const { status, type } = req.query;
    const filter = { employee: req.user._id };
    if (status) filter.status = status;
    if (type)   filter.type   = type;

    const leaves = await Leave.find(filter)
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── GET /api/leaves/all  (admin/manager) ────────────────────────────────────
exports.getAllLeaves = async (req, res) => {
  try {
    const { status, type, department } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type)   filter.type   = type;

    const leaves = await Leave.find(filter)
      .populate('employee',   'name employeeId department designation avatar')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });

    const filtered = department
      ? leaves.filter((l) => l.employee?.department === department)
      : leaves;

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── GET /api/leaves/:id ──────────────────────────────────────────────────────
exports.getById = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id)
      .populate('employee',   'name employeeId department designation')
      .populate('reviewedBy', 'name');

    if (!leave) return res.status(404).json({ message: 'Leave not found.' });

    // Only owner or admin/manager can view
    if (
      req.user.role === 'employee' &&
      leave.employee._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    res.json(leave);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── PATCH /api/leaves/:id/cancel ────────────────────────────────────────────
exports.cancelLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave not found.' });

    if (leave.employee.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Cannot cancel another employee\'s leave.' });
    }
    if (!['pending', 'approved'].includes(leave.status)) {
      return res.status(400).json({ message: 'Cannot cancel this leave.' });
    }

    // Restore balance if it was approved
    if (leave.status === 'approved' && leave.type !== 'unpaid') {
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { [`leaveBalance.${leave.type}`]: leave.days },
      });
    }

    leave.status = 'cancelled';
    await leave.save();

    res.json({ success: true, leave });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── PATCH /api/leaves/:id/approve  (admin/manager) ──────────────────────────
exports.approveLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave not found.' });
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Leave is not pending.' });
    }

    leave.status     = 'approved';
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    leave.adminNote  = req.body.note || '';
    await leave.save();

    // Deduct leave balance
    if (leave.type !== 'unpaid') {
      await User.findByIdAndUpdate(leave.employee, {
        $inc: { [`leaveBalance.${leave.type}`]: -leave.days },
      });
    }

    const populated = await leave.populate('employee', 'name employeeId department');
    res.json({ success: true, leave: populated });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── PATCH /api/leaves/:id/reject  (admin/manager) ───────────────────────────
exports.rejectLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave not found.' });
    if (leave.status !== 'pending') {
      return res.status(400).json({ message: 'Leave is not pending.' });
    }

    leave.status     = 'rejected';
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    leave.adminNote  = req.body.note || '';
    await leave.save();

    const populated = await leave.populate('employee', 'name employeeId department');
    res.json({ success: true, leave: populated });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── GET /api/leaves/balance ──────────────────────────────────────────────────
exports.getLeaveBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('leaveBalance');
    res.json(user.leaveBalance);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};