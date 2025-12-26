const Submission = require("../models/Submission");

const getRecentSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(4)
      .populate("problem", "title difficulty")
      .select("status createdAt problem");

    res.json({ submissions });
  } catch (error) {
    console.error("Recent submissions error:", error);
    res.status(500).json({ message: "Failed to fetch recent submissions" });
  }
};

module.exports = { getRecentSubmissions };
