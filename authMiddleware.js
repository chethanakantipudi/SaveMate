const jwt = require('jsonwebtoken');
const { User } = require('../models/db');

// This middleware checks for a token and attaches the user to the request if valid.
// It doesn't block access, just identifies the user.
const protect = async (req, res, next) => {
    let token;

    if (req.cookies && req.cookies.token) {
        try {
            // Verify the token using the secret key
            const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
            
            // Find the user from the token's payload (ID)
            // We exclude the password hash from being attached to the request object
            req.user = await User.findByPk(decoded.id, {
                attributes: { exclude: ['password'] }
            });
            
            // Make user data available in all EJS templates
            res.locals.user = req.user;

        } catch (error) {
            console.error('Authentication error: Token failed validation.', error.message);
            res.locals.user = null; // Ensure user is null if token is invalid
        }
    } else {
        res.locals.user = null; // No token, so no user
    }
    next();
};

// This middleware actively blocks access to a route if the user is not authenticated.
const requireAuth = (req, res, next) => {
    if (!res.locals.user) {
        // If no user is identified by the 'protect' middleware, redirect to login.
        return res.redirect('/login');
    }
    next();
};

module.exports = { protect, requireAuth };

