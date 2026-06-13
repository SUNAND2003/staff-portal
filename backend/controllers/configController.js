const WorkingHours = require('../models/WorkingHours');

// Get working hours configuration
exports.getWorkingHours = async (req, res) => {
  try {
    let config = await WorkingHours.findOne();
    
    // Create default config if doesn't exist
    if (!config) {
      config = new WorkingHours({
        punchInTime: '09:00',
        punchOutTime: '20:00',
        lateThresholdMinutes: 15,
        breakDurationMinutes: 60,
      });
      await config.save();
    }
    
    res.json(config);
  } catch (err) {
    console.error('Error fetching working hours:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Update working hours configuration (admin only)
exports.updateWorkingHours = async (req, res) => {
  try {
    const { punchInTime, punchOutTime, lateThresholdMinutes, breakDurationMinutes, notes } = req.body;

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (punchInTime && !timeRegex.test(punchInTime)) {
      return res.status(400).json({ message: 'Invalid punch in time format. Use HH:mm (e.g., 09:00)' });
    }
    if (punchOutTime && !timeRegex.test(punchOutTime)) {
      return res.status(400).json({ message: 'Invalid punch out time format. Use HH:mm (e.g., 20:00)' });
    }

    let config = await WorkingHours.findOne();
    
    if (!config) {
      config = new WorkingHours();
    }

    if (punchInTime) config.punchInTime = punchInTime;
    if (punchOutTime) config.punchOutTime = punchOutTime;
    if (lateThresholdMinutes !== undefined) config.lateThresholdMinutes = lateThresholdMinutes;
    if (breakDurationMinutes !== undefined) config.breakDurationMinutes = breakDurationMinutes;
    if (notes !== undefined) config.notes = notes;

    await config.save();

    res.json({ message: 'Working hours updated successfully', config });
  } catch (err) {
    console.error('Error updating working hours:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};
