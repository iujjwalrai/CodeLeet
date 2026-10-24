// /api/controllers/submissionController.js
const mongoose = require('mongoose');
const Submission = require('../models/Submission');
const Problem = require('../models/Problem');
const User = require('../models/User');
const submissionQueue = require('../queue/submissionQueue');

const createSubmission = async (req, res) => {
  const { problemId, language, code } = req.body;

  if (!problemId || !language || !code) {
    return res.status(400).json({ message: 'problemId, language and code are required' });
  }

  try {
    const problem = await Problem.findById(problemId).select(Problem.JUDGING_FIELDS);
    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }
    const prob = {codeTemplates: problem.codeTemplates, testCases: problem.testCases, timeLimitMs: problem.timeLimitMs};

    const submission = await Submission.create({
      user: req.user._id,
      problem: problem._id,
      language,
      code,
      status: 'in_queue',
    });

    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.totalSubmissions': 1 },
    });

    await Problem.findByIdAndUpdate(problem._id, {
      $inc: { 'stats.submissions': 1 },
    });
    const job = await submissionQueue.add("run-submission", {
      submissionId: submission._id,
      code,
      language,
      problem : prob
    });

    res.status(201).json({
      success: true,
      jobId: job.id,
      message: "Code submission queued"
    });

  } catch (error) {
    console.error('Create submission error:', error.message);
    res.status(500).json({
      success: false,
      message: "Unable to submit code at this moment of time"
    });
  }
};

const getUserSubmissions = async (req, res) => {
  const { problemId, limit = 10 } = req.query;
  const filters = { user: req.user._id };

  if (problemId) {
    filters.problem = problemId;
  }

  try {
    const submissions = await Submission.find(filters)
      .select('-analysis') // can be large; GET /api/submissions/:id has it
      .populate('problem', 'title slug difficulty')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json(submissions);
  } catch (error) {
    console.error('Get submissions error:', error.message);
    res.status(500).json({ message: 'Unable to load submissions.' });
  }
};

// One of the caller's own submissions, including what the judge measured
const getSubmission = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Submission not found' });
  }

  try {
    const submission = await Submission.findOne({ _id: req.params.id, user: req.user._id })
      .populate('problem', 'title slug difficulty');
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    res.json(submission);
  } catch (error) {
    console.error('Get submission error:', error.message);
    res.status(500).json({ message: 'Unable to load submission.' });
  }
};

const getSubmissionHeatmap = async (req, res) => {
  try {
    const days = 84; // 12 weeks × 7 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);

    // Aggregate submissions per day
    const rawData = await Submission.aggregate([
      {
        $match: {
          user: req.user._id,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Convert to map for fast lookup
    const countMap = {};
    rawData.forEach(d => {
      countMap[d._id] = d.count;
    });

    // Fill missing days with 0
    const heatmap = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const key = date.toISOString().split("T")[0];

      heatmap.push({
        date: key,
        count: countMap[key] || 0
      });
    }

    res.json({ heatmap });
  } catch (err) {
    console.error("Heatmap error:", err);
    res.status(500).json({ message: "Failed to fetch heatmap" });
  }
};


module.exports = {
  createSubmission,
  getUserSubmissions,
  getSubmission,
  getSubmissionHeatmap
};
