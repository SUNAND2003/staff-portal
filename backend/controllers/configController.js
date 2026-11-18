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
        networkRestrictionEnabled: true,
        allowedWifiSsid: 'HEXA_5G',
        allowedIpv6Prefixes: ['2405:201:f006:b86f'],
        allowedIpv4Addresses: ['49.47.199.103', '192.168.29.'],
        allowedSubnets: ['192.168.29.'],
        allowAdminBypass: true,
      });
      await config.save();
    }

    const clientIp = (
      req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.socket.remoteAddress ||
      ''
    ).split(',')[0].trim();
    
    res.json({
      ...config.toObject(),
      detectedClientIp: clientIp,
    });
  } catch (err) {
    console.error('Error fetching working hours:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Update working hours configuration (admin only)
exports.updateWorkingHours = async (req, res) => {
  try {
    const {
      punchInTime,
      punchOutTime,
      lateThresholdMinutes,
      breakDurationMinutes,
      notes,
      networkRestrictionEnabled,
      allowedWifiSsid,
      allowedIpv6Prefixes,
      allowedIpv4Addresses,
      allowedSubnets,
      allowAdminBypass,
    } = req.body;

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
    if (networkRestrictionEnabled !== undefined) config.networkRestrictionEnabled = Boolean(networkRestrictionEnabled);
    if (allowedWifiSsid !== undefined) config.allowedWifiSsid = String(allowedWifiSsid).trim();
    if (allowedIpv6Prefixes !== undefined) {
      config.allowedIpv6Prefixes = Array.isArray(allowedIpv6Prefixes)
        ? allowedIpv6Prefixes
        : String(allowedIpv6Prefixes).split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (allowedIpv4Addresses !== undefined) {
      config.allowedIpv4Addresses = Array.isArray(allowedIpv4Addresses)
        ? allowedIpv4Addresses
        : String(allowedIpv4Addresses).split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (allowedSubnets !== undefined) {
      config.allowedSubnets = Array.isArray(allowedSubnets)
        ? allowedSubnets
        : String(allowedSubnets).split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (allowAdminBypass !== undefined) config.allowAdminBypass = Boolean(allowAdminBypass);

    await config.save();

    res.json({ message: 'Configuration updated successfully', config });
  } catch (err) {
    console.error('Error updating working hours:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};
