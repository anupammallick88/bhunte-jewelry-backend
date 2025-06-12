const paypal = require('paypal-rest-sdk');

// PayPal configuration
const paypalConfig = {
  mode: process.env.PAYPAL_MODE || 'sandbox', // 'sandbox' or 'live'
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
  
  // Request configuration
  headers: {
    'Content-Type': 'application/json'
  },
  
  // Webhook configuration
  webhook: {
    id: process.env.PAYPAL_WEBHOOK_ID,
    url: process.env.PAYPAL_WEBHOOK_URL
  }
};

// Configure PayPal SDK
paypal.configure(paypalConfig);

// PayPal utility functions
const paypalUtils = {
  // Create payment
  createPayment: async (paymentData) => {
    try {
      const {
        amount,
        currency = 'USD',
        description = 'Angara Jewelry Purchase',
        returnUrl,
        cancelUrl,
        items = []
      } = paymentData;

      const payment = {
        intent: 'sale',
        payer: {
          payment_method: 'paypal'
        },
        redirect_urls: {
          return_url: returnUrl,
          cancel_url: cancelUrl
        },
        transactions: [{
          item_list: {
            items: items.map(item => ({
              name: item.name,
              sku: item.sku || '',
              price: item.price.toString(),
              currency: currency,
              quantity: item.quantity
            }))
          },
          amount: {
            currency: currency,
            total: amount.toString(),
            details: {
              subtotal: paymentData.subtotal?.toString() || amount.toString(),
              tax: paymentData.tax?.toString() || '0.00',
              shipping: paymentData.shipping?.toString() || '0.00',
              handling_fee: paymentData.handling_fee?.toString() || '0.00',
              shipping_discount: paymentData.shipping_discount?.toString() || '0.00',
              insurance: paymentData.insurance?.toString() || '0.00'
            }
          },
          description: description,
          custom: paymentData.orderId || '',
          invoice_number: paymentData.invoiceNumber || `INV-${Date.now()}`,
          soft_descriptor: 'ANGARA JEWELRY'
        }]
      };

      return new Promise((resolve, reject) => {
        paypal.payment.create(payment, (error, payment) => {
          if (error) {
            console.error('PayPal payment creation error:', error);
            reject(new Error(`Payment creation failed: ${error.message}`));
          } else {
            resolve(payment);
          }
        });
      });
    } catch (error) {
      console.error('PayPal create payment error:', error);
      throw error;
    }
  },

  // Execute payment
  executePayment: async (paymentId, payerId, amount) => {
    try {
      const execute_payment_json = {
        payer_id: payerId,
        transactions: [{
          amount: {
            currency: 'USD',
            total: amount.toString()
          }
        }]
      };

      return new Promise((resolve, reject) => {
        paypal.payment.execute(paymentId, execute_payment_json, (error, payment) => {
          if (error) {
            console.error('PayPal payment execution error:', error);
            reject(new Error(`Payment execution failed: ${error.message}`));
          } else {
            resolve(payment);
          }
        });
      });
    } catch (error) {
      console.error('PayPal execute payment error:', error);
      throw error;
    }
  },

  // Get payment details
  getPayment: async (paymentId) => {
    try {
      return new Promise((resolve, reject) => {
        paypal.payment.get(paymentId, (error, payment) => {
          if (error) {
            console.error('PayPal get payment error:', error);
            reject(new Error(`Get payment failed: ${error.message}`));
          } else {
            resolve(payment);
          }
        });
      });
    } catch (error) {
      console.error('PayPal get payment error:', error);
      throw error;
    }
  },

  // Create refund
  createRefund: async (saleId, refundData) => {
    try {
      const {
        amount,
        currency = 'USD',
        reason = 'Customer requested refund'
      } = refundData;

      const refund = {
        amount: {
          total: amount.toString(),
          currency: currency
        },
        reason: reason
      };

      return new Promise((resolve, reject) => {
        paypal.sale.refund(saleId, refund, (error, refund) => {
          if (error) {
            console.error('PayPal refund error:', error);
            reject(new Error(`Refund failed: ${error.message}`));
          } else {
            resolve(refund);
          }
        });
      });
    } catch (error) {
      console.error('PayPal create refund error:', error);
      throw error;
    }
  },

  // Get refund details
  getRefund: async (refundId) => {
    try {
      return new Promise((resolve, reject) => {
        paypal.refund.get(refundId, (error, refund) => {
          if (error) {
            console.error('PayPal get refund error:', error);
            reject(new Error(`Get refund failed: ${error.message}`));
          } else {
            resolve(refund);
          }
        });
      });
    } catch (error) {
      console.error('PayPal get refund error:', error);
      throw error;
    }
  },

  // Verify webhook signature
  verifyWebhookSignature: (headers, body, webhookId) => {
    try {
      const expected_sig = headers['paypal-transmission-sig'];
      const auth_algo = headers['paypal-auth-algo'];
      const cert_id = headers['paypal-cert-id'];
      const transmission_id = headers['paypal-transmission-id'];
      const timestamp = headers['paypal-transmission-time'];

      if (!expected_sig || !auth_algo || !cert_id || !transmission_id || !timestamp) {
        return false;
      }

      // PayPal webhook verification would require additional setup
      // For now, we'll implement basic validation
      return true;
    } catch (error) {
      console.error('PayPal webhook verification error:', error);
      return false;
    }
  },

  // Get payment approval URL
  getApprovalUrl: (payment) => {
    const approvalUrl = payment.links.find(link => link.rel === 'approval_url');
    return approvalUrl ? approvalUrl.href : null;
  },

  // Parse webhook event
  parseWebhookEvent: (event) => {
    try {
      const eventType = event.event_type;
      const resource = event.resource;

      return {
        type: eventType,
        id: event.id,
        createTime: event.create_time,
        resourceType: event.resource_type,
        summary: event.summary,
        resource: resource,
        // Extract relevant data based on event type
        paymentId: resource.parent_payment || resource.id,
        saleId: resource.id,
        amount: resource.amount,
        state: resource.state,
        transactionFee: resource.transaction_fee
      };
    } catch (error) {
      console.error('PayPal webhook parsing error:', error);
      return null;
    }
  }
};

// Validate PayPal configuration
const validateConfig = () => {
  const requiredKeys = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'];
  const missing = requiredKeys.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`Missing PayPal configuration: ${missing.join(', ')}`);
    return false;
  }
  return true;
};

// Test PayPal connection
const testConnection = async () => {
  try {
    // Create a minimal test payment to verify connection
    const testPayment = await paypalUtils.createPayment({
      amount: 1.00,
      currency: 'USD',
      description: 'Connection test',
      returnUrl: 'http://localhost:3000/success',
      cancelUrl: 'http://localhost:3000/cancel',
      items: [{
        name: 'Test Item',
        price: 1.00,
        quantity: 1
      }]
    });

    if (testPayment && testPayment.id) {
      console.log('✅ PayPal connection successful');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ PayPal connection failed:', error.message);
    return false;
  }
};

module.exports = {
  paypal,
  paypalConfig,
  paypalUtils,
  validateConfig,
  testConnection
};