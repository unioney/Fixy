const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripe.controller');

// Create checkout session for subscription
router.post('/create-subscription', stripeController.createSubscription);

// Create checkout session for one-time payment
router.post('/create-checkout-session', stripeController.createCheckoutSession);

// Get customer portal session
router.post('/create-portal-session', stripeController.createPortalSession);

// Cancel subscription
router.post('/cancel-subscription', stripeController.cancelSubscription);

// Webhook handler is defined in server.js with raw body parser

module.exports = router;
