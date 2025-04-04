const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../config/database');
const { createCustomer } = require('./stripe.integration');

// Configure Google OAuth Strategy
const setupGoogleOAuth = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.API_URL}/api/auth/google/callback`,
        scope: ['profile', 'email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists
          const userResult = await db.query(
            'SELECT * FROM users WHERE google_id = $1',
            [profile.id]
          );
          
          if (userResult.rows.length > 0) {
            // User exists, return user
            return done(null, userResult.rows[0]);
          }
          
          // Check if email already exists
          const email = profile.emails[0].value;
          const emailCheckResult = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
          );
          
          if (emailCheckResult.rows.length > 0) {
            // Email exists, link Google ID to existing account
            const user = emailCheckResult.rows[0];
            
            await db.query(
              'UPDATE users SET google_id = $1 WHERE id = $2',
              [profile.id, user.id]
            );
            
            return done(null, user);
          }
          
          // Create new user
          const name = profile.displayName || `${profile.name.givenName} ${profile.name.familyName}`;
          
          // Create Stripe customer
          const customer = await createCustomer(email, name);
          
          // Insert new user
          const newUserResult = await db.query(
            `INSERT INTO users 
              (email, name, google_id, stripe_customer_id, plan, trial_used) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [email, name, profile.id, customer.id, 'Trial', false]
          );
          
          const newUser = newUserResult.rows[0];
          
          // Create initial credits for user
          await db.query(
            'INSERT INTO credits (user_id, credit_limit, used_credits, additional_credits) VALUES ($1, $2, $3, $4)',
            [newUser.id, 50, 0, 0]
          );
          
          return done(null, newUser);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
};

module.exports = {
  setupGoogleOAuth
};
