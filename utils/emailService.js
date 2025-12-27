// utils/emailService.js
import nodemailer from "nodemailer";

let transporter = null;

// Initialize email transporter
const initializeTransporter = () => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("⚠️ Email credentials not found in environment variables");
      return null;
    }

    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      debug: false,
      logger: false,
    });

    console.log("✅ Email service initialized successfully");
    return transporter;
  } catch (error) {
    console.error("❌ Email service initialization failed:", error.message);
    return null;
  }
};

// Get or create transporter
const getTransporter = () => {
  if (!transporter) {
    transporter = initializeTransporter();
  }
  return transporter;
};

/**
 * Send a notification email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {string} [options.actionUrl] - Optional action URL
 * @param {string} [options.actionLabel] - Optional action button label
 * @param {string} [options.priority] - Priority level (low, medium, high)
 * @returns {Promise<boolean>} - True if email sent successfully
 */
export const sendNotificationEmail = async ({
  to,
  subject,
  title,
  message,
  actionUrl,
  actionLabel,
  priority = "medium",
}) => {
  const emailTransporter = getTransporter();

  if (!emailTransporter) {
    console.warn("⚠️ Email service not available, skipping email send");
    return false;
  }

  try {
    // Determine priority color and icon
    const priorityConfig = {
      low: { color: "#6B7280", icon: "ℹ️" },
      medium: { color: "#575C9E", icon: "📢" },
      high: { color: "#DC2626", icon: "⚠️" },
    };

    const config = priorityConfig[priority] || priorityConfig.medium;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header {
            background: ${config.color};
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .header p {
            margin: 5px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
          }
          .content {
            padding: 30px 20px;
          }
          .notification-title {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin: 0 0 15px 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .notification-message {
            font-size: 15px;
            color: #4b5563;
            margin: 0 0 20px 0;
            line-height: 1.7;
          }
          .action-button {
            display: inline-block;
            background: ${config.color};
            color: white;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 6px;
            font-weight: 600;
            margin-top: 10px;
          }
          .footer {
            background: #f9fafb;
            padding: 20px;
            text-align: center;
            font-size: 13px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
          }
          .divider {
            height: 1px;
            background: #e5e7eb;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>DeskInspect</h1>
            <p>Thesis Evaluation System</p>
          </div>
          <div class="content">
            <div class="notification-title">
              <span>${config.icon}</span>
              <span>${title || "New Notification"}</span>
            </div>
            <div class="notification-message">
              ${message}
            </div>
            ${
              actionUrl && actionLabel
                ? `<a href="${actionUrl}" class="action-button">${actionLabel}</a>`
                : ""
            }
          </div>
          <div class="footer">
            <p>This is an automated notification from DeskInspect.</p>
            <p>You received this email because you have email notifications enabled in your profile settings.</p>
            <div class="divider"></div>
            <p style="margin: 10px 0 0 0; font-size: 12px;">
              © ${new Date().getFullYear()} DeskInspect. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: {
        name: "DeskInspect System",
        address: process.env.EMAIL_USER,
      },
      to,
      subject: subject || title || "New Notification",
      html: htmlContent,
    };

    await emailTransporter.sendMail(mailOptions);
    console.log(`✅ Notification email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error(
      `❌ Failed to send notification email to ${to}:`,
      error.message
    );
    return false;
  }
};

// Initialize on module load
initializeTransporter();

export default {
  sendNotificationEmail,
};