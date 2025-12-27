// Script to create admin user in database
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      email: "admin@deskinspect.com",
    });

    if (existingAdmin) {
      console.log("ℹ️  Admin user already exists");

      // Update password to ensure it matches login
      const hashedPassword = await bcrypt.hash("12345", 10);
      existingAdmin.password = hashedPassword;
      existingAdmin.fullName = "Administrator";
      existingAdmin.role = "admin";
      await existingAdmin.save();

      console.log("✅ Admin user updated successfully");
    } else {
      // Create new admin user
      const hashedPassword = await bcrypt.hash("12345", 10);

      const adminUser = new User({
        fullName: "Administrator",
        email: "admin@deskinspect.com",
        password: hashedPassword,
        studentId: "ADMIN001",
        department: "Administration",
        role: "admin",
        contactNumber: "",
        notificationPreferences: {
          email: true,
        },
      });

      await adminUser.save();
      console.log("✅ Admin user created successfully");
    }

    console.log("\n📋 Admin Credentials:");
    console.log("Email: admin@deskinspect.com");
    console.log("Password: 12345");

    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    process.exit(1);
  }
};

createAdminUser();