const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database');
const { sendEmail } = require('./email.service');

// Create Stripe customer
const createCustomer = async (user) => {
  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || undefined,
      metadata: {
        userId: user.id
      }
    });
    
    // Update user with Stripe customer ID
    await db.query(
      'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
      [customer.id, user.id]
    );
    
    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
};

// Get or create Stripe customer
const getOrCreateCustomer = async (userId) => {
  try {
    const userResult = await db.query(
      'SELECT id, email, name, stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = userResult.rows[0];
    
    if (user.stripe_customer_id) {
      // Get existing customer
      const customer = await stripe.customers.retrieve(user.stripe_customer_id);
      return customer;
    }
    
    // Create new customer
    return await createCustomer(user);
  } catch (error) {
    console.error('Error getting or creating Stripe customer:', error);
    throw error;
  }
};

// Create subscription
const createSubscription = async (userId, priceId) => {
  try {
    const customer = await getOrCreateCustomer(userId);
    
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId: userId
      }
    });
    
    return {
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret
    };
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};

// Cancel subscription
const cancelSubscription = async (subscriptionId) => {
  try {
    return await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};

// Handle webhook events
const handleWebhookEvent = async (event) => {
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
        
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
    }
    
    return { received: true };
  } catch (error) {
    console.error('Error handling webhook event:', error);
    throw error;
  }
};

// Handle checkout session completed
const handleCheckoutSessionCompleted = async (session) => {
  try {
    const { userId, type, amount } = session.metadata;
    
    if (!userId) {
      console.error('No userId in session metadata');
      return;
    }
    
    // Get user
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      console.error('User not found:', userId);
      return;
    }
    
    const user = userResult.rows[0];
    
    // Handle different payment types
    switch (type) {
      case 'trial':
        // Mark trial as used and set up credits
        await db.query(
          'UPDATE users SET trial_used = true WHERE id = $1',
          [userId]
        );
        
        // Create or update credits
        await db.query(
          `INSERT INTO credits (user_id, used, limit_amount, reset_date)
           VALUES ($1, 0, 50, NOW() + INTERVAL '7 days')
           ON CONFLICT (user_id) DO UPDATE
           SET used = 0, limit_amount = 50, reset_date = NOW() + INTERVAL '7 days'`,
          [userId]
        );
        
        // Send confirmation email
        await sendEmail({
          to: user.email,
          subject: 'Welcome to Fixy Trial!',
          text: `Your trial has been activated. You have 50 credits to use over the next 7 days.`,
          html: `<h1>Welcome to Fixy Trial!</h1>
                 <p>Your trial has been activated.</p>
                 <p>You have 50 credits to use over the next 7 days.</p>
                 <p><a href="${process.env.FRONTEND_URL}/dashboard">Visit your dashboard</a></p>`
        });
        break;
        
      case 'topup':
        // Add credits
        const creditAmount = parseInt(amount, 10);
        
        await db.query(
          `UPDATE credits
           SET limit_amount = limit_amount + $1
           WHERE user_id = $2`,
          [creditAmount, userId]
        );
        
        // Record transaction
        await db.query(
          `INSERT INTO credit_transactions (user_id, amount, description, stripe_payment_id)
           VALUES ($1, $2, $3, $4)`,
          [userId, creditAmount, `Top-up of ${creditAmount} credits`, session.payment_intent]
        );
        
        // Send confirmation email
        await sendEmail({
          to: user.email,
          subject: 'Fixy: Credits Added',
          text: `${creditAmount} credits have been added to your account.`,
          html: `<h1>Credits Added</h1>
                 <p>${creditAmount} credits have been added to your account.</p>
                 <p><a href="${process.env.FRONTEND_URL}/dashboard/credits">View your credits</a></p>`
        });
        break;
    }
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
    throw error;
  }
};

