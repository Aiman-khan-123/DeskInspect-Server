import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  fullName: String,
  studentId: String,
  department: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  contactNumber: String,
  profileImageUrl: String,
  notificationPreferences: {
    email: { type: Boolean, default: true },
  },
});

const User = mongoose.model("User", userSchema);

export default User;