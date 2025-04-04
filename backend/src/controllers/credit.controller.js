const db = require('../config/database');
const stripe = require('../services/stripe.service');
const { sendEmail } = require('../services/email.service');

// Get user credits
exports.getCredits = async (req, res, next) => {
  try {
    const { userId } = req;
    
    const result = await db.query(
      `SELECT used, limit_amount, reset_date
       FROM credits
       WHERE user_id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Credits not found' });
    }
    
    // Get credit transactions
    const transactionsResult = await db.query(
      `SELECT id, amount, description, created_at
       FROM credit_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );
    
    res.status(200).json({ 
      credits: result.rows[0],
      transactions: transactionsResult.rows
    });
  } catch (error) {
    next(error);
  }
};

// Top up credits
exports.topUpCredits = async (req, res, next) => {
  try {
    const { userId } = req;
    const { amount } = req.body;
    
    // Validate amount
    if (!['100', '300', '1000'].includes(amount)) {
      return res.status(400).json({ message: 'Invalid amount. Choose 100, 300, or 1000.' });
    }
    
    // Get user
    const userResult = await db.query(
      'SELECT email, plan, stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Check if user is on Pro or Teams plan
    if (user.plan !== 'Pro' && user.plan !== 'Teams') {
      return res.status(403).json({ 
        message: 'Only Pro and Teams plans can top up credits',
        upgrade_required: true
      });
    }
    
    // Get price ID based on amount
    let priceId;
    switch (amount) {
      case '100':
        priceId = process.env.STRIPE_TOPUP_100_PRICE_ID;
        break;
      case '300':
        priceId = process.env.STRIPE_TOPUP_300_PRICE_ID;
        break;
      case '1000':
        priceId = process.env.STRIPE_TOPUP_1000_PRICE_ID;
        break;
    }
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/dashboard?topup=success`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard?topup=canceled`,
      customer: user.stripe_customer_id || undefined,
      customer_email: !user.stripe_customer_id ? user.email : undefined,
      metadata: {
        userId: userId,
        type: 'topup',
        amount: amount
      }
    });
    
    res.status(200).json({ sessionId: session.id });
  } catch (error) {
    next(error);
  }
};

// Process credit usage (internal function, not exposed as API)
exports.processCredits = async (userId, amount, description) => {
  try {
    // Update credits
    await db.query(
      `UPDATE credits
       SET used = used + $1
       WHERE user_id = $2`,
      [amount, userId]
    );
    
    // Record transaction
    await db.query(
      `INSERT INTO credit_transactions (user_id, amount, description)
       VALUES ($1, $2, $3)`,
      [userId, -amount, description]
    );
    
    // Check if user is approaching limit
    const creditsResult = await db.query(
      `SELECT used, limit_amount
       FROM credits
       WHERE user_id = $1`,
      [userId]
    );
    
    if (creditsResult.rows.length > 0) {
      const { used, limit_amount } = creditsResult.rows[0];
      const usagePercentage = (used / limit_amount) * 100;
      
      // Send alert at 80% usage
      if (usagePercentage >= 80 && usagePercentage < 90) {
        const userResult = await db.query(
          'SELECT email FROM users WHERE id = $1',
          [userId]
        );
        
        if (userResult.rows.length > 0) {
          await sendEmail({
            to: userResult.rows[0].email,
            subject: 'Fixy: You\'ve used 80% of your credits',
            text: `You've used ${used} out of ${limit_amount} credits. Consider topping up to avoid interruptions.`,
            html: `<h1>Credit Usage Alert</h1>
                   <p>You've used ${used} out of ${limit_amount} credits (${Math.round(usagePercentage)}%).</p>
                   <p>Consider topping up to avoid interruptions.</p>
                   <p><a href="${process.env.FRONTEND_URL}/dashboard/credits">Manage your credits</a></p>`
          });
        }
      }
      
      // Send alert at 100% usage
      if (used >= limit_amount) {
        const userResult = await db.query(
          'SELECT email FROM users WHERE id = $1',
          [userId]
        );
        
        if (userResult.rows.length > 0) {
          await sendEmail({
            to: userResult.rows[0].email,
            subject: 'Fixy: You\'ve reached your credit limit',
            text: `You've used all ${limit_amount} credits. Top up now to continue using AI features.`,
            html: `<h1>Credit Limit Reached</h1>
                   <p>You've used all ${limit_amount} credits.</p>
                   <p>Top up now to continue using AI features.</p>
                   <p><a href="${process.env.FRONTEND_URL}/dashboard/credits">Top up credits</a></p>`
          });
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error processing credits:', error);
    return false;
  }
};

// Reset credits (for cron job, not exposed as API)
exports.resetMonthlyCredits = async () => {
  try {
    // Get all Pro and Teams users
    const usersResult = await db.query(
      `SELECT u.id, u.email, u.plan
       FROM users u
       WHERE u.plan IN ('Pro', 'Teams') AND u.is_active = true`
    );
    
    for (const user of usersResult.rows) {
      // Reset credits to plan limit
      await db.query(
        `UPDATE credits
         SET used = 0, limit_amount = $1, reset_date = NOW() + INTERVAL '1 month'
         WHERE user_id = $2`,
        [user.plan === 'Pro' ? 500 : 500, user.id]
      );
      
      // Record transaction
      await db.query(
        `INSERT INTO credit_transactions (user_id, amount, description)
         VALUES ($1, $2, $3)`,
        [user.id, 0, 'Monthly credit reset']
      );
      
      // Send email notification
      await sendEmail({
        to: user.email,
        subject: 'Fixy: Your credits have been reset',
        text: `Your monthly credits have been reset. You now have 500 credits available.`,
        html: `<h1>Credits Reset</h1>
               <p>Your monthly credits have been reset.</p>
               <p>You now have 500 credits available for this month.</p>
               <p><a href="${process.env.FRONTEND_URL}/dashboard">Visit your dashboard</a></p>`
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error resetting monthly credits:', error);
    return false;
  }
};
