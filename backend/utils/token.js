const jwt = require('jsonwebtoken');
require("dotenv").config();
const COOKIE_NAME = process.env.COOKIE_NAME || 'codeleet_token';

const sanitizeUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  username: user.username,
  email: user.email,
  avatarUrl: user.avatarUrl,
  bio: user.bio,
  education: user.education,
  location: user.location,
  role: user.role,
  stats: user.stats,
  preferences: user.preferences,
  onboardingCompleted: user.onboardingCompleted,
  authProvider: user.authProvider,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const generateToken = (user) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('Missing JWT_SECRET environment variable');
  }

  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
    },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
};

const attachTokenCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

module.exports = {
  generateToken,
  sanitizeUser,
  attachTokenCookie,
  COOKIE_NAME,
};

