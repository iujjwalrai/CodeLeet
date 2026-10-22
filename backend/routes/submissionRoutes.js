const express = require('express');
const { createSubmission, getUserSubmissions, getSubmission } = require('../controllers/submissionController');
const { protect } = require('../middleware/authMiddleware');
const {runCode} = require('../controllers/runConroller');
const router = express.Router();

router.post('/', protect, createSubmission);
router.post('/run', protect, runCode);
router.get('/me', protect, getUserSubmissions);
router.get('/:id', protect, getSubmission);

module.exports = router;