// Handle invoice paid
const handleInvoicePaid = async (invoice) => {
  try {
    // Get subscription
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const { userId } = subscription.metadata;
    
    if (!userId) {
      console.error('No userId in subscription metadata');
      return;
    }
    
    // Get user
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      console.error('User not found:', userId);
      return;
    }
    
    const user = userResult.rows[0];
    
    // Get plan from subscription items
    const item = subscription.items.data[0];
    const priceId = item.price.id;
    
    let plan;
    let creditLimit;
    
    if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
      plan = 'Pro';
      creditLimit = 500;
    } else if (priceId === process.env.STRIPE_ELITE_PRICE_ID) {
      plan = 'Elite';
      creditLimit = 0; // Unlimited with BYOK
    } else if (priceId === process.env.STRIPE_TEAMS_PRICE_ID) {
      plan = 'Teams';
      creditLimit = 500;
    } else {
      console.error('Unknown price ID:', priceId);
      return;
    }
    
    // Update user plan and subscription ID
    await db.query(
      'UPDATE users SET plan = $1, stripe_subscription_id = $2 WHERE id = $3',
      [plan, subscription.id, userId]
    );
    
    // Update credits
    if (plan === 'Pro' || plan === 'Teams') {
      await db.query(
        `INSERT INTO credits (user_id, used, limit_amount, reset_date)
         VALUES ($1, 0, $2, NOW() + INTERVAL '1 month')
         ON CONFLICT (user_id) DO UPDATE
         SET used = 0, limit_amount = $2, reset_date = NOW() + INTERVAL '1 month'`,
        [userId, creditLimit]
      );
    }
    
    // Send confirmation email
    await sendEmail({
      to: user.email,
      subject: `Fixy: ${plan} Plan Activated`,
      text: `Your ${plan} plan has been activated.`,
      html: `<h1>${plan} Plan Activated</h1>
             <p>Your ${plan} plan has been activated.</p>
             <p><a href="${process.env.FRONTEND_URL}/dashboard">Visit your dashboard</a></p>`
    });
  } catch (error) {
    console.error('Error handling invoice paid:', error);
    throw error;
  }
};

// Handle invoice payment failed
const handleInvoicePaymentFailed = async (invoice) => {
  try {
    // Get subscription
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const { userId } = subscription.metadata;
    
    if (!userId) {
      console.error('No userId in subscription metadata');
      return;
    }
    
    // Get user
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      console.error('User not found:', userId);
      return;
    }
    
    const user = userResult.rows[0];
    
    // Send payment failed email
    await sendEmail({
      to: user.email,
      subject: 'Fixy: Payment Failed',
      text: `Your payment for Fixy subscription failed. Please update your payment method to avoid service interruption.`,
      html: `<h1>Payment Failed</h1>
             <p>Your payment for Fixy subscription failed.</p>
             <p>Please update your payment method to avoid service interruption.</p>
             <p><a href="${process.env.FRONTEND_URL}/dashboard/billing">Update payment method</a></p>`
    });
  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
    throw error;
  }
};

// Handle subscription deleted
const handleSubscriptionDeleted = async (subscription) => {
  try {
    const { userId } = subscription.metadata;
    
    if (!userId) {
      console.error('No userId in subscription metadata');
      return;
    }
    
    // Get user
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      console.error('User not found:', userId);
      return;
    }
    
    const user = userResult.rows[0];
    
    // Downgrade user to Trial
    await db.query(
      'UPDATE users SET plan = $1, stripe_subscription_id = NULL WHERE id = $2',
      ['Trial', userId]
    );
    
    // Send cancellation email
    await sendEmail({
      to: user.email,
      subject: 'Fixy: Subscription Cancelled',
      text: `Your Fixy subscription has been cancelled. Your account has been downgraded to Trial.`,
      html: `<h1>Subscription Cancelled</h1>
             <p>Your Fixy subscription has been cancelled.</p>
             <p>Your account has been downgraded to Trial.</p>
             <p><a href="${process.env.FRONTEND_URL}/pricing">Resubscribe</a></p>`
    });
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
    throw error;
  }
};

// Handle subscription updated
const handleSubscriptionUpdated = async (subscription) => {
  try {
    // Only handle status changes
    if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
      const { userId } = subscription.metadata;
      
      if (!userId) {
        console.error('No userId in subscription metadata');
        return;
      }
      
      // Get user
      const userResult = await db.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        console.error('User not found:', userId);
        return;
      }
      
      const user = userResult.rows[0];
      
      // Send payment reminder email
      await sendEmail({
        to: user.email,
        subject: 'Fixy: Payment Required',
        text: `Your Fixy subscription requires payment. Please update your payment method to avoid service interruption.`,
        html: `<h1>Payment Required</h1>
               <p>Your Fixy subscription requires payment.</p>
               <p>Please update your payment method to avoid service interruption.</p>
               <p><a href="${process.env.FRONTEND_URL}/dashboard/billing">Update payment method</a></p>`
      });
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error);
    throw error;
  }
};

module.exports = {
  stripe,
  createCustomer,
  getOrCreateCustomer,
  createSubscription,
  cancelSubscription,
  handleWebhookEvent
};
