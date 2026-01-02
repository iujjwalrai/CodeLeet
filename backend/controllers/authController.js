const { validationResult } = require('express-validator');
const Submission = require("../models/Submission");
const User = require('../models/User');
const { generateAvailableUsername } = require('../utils/username');
const { generateToken, sanitizeUser, attachTokenCookie, COOKIE_NAME } = require('../utils/token');

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
};

const register = async (req, res) => {
  if (!handleValidation(req, res)) return;

  const { fullName, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return res.status(409).json({ message: 'Account already exists. Try logging in.' });
    }

    const username = await generateAvailableUsername(fullName, email);

    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      password,
      username,
      authProvider: 'local',
      stats: {},
      preferences: {},
    });

    const token = generateToken(user);
    attachTokenCookie(res, token);

    res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Unable to register right now.' });
  }
};

const login = async (req, res) => {
  if (!handleValidation(req, res)) return;

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || user.authProvider !== 'local') {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);
    attachTokenCookie(res, token);

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Unable to login right now.' });
  }
};

const getCurrentUser = async (req, res) => {
  res.json({
    user: sanitizeUser(req.user),
  });
};

const logout = (req, res) => {
  try{
    res.clearCookie(COOKIE_NAME);
    res.json({ success: true, message: 'Logged out' });
  }
  catch(error){
    console.error(error);
    res.json({
      success: false,
      message: "Can't Logout now!"
    })
  }
  
};


const getRecentSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(4)
      .populate("problem", "title difficulty")
      .select("status createdAt problem");

    res.json({ submissions });
  } catch (error) {
    console.error("Recent submissions error:", error);
    res.status(500).json({ message: "Failed to fetch recent submissions" });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  logout,
  getRecentSubmissions
};

