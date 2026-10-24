const { validationResult } = require('express-validator');
const Problem = require('../models/Problem');
const TOPICS = require('../problemkit/topics.json');

const buildFilters = (query) => {
  const filters = {};

  if (query.difficulty) {
    filters.difficulty = query.difficulty;
  }

  if (query.topic) {
    filters.topics = { $in: [query.topic] };
  }

  if (query.search) {
    filters.$or = [
      { title: { $regex: query.search, $options: 'i' } },
      { description: { $regex: query.search, $options: 'i' } },
    ];
  }

  return filters;
};

const getProblems = async (req, res) => {
  const { page = 1, limit = 20, sortBy = 'title' } = req.query;

  try {
    const filters = buildFilters(req.query);
    const skip = (Number(page) - 1) * Number(limit);
    const sortOptions = {
      title: { title: 1 },
      difficulty: { difficulty: 1 },
      acceptance: { 'stats.acceptance': -1 },
    };
    const sort = sortOptions[sortBy] || sortOptions.title;

    const problems = await Problem.find(filters)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Problem.countDocuments(filters);

    res.json({
      data: problems,
      meta: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get problems error:', error.message);
    res.status(500).json({ message: 'Unable to load problems right now.' });
  }
};

const getProblemBySlug = async (req, res) => {
  try {
    const problem = await Problem.findOne({ slug: req.params.slug });
    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }
    res.json(problem);
  } catch (error) {
    console.error('Get problem error:', error.message);
    res.status(500).json({ message: 'Unable to load problem.' });
  }
};

const createProblem = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const payload = {
      ...req.body,
      slug: req.body.slug.toLowerCase(),
    };

    const problem = await Problem.create(payload);
    res.status(201).json(problem);
  } catch (error) {
    console.error('Create problem error:', error.message);
    res.status(500).json({ message: 'Unable to create problem.' });
  }
};

// Topics that at least one problem has, in the order of problemkit/topics.json
const getTopics = async (req, res) => {
  try {
    const used = await Problem.distinct('topics');
    const rank = (t) => (TOPICS.includes(t) ? TOPICS.indexOf(t) : TOPICS.length);
    used.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    res.json(used);
  } catch (error) {
    console.error('Get topics error:', error.message);
    res.status(500).json({ message: 'Unable to load topics.' });
  }
};

module.exports = {
  getProblems,
  getProblemBySlug,
  getTopics,
  createProblem,
};

