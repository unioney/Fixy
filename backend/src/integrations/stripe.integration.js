// Stripe integration configuration
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Price IDs for different subscription plans
const PRICE_IDS = {
  PRO: process.env.STRIPE_PRO_PRICE_ID,
  ELITE: process.env.STRIPE_ELITE_PRICE_ID,
  TEAMS: process.env.STRIPE_TEAMS_PRICE_ID,
  TRIAL_PAYMENT: process.env.STRIPE_TRIAL_PAYMENT_PRICE_ID,
  CREDIT_10: process.env.STRIPE_CREDIT_10_PRICE_ID,
  CREDIT_50: process.env.STRIPE_CREDIT_50_PRICE_ID,
  CREDIT_100: process.env.STRIPE_CREDIT_100_PRICE_ID
};

// Create a new customer in Stripe
const createCustomer = async (email, name) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        source: 'fixy_platform'
      }
    });
    
    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
};

// Create a subscription for a customer
const createSubscription = async (userId, priceId) => {
  try {
    // Get user from database
    const db = require('../config/database');
    const userResult = await db.query(
      'SELECT email, name, stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = userResult.rows[0];
    
    // Create customer if not exists
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await createCustomer(user.email, user.name);
      customerId = customer.id;
      
      // Update user with customer ID
      await db.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, userId]
      );
    }
    
    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: priceId,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });
    
    return {
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
    };
  } catch (error) {
    console.error('Error creating Stripe subscription:', error);
    throw error;
  }
};

// Cancel a subscription
const cancelSubscription = async (subscriptionId) => {
  try {
    return await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    console.error('Error canceling Stripe subscription:', error);
    throw error;
  }
};

// Handle webhook events from Stripe
const handleWebhookEvent = async (event) => {
  const db = require('../config/database');
  
  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        // Get the price ID from the subscription
        const priceId = subscription.items.data[0].price.id;
        
        // Determine the plan based on the price ID
        let plan = 'Trial';
        if (priceId === PRICE_IDS.PRO) {
          plan = 'Pro';
        } else if (priceId === PRICE_IDS.ELITE) {
          plan = 'Elite';
        } else if (priceId === PRICE_IDS.TEAMS) {
          plan = 'Teams';
        }
        
        // Update user's plan and subscription ID
        await db.query(
          'UPDATE users SET plan = $1, stripe_subscription_id = $2 WHERE stripe_customer_id = $3',
          [plan, subscription.id, customerId]
        );
        
        // Update user's credit limit based on the plan
        let creditLimit = 50; // Trial
        if (plan === 'Pro') {
          creditLimit = 500;
        } else if (plan === 'Elite') {
          creditLimit = 2000;
        } else if (plan === 'Teams') {
          creditLimit = 5000;
        }
        
        // Get user ID
        const userResult = await db.query(
          'SELECT id FROM users WHERE stripe_customer_id = $1',
          [customerId]
        );
        
        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].id;
          
          // Update credit limit
          await db.query(
            'UPDATE credits SET credit_limit = $1 WHERE user_id = $2',
            [creditLimit, userId]
          );
        }
        
        return { success: true, plan };
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        // Update user's plan to Trial and remove subscription ID
        await db.query(
          'UPDATE users SET plan = $1, stripe_subscription_id = NULL WHERE stripe_customer_id = $2',
          ['Trial', customerId]
        );
        
        // Update user's credit limit to Trial level
        const userResult = await db.query(
          'SELECT id FROM users WHERE stripe_customer_id = $1',
          [customerId]
        );
        
        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].id;
          
          // Update credit limit to Trial level
          await db.query(
            'UPDATE credits SET credit_limit = $1 WHERE user_id = $2',
            [50, userId]
          );
        }
        
        return { success: true, plan: 'Trial' };
      }
      
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        // Handle one-time payments (credits)
        if (session.mode === 'payment' && session.metadata?.type === 'credits') {
          const userId = session.metadata.userId;
          let creditAmount = 0;
          
          // Determine credit amount based on price ID
          if (session.line_items?.data[0]?.price.id === PRICE_IDS.CREDIT_10) {
            creditAmount = 10;
          } else if (session.line_items?.data[0]?.price.id === PRICE_IDS.CREDIT_50) {
            creditAmount = 50;
          } else if (session.line_items?.data[0]?.price.id === PRICE_IDS.CREDIT_100) {
            creditAmount = 100;
          }
          
          if (creditAmount > 0) {
            // Add credits to user
            await db.query(
              'UPDATE credits SET additional_credits = additional_credits + $1 WHERE user_id = $2',
              [creditAmount, userId]
            );
            
            // Record transaction
            await db.query(
              'INSERT INTO credit_transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
              [userId, creditAmount, 'purchase', `Purchased ${creditAmount} credits`]
            );
          }
          
          return { success: true, credits: creditAmount };
        }
        
        // Handle trial payment
        if (session.mode === 'payment' && session.metadata?.type === 'trial') {
          const userId = session.metadata.userId;
          
          // Update user's trial status
          await db.query(
            'UPDATE users SET trial_used = TRUE WHERE id = $1',
            [userId]
          );
          
          return { success: true, trial: true };
        }
        
        return { success: true };
      }
      
      default:
        return { success: true, handled: false };
    }
  } catch (error) {
    console.error('Error handling Stripe webhook:', error);
    throw error;
  }
};

module.exports = {
  stripe,
  createCustomer,
  createSubscription,
  cancelSubscription,
  handleWebhookEvent,
  PRICE_IDS
};
