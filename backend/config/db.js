const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // MONGO_URI is this project's original name; MONGODB_URI is accepted too so
    // the same scripts work with a Render-style environment. Never logged.
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGO_URI (or MONGODB_URI) is not set');

    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;