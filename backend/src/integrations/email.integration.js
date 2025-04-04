const nodemailer = require('nodemailer');

// Create email transporter
let transporter;

// Initialize email service
const initEmailService = () => {
  // Create transporter based on environment
  if (process.env.NODE_ENV === 'production') {
    // Production email service (e.g., SendGrid, Mailgun, etc.)
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  } else {
    // Development email service (ethereal.email)
    nodemailer.createTestAccount().then(account => {
      transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
          user: account.user,
          pass: account.pass
        }
      });
      
      console.log('Email test account created:', account.user);
    });
  }
};

// Send email
const sendEmail = async (to, subject, html) => {
  if (!transporter) {
    throw new Error('Email service not initialized');
  }
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Fixy Platform" <noreply@fixyplatform.com>',
    to,
    subject,
    html
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    
    // Log URL for development environment
    if (process.env.NODE_ENV !== 'production') {
      console.log('Email preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Email templates
const templates = {
  // Welcome email
  welcome: (name) => ({
    subject: 'Welcome to Fixy Platform',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Fixy Platform, ${name}!</h2>
        <p>Thank you for joining Fixy, the real-time group chat system with AI agents.</p>
        <p>You can now create chatrooms, add AI agents, and collaborate with teammates.</p>
        <p>Get started by logging in to your account and creating your first chatroom.</p>
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <p>Best regards,<br>The Fixy Team</p>
      </div>
    `
  }),
  
  // Password reset
  passwordReset: (resetLink) => ({
    subject: 'Reset Your Fixy Platform Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>You requested a password reset for your Fixy Platform account.</p>
        <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
        <p>
          <a href="${resetLink}" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            Reset Password
          </a>
        </p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p>Best regards,<br>The Fixy Team</p>
      </div>
    `
  }),
  
  // Team invite
  teamInvite: (inviterName, chatroomName, acceptLink) => ({
    subject: `${inviterName} invited you to join a chatroom on Fixy Platform`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've Been Invited to Join a Chatroom</h2>
        <p>${inviterName} has invited you to join the "${chatroomName}" chatroom on Fixy Platform.</p>
        <p>Fixy is a real-time group chat system with AI agents that helps teams collaborate effectively.</p>
        <p>Click the button below to accept the invitation:</p>
        <p>
          <a href="${acceptLink}" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            Accept Invitation
          </a>
        </p>
        <p>If you don't have a Fixy account yet, you'll be able to create one after accepting the invitation.</p>
        <p>Best regards,<br>The Fixy Team</p>
      </div>
    `
  }),
  
  // Subscription confirmation
  subscriptionConfirmation: (plan, nextBillingDate) => ({
    subject: 'Your Fixy Platform Subscription Confirmation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Subscription Confirmation</h2>
        <p>Thank you for subscribing to the Fixy Platform ${plan} plan!</p>
        <p>Your subscription is now active, and you have access to all the features included in your plan.</p>
        <p>Your next billing date is: ${new Date(nextBillingDate).toLocaleDateString()}</p>
        <p>You can manage your subscription at any time from your account dashboard.</p>
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <p>Best regards,<br>The Fixy Team</p>
      </div>
    `
  })
};

module.exports = {
  initEmailService,
  sendEmail,
  templates
};
