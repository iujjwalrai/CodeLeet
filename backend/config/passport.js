const passport = require("passport");
const { generateAvailableUsername } = require('../utils/username');
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
const User = require("../models/User");
require("dotenv").config;
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;

        let user = await User.findOne({ email });

        const username = await generateAvailableUsername(profile.displayName, email);
        // AUTO-REGISTER
        if (!user) {
          user = await User.create({
            fullName: profile.displayName,
            email,
            username,
            authProvider: "google",
            stats: {},
            preferences: {}
          });
        }
        
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
