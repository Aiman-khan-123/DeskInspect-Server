// server.js
import dotenv from "dotenv";
dotenv.config();

console.log("🎯 Environment Variables Loaded:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("EMAIL_USER:", process.env.EMAIL_USER || "NOT FOUND");
console.log(
  "EMAIL_PASS:",
  process.env.EMAIL_PASS
    ? "***" + process.env.EMAIL_PASS.slice(-4)
    : "NOT FOUND"
);
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "Set" : "NOT FOUND");

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import connectDB from "./config/db.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Connect to database FIRST
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// IMPORT ROUTES
const authRoutes = await import("./routes/auth.js");
const profileRoutes = await import("./routes/profile.js");
const thesisRoutes = await import("./routes/thesis.js");
const supervisorsRoutes = await import("./routes/supervisors.js");
const eventsRoutes = await import("./routes/events.js");
const notificationsRoutes = await import("./routes/notifications.js");
const evaluationRoutes = await import("./routes/evaluationRoutes.js");
const reportRoutes = await import("./routes/reportRoutes.js");
import temporaryReportsRoutes from "./routes/temporaryReports.js";
import adminRoutes from "./routes/admin.js";
// Routes
app.use("/api/auth", authRoutes.default);
app.use("/api/profile", profileRoutes.default);
app.use("/api/thesis", thesisRoutes.default);
app.use("/api/supervisors", supervisorsRoutes.default);
app.use("/api/events", eventsRoutes.default);
app.use("/api/notifications", notificationsRoutes.default);
app.use("/api/evaluation", evaluationRoutes.default);
app.use("/api/reports", reportRoutes.default);
app.use("/api/temporary-reports", temporaryReportsRoutes);
app.use("/api/admin", adminRoutes);
// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Thesis Evaluation System",
    timestamp: new Date().toISOString(),
    database:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Thesis Evaluation System API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      thesis: "/api/thesis",
      evaluation: "/api/evaluation",
      profiles: "/api/profile",
      supervisors: "/api/supervisors",
      temporaryReports: "/api/temporary-reports",
      admin: "/api/admin",
      events: "/api/events"
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Documentation: http://localhost:${PORT}/`);
});