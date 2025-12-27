// routes/thesis.js
import express from "express";
import Thesis from "../models/Thesis.js";
import {
  uploadThesis,
  getAllThesis,
  getThesisById,
  getThesisByStudentId,
  getThesesBySupervisor,
  getAllSupervisors,
  requestResubmission,
  submitResubmission,
  getThesisVersionHistory,
  checkResubmissionStatus,
} from "../controllers/thesisController.js";
import {
  createThesisFoldersForEvent,
  executeThesisFolderCreation,
  manuallyCreateFoldersForEvent,
  getFolderStatus,
  scheduleFolderCreation,
  getScheduledFolders,
} from "../controllers/thesisFolderController.js";

const router = express.Router();

// Thesis routes
router.post("/upload", uploadThesis);
router.get("/all", getAllThesis);
router.get("/by-student/:studentId", getThesisByStudentId);
router.get("/by-supervisor/:supervisorId", getThesesBySupervisor);
router.get("/:id", getThesisById);

// Supervisor routes
router.get("/supervisors/all", getAllSupervisors);

// Resubmission routes
router.post("/request-resubmission", requestResubmission);
router.post("/submit-resubmission", submitResubmission);
router.post("/resubmit", submitResubmission); // Alias for submit-resubmission
router.get("/version-history/:thesisId", getThesisVersionHistory);
router.get("/resubmission-status/:studentId", checkResubmissionStatus);

// Thesis Folder routes
router.post("/create-folders", async (req, res) => {
  try {
    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required",
      });
    }

    const result = await createThesisFoldersForEvent(eventId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error in create-folders route:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create folders",
    });
  }
});

// Schedule folder creation
router.post("/schedule-folder-creation", async (req, res) => {
  try {
    const result = await scheduleFolderCreation(req.body);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error in schedule-folder-creation route:", error);
    res.status(500).json({
      success: false,
      message: "Failed to schedule folder creation",
    });
  }
});

// Folder status route
router.get("/folder-status/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const result = await getFolderStatus(eventId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error("Error getting folder status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get folder status",
    });
  }
});

// Get all scheduled folders
router.get("/scheduled-folders", async (req, res) => {
  try {
    const result = await getScheduledFolders();
    res.json(result);
  } catch (error) {
    console.error("Error getting scheduled folders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get scheduled folders",
    });
  }
});

// Manual folder creation trigger
router.post("/manual-create-folders", async (req, res) => {
  try {
    const result = await executeThesisFolderCreation();
    res.json(result);
  } catch (error) {
    console.error("Error in manual folder creation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to execute manual folder creation",
    });
  }
});

// Manual folder creation for specific event
router.post("/manual-create-folders-event", async (req, res) => {
  try {
    const result = await manuallyCreateFoldersForEvent(req.body);
    res.json(result);
  } catch (error) {
    console.error("Error in manual folder creation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create folders",
    });
  }
});
// Get status history for a thesis
router.get("/status-history/:thesisId", async (req, res) => {
  try {
    const { thesisId } = req.params;

    const thesis = await Thesis.findById(thesisId);
    if (!thesis) {
      return res.status(404).json({
        success: false,
        message: "Thesis not found",
      });
    }

    // If thesis has status history, return it
    if (thesis.statusHistory && thesis.statusHistory.length > 0) {
      return res.json({
        success: true,
        history: thesis.statusHistory.sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        ),
      });
    }

    // Otherwise, create basic history from thesis data
    const history = [
      {
        status: thesis.status || "Submitted",
        timestamp: thesis.updatedAt || thesis.createdAt,
        comments: "Initial submission",
      },
    ];

    res.json({
      success: true,
      history: history,
    });
  } catch (error) {
    console.error("Error fetching status history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching status history",
    });
  }
});
export default router;