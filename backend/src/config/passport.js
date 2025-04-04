const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./database');

// Use JWT_SECRET from environment or a fallback for development only
const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_for_development_only';
if (!process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET environment variable is not set. Using fallback secret for development purposes only.');
}

// Use Google OAuth environment variables or fallbacks for development
const googleClientID = process.env.GOOGLE_CLIENT_ID || 'fallback_client_id_for_development_only';
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || 'fallback_client_secret_for_development_only';
const googleCallbackURL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';

if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn('Warning: GOOGLE_CLIENT_ID environment variable is not set. Using fallback client ID for development purposes only.');
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('Warning: GOOGLE_CLIENT_SECRET environment variable is not set. Using fallback client secret for development purposes only.');
}
if (!process.env.GOOGLE_CALLBACK_URL) {
  console.warn('Warning: GOOGLE_CALLBACK_URL environment variable is not set. Using fallback callback URL for development purposes only.');
}

// JWT Strategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: jwtSecret
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const result = await db.query(
        'SELECT id, email, plan FROM users WHERE id = $1 AND is_active = true',
        [payload.id]
      );

      if (result.rows.length > 0) {
        return done(null, result.rows[0]);
      }
      return done(null, false);
    } catch (error) {
      return done(error, false);
    }
  })
);

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: googleClientID,
      clientSecret: googleClientSecret,
      callbackURL: googleCallbackURL,
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists
        const existingUser = await db.query(
          'SELECT * FROM users WHERE google_id = $1',
          [profile.id]
        );

        if (existingUser.rows.length > 0) {
          // Update last login
          await db.query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [existingUser.rows[0].id]
          );
          return done(null, existingUser.rows[0]);
        }

        // Create new user
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        if (!email) {
          return done(new Error('Email not provided by Google'), false);
        }

        // Check if email already exists
        const emailUser = await db.query(
          'SELECT * FROM users WHERE email = $1',
          [email]
        );

        if (emailUser.rows.length > 0) {
          // Link Google ID to existing account
          const updatedUser = await db.query(
            'UPDATE users SET google_id = $1, last_login = NOW() WHERE id = $2 RETURNING *',
            [profile.id, emailUser.rows[0].id]
          );
          return done(null, updatedUser.rows[0]);
        }

        // Create new user
        const newUser = await db.query(
          `INSERT INTO users 
          (email, name, google_id, plan, trial_used, last_login) 
          VALUES ($1, $2, $3, 'Trial', false, NOW()) 
          RETURNING *`,
          [email, profile.displayName, profile.id]
        );

        // Create initial credits for trial user
        await db.query(
          `INSERT INTO credits (user_id, used, limit_amount, reset_date)
          VALUES ($1, 0, 50, NOW() + INTERVAL '7 days')`,
          [newUser.rows[0].id]
        );

        return done(null, newUser.rows[0]);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

module.exports = passport;
