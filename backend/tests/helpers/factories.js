const User = require('../../models/User');
const Problem = require('../../models/Problem');
const Submission = require('../../models/Submission');
const { generateToken, COOKIE_NAME } = require('../../utils/token');

let seq = 0;
const next = () => {
  seq += 1;
  return seq;
};

const createUser = async (overrides = {}) => {
  const n = next();
  return User.create({
    fullName: `Test User ${n}`,
    username: `testuser${n}`,
    email: `user${n}@example.com`,
    password: 'password123',
    authProvider: 'local',
    ...overrides,
  });
};

const createProblem = async (overrides = {}) => {
  const n = next();
  return Problem.create({
    title: `Problem ${n}`,
    slug: `problem-${n}`,
    difficulty: 'Easy',
    description: `Description for problem ${n}`,
    topics: ['arrays'],
    testCases: [
      { input: '1 2', output: '3' },
      { input: '5 5', output: '10', hidden: true },
    ],
    codeTemplates: {
      python: { starter: 'def solve(): pass', driver: 'solve()' },
      cpp: { starter: 'int solve();', driver: 'int main(){}' },
    },
    ...overrides,
  });
};

const createSubmission = async (user, problem, overrides = {}) =>
  Submission.create({
    user: user._id,
    problem: problem._id,
    language: 'python',
    code: 'print(1)',
    status: 'in_queue',
    ...overrides,
  });

// Returns both auth styles the middleware accepts.
const authFor = (user) => {
  const token = generateToken(user);
  return {
    token,
    bearer: `Bearer ${token}`,
    cookie: `${COOKIE_NAME}=${token}`,
  };
};

module.exports = { createUser, createProblem, createSubmission, authFor };
