import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { updateProfile, getProfile } from "../controllers/profileController.js";

// Needed because __dirname isn’t available in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads/")),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

// Routes
router.get("/:email", getProfile);
router.put("/:email", upload.single("profileImage"), updateProfile);

export default router;
