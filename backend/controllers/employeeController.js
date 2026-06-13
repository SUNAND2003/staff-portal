const User = require('../models/User');
const Attendance = require('../models/Attendance');

// ─── GET /api/employees ───────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { department, role, status, search } = req.query;
    const filter = {};

    if (department) filter.department = department;
    if (role)       filter.role = role;
    if (status)     filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const employees = await User.find(filter).sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── GET /api/employees/:id ───────────────────────────────────────────────────
exports.getById = async (req, res) => {
  try {
    const user = await User.findOne({ employeeId: req.params.id });
    if (!user) return res.status(404).json({ message: 'Employee not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── POST /api/employees ──────────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { username, password, name, department, role, email, designation, phone } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ message: 'Username, password, and name are required.' });
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    const employee = new User({
      username: username.toLowerCase(),
      password,
      plainPassword: password, // ← store plain-text for admin dashboard
      name,
      department: department || 'General',
      role: role || 'employee',
      email: email || '',
      designation: designation || '',
      phone: phone || '',
    });

    await employee.save();
    res.status(201).json(employee);
  } catch (err) {
    console.error('Create employee error:', err);
    res.status(500).json({ message: err.message || 'Server error.' });
  }
};

// ─── PATCH /api/employees/:id ─────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const allowedFields = [
      'name', 'email', 'department', 'designation', 'phone',
      'role', 'status', 'avatar', 'joiningDate', 'address', 'bio', 'skills',
      'emergencyContact', 'leaveBalance',
    ];
    const updates = {};
    allowedFields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const user = await User.findOneAndUpdate(
      { employeeId: req.params.id },
      updates,
      { new: true, runValidators: true }
    );

    if (!user) return res.status(404).json({ message: 'Employee not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error.' });
  }
};

// ─── PATCH /api/employees/:id/toggle-status ──────────────────────────────────
exports.toggleStatus = async (req, res) => {
  try {
    const user = await User.findOne({ employeeId: req.params.id });
    if (!user) return res.status(404).json({ message: 'Employee not found.' });

    user.status = user.status === 'active' ? 'inactive' : 'active';
    await user.save();

    res.json({ message: `Employee ${user.status}.`, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── DELETE /api/employees/:id ────────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const user = await User.findOne({ employeeId: req.params.id });
    if (!user) return res.status(404).json({ message: 'Employee not found.' });

    // Prevent deleting self
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account.' });
    }

    await User.findByIdAndDelete(user._id);
    res.json({ success: true, message: 'Employee deleted successfully.' });
  } catch (err) {
    console.error('Delete employee error:', err);
    res.status(500).json({ message: err.message || 'Server error.' });
  }
};

// ─── PATCH /api/employees/:id/reset-password ─────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findOne({ employeeId: req.params.id });
    if (!user) return res.status(404).json({ message: 'Employee not found.' });

    // Prevent admin from resetting own password this way
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Use change-password endpoint for your own account.' });
    }

    user.password = newPassword;
    user.plainPassword = newPassword; // ← keep plain-text in sync
    await user.save();

    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: err.message || 'Server error.' });
  }
};

// ─── GET /api/employees/:id/attendance-summary ────────────────────────────────
exports.attendanceSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year)  || new Date().getFullYear();

    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate   = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;

    const user = await User.findOne({ employeeId: req.params.id });
    if (!user) return res.status(404).json({ message: 'Employee not found.' });

    const records = await Attendance.find({
      employee: user._id,
      date: { $gte: startDate, $lte: endDate },
    });

    const present  = records.filter((r) => ['working', 'checked_out', 'on_break'].includes(r.status)).length;
    const absent   = records.filter((r) => r.status === 'absent').length;
    const onLeave  = records.filter((r) => r.status === 'on_leave').length;
    const late     = records.filter((r) => r.isLate).length;
    const totalHrs = records.reduce((sum, r) => sum + r.totalHours, 0);

    res.json({
      month: m, year: y,
      present, absent, onLeave, late,
      totalHours: Math.round(totalHrs * 10) / 10,
      records,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};