const nodemailer = require('nodemailer');

/**
 * Email Configuration using Gmail SMTP (Free)
 *
 * Setup Instructions:
 * 1. Use a Gmail account
 * 2. Enable 2-Factor Authentication
 * 3. Generate App Password: https://myaccount.google.com/apppasswords
 * 4. Add to .env file:
 *    EMAIL_USER=your-email@gmail.com
 *    EMAIL_PASS=your-app-password
 */

// Create reusable transporter
const createTransporter = () => {
  const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const emailPort = process.env.EMAIL_PORT || 587;
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS; // Support both variable names

  if (!emailUser || !emailPass) {
    console.warn('⚠️  Email credentials not configured. Password reset feature will not work.');
    console.warn('💡 Add EMAIL_USER and EMAIL_PASSWORD to your .env file');
    return null;
  }

  return nodemailer.createTransporter({
    host: emailHost,
    port: emailPort,
    secure: false, // Use STARTTLS
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });
};

/**
 * Send OTP email for password reset
 * @param {string} email - Recipient email
 * @param {string} otp - 6-digit OTP code
 * @param {string} username - User's username
 */
const sendPasswordResetOTP = async (email, otp, username) => {
  const transporter = createTransporter();

  if (!transporter) {
    throw new Error('Email service not configured');
  }

  const mailOptions = {
    from: `"Speed Typing Battle" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset - Speed Typing Battle',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #00d9ff, #a855f7);
            padding: 40px 20px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 40px 30px;
          }
          .otp-box {
            background: linear-gradient(135deg, #00d9ff15, #a855f715);
            border: 2px solid #00d9ff;
            border-radius: 12px;
            padding: 24px;
            margin: 24px 0;
            text-align: center;
          }
          .otp-code {
            font-size: 36px;
            font-weight: 700;
            letter-spacing: 8px;
            color: #00d9ff;
            margin: 12px 0;
            font-family: 'Courier New', monospace;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #fbbf24;
            padding: 16px;
            margin: 24px 0;
            border-radius: 4px;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            font-size: 14px;
            color: #666;
          }
          .button {
            display: inline-block;
            padding: 12px 32px;
            background: linear-gradient(135deg, #00d9ff, #a855f7);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 16px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚡ Speed Typing Battle</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">Password Reset Request</p>
          </div>

          <div class="content">
            <p>Hi <strong>${username}</strong>,</p>

            <p>We received a request to reset your password. Use the One-Time Password (OTP) below to reset your password:</p>

            <div class="otp-box">
              <p style="margin: 0; font-size: 14px; color: #666;">Your OTP Code</p>
              <div class="otp-code">${otp}</div>
              <p style="margin: 0; font-size: 12px; color: #666;">Valid for 10 minutes</p>
            </div>

            <p>Enter this code on the password reset page to create a new password.</p>

            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <p style="margin: 8px 0 0 0;">
                If you didn't request this password reset, please ignore this email.
                Your password will remain unchanged.
              </p>
            </div>

            <p style="margin-top: 32px; color: #666; font-size: 14px;">
              This OTP will expire in <strong>10 minutes</strong>. Don't share this code with anyone.
            </p>
          </div>

          <div class="footer">
            <p>Speed Typing Battle - Where Speed Meets Precision</p>
            <p style="margin: 8px 0 0 0; font-size: 12px;">
              This is an automated email. Please do not reply.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset OTP sent to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    throw new Error('Failed to send email');
  }
};

/**
 * Send password reset success confirmation email
 * @param {string} email - Recipient email
 * @param {string} username - User's username
 */
const sendPasswordResetConfirmation = async (email, username) => {
  const transporter = createTransporter();

  if (!transporter) {
    return; // Silently fail if email not configured
  }

  const mailOptions = {
    from: `"Speed Typing Battle" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Successfully Reset - Speed Typing Battle',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #00ff9f, #00d9ff);
            padding: 40px 20px;
            text-align: center;
            color: white;
          }
          .content {
            padding: 40px 30px;
          }
          .success-box {
            background: #d1fae5;
            border-left: 4px solid #00ff9f;
            padding: 16px;
            margin: 24px 0;
            border-radius: 4px;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            font-size: 14px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Password Reset Successful</h1>
          </div>

          <div class="content">
            <p>Hi <strong>${username}</strong>,</p>

            <div class="success-box">
              <p style="margin: 0;">
                <strong>✓ Your password has been successfully reset!</strong>
              </p>
            </div>

            <p>You can now log in to your Speed Typing Battle account with your new password.</p>

            <p style="margin-top: 32px; color: #666; font-size: 14px;">
              If you didn't make this change, please contact us immediately.
            </p>
          </div>

          <div class="footer">
            <p>Speed Typing Battle - Where Speed Meets Precision</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset confirmation sent to ${email}`);
  } catch (error) {
    console.error('❌ Error sending confirmation email:', error.message);
    // Don't throw error for confirmation emails
  }
};

module.exports = {
  sendPasswordResetOTP,
  sendPasswordResetConfirmation
};
