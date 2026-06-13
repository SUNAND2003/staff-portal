const Punch = require('../models/Punch');
const Attendance = require('../models/Attendance');
const { todayStr } = require('../utils/dateHelpers');

// ─── POST /api/attendance/punch ────────────────────────────────────────────────
// Save punch event to database
exports.recordPunch = async (req, res) => {
  try {
    const { action, status } = req.body;

    if (!action || !status) {
      return res.status(400).json({ 
        success: false,
        message: 'Action and status are required.' 
      });
    }

    // Validate action type
    const validActions = ['Punch In', 'Punch Out', 'Break Start', 'Break End'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ 
        success: false,
        message: `Invalid action. Must be one of: ${validActions.join(', ')}` 
      });
    }

    // Validate status type
    const validStatuses = ['Working', 'On Break', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const now = new Date();
    const today = todayStr();

    // Get current attendance record to validate punch actions
    const attendance = await Attendance.findOne({
      employee: req.user._id,
      date: today,
    });

    // Validate punch-in: employee must not be already punched in
    if (action === 'Punch In') {
      if (attendance && attendance.checkIn && !attendance.checkOut) {
        return res.status(400).json({
          success: false,
          message: 'Already checked in today. Please punch out first.'
        });
      }
    }

    // Validate punch-out: employee must be punched in
    if (action === 'Punch Out') {
      if (!attendance || !attendance.checkIn || attendance.checkOut) {
        return res.status(400).json({
          success: false,
          message: 'Not currently checked in. Please punch in first.'
        });
      }
    }

    // Validate break-start: employee must be working (not on break, must be checked in)
    if (action === 'Break Start') {
      if (!attendance || !attendance.checkIn || attendance.checkOut) {
        return res.status(400).json({
          success: false,
          message: 'Not currently working. Please punch in first.'
        });
      }
      if (attendance.status === 'on_break') {
        return res.status(400).json({
          success: false,
          message: 'Already on break. Please end break first.'
        });
      }
    }

    // Validate break-end: employee must be on break
    if (action === 'Break End') {
      if (!attendance || attendance.status !== 'on_break') {
        return res.status(400).json({
          success: false,
          message: 'Not currently on break. Please start a break first.'
        });
      }
    }

    // Create punch record
    const punch = new Punch({
      employee: req.user._id,
      employeeId: req.user.employeeId,
      employeeName: req.user.name,
      action,
      status,
      timestamp: now,
      date: today,
    });

    const savedPunch = await punch.save();

    // Also update Attendance record based on action
    if (action === 'Punch In') {
      let newAttendance = await Attendance.findOne({
        employee: req.user._id,
        date: today,
      });

      if (!newAttendance) {
        const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 15);
        newAttendance = new Attendance({
          employee: req.user._id,
          employeeId: req.user.employeeId,
          date: today,
          checkIn: now,
          status: 'working',
          isLate,
        });
      } else if (!newAttendance.checkIn) {
        newAttendance.checkIn = now;
        newAttendance.status = 'working';
      }

      await newAttendance.save();
    } else if (action === 'Punch Out') {
      let newAttendance = await Attendance.findOne({
        employee: req.user._id,
        date: today,
      });

      if (newAttendance && newAttendance.checkIn && !newAttendance.checkOut) {
        newAttendance.checkOut = now;
        newAttendance.status = 'checked_out';
        
        // Calculate work hours
        const workSeconds = (newAttendance.checkOut - newAttendance.checkIn) / 1000;
        const breakSeconds = (newAttendance.breaks || []).reduce((sum, b) => {
          if (b.end) return sum + (b.end - b.start) / 1000;
          return sum;
        }, 0);
        
        newAttendance.workSeconds = Math.max(0, workSeconds - breakSeconds);
        newAttendance.totalHours = Math.round((newAttendance.workSeconds / 3600) * 100) / 100;
        
        await newAttendance.save();
      }
    } else if (action === 'Break Start') {
      let newAttendance = await Attendance.findOne({
        employee: req.user._id,
        date: today,
      });

      if (newAttendance) {
        newAttendance.breaks.push({ start: now });
        newAttendance.status = 'on_break';
        await newAttendance.save();
      }
    } else if (action === 'Break End') {
      let newAttendance = await Attendance.findOne({
        employee: req.user._id,
        date: today,
      });

      if (newAttendance && newAttendance.status === 'on_break') {
        const openBreak = newAttendance.breaks.find((b) => !b.end);
        if (openBreak) {
          openBreak.end = now;
          openBreak.durationSeconds = Math.floor((now - openBreak.start) / 1000);
        }
        newAttendance.status = 'working';
        await newAttendance.save();
      }
    }

    console.log(`✅ Punch recorded: ${action} by ${req.user.employeeId} at ${now}`);

    res.json({ 
      success: true, 
      punch: savedPunch,
      message: `${action} recorded successfully` 
    });
  } catch (err) {
    console.error('❌ Punch record error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to record punch. Please try again.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ─── GET /api/attendance/punches/today ────────────────────────────────────────
// Get today's punches for current user
exports.getTodayPunches = async (req, res) => {
  try {
    const punches = await Punch.find({
      employee: req.user._id,
      date: todayStr(),
    }).sort({ timestamp: -1 });

    res.json({
      success: true,
      punches,
      count: punches.length,
    });
  } catch (err) {
    console.error('Error fetching today punches:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch punches.' 
    });
  }
};

// ─── GET /api/attendance/punches/live (admin/manager) ──────────────────────────
// Get all punches from today for admin dashboard - real-time feed
exports.getLivePunches = async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.query;

    const punches = await Punch.find({
      date: todayStr(),
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select('_id employee employeeId employeeName action status timestamp date');

    const total = await Punch.countDocuments({ date: todayStr() });

    res.json({
      success: true,
      punches,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('❌ Live punches error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch live punches.' 
    });
  }
};

// ─── GET /api/attendance/punches/employee/:employeeId ──────────────────────────
// Get punches for specific employee (admin/manager only)
exports.getEmployeePunches = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { date, limit = 20 } = req.query;
    const filterDate = date || todayStr();

    const punches = await Punch.find({
      employeeId,
      date: filterDate,
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      punches,
      count: punches.length,
      employeeId,
      date: filterDate,
    });
  } catch (err) {
    console.error('Error fetching employee punches:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch employee punches.' 
    });
  }
};

