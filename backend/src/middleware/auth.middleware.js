const passport = require('passport');

// Middleware to authenticate requests using the JWT strategy
const authenticateJwt = passport.authenticate('jwt', { session: false });

module.exports = { authenticateJwt };
