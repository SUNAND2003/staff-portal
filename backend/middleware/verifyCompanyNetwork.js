const WorkingHours = require('../models/WorkingHours');

/**
 * Helper to extract client IP reliably behind proxies (Render, Cloudflare, etc.)
 */
function getClientIp(req) {
  let ip = '';

  // 1. Check Cloudflare
  if (req.headers && req.headers['cf-connecting-ip']) {
    ip = req.headers['cf-connecting-ip'];
  }
  // 2. Check X-Forwarded-For (Render reverse proxy)
  else if (req.headers && req.headers['x-forwarded-for']) {
    const list = String(req.headers['x-forwarded-for']).split(',');
    ip = list[0].trim();
  }
  // 3. Check X-Real-IP
  else if (req.headers && req.headers['x-real-ip']) {
    ip = String(req.headers['x-real-ip']).trim();
  }
  // 4. Fallback to Express req.ip or socket
  else if (req.ip) {
    ip = req.ip;
  } else if (req.socket && req.socket.remoteAddress) {
    ip = req.socket.remoteAddress;
  }

  // Strip brackets from IPv6 [2405:...]:port
  ip = ip.replace(/^\[/, '').replace(/\](?::\d+)?$/, '');

  // Strip IPv4 mapped IPv6 prefix (::ffff:192.168.1.1 -> 192.168.1.1)
  ip = ip.replace(/^::ffff:/, '');

  // Strip port from IPv4 (e.g. 49.47.199.103:54321 -> 49.47.199.103)
  if (ip.includes('.') && ip.includes(':')) {
    ip = ip.split(':')[0];
  }

  return ip.trim();
}

/**
 * Checks if the given IP matches allowed company network configurations
 */
function isIpAllowed(clientIp, config) {
  if (!clientIp) return false;

  // Localhost development fallback (only outside production)
  const isLocalhost =
    clientIp === '127.0.0.1' ||
    clientIp === '::1' ||
    clientIp === 'localhost';

  if (isLocalhost && process.env.NODE_ENV !== 'production') {
    return true;
  }

  const clientLower = clientIp.toLowerCase();

  // 1. IPv6 Prefix check (e.g. 2405:201:f006:b86f)
  const allowedV6 = (config.allowedIpv6Prefixes || []).map((p) => p.trim().toLowerCase()).filter(Boolean);
  const matchV6 = allowedV6.some((prefix) => clientLower.startsWith(prefix));
  if (matchV6) return true;

  // 2. IPv4 Address or Subnet check (e.g. 49.47.199.103, 192.168.29.)
  const allowedV4 = (config.allowedIpv4Addresses || []).map((p) => p.trim()).filter(Boolean);
  const matchV4 = allowedV4.some((ip) => clientIp === ip || clientIp.startsWith(ip));
  if (matchV4) return true;

  // 3. Local Subnet check (e.g. 192.168.29.)
  const allowedSubnets = (config.allowedSubnets || []).map((p) => p.trim()).filter(Boolean);
  const matchSubnet = allowedSubnets.some((subnet) => clientIp.startsWith(subnet));
  if (matchSubnet) return true;

  return false;
}

/**
 * Express middleware to strictly enforce company network restriction
 */
const verifyCompanyNetwork = async (req, res, next) => {
  try {
    let config = null;
    try {
      config = await WorkingHours.findOne().lean();
    } catch (dbErr) {
      console.warn('Could not read WorkingHours for network restriction:', dbErr.message);
    }

    // Default configuration if not set yet
    const effectiveConfig = config || {
      networkRestrictionEnabled: true,
      allowedWifiSsid: 'HEXA_5G',
      allowedIpv6Prefixes: ['2405:201:f006:b86f'],
      allowedIpv4Addresses: ['49.47.199.103', '192.168.29.'],
      allowedSubnets: ['192.168.29.'],
    };

    // If restriction is explicitly disabled in admin settings, allow
    if (effectiveConfig.networkRestrictionEnabled === false) {
      return next();
    }

    const clientIp = getClientIp(req);
    const wifiSsid = effectiveConfig.allowedWifiSsid || 'HEXA_5G';

    const allowed = isIpAllowed(clientIp, effectiveConfig);

    if (!allowed) {
      console.warn(
        `[NetworkBlock] Blocked punch attempt from unauthorized IP: "${clientIp}" (User: ${req.user?.name || req.user?._id})`
      );
      return res.status(403).json({
        success: false,
        code: 'UNAUTHORIZED_NETWORK',
        message: `Unauthorized Network: Attendance punch is restricted to the company office network (${wifiSsid}). Please connect to ${wifiSsid} Wi-Fi to punch.`,
        detectedIp: clientIp,
        clientIp: clientIp,
        allowedWifiSsid: wifiSsid,
      });
    }

    // Network is verified, proceed
    req.companyClientIp = clientIp;
    next();
  } catch (err) {
    console.error('Error in verifyCompanyNetwork:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify network access.',
    });
  }
};

module.exports = {
  verifyCompanyNetwork,
  getClientIp,
  isIpAllowed,
};