// ─── GET /api/attendance/punches/all ────────────────────────────────────────────
// Get all punches with pagination (admin/manager only)
exports.getAllPunches = async (req, res) => {
  try {
    const { date, startDate, endDate, limit = 100, skip = 0, employeeId } = req.query;

    const filter = {};
    if (employeeId) filter.employeeId = employeeId;

    if (date === 'all') {
      // no date filter — fetch everything
    } else if (startDate && endDate) {
      filter.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      filter.date = startDate;
    } else if (date) {
      filter.date = date;
    } else {
      filter.date = todayStr();
    }

    // ── Fetch from Punch collection ──────────────────────────────────────────
    const parsedLimit = parseInt(limit);
    const punchQuery = Punch.find(filter).sort({ timestamp: -1 });
    if (parsedLimit > 0) punchQuery.limit(parsedLimit);
    const punchDocs = await punchQuery;

    // ── Fetch from Attendance collection (covers days with no Punch records) ─
    // Build attendance filter — Attendance uses employee ObjectId, not employeeId string
    const attFilter = {};
    if (filter.date) attFilter.date = filter.date;                 // same $gte/$lte or exact
    if (employeeId)  attFilter.employeeId = employeeId;            // denormalized string field

    const attDocs = await Attendance.find(attFilter)
      .populate('employee', 'name employeeId')
      .sort({ date: -1, checkIn: -1 });

    // Dates already covered by real Punch records — skip synthesising for those
    const punchDates = new Set(punchDocs.map(p => `${p.employeeId}|${p.date}`));

    // Synthesise punch-like rows from Attendance for any date not in punchDates
    const synthetic = [];
    for (const att of attDocs) {
      const empId   = att.employeeId || att.employee?.employeeId || '';
      const empName = att.employee?.name || '';
      const d       = att.date;

      if (punchDates.has(`${empId}|${d}`)) continue; // real punches exist — skip

      if (att.checkIn) {
        synthetic.push({
          _id:          `synth-in-${att._id}`,
          employee:     att.employee?._id,
          employeeId:   empId,
          employeeName: empName,
          action:       'Punch In',
          status:       'Working',
          timestamp:    att.checkIn,
          date:         d,
        });
      }
      if (att.checkOut) {
        synthetic.push({
          _id:          `synth-out-${att._id}`,
          employee:     att.employee?._id,
          employeeId:   empId,
          employeeName: empName,
          action:       'Punch Out',
          status:       'Completed',
          timestamp:    att.checkOut,
          date:         d,
        });
      }
    }

    // Merge and sort by timestamp descending
    const allPunches = [...punchDocs, ...synthetic]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      punches:  allPunches,
      total:    allPunches.length,
      limit:    parsedLimit,
      skip:     parseInt(skip),
    });
  } catch (err) {
    console.error('Error fetching all punches:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch punches.' 
    });
  }
};

// ─── GET /api/attendance/punches/my ────────────────────────────────────────────
// Get all punches for logged-in employee (with optional date range / month filter)
exports.getMyPunches = async (req, res) => {
  try {
    const { from, to, month, year } = req.query;

    const filter = { employee: req.user._id };

    if (from && to) {
      const startDate = new Date(from);
      const endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      filter.timestamp = { $gte: startDate, $lte: endDate };
    } else if (month && year) {
      const m = parseInt(month);
      const y = parseInt(year);
      const startDate = new Date(y, m - 1, 1);
      const endDate = new Date(y, m, 0, 23, 59, 59, 999);
      filter.timestamp = { $gte: startDate, $lte: endDate };
    }

    const punches = await Punch.find(filter).sort({ timestamp: -1 });

    res.json({
      success: true,
      punches,
      count: punches.length,
    });
  } catch (err) {
    console.error('Error fetching own punches:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch employee punches.' 
    });
  }
};