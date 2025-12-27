// controllers/eventController.js
import Event from "../models/Event.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { sendNotificationEmail } from "../utils/emailService.js";

// 📌 List Events
export const listEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ endDate: 1, createdAt: -1 });
    const withDue = events.map((e) => ({
      ...e.toObject(),
      dueDate: e.endDate,
    }));
    res.json(withDue);
  } catch (err) {
    console.error("Error listing events:", err);
    res.status(500).json({ msg: "Failed to load events" });
  }
};

// 📌 Create Event
export const createEvent = async (req, res) => {
  try {
    let { name, type, startDate, endDate } = req.body;
    if (!name || !endDate)
      return res.status(400).json({ msg: "name and endDate are required" });

    // Normalize date-only strings to midday UTC to avoid TZ issues
    const normalize = (val) => {
      if (!val) return val;
      if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        return new Date(`${val}T12:00:00.000Z`);
      }
      return val;
    };

    startDate = normalize(startDate);
    endDate = normalize(endDate);

    const event = await Event.create({ name, type, startDate, endDate });

    // Send notifications to all students and faculty
    try {
      console.log(
        "🔔 [EVENT NOTIFICATION] Starting notification creation for event:",
        name
      );

      const studentsAndFaculty = await User.find({
        role: { $in: ["Student", "Faculty"] },
      });

      console.log(
        `🔔 [EVENT NOTIFICATION] Found ${studentsAndFaculty.length} users with role 'Student' or 'Faculty'`
      );

      if (studentsAndFaculty.length === 0) {
        console.log(
          "⚠️ [EVENT NOTIFICATION] No students or faculty found - notifications will not be sent"
        );
      } else {
        console.log(
          `🔔 [EVENT NOTIFICATION] Creating ${studentsAndFaculty.length} notifications...`
        );

        const eventMessage = `A new event "${name}" has been added${
          endDate
            ? ` with due date ${new Date(endDate).toLocaleDateString()}`
            : ""
        }`;

        const notificationPromises = studentsAndFaculty.map(async (user) => {
          const notification = await Notification.create({
            email: user.email,
            userId: user.studentId || user.email,
            type: "general",
            title: "New Event Added",
            message: eventMessage,
            scheduledAt: new Date(),
            priority: "medium",
          });

          // Send email if user has email notifications enabled
          if (user.notificationPreferences?.email) {
            try {
              await sendNotificationEmail({
                to: user.email,
                subject: "New Event Added - DeskInspect",
                title: "New Event Added",
                message: eventMessage,
                actionUrl: `${
                  process.env.CLIENT_URL || "http://localhost:3000"
                }/events`,
                actionLabel: "View Events",
                priority: "medium",
              });
              console.log(`📧 Event notification email sent to ${user.email}`);
            } catch (emailError) {
              console.error(
                `❌ Failed to send email to ${user.email}:`,
                emailError.message
              );
            }
          }

          return notification;
        });

        const results = await Promise.all(notificationPromises);
        console.log(
          `✅ [EVENT NOTIFICATION] Successfully created ${results.length} notifications`
        );
      }
    } catch (notifErr) {
      console.error(
        "❌ [EVENT NOTIFICATION] Error creating notifications:",
        notifErr
      );
      console.error("❌ [EVENT NOTIFICATION] Stack:", notifErr.stack);
      // Don't fail the event creation if notifications fail
    }

    const obj = event.toObject();
    res.status(201).json({ ...obj, dueDate: obj.endDate });
  } catch (err) {
    console.error("Error creating event:", err);
    res.status(500).json({ msg: "Failed to create event" });
  }
};

// 📌 Update Event
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    let { name, type, startDate, endDate } = req.body;

    const normalize = (val) => {
      if (!val) return val;
      if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        return new Date(`${val}T12:00:00.000Z`);
      }
      return val;
    };

    startDate = normalize(startDate);
    endDate = normalize(endDate);

    const updated = await Event.findByIdAndUpdate(
      id,
      { name, type, startDate, endDate },
      { new: true }
    );

    if (!updated) return res.status(404).json({ msg: "Event not found" });

    const obj = updated.toObject();
    res.json({ ...obj, dueDate: obj.endDate });
  } catch (err) {
    console.error("Error updating event:", err);
    res.status(500).json({ msg: "Failed to update event" });
  }
};

// 📌 Delete Event
export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Event.findByIdAndDelete(id);

    if (!deleted) return res.status(404).json({ msg: "Event not found" });

    res.json({ msg: "Event deleted" });
  } catch (err) {
    console.error("Error deleting event:", err);
    res.status(500).json({ msg: "Failed to delete event" });
  }
};