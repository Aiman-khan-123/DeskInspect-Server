import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
	{
		email: { type: String, required: true },
		type: { type: String, default: "reminder" },
		message: { type: String, required: true },
		scheduledAt: { type: Date, required: true },
		read: { type: Boolean, default: false },
		delivered: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;


