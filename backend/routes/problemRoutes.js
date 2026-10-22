const express = require('express');
const { body } = require('express-validator');
const { getProblems, getProblemBySlug, getTopics, createProblem } = require('../controllers/problemController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', getProblems);
router.get('/topics', getTopics); // before /:slug, which would match it
router.get('/:slug', getProblemBySlug);

router.post(
  '/',
  protect,
  requireAdmin,
  [
    body('title').notEmpty(),
    body('slug').notEmpty(),
    body('difficulty').isIn(['Easy', 'Medium', 'Hard']),
    body('description').notEmpty(),
  ],
  createProblem,
);

module.exports = router;

