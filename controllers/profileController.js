// controllers/profileController.js

import User from "../models/User.js";
import { cloudinary, isCloudinaryConfigured } from "../config/cloudinary.js";

export const updateProfile = async (req, res) => {
  try {
    const email = req.params.email;
    const { contactNumber, emailPref } = req.body;

    // Find the user first to get old profile image URL
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res.status(404).json({ msg: "User not found" });
    }

    const updateFields = {
      contactNumber,
      notificationPreferences: {
        email: emailPref === "true",
      },
    };

    // If a new profile image is uploaded
    if (req.file) {
      // If using Cloudinary
      if (isCloudinaryConfigured) {
        // Delete old image from Cloudinary if it exists and is a Cloudinary URL
        if (
          existingUser.profileImageUrl &&
          existingUser.profileImageUrl.includes("cloudinary.com")
        ) {
          try {
            // Extract public_id from Cloudinary URL
            const urlParts = existingUser.profileImageUrl.split("/");
            const publicIdWithExtension = urlParts[urlParts.length - 1];
            const publicId = `profile_pictures/${
              publicIdWithExtension.split(".")[0]
            }`;

            await cloudinary.uploader.destroy(publicId);
            console.log(`🗑️ Deleted old profile image: ${publicId}`);
          } catch (deleteError) {
            console.error("Error deleting old image:", deleteError);
            // Continue even if deletion fails
          }
        }

        // Set new Cloudinary URL
        updateFields.profileImageUrl = req.file.path;
      } else {
        // Using local storage
        updateFields.profileImageUrl = `/uploads/${req.file.filename}`;
      }
    }

    const updatedUser = await User.findOneAndUpdate({ email }, updateFields, {
      new: true,
    });

    console.log(`✅ Profile updated and saved for ${email}`);
    res.json({
      msg: "Profile updated successfully",
      profileImageUrl: updatedUser.profileImageUrl,
    });
  } catch (error) {
    console.error("❌ Profile update error:", error);
    res.status(500).json({ msg: "Failed to update profile" });
  }
};

export const getProfile = async (req, res) => {
  try {
    const email = req.params.email;
    const user = await User.findOne({ email }).select("-password");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};