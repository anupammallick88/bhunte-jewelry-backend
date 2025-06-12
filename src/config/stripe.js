const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Stripe configuration
const stripeConfig = {
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  secretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  apiVersion: '2023-10-16',
  
  // Payment configuration
  currency: 'USD',
  captureMethod: 'automatic',
  confirmationMethod: 'automatic',
  
  // Webhook events to listen for
  webhookEvents: [
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'charge.dispute.created',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted'
  ]
};

// Stripe utility functions
const stripeUtils = {
  // Create payment intent
  createPaymentIntent: async (paymentData) => {
    try {
      const {
        amount, // Amount in cents
        currency = 'USD',
        customerId,
        description = 'Angara Jewelry Purchase',
        metadata = {},
        paymentMethodTypes = ['card'],
        captureMethod = 'automatic',
        confirmationMethod = 'automatic'
      } = paymentData;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        customer: customerId,
        description,
        metadata: {
          ...metadata,
          company: 'Angara Jewelry'
        },
        payment_method_types: paymentMethodTypes,
        capture_method: captureMethod,
        confirmation_method: confirmationMethod,
        automatic_payment_methods: {
          enabled: true
        }
      });

      return paymentIntent;
    } catch (error) {
      console.error('Stripe payment intent creation error:', error);
      throw new Error(`Payment intent creation failed: ${error.message}`);
    }
  },

  // Confirm payment intent
  confirmPaymentIntent: async (paymentIntentId, paymentMethodId) => {
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId
      });
      return paymentIntent;
    } catch (error) {
      console.error('Stripe payment confirmation error:', error);
      throw new Error(`Payment confirmation failed: ${error.message}`);
    }
  },

  // Create customer
  createCustomer: async (customerData) => {
    try {
      const {
        email,
        name,
        phone,
        description,
        metadata = {}
      } = customerData;

      const customer = await stripe.customers.create({
        email,
        name,
        phone,
        description: description || `Angara Jewelry Customer - ${name}`,
        metadata: {
          ...metadata,
          source: 'angara_website'
        }
      });

      return customer;
    } catch (error) {
      console.error('Stripe customer creation error:', error);
      throw new Error(`Customer creation failed: ${error.message}`);
    }
  },

  // Update customer
  updateCustomer: async (customerId, updateData) => {
    try {
      const customer = await stripe.customers.update(customerId, updateData);
      return customer;
    } catch (error) {
      console.error('Stripe customer update error:', error);
      throw new Error(`Customer update failed: ${error.message}`);
    }
  },

  // Create refund
  createRefund: async (chargeId, refundData) => {
    try {
      const {
        amount, // Amount in dollars
        reason = 'requested_by_customer',
        metadata = {}
      } = refundData;

      const refund = await stripe.refunds.create({
        charge: chargeId,
        amount: amount ? Math.round(amount * 100) : undefined, // Convert to cents
        reason,
        metadata: {
          ...metadata,
          refunded_by: 'angara_system'
        }
      });

      return refund;
    } catch (error) {
      console.error('Stripe refund creation error:', error);
      throw new Error(`Refund creation failed: ${error.message}`);
    }
  },

  // Get payment intent
  getPaymentIntent: async (paymentIntentId) => {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('Stripe get payment intent error:', error);
      throw new Error(`Get payment intent failed: ${error.message}`);
    }
  },

  // Verify webhook signature
  verifyWebhookSignature: (payload, signature, secret) => {
    try {
      const event = stripe.webhooks.constructEvent(payload, signature, secret);
      return event;
    } catch (error) {
      console.error('Stripe webhook verification error:', error);
      throw new Error(`Webhook verification failed: ${error.message}`);
    }
  },

  // Create subscription
  createSubscription: async (subscriptionData) => {
    try {
      const {
        customerId,
        priceId,
        quantity = 1,
        metadata = {},
        trialPeriodDays,
        couponId
      } = subscriptionData;

      const subscriptionOptions = {
        customer: customerId,
        items: [{
          price: priceId,
          quantity
        }],
        metadata: {
          ...metadata,
          created_by: 'angara_system'
        },
        expand: ['latest_invoice.payment_intent']
      };

      if (trialPeriodDays) {
        subscriptionOptions.trial_period_days = trialPeriodDays;
      }

      if (couponId) {
        subscriptionOptions.coupon = couponId;
      }

      const subscription = await stripe.subscriptions.create(subscriptionOptions);
      return subscription;
    } catch (error) {
      console.error('Stripe subscription creation error:', error);
      throw new Error(`Subscription creation failed: ${error.message}`);
    }
  },

  // Update subscription
  updateSubscription: async (subscriptionId, updateData) => {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, updateData);
      return subscription;
    } catch (error) {
      console.error('Stripe subscription update error:', error);
      throw new Error(`Subscription update failed: ${error.message}`);
    }
  },

  // Cancel subscription
  cancelSubscription: async (subscriptionId, cancelAtPeriodEnd = true) => {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd
      });
      return subscription;
    } catch (error) {
      console.error('Stripe subscription cancellation error:', error);
      throw new Error(`Subscription cancellation failed: ${error.message}`);
    }
  },

  // Create product
  createProduct: async (productData) => {
    try {
      const {
        name,
        description,
        images = [],
        metadata = {},
        type = 'good'
      } = productData;

      const product = await stripe.products.create({
        name,
        description,
        images,
        type,
        metadata: {
          ...metadata,
          source: 'angara_inventory'
        }
      });

      return product;
    } catch (error) {
      console.error('Stripe product creation error:', error);
      throw new Error(`Product creation failed: ${error.message}`);
    }
  },

  // Create price
  createPrice: async (priceData) => {
    try {
      const {
        productId,
        amount, // Amount in dollars
        currency = 'USD',
        recurring,
        metadata = {}
      } = priceData;

      const priceOptions = {
        product: productId,
        unit_amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        metadata: {
          ...metadata,
          created_by: 'angara_system'
        }
      };

      if (recurring) {
        priceOptions.recurring = recurring;
      }

      const price = await stripe.prices.create(priceOptions);
      return price;
    } catch (error) {
      console.error('Stripe price creation error:', error);
      throw new Error(`Price creation failed: ${error.message}`);
    }
  },

  // Create coupon
  createCoupon: async (couponData) => {
    try {
      const {
        id,
        percentOff,
        amountOff,
        currency = 'USD',
        duration = 'once',
        durationInMonths,
        maxRedemptions,
        redeemBy,
        metadata = {}
      } = couponData;

      const couponOptions = {
        id,
        duration,
        metadata: {
          ...metadata,
          created_by: 'angara_system'
        }
      };

      if (percentOff) {
        couponOptions.percent_off = percentOff;
      } else if (amountOff) {
        couponOptions.amount_off = Math.round(amountOff * 100); // Convert to cents
        couponOptions.currency = currency.toLowerCase();
      }

      if (duration === 'repeating' && durationInMonths) {
        couponOptions.duration_in_months = durationInMonths;
      }

      if (maxRedemptions) {
        couponOptions.max_redemptions = maxRedemptions;
      }

      if (redeemBy) {
        couponOptions.redeem_by = Math.floor(new Date(redeemBy).getTime() / 1000);
      }

      const coupon = await stripe.coupons.create(couponOptions);
      return coupon;
    } catch (error) {
      console.error('Stripe coupon creation error:', error);
      throw new Error(`Coupon creation failed: ${error.message}`);
    }
  },

  // Get customer payment methods
  getCustomerPaymentMethods: async (customerId, type = 'card') => {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: type
      });
      return paymentMethods.data;
    } catch (error) {
      console.error('Stripe get payment methods error:', error);
      throw new Error(`Get payment methods failed: ${error.message}`);
    }
  },

  // Attach payment method to customer
  attachPaymentMethod: async (paymentMethodId, customerId) => {
    try {
      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
      return paymentMethod;
    } catch (error) {
      console.error('Stripe attach payment method error:', error);
      throw new Error(`Attach payment method failed: ${error.message}`);
    }
  },

  // Detach payment method from customer
  detachPaymentMethod: async (paymentMethodId) => {
    try {
      const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
      return paymentMethod;
    } catch (error) {
      console.error('Stripe detach payment method error:', error);
      throw new Error(`Detach payment method failed: ${error.message}`);
    }
  },

  // Create setup intent (for saving payment methods)
  createSetupIntent: async (customerId, paymentMethodTypes = ['card']) => {
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: paymentMethodTypes,
        usage: 'off_session'
      });
      return setupIntent;
    } catch (error) {
      console.error('Stripe setup intent creation error:', error);
      throw new Error(`Setup intent creation failed: ${error.message}`);
    }
  },

  // Calculate tax
  calculateTax: async (taxData) => {
    try {
      const {
        currency = 'USD',
        customerDetails,
        lineItems,
        shipping
      } = taxData;

      const calculation = await stripe.tax.calculations.create({
        currency: currency.toLowerCase(),
        customer_details: customerDetails,
        line_items: lineItems,
        shipping_cost: shipping ? {
          amount: Math.round(shipping.amount * 100), // Convert to cents
          shipping_rate: shipping.shipping_rate
        } : undefined
      });

      return calculation;
    } catch (error) {
      console.error('Stripe tax calculation error:', error);
      throw new Error(`Tax calculation failed: ${error.message}`);
    }
  },

  // Process webhook event
  processWebhookEvent: async (event) => {
    try {
      const { type, data } = event;
      
      switch (type) {
        case 'payment_intent.succeeded':
          console.log('Payment succeeded:', data.object.id);
          return { type: 'payment_success', paymentIntent: data.object };

        case 'payment_intent.payment_failed':
          console.log('Payment failed:', data.object.id);
          return { type: 'payment_failed', paymentIntent: data.object };

        case 'charge.dispute.created':
          console.log('Dispute created:', data.object.id);
          return { type: 'dispute_created', dispute: data.object };

        case 'customer.subscription.created':
          console.log('Subscription created:', data.object.id);
          return { type: 'subscription_created', subscription: data.object };

        case 'customer.subscription.updated':
          console.log('Subscription updated:', data.object.id);
          return { type: 'subscription_updated', subscription: data.object };

        case 'customer.subscription.deleted':
          console.log('Subscription deleted:', data.object.id);
          return { type: 'subscription_deleted', subscription: data.object };

        case 'invoice.payment_succeeded':
          console.log('Invoice payment succeeded:', data.object.id);
          return { type: 'invoice_paid', invoice: data.object };

        case 'invoice.payment_failed':
          console.log('Invoice payment failed:', data.object.id);
          return { type: 'invoice_failed', invoice: data.object };

        default:
          console.log('Unhandled event type:', type);
          return { type: 'unhandled', event };
      }
    } catch (error) {
      console.error('Stripe webhook processing error:', error);
      throw error;
    }
  },

  // Format amount for display
  formatAmount: (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  },

  // Convert amount from cents to dollars
  centsToAmount: (cents) => {
    return Math.round(cents) / 100;
  },

  // Convert amount from dollars to cents
  amountToCents: (amount) => {
    return Math.round(amount * 100);
  }
};

// Validate Stripe configuration
const validateConfig = () => {
  const requiredKeys = ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY'];
  const missing = requiredKeys.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`Missing Stripe configuration: ${missing.join(', ')}`);
    return false;
  }
  return true;
};

// Test Stripe connection
const testConnection = async () => {
  try {
    // Test connection by retrieving account info
    const account = await stripe.accounts.retrieve();
    
    if (account && account.id) {
      console.log('✅ Stripe connection successful');
      console.log(`   Account ID: ${account.id}`);
      console.log(`   Country: ${account.country}`);
      console.log(`   Charges enabled: ${account.charges_enabled}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Stripe connection failed:', error.message);
    return false;
  }
};

// Get Stripe dashboard URL
const getDashboardUrl = (mode = 'live') => {
  const baseUrl = mode === 'test' ? 'https://dashboard.stripe.com/test' : 'https://dashboard.stripe.com';
  return baseUrl;
};

module.exports = {
  stripe,
  stripeConfig,
  stripeUtils,
  validateConfig,
  testConnection,
  getDashboardUrl
};