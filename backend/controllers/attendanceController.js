const Attendance = require('../models/Attendance');
const { todayStr, toDateStr } = require('../utils/dateHelpers');

const WORK_START_HOUR = 9; // 9:00 AM = on time threshold

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getTodayRecord = async (employeeId) => {
  return Attendance.findOne({ employee: employeeId, date: todayStr() });
};

const calcWorkSeconds = (checkIn, checkOut, breaks) => {
  const total = (checkOut - checkIn) / 1000;
  const breakSecs = breaks.reduce((sum, b) => {
    if (b.start && b.end) sum += (b.end - b.start) / 1000;
    return sum;
  }, 0);
  return Math.max(0, total - breakSecs);
};

// ─── POST /api/attendance/checkin ─────────────────────────────────────────────
exports.checkIn = async (req, res) => {
  try {
    const today = todayStr();
    let record = await getTodayRecord(req.user._id);

    if (record && record.checkIn) {
      return res.status(400).json({ message: 'Already checked in today.' });
    }

    const now = new Date();
    const isLate = now.getHours() > WORK_START_HOUR ||
                   (now.getHours() === WORK_START_HOUR && now.getMinutes() > 15);

    if (record) {
      record.checkIn = now;
      record.status  = 'working';
      record.isLate  = isLate;
    } else {
      record = new Attendance({
        employee:   req.user._id,
        employeeId: req.user.employeeId,
        date:       today,
        checkIn:    now,
        status:     'working',
        isLate,
      });
    }

    await record.save();
    res.json({ checkInTime: now, status: 'working', isLate, record });
  } catch (err) {
    console.error('CheckIn error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── POST /api/attendance/checkout ────────────────────────────────────────────
exports.checkOut = async (req, res) => {
  try {
    const record = await getTodayRecord(req.user._id);

    if (!record || !record.checkIn) {
      return res.status(400).json({ message: 'Not checked in today.' });
    }
    if (record.checkOut) {
      return res.status(400).json({ message: 'Already checked out.' });
    }

    // Close any open break
    if (record.status === 'on_break') {
      const openBreak = record.breaks.find((b) => !b.end);
      if (openBreak) {
        openBreak.end = new Date();
        openBreak.durationSeconds = Math.floor((openBreak.end - openBreak.start) / 1000);
      }
    }

    const now = new Date();
    record.checkOut     = now;
    record.status       = 'checked_out';
    record.workSeconds  = Math.floor(calcWorkSeconds(record.checkIn, now, record.breaks));
    record.breakSeconds = record.breaks.reduce((s, b) => s + (b.durationSeconds || 0), 0);
    record.totalHours   = Math.round((record.workSeconds / 3600) * 100) / 100;

    await record.save();
    res.json({ checkOutTime: now, status: 'checked_out', record });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── POST /api/attendance/break/start ─────────────────────────────────────────
exports.breakStart = async (req, res) => {
  try {
    const record = await getTodayRecord(req.user._id);

    if (!record || !record.checkIn || record.checkOut) {
      return res.status(400).json({ message: 'Not currently working.' });
    }
    if (record.status === 'on_break') {
      return res.status(400).json({ message: 'Already on break.' });
    }

    const now = new Date();
    record.breaks.push({ start: now });
    record.status = 'on_break';
    await record.save();

    res.json({ breakStartTime: now, status: 'on_break' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── POST /api/attendance/break/end ───────────────────────────────────────────
exports.breakEnd = async (req, res) => {
  try {
    const record = await getTodayRecord(req.user._id);

    if (!record || record.status !== 'on_break') {
      return res.status(400).json({ message: 'Not on break.' });
    }

    const now = new Date();
    const openBreak = record.breaks.find((b) => !b.end);
    if (openBreak) {
      openBreak.end = now;
      openBreak.durationSeconds = Math.floor((now - openBreak.start) / 1000);
    }

    record.status = 'working';
    await record.save();

    res.json({ breakEndTime: now, status: 'working' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── GET /api/attendance/today ────────────────────────────────────────────────
exports.getToday = async (req, res) => {
  try {
    const record = await getTodayRecord(req.user._id);
    res.json(record || { status: 'absent', date: todayStr() });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── GET /api/attendance/my ───────────────────────────────────────────────────
exports.getMyAttendance = async (req, res) => {
  try {
    const { month, year, from, to } = req.query;

    let startDate, endDate;

    if (from && to) {
      startDate = from;
      endDate   = to;
    } else {
      const m = parseInt(month) || new Date().getMonth() + 1;
      const y = parseInt(year)  || new Date().getFullYear();
      startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      endDate   = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;
    }

    const records = await Attendance.find({
      employee: req.user._id,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    res.json({ records, startDate, endDate });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── GET /api/attendance/all  (admin/manager) ─────────────────────────────────
exports.getAllAttendance = async (req, res) => {
  try {
    const { date, from, to, department, employeeId } = req.query;
    const filter = {};

    if (date) {
      filter.date = date;
    } else if (from && to) {
      filter.date = { $gte: from, $lte: to };
    } else {
      filter.date = todayStr();
    }

    const records = await Attendance.find(filter)
      .populate('employee', 'name employeeId department designation avatar role status')
      .sort({ checkIn: -1 });

    // Filter by department if requested
    const filtered = department
      ? records.filter((r) => r.employee?.department === department)
      : records;

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── GET /api/attendance/report ───────────────────────────────────────────────
exports.getReport = async (req, res) => {
  try {
    const { month, year, employeeId } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year)  || new Date().getFullYear();

    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate   = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;

    const filter = {
      date: { $gte: startDate, $lte: endDate },
    };

    // Employee can only see their own; admin can specify
    if (req.user.role === 'employee') {
      filter.employee = req.user._id;
    } else if (employeeId) {
      filter.employee = employeeId;
    }

    const records = await Attendance.find(filter).sort({ date: 1 });

    const present  = records.filter((r) => r.checkIn).length;
    const absent   = records.filter((r) => !r.checkIn).length;
    const late     = records.filter((r) => r.isLate).length;
    const totalHrs = records.reduce((s, r) => s + r.totalHours, 0);

    res.json({
      month: m, year: y, startDate, endDate,
      totalDays: records.length,
      presentDays: present,
      absentDays: absent,
      lateDays: late,
      totalHours: Math.round(totalHrs * 10) / 10,
      avgHours: present > 0 ? Math.round((totalHrs / present) * 10) / 10 : 0,
      attendancePercent: records.length > 0 ? Math.round((present / records.length) * 100) : 0,
      records,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};