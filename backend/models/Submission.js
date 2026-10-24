const mongoose = require("mongoose");

const failedTestCaseSchema = new mongoose.Schema(
  {
    input: { type: String },
    expected: { type: String },
    output: { type: String },
  },
  { _id: false }
);

// What cl-meter measured during judging; see resourcesFrom in docker/judge.js
const resourcesSchema = new mongoose.Schema(
  {
    testIndex: Number,
    peakKb: Number,
    cpuMs: Number,
    wallMs: Number,
    timeline: [{ _id: false, t: Number, rssKb: Number, cpuMs: Number }],
    tests: [{ _id: false, wallMs: Number, peakKb: Number }],
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
      required: true,
      index: true,
    },

    language: {
      type: String,
      required: true,
      enum: ["java", "python", "javascript", "cpp"],
    },

    code: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "in_queue",
        "accepted",
        "wrong_answer",
        "compilation_error",
        "runtime_error",
        "time_limit_exceeded",
        "memory_limit_exceeded",
      ],
      required: true,
      index: true,
    },

    output: {
      type: String, 
    },

    error: {
      type: String, 
    },

    failedTestCase: failedTestCaseSchema,

    time: {
      type: Number,
    },

    memory: {
      type: Number, 
    },

    analysis: {
      resources: resourcesSchema,
      // Only the public search result, never generator/reference source.
      counterexample: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true, 
  }
);

submissionSchema.index({ user: 1, createdAt: -1 });
submissionSchema.index({ problem: 1 });

const Submission = mongoose.model("Submission", submissionSchema);

module.exports = Submission;
