const mongoose = require("mongoose");

const exampleSchema = new mongoose.Schema(
  {
    input: { type: String, required: true },
    output: { type: String, required: true },
    explanation: { type: String },
  },
  { _id: false }
);

const testCaseSchema = new mongoose.Schema(
  {
    input: { type: String, required: true },
    output: { type: String, required: true },
    hidden: { type: Boolean, default: false },
  },
  { _id: false }
);

const languageTemplateSchema = new mongoose.Schema(
  {
    starter: { type: String, required: true }, // user edits
    driver: { type: String, required: true },  // platform runs
  },
  { _id: false }
);

const problemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      required: true,
    },
    topics: [{ type: String }],
    description: { type: String, required: true },
    constraints: [{ type: String }],
    examples: [exampleSchema],
    testCases: [testCaseSchema],

    // 👇 MAIN CHANGE HERE
    codeTemplates: {
      javascript: languageTemplateSchema,
      python: languageTemplateSchema,
      java: languageTemplateSchema,
      cpp: languageTemplateSchema,
      typescript: languageTemplateSchema,
    },

    stats: {
      acceptance: { type: Number, default: 0 },
      submissions: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
    },
    premium: { type: Boolean, default: false },
    tags: [{ type: String }],
    editorialUrl: { type: String },
  },
  { timestamps: true }
);

problemSchema.index({ slug: 1 });
problemSchema.index({ difficulty: 1 });
problemSchema.index({ topics: 1 });

module.exports = mongoose.model("Problem", problemSchema);
