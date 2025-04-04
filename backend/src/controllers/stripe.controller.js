const express = require('express');
const router = express.Router();
const stripe = require('../services/stripe.service');

// Create subscription
exports.createSubscription = async (req, res, next) => {
  try {
    const { userId } = req;
    const { priceId } = req.body;
    
    // Validate price ID
    if (![
      process.env.STRIPE_PRO_PRICE_ID,
      process.env.STRIPE_ELITE_PRICE_ID,
      process.env.STRIPE_TEAMS_PRICE_ID
    ].includes(priceId)) {
      return res.status(400).json({ message: 'Invalid price ID' });
    }
    
    // Create subscription
    const subscription = await stripe.createSubscription(userId, priceId);
    
    res.status(200).json({ 
      clientSecret: subscription.clientSecret,
      subscriptionId: subscription.subscriptionId
    });
  } catch (error) {
    next(error);
  }
};

// Create checkout session for one-time payment
exports.createCheckoutSession = async (req, res, next) => {
  try {
    const { userId } = req;
    const { priceId, type } = req.body;
    
    // Get user
    const userResult = await db.query(
      'SELECT email, stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Create checkout session
    const session = await stripe.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/dashboard?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard?payment=canceled`,
      customer: user.stripe_customer_id || undefined,
      customer_email: !user.stripe_customer_id ? user.email : undefined,
      metadata: {
        userId: userId,
        type: type
      }
    });
    
    res.status(200).json({ sessionId: session.id });
  } catch (error) {
    next(error);
  }
};

// Get customer portal session
exports.createPortalSession = async (req, res, next) => {
  try {
    const { userId } = req;
    
    // Get user
    const userResult = await db.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const { stripe_customer_id } = userResult.rows[0];
    
    if (!stripe_customer_id) {
      return res.status(400).json({ message: 'No Stripe customer found' });
    }
    
    // Create portal session
    const session = await stripe.stripe.billingPortal.sessions.create({
      customer: stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    });
    
    res.status(200).json({ url: session.url });
  } catch (error) {
    next(error);
  }
};

// Cancel subscription
exports.cancelSubscription = async (req, res, next) => {
  try {
    const { userId } = req;
    
    // Get user
    const userResult = await db.query(
      'SELECT stripe_subscription_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const { stripe_subscription_id } = userResult.rows[0];
    
    if (!stripe_subscription_id) {
      return res.status(400).json({ message: 'No active subscription found' });
    }
    
    // Cancel subscription
    await stripe.cancelSubscription(stripe_subscription_id);
    
    // Update user
    await db.query(
      'UPDATE users SET plan = $1, stripe_subscription_id = NULL WHERE id = $2',
      ['Trial', userId]
    );
    
    res.status(200).json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    next(error);
  }
};

// Handle webhook
exports.handleWebhook = async (req, res, next) => {
  try {
    const sig = req.headers['stripe-signature'];
    
    let event;
    
    try {
      event = stripe.stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle the event
    const result = await stripe.handleWebhookEvent(event);
    
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
