const express = require('express');
const { body } = require('express-validator');
const { updateProfile, getStats } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.patch(
  '/me',
  protect,
  [
    body('fullName').optional().isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
    body('username')
      .optional()
      .matches(/^[a-z0-9_]+$/i)
      .withMessage('Username may only contain letters, numbers and underscores'),
  ],
  updateProfile,
);

router.get('/stats', protect, getStats);

module.exports = router;

