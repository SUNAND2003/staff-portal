const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    // ─── Plain-text password for admin visibility ────────────────────────────
    // Stored separately so admin can view/reset credentials in the dashboard.
    // The hashed `password` field is still used for all auth comparisons.
    plainPassword: {
      type: String,
      default: '',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    role: {
      type: String,
      enum: ['admin', 'employee', 'manager'],
      default: 'employee',
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
    },
    department: {
      type: String,
      default: 'General',
    },
    designation: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    avatar: {
      type: Number,
      default: 20,
    },
    leaveBalance: {
      casual:    { type: Number, default: 12 },
      sick:      { type: Number, default: 10 },
      annual:    { type: Number, default: 15 },
      maternity: { type: Number, default: 90 },
      paternity: { type: Number, default: 15 },
      unpaid:    { type: Number, default: 0 },
      comp_off:  { type: Number, default: 0 },
    },
    address: { type: String, default: '' },
    bio:     { type: String, default: '' },
    skills:  [{ type: String }],
    emergencyContact: {
      name:     { type: String, default: '' },
      phone:    { type: String, default: '' },
      relation: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

// ─── Hash password before save ────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Auto-generate employeeId ─────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isNew || this.employeeId) return next();

  try {
    const UserModel = mongoose.model('User');

    const all = await UserModel.find(
      { employeeId: { $regex: /^\d+$/ } },
      { employeeId: 1 }
    ).lean();

    let nextNum = 1;

    if (all.length > 0) {
      const nums = all
        .map(function(u) { return parseInt(u.employeeId, 10); })
        .filter(function(n) { return !isNaN(n); });

      if (nums.length > 0) {
        nextNum = Math.max.apply(null, nums) + 1;
      }
    }

    this.employeeId = String(nextNum);
    next();
  } catch (err) {
    next(err);
  }
});

// ─── Compare password ─────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Remove hashed password from JSON output (plainPassword is kept) ─────────
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password; // remove bcrypt hash — plainPassword stays
  return obj;
};

module.exports = mongoose.model('User', userSchema);