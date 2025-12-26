const runQueue = require('../queue/runQueue');
const Problem = require('../models/Problem');

const runCode = async (req, res) => {
  const { problemId, language, code, customInput } = req.body;

  if (!problemId || !language || !code) {
    return res.status(400).json({
      message: 'problemId, language and code are required'
    });
  }

  try {
    const problem = await Problem.findById(problemId);
    const prob = {codeTemplates: problem.codeTemplates, testCases: problem.testCases};
    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }
    const job = await runQueue.add(
      'run-code',
      {
        code,
        language,
        input: customInput || '',
        problemId,
        problem: prob
      },
      {
        removeOnComplete: true,
        removeOnFail: true
      }
    );

    return res.status(202).json({
      success: true,
      jobId: job.id,
      message: 'Code execution queued'
    });

  } catch (error) {
    console.error('Run code error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to run code right now'
    });
  }
};

module.exports = {
  runCode
};
