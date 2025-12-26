const { validationResult } = require('express-validator');
const User = require('../models/User');
const { sanitizeUser } = require('../utils/token');

const updateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { fullName, bio, education, location, preferences, username } = req.body;

  try {
    if (username && username !== req.user.username) {
      const exists = await User.findOne({ username: username.toLowerCase() });
      if (exists) {
        return res.status(409).json({ message: 'Username already in use' });
      }
      req.user.username = username.toLowerCase();
    }

    if (fullName) req.user.fullName = fullName;
    if (bio !== undefined) req.user.bio = bio;
    if (education !== undefined) req.user.education = education;
    if (location !== undefined) req.user.location = location;
    if (preferences) {
      req.user.preferences = {
        ...req.user.preferences,
        ...preferences,
      };
    }

    await req.user.save();

    res.json({ user: sanitizeUser(req.user) });
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({ message: 'Unable to update profile right now.' });
  }
};

const getStats = async (req, res) => {
  res.json({ stats: req.user.stats });
};

module.exports = {
  updateProfile,
  getStats,
};

