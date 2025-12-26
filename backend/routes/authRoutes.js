const express = require('express');
const passport = require('passport');
const { body } = require('express-validator');
const { register, login, getCurrentUser, logout, googleCallback } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const {getRecentSubmissions} = require("../controllers/authController");
const {getSubmissionHeatmap} = require("../controllers/submissionController");
const router = express.Router();
const {googleLogin} = require("../controllers/googleAuthController");
router.post(
  '/register',
  [
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be 6+ characters'),
  ],
  register,
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login,
);


// STEP 1: Redirect to Google
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

// STEP 2: Google callback
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  googleLogin
);


router.get('/me', protect, getCurrentUser);
router.post('/logout', protect, logout);

router.get('/me/recent', protect, getRecentSubmissions);

router.get('/me/heatmap', protect, getSubmissionHeatmap);

module.exports = router;

