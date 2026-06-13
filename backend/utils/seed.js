require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const SEED_USERS = [
  {
    username: 'admin',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin',
    employeeId: 'HEXA-0001',
    department: 'Management',
    designation: 'System Administrator',
    email: 'admin@hexahr.com',
    status: 'active',
    avatar: 12,
  },
  {
    username: 'sunand',
    password: 'emp123',
    name: 'Sunand T',
    role: 'employee',
    employeeId: 'HEXA-1024',
    department: 'Engineering',
    designation: 'Software Engineer',
    email: 'sunand@hexahr.com',
    status: 'active',
    avatar: 22,
  },
  {
    username: 'employee',
    password: 'emp123',
    name: 'New Employee',
    role: 'employee',
    employeeId: 'HEXA-1025',
    department: 'General',
    designation: 'Employee',
    email: 'employee@hexahr.com',
    status: 'active',
    avatar: 18,
  },
  {
    username: 'manager',
    password: 'mgr123',
    name: 'Team Manager',
    role: 'manager',
    employeeId: 'HEXA-0002',
    department: 'Engineering',
    designation: 'Engineering Manager',
    email: 'manager@hexahr.com',
    status: 'active',
    avatar: 5,
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Drop existing users
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Insert seed users (passwords will be hashed by pre-save hook)
    for (const u of SEED_USERS) {
      const user = new User(u);
      await user.save();
      console.log(`✅ Created user: ${u.username} (${u.role})`);
    }

    console.log('\n🌱 Seeding complete!');
    console.log('──────────────────────────────────────');
    console.log('Login credentials:');
    console.log('  Admin:    admin / admin123');
    console.log('  Manager:  manager / mgr123');
    console.log('  Employee: sunand / emp123');
    console.log('  Employee: employee / emp123');
    console.log('──────────────────────────────────────');
  } catch (err) {
    console.error('Seed error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

seed();