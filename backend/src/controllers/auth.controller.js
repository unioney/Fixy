const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { sendEmail } = require('../services/email.service');
const { v4: uuidv4 } = require('uuid');
const stripe = require('../services/stripe.service');

// Register new user
exports.register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Check if email already exists
    const existingUser = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await db.query(
      `INSERT INTO users 
      (email, password_hash, name, plan, trial_used) 
      VALUES ($1, $2, $3, 'Trial', false) 
      RETURNING id, email, name, plan, trial_used`,
      [email, hashedPassword, name]
    );

    // Create initial credits for trial user
    await db.query(
      `INSERT INTO credits (user_id, used, limit_amount, reset_date)
      VALUES ($1, 0, 50, NOW() + INTERVAL '7 days')`,
      [newUser.rows[0].id]
    );

    // Generate JWT
    const token = jwt.sign(
      { id: newUser.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Send welcome email
    await sendEmail({
      to: email,
      subject: 'Welcome to Fixy!',
      text: `Welcome to Fixy! Your account has been created successfully.`,
      html: `<h1>Welcome to Fixy!</h1><p>Your account has been created successfully.</p>`
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: newUser.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// Login user
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check if password is correct
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate JWT
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Remove sensitive data
    delete user.password_hash;

    res.status(200).json({
      message: 'Login successful',
      token,
      user
    });
  } catch (error) {
    next(error);
  }
};

// Google OAuth callback
exports.googleCallback = (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user) => {
    if (err || !user) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);
  })(req, res, next);
};

// Request password reset
exports.requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      // Don't reveal that email doesn't exist
      return res.status(200).json({ message: 'If your email is registered, you will receive a password reset link' });
    }

    const user = result.rows[0];
    const resetToken = uuidv4();
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token
    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetTokenExpires, user.id]
    );

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await sendEmail({
      to: email,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Please go to this link to reset your password: ${resetUrl}`,
      html: `<h1>Password Reset Request</h1>
             <p>You requested a password reset. Please click the link below to reset your password:</p>
             <a href="${resetUrl}">Reset Password</a>
             <p>This link will expire in 1 hour.</p>`
    });

    res.status(200).json({ message: 'If your email is registered, you will receive a password reset link' });
  } catch (error) {
    next(error);
  }
};

// Reset password
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Find user with valid reset token
    const result = await db.query(
      'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const user = result.rows[0];

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password and clear reset token
    await db.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hashedPassword, user.id]
    );

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
};

// Start trial (requires $1 payment)
exports.startTrial = async (req, res, next) => {
  try {
    const { userId } = req;
    
    // Check if user already used trial
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    if (user.trial_used) {
      return res.status(400).json({ message: 'Trial already used' });
    }
    
    // Create Stripe checkout session for $1 trial payment
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_TRIAL_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/dashboard?trial=success`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?trial=canceled`,
      customer_email: user.email,
      metadata: {
        userId: userId,
        type: 'trial'
      }
    });
    
    res.status(200).json({ sessionId: session.id });
  } catch (error) {
    next(error);
  }
};

// Get current user
exports.getCurrentUser = async (req, res, next) => {
  try {
    const { userId } = req;
    
    const result = await db.query(
      `SELECT u.id, u.email, u.name, u.profile_image_url, u.organization, 
              u.plan, u.trial_used, u.stripe_customer_id, u.created_at,
              c.used as credits_used, c.limit_amount as credits_limit, c.reset_date
       FROM users u
       LEFT JOIN credits c ON u.id = c.user_id
       WHERE u.id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get BYOK keys (just presence, not the actual keys)
    const byokResult = await db.query(
      `SELECT provider FROM byok WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    
    const user = result.rows[0];
    user.byok_providers = byokResult.rows.map(row => row.provider);
    
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

// Update user profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { userId } = req;
    const { name, organization, profile_image_url } = req.body;
    
    const result = await db.query(
      `UPDATE users 
       SET name = COALESCE($1, name), 
           organization = COALESCE($2, organization), 
           profile_image_url = COALESCE($3, profile_image_url),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, name, organization, profile_image_url, plan`,
      [name, organization, profile_image_url, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({ 
      message: 'Profile updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};
