const mongoose = require('mongoose');
require("dotenv").config();
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  console.log(uri);
  if (!uri) {
    throw new Error('Missing MONGODB_URI in environment variables');
  }

  try {
    await mongoose.connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;

