import express from "express";
import { getAllSupervisors } from "../controllers/thesisController.js";

const router = express.Router();

// GET /supervisors -> list all supervisors (faculty members)
router.get("/", getAllSupervisors);

export default router;
