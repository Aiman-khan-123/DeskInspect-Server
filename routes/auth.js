// routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import OTP from "../models/OTP.js";

const router = express.Router();

console.log("🔧 Environment Variables Check in auth.js:");
console.log("EMAIL_USER exists:", !!process.env.EMAIL_USER);
console.log("EMAIL_USER value:", process.env.EMAIL_USER || "Not Set");

// Gmail Configuration with fallback
let transporter;

try {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email credentials not found in environment variables");
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    debug: true,
    logger: true,
  });

  console.log("✅ Email transporter created successfully");
} catch (error) {
  console.error("❌ Email transporter initialization failed:", error.message);
  transporter = null;
}

// Generate random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Forgot Password - Send OTP
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    console.log("📧 Forgot password request for:", email);

    // Check if email transporter is configured
    if (!transporter) {
      return res.status(500).json({
        success: false,
        message:
          "Email service is not configured. Please contact administrator.",
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found:", email);
      return res.status(404).json({
        success: false,
        message: "User with this email does not exist",
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log("🔐 Generated OTP:", otp, "for email:", email);

    // Save OTP to database
    await OTP.findOneAndUpdate(
      { email },
      {
        otp,
        expiresAt,
        used: false,
      },
      { upsert: true, new: true }
    );

    // Send email with OTP
    const mailOptions = {
      from: {
        name: "DeskInspect System",
        address: process.env.EMAIL_USER,
      },
      to: email,
      subject: "Password Reset OTP - DeskInspect",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="text-align: center; background: #575C9E; padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">DeskInspect</h1>
            <p style="color: white; margin: 5px 0 0 0;">Thesis Evaluation System</p>
          </div>
          
          <div style="padding: 20px;">
            <h2 style="color: #575C9E; margin-bottom: 20px;">Password Reset Request</h2>
            <p>Hello ${user.fullName},</p>
            <p>You requested to reset your password. Use the OTP below to proceed with resetting your password:</p>
            
            <div style="background: #f8f9fa; padding: 20px; text-align: center; margin: 25px 0; border-radius: 8px; border: 2px dashed #575C9E;">
              <h1 style="color: #575C9E; margin: 0; font-size: 36px; letter-spacing: 8px; font-weight: bold;">${otp}</h1>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              <strong>Important:</strong> This OTP will expire in 10 minutes. Do not share this code with anyone.
            </p>
            
            <p>If you didn't request this password reset, please ignore this email. Your account remains secure.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This is an automated message from DeskInspect Thesis Evaluation System.<br>
                Please do not reply to this email.
              </p>
            </div>
          </div>
        </div>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);
    console.log("✅ OTP email sent successfully to:", email);

    res.json({
      success: true,
      message: "OTP sent to your email successfully. Please check your inbox.",
    });
  } catch (error) {
    console.error("❌ Forgot password error:", error);

    let errorMessage = "Error sending OTP. Please try again.";

    if (error.code === "EAUTH") {
      errorMessage =
        "Email authentication failed. Please check email configuration.";
    }

    res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
});

// Verify OTP
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    console.log("🔍 Verifying OTP for:", email);

    const otpRecord = await OTP.findOne({ email });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "No OTP found for this email. Please request a new OTP.",
      });
    }

    if (otpRecord.used) {
      return res.status(400).json({
        success: false,
        message: "OTP has already been used. Please request a new OTP.",
      });
    }

    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    if (otpRecord.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please check the code and try again.",
      });
    }

    // Don't mark OTP as used yet - wait for password reset
    console.log("✅ OTP verified successfully for:", email);

    res.json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("❌ Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying OTP",
    });
  }
});

// Reset Password
router.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    console.log("🔄 Resetting password for:", email);

    // Verify OTP first
    const otpRecord = await OTP.findOne({ email });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "No OTP found for this email. Please request a new OTP.",
      });
    }

    if (otpRecord.used) {
      return res.status(400).json({
        success: false,
        message: "OTP has already been used. Please request a new OTP.",
      });
    }

    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    if (otpRecord.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please check the code and try again.",
      });
    }

    // Find user and update password
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Mark OTP as used and then delete it
    otpRecord.used = true;
    await otpRecord.save();
    await OTP.deleteOne({ email });

    console.log("✅ Password reset successfully for:", email);

    res.json({
      success: true,
      message:
        "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    console.error("❌ Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting password",
    });
  }
});

// Your existing login and signup routes remain the same...
router.post("/signup", async (req, res) => {
  const { fullName, email, password, studentId, department, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      studentId,
      department,
      role,
    });
    await newUser.save();
    res.status(201).json({ msg: "User registered successfully" });
  } catch (error) {
    res.status(400).json({ msg: error.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        studentId: user.studentId,
        department: user.department,
        role: user.role,
        contactNumber: user.contactNumber,
        notificationPreferences: user.notificationPreferences,
        profileImageUrl: user.profileImageUrl,
      },
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
});

// Change Password (while logged in)
router.post("/change-password", async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  try {
    console.log("🔄 Change password request for:", email);

    // Validate input
    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({
        msg: "Email, current password, and new password are required",
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await user.save();

    console.log("✅ Password changed successfully for:", email);

    res.json({
      msg: "Password changed successfully",
    });
  } catch (error) {
    console.error("❌ Change password error:", error);
    res.status(500).json({
      msg: "Error changing password. Please try again.",
    });
  }
});

export default router;