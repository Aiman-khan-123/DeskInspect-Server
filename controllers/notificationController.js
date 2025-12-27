import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendNotificationEmail } from "../utils/emailService.js";

export const createNotification = async (req, res) => {
  try {
    const {
      email,
      userId,
      type,
      title,
      message,
      scheduledAt,
      relatedThesisId,
      actionUrl,
      actionLabel,
      priority,
      metadata,
    } = req.body;

    if (!email || !message || !scheduledAt) {
      return res
        .status(400)
        .json({ msg: "email, message, scheduledAt required" });
    }

    const notif = await Notification.create({
      email,
      userId,
      type: type || "general",
      title,
      message,
      scheduledAt,
      relatedThesisId,
      actionUrl,
      actionLabel,
      priority: priority || "medium",
      metadata: metadata || {},
    });

    // Check if user has email notifications enabled and send email
    try {
      const user = await User.findOne({ email });
      if (user && user.notificationPreferences?.email) {
        console.log(`📧 Sending notification email to ${email}...`);
        await sendNotificationEmail({
          to: email,
          subject: title || "New Notification from DeskInspect",
          title,
          message,
          actionUrl,
          actionLabel,
          priority: priority || "medium",
        });
      } else {
        console.log(
          `⏭️ Skipping email for ${email} (email notifications disabled or user not found)`
        );
      }
    } catch (emailError) {
      console.error("Error sending notification email:", emailError);
      // Don't fail the notification creation if email fails
    }

    res.status(201).json(notif);
  } catch (e) {
    console.error("Error creating notification:", e);
    res.status(500).json({ msg: "Failed to create notification" });
  }
};

export const listNotifications = async (req, res) => {
  try {
    const { email, userId, status, type, limit = 50 } = req.query; // status: all|read|unread
    const filter = {};

    if (email || userId) {
      filter.$or = [];
      if (email) filter.$or.push({ email });
      if (userId) filter.$or.push({ userId });
    }

    if (status === "read") filter.read = true;
    else if (status === "unread") filter.read = false;

    if (type) filter.type = type;

    const items = await Notification.find(filter)
      .populate("relatedThesisId", "studentName studentId version status")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: items.length,
      notifications: items,
    });
  } catch (e) {
    console.error("Error fetching notifications:", e);
    res.status(500).json({ msg: "Failed to load notifications" });
  }
};

export const markRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Notification.findByIdAndUpdate(
      id,
      {
        read: true,
        readAt: new Date(),
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ msg: "Not found" });
    res.json(updated);
  } catch (e) {
    console.error("Error marking notification as read:", e);
    res.status(500).json({ msg: "Failed to mark read" });
  }
};

export const markAllRead = async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId && !email) {
      return res.status(400).json({ msg: "userId or email required" });
    }

    const filter = {};
    if (userId || email) {
      filter.$or = [];
      if (userId) filter.$or.push({ userId });
      if (email) filter.$or.push({ email });
    }
    filter.read = false;

    const result = await Notification.updateMany(filter, {
      read: true,
      readAt: new Date(),
    });

    res.json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
      modifiedCount: result.modifiedCount,
    });
  } catch (e) {
    console.error("Error marking all notifications as read:", e);
    res.status(500).json({ msg: "Failed to mark all as read" });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Notification.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ msg: "Not found" });
    res.json({ success: true, message: "Notification deleted successfully" });
  } catch (e) {
    console.error("Error deleting notification:", e);
    res.status(500).json({ msg: "Failed to delete notification" });
  }
};

export const getNotificationCount = async (req, res) => {
  try {
    const { userId, email } = req.query;

    if (!userId && !email) {
      return res.status(400).json({ msg: "userId or email required" });
    }

    const filter = {};
    if (userId || email) {
      filter.$or = [];
      if (userId) filter.$or.push({ userId });
      if (email) filter.$or.push({ email });
    }

    const totalCount = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({
      ...filter,
      read: false,
    });

    res.json({
      success: true,
      totalCount,
      unreadCount,
    });
  } catch (e) {
    console.error("Error getting notification count:", e);
    res.status(500).json({ msg: "Failed to get notification count" });
  }
};

export const dueUndelivered = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ msg: "email required" });
    const now = new Date();
    const items = await Notification.find({
      email,
      scheduledAt: { $lte: now },
      delivered: false,
    }).sort({ scheduledAt: 1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ msg: "Failed to fetch due notifications" });
  }
};

export const markDelivered = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Notification.findByIdAndUpdate(
      id,
      { delivered: true },
      { new: true }
    );
    if (!updated) return res.status(404).json({ msg: "Not found" });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ msg: "Failed to mark delivered" });
  }
};