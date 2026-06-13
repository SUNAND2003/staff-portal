const WorkLog = require('../models/WorkLog');
const { todayStr } = require('../utils/dateHelpers');

// ─── GET /api/worklogs/today ──────────────────────────────────────────────────
exports.getToday = async (req, res) => {
  try {
    const logs = await WorkLog.find({
      employee: req.user._id,
      date: todayStr(),
    }).sort({ startTime: 1 });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── GET /api/worklogs ────────────────────────────────────────────────────────
exports.getMyLogs = async (req, res) => {
  try {
    const { from, to, date } = req.query;
    const filter = { employee: req.user._id };

    if (date)       filter.date = date;
    else if (from)  filter.date = { $gte: from, ...(to && { $lte: to }) };

    const logs = await WorkLog.find(filter).sort({ startTime: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── GET /api/worklogs/all  (admin/manager) ───────────────────────────────────
exports.getAllLogs = async (req, res) => {
  try {
    const { date, employeeId } = req.query;
    const filter = {};
    if (date)       filter.date = date;
    if (employeeId) filter.employee = employeeId;

    const logs = await WorkLog.find(filter)
      .populate('employee', 'name employeeId department avatar')
      .sort({ startTime: -1 });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── POST /api/worklogs ───────────────────────────────────────────────────────
exports.addLog = async (req, res) => {
  try {
    const { title, description, tags } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required.' });
    }

    // Check for any in-progress log
    const inProgress = await WorkLog.findOne({
      employee: req.user._id,
      status:   'in_progress',
    });
    if (inProgress) {
      return res.status(400).json({
        message: 'You have an in-progress work log. Please end it before starting a new one.',
      });
    }

    const log = await WorkLog.create({
      employee:   req.user._id,
      employeeId: req.user.employeeId,
      title,
      description: description || '',
      date:        todayStr(),
      startTime:   new Date(),
      tags:        tags || [],
    });

    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── PATCH /api/worklogs/:id/end ─────────────────────────────────────────────
exports.endLog = async (req, res) => {
  try {
    const log = await WorkLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: 'Work log not found.' });

    if (log.employee.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    if (log.status === 'completed') {
      return res.status(400).json({ message: 'Work log already ended.' });
    }

    const now = new Date();
    log.endTime         = now;
    log.durationSeconds = Math.floor((now - log.startTime) / 1000);
    log.status          = 'completed';
    await log.save();

    res.json(log);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── DELETE /api/worklogs/:id ─────────────────────────────────────────────────
exports.deleteLog = async (req, res) => {
  try {
    const log = await WorkLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: 'Work log not found.' });

    if (
      log.employee.toString() !== req.user._id.toString() &&
      !['admin', 'manager'].includes(req.user.role)
    ) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    await log.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};