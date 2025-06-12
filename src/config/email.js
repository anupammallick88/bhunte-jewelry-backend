const nodemailer = require('nodemailer');

// Email configuration
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  
  // Default sender info
  from: {
    name: process.env.EMAIL_FROM_NAME || 'Angara Jewelry',
    address: process.env.EMAIL_FROM_ADDRESS || 'noreply@angara.com'
  },

  // Email templates configuration
  templates: {
    directory: './templates/emails',
    options: {
      viewEngine: 'handlebars',
      viewPath: './templates/emails',
      extName: '.hbs'
    }
  }
};

// Create transporter
const createTransporter = () => {
  try {
    const transporter = nodemailer.createTransporter({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: emailConfig.auth,
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    });

    return transporter;
  } catch (error) {
    console.error('Email transporter creation error:', error);
    throw error;
  }
};

// Email utility functions
const emailUtils = {
  // Send email
  sendEmail: async (emailData) => {
    try {
      const {
        to,
        subject,
        text,
        html,
        attachments = [],
        template,
        context = {}
      } = emailData;

      const transporter = createTransporter();

      const mailOptions = {
        from: `${emailConfig.from.name} <${emailConfig.from.address}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        text,
        html,
        attachments
      };

      // If template is specified, render it
      if (template) {
        // You can integrate with a template engine here
        // For now, we'll use the provided HTML
        mailOptions.html = html || `<p>${text}</p>`;
      }

      const info = await transporter.sendMail(mailOptions);
      
      console.log('Email sent successfully:', info.messageId);
      return {
        success: true,
        messageId: info.messageId,
        response: info.response
      };
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error(`Email sending failed: ${error.message}`);
    }
  },

  // Send welcome email
  sendWelcomeEmail: async (userEmail, userName) => {
    const subject = 'Welcome to Angara Jewelry!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #185181;">Welcome to Angara Jewelry, ${userName}!</h1>
        <p>Thank you for joining our community of jewelry lovers.</p>
        <p>We're excited to help you find the perfect pieces for life's special moments.</p>
        <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3>What's Next?</h3>
          <ul>
            <li>Browse our collection of fine jewelry</li>
            <li>Set up your wishlist</li>
            <li>Follow us on social media for the latest updates</li>
          </ul>
        </div>
        <p>If you have any questions, our customer service team is here to help.</p>
        <p>Best regards,<br>The Angara Team</p>
      </div>
    `;

    return await emailUtils.sendEmail({
      to: userEmail,
      subject,
      html
    });
  },

  // Send order confirmation email
  sendOrderConfirmation: async (userEmail, orderData) => {
    const { orderNumber, items, total, shippingAddress } = orderData;
    
    const subject = `Order Confirmation - ${orderNumber}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #185181;">Order Confirmation</h1>
        <p>Thank you for your order! Your order <strong>${orderNumber}</strong> has been confirmed.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3>Order Details:</h3>
          <ul>
            ${items.map(item => `
              <li>${item.product.name} - Quantity: ${item.quantity} - ${item.totalPrice}</li>
            `).join('')}
          </ul>
          <p><strong>Total: ${total}</strong></p>
        </div>

        <div style="background-color: #e9ecef; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3>Shipping Address:</h3>
          <p>
            ${shippingAddress.firstName} ${shippingAddress.lastName}<br>
            ${shippingAddress.address1}<br>
            ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}
          </p>
        </div>

        <p>We'll send you another email when your order ships.</p>
        <p>Best regards,<br>The Angara Team</p>
      </div>
    `;

    return await emailUtils.sendEmail({
      to: userEmail,
      subject,
      html
    });
  },

  // Send password reset email
  sendPasswordResetEmail: async (userEmail, resetToken, userName) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const subject = 'Password Reset Request';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #185181;">Password Reset Request</h1>
        <p>Hello ${userName},</p>
        <p>You recently requested to reset your password for your Angara Jewelry account.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #185181; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Your Password
          </a>
        </div>

        <p>If the button above doesn't work, copy and paste this link into your browser:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        
        <p><strong>This link will expire in 1 hour.</strong></p>
        
        <p>If you didn't request this password reset, please ignore this email.</p>
        <p>Best regards,<br>The Angara Team</p>
      </div>
    `;

    return await emailUtils.sendEmail({
      to: userEmail,
      subject,
      html
    });
  },

  // Send newsletter email
  sendNewsletterEmail: async (subscribers, subject, content) => {
    try {
      const emailPromises = subscribers.map(subscriber => 
        emailUtils.sendEmail({
          to: subscriber.email,
          subject,
          html: content.replace('{{firstName}}', subscriber.firstName || 'Valued Customer')
        })
      );

      const results = await Promise.allSettled(emailPromises);
      
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      return { successful, failed, total: results.length };
    } catch (error) {
      console.error('Newsletter sending error:', error);
      throw error;
    }
  },

  // Send review request email
  sendReviewRequestEmail: async (userEmail, userName, orderData) => {
    const { orderNumber, items } = orderData;
    
    const subject = 'How was your Angara experience?';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #185181;">We'd love your feedback!</h1>
        <p>Hi ${userName},</p>
        <p>Thank you for your recent purchase (Order ${orderNumber}). We hope you're loving your new jewelry!</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <h3>Your Recent Purchase:</h3>
          <ul>
            ${items.map(item => `<li>${item.product.name}</li>`).join('')}
          </ul>
        </div>

        <p>Would you mind taking a moment to share your experience? Your review helps other customers and helps us improve.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/account/orders/${orderData._id}/review" 
             style="background-color: #185181; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Leave a Review
          </a>
        </div>

        <p>Thank you for choosing Angara Jewelry!</p>
        <p>Best regards,<br>The Angara Team</p>
      </div>
    `;

    return await emailUtils.sendEmail({
      to: userEmail,
      subject,
      html
    });
  }
};

// Validate email configuration
const validateConfig = () => {
  const requiredKeys = ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASS'];
  const missing = requiredKeys.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`Missing email configuration: ${missing.join(', ')}`);
    return false;
  }
  return true;
};

// Test email connection
const testConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email server connection successful');
    return true;
  } catch (error) {
    console.error('❌ Email server connection failed:', error.message);
    return false;
  }
};