const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const statsSchema = new mongoose.Schema(
  {
    problemsSolved: { type: Number, default: 0 },
    totalSubmissions: { type: Number, default: 0 },
    dailyStreak: { type: Number, default: 0 },
    acceptanceRate: { type: Number, default: 0 },
    contestsParticipated: { type: Number, default: 0 },
  },
  { _id: false },
);

const preferencesSchema = new mongoose.Schema(
  {
    theme: { type: String, enum: ['light', 'dark'], default: 'dark' },
    defaultLanguage: { type: String, default: 'javascript' },
    editorTheme: { type: String, default: 'vs-dark' },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String },
    avatarUrl: { type: String },
    bio: { type: String, trim: true },
    education: { type: String, trim: true },
    location: { type: String, trim: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    googleId: { type: String },
    onboardingCompleted: { type: Boolean, default: false },
    preferences: { type: preferencesSchema, default: () => ({}) },
    stats: { type: statsSchema, default: () => ({}) },
    lastLoginAt: { type: Date },
    streakRefDate: { type: Date },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;

