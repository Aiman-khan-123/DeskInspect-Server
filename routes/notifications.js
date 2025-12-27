import express from "express";
import {
	createNotification,
	listNotifications,
	markRead,
	dueUndelivered,
	markDelivered,
} from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", listNotifications);
router.post("/", createNotification);
router.get("/due", dueUndelivered);
router.post("/:id/read", markRead);
router.post("/:id/delivered", markDelivered);

export default router;
