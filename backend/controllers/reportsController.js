const Attendance = require('../models/Attendance');
const Leave      = require('../models/Leave');
const Task       = require('../models/Task');
const WorkLog    = require('../models/WorkLog');
const User       = require('../models/User');
const { getDatesInMonth, getWeekRange, toDateStr } = require('../utils/dateHelpers');

// ─── GET /api/reports  ────────────────────────────────────────────────────────
// Query: filter=today|week|month|custom, from, to, employeeId
exports.getReport = async (req, res) => {
  try {
    const { filter = 'month', from, to, employeeId } = req.query;

    let startDate, endDate;
    const now = new Date();

    if (filter === 'today') {
      startDate = endDate = toDateStr(now);
    } else if (filter === 'week') {
      const range = getWeekRange(now);
      startDate = range.start;
      endDate   = range.end;
    } else if (filter === 'custom' && from && to) {
      startDate = from;
      endDate   = to;
    } else {
      // Default: current month
      const m = now.getMonth() + 1;
      const y = now.getFullYear();
      startDate = `${y}-${String(m).padStart(2,'0')}-01`;
      endDate   = `${y}-${String(m).padStart(2,'0')}-${new Date(y, m, 0).getDate()}`;
    }

    const empFilter = {};
    if (req.user.role === 'employee') {
      empFilter.employee = req.user._id;
    } else if (employeeId) {
      empFilter.employee = employeeId;
    }

    const attendanceFilter = { ...empFilter, date: { $gte: startDate, $lte: endDate } };

    const [attendance, leaves, tasks, workLogs] = await Promise.all([
      Attendance.find(attendanceFilter).sort({ date: 1 }),
      Leave.find({
        ...(empFilter.employee ? { employee: empFilter.employee } : {}),
        status: { $in: ['approved', 'pending'] },
        startDate: { $lte: new Date(endDate) },
        endDate:   { $gte: new Date(startDate) },
      }),
      Task.find(req.user.role === 'employee' ? { assignedTo: req.user._id } : empFilter.employee ? { assignedTo: empFilter.employee } : {})
          .select('status priority completedAt dueDate'),
      WorkLog.find(attendanceFilter).sort({ date: 1 }),
    ]);

    // ── Attendance stats ──
    const presentDays = attendance.filter((r) => r.checkIn).length;
    const absentDays  = attendance.filter((r) => !r.checkIn).length;
    const lateDays    = attendance.filter((r) => r.isLate).length;
    const totalHours  = attendance.reduce((s, r) => s + (r.totalHours || 0), 0);
    const totalBreak  = attendance.reduce((s, r) => s + (r.breakSeconds || 0), 0) / 3600;

    // ── Task stats ──
    const taskStats = {
      total:      tasks.length,
      completed:  tasks.filter((t) => t.status === 'completed').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      pending:    tasks.filter((t) => t.status === 'pending').length,
      onHold:     tasks.filter((t) => t.status === 'on_hold').length,
    };

    // ── Weekly chart data ──
    const weekDays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const weeklyData = weekDays.map((day, i) => {
      const dayRecords = attendance.filter((r) => {
        const d = new Date(r.date);
        return d.getDay() === (i + 1) % 7;
      });
      const avgWork  = dayRecords.length
        ? dayRecords.reduce((s, r) => s + (r.totalHours || 0), 0) / dayRecords.length
        : 0;
      const avgBreak = dayRecords.length
        ? dayRecords.reduce((s, r) => s + (r.breakSeconds || 0) / 3600, 0) / dayRecords.length
        : 0;
      return { day, work: Math.round(avgWork * 10) / 10, break: Math.round(avgBreak * 100) / 100, target: 8 };
    });

    // ── Monthly chart data ──
    const monthlyData = attendance.map((r) => ({
      date:   parseInt(r.date.split('-')[2]),
      hours:  Math.round((r.totalHours || 0) * 10) / 10,
      status: r.checkIn
        ? (r.isLate ? 'late' : 'present')
        : 'absent',
    }));

    res.json({
      filter, startDate, endDate,
      totalDays:         attendance.length,
      presentDays,
      absentDays,
      lateDays,
      totalHours:        Math.round(totalHours * 10) / 10,
      avgHours:          presentDays > 0 ? Math.round((totalHours / presentDays) * 10) / 10 : 0,
      totalBreak:        Math.round(totalBreak * 10) / 10,
      attendancePercent: attendance.length > 0 ? Math.round((presentDays / attendance.length) * 100) : 0,
      leaveDays:         leaves.reduce((s, l) => s + l.days, 0),
      taskStats,
      weeklyData,
      monthlyData,
    });
  } catch (err) {
    console.error('Reports error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─── GET /api/reports/admin  (admin/manager – full team report) ───────────────
exports.getAdminReport = async (req, res) => {
  try {
    const today = toDateStr(new Date());

    const [totalEmployees, todayAttendance, pendingLeaves, openTasks] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' }, status: 'active' }),
      Attendance.find({ date: today }).populate('employee', 'name department'),
      Leave.countDocuments({ status: 'pending' }),
      Task.countDocuments({ status: { $in: ['pending', 'in_progress'] } }),
    ]);

    const present  = todayAttendance.filter((a) => a.checkIn).length;
    const onBreak  = todayAttendance.filter((a) => a.status === 'on_break').length;
    const absent   = totalEmployees - present;

    res.json({
      totalEmployees,
      todayPresent:  present,
      todayAbsent:   absent,
      todayOnBreak:  onBreak,
      pendingLeaves,
      openTasks,
      todayAttendance,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
};