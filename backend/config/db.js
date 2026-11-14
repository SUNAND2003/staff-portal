const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch {
  // Ignore
}

const mongoose = require('mongoose');

const maskUri = (uri) => {
  if (!uri || typeof uri !== 'string') return '';
  return uri.replace(/\/\/[^@/]+@/, '//<credentials>@');
};

const isLocalhostUri = (uri) => {
  if (!uri || typeof uri !== 'string') return false;
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i.test(uri);
};

const connectDB = async () => {
  try {
    const rawUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    const uri = typeof rawUri === 'string' ? rawUri.trim().replace(/^["']|["']$/g, '') : '';
    const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);

    if (!uri) {
      throw new Error(
        'MONGO_URI (or MONGODB_URI) is not set. In production, configure your MongoDB Atlas connection string in Render environment variables.'
      );
    }

    if (isProduction && isLocalhostUri(uri)) {
      throw new Error(
        `Localhost MongoDB connection (${maskUri(uri)}) is rejected in production. Please set MONGO_URI in Render dashboard to your MongoDB Atlas connection string.`
      );
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    const safeMsg = error.message.replace(/\/\/[^@/]+@/g, '//<credentials>@');
    console.error(`❌ MongoDB connection error: ${safeMsg}`);
    process.exit(1);
  }
};

module.exports = connectDB;
