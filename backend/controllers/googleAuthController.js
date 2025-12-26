const User = require('../models/User');
const { generateAvailableUsername } = require('../utils/username');
const { generateToken, sanitizeUser, attachTokenCookie } = require('../utils/token');
require("dotenv").config();
const googleLogin = async(req, res)=>{

    try{
        const user = await User.findById(req.user._id);

        user.lastLoginAt = new Date()
        await user.save();

        const token = generateToken(user);
        attachTokenCookie(res, token);

        res.redirect(
        `${process.env.FRONTEND_URL}/oauth-success?token=${token}`
        );
    }
    catch(error){
        console.error('Login error:', error);
        res.status(500).json({ message: 'Unable to login right now.' });
    }
}

module.exports = {googleLogin};