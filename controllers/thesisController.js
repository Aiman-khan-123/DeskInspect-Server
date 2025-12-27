import Thesis from "../models/thesis.js";
import User from "../models/User.js";

// uploadThesis
export const uploadThesis = async (req, res) => {
  try {
    const { studentName, studentId, department, fileUrl, supervisorId } =
      req.body;

    if (!fileUrl) {
      return res
        .status(400)
        .json({ success: false, message: "File URL is required" });
    }

    if (!supervisorId) {
      return res
        .status(400)
        .json({ success: false, message: "Supervisor selection is required" });
    }

    let supervisor = null;
    try {
      supervisor = await User.findById(supervisorId);
    } catch {
      supervisor = null;
    }

    if (!supervisor) {
      supervisor = await User.findOne({
        $or: [{ email: supervisorId }, { fullName: supervisorId }],
      });
    }

    if (
      !supervisor ||
      String(supervisor.role || "").toLowerCase() !== "faculty"
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid supervisor selected" });
    }

    const existingThesis = await Thesis.findOne({ studentId });
    if (existingThesis) {
      return res
        .status(400)
        .json({ success: false, message: "Thesis already submitted" });
    }

    const thesis = new Thesis({
      studentName,
      studentId,
      department,
      fileUrl,
      supervisorId,
      status: "Under Review",
    });

    await thesis.save();
    await thesis.populate("supervisorId", "fullName email department");

    res.status(201).json({
      success: true,
      message: "Thesis submitted successfully",
      thesis,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// getAllThesis
export const getAllThesis = async (req, res) => {
  try {
    const thesis = await Thesis.find()
      .populate("supervisorId", "fullName email department")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: thesis.length, thesis });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// getThesisById
export const getThesisById = async (req, res) => {
  try {
    const thesis = await Thesis.findById(req.params.id).populate(
      "supervisorId",
      "fullName email department"
    );

    if (!thesis)
      return res
        .status(404)
        .json({ success: false, message: "Thesis not found" });

    res.status(200).json({ success: true, thesis });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// getThesisByStudentId
export const getThesisByStudentId = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get the most recent thesis for this student (highest version number)
    const thesis = await Thesis.findOne({ studentId })
      .populate("supervisorId", "fullName email department")
      .sort({ version: -1, createdAt: -1 }); // Sort by version descending, then by creation date

    if (!thesis)
      return res
        .status(404)
        .json({ success: false, message: "Thesis not found" });

    res.status(200).json({ success: true, thesis });
  } catch (error) {
    console.error("Error in getThesisByStudentId:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// getThesesBySupervisor
export const getThesesBySupervisor = async (req, res) => {
  try {
    const { supervisorId } = req.params;
    const theses = await Thesis.find({ supervisorId })
      .populate("supervisorId", "fullName email department")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: theses.length, theses });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// getAllSupervisors
export const getAllSupervisors = async (req, res) => {
  try {
    const supervisors = await User.find(
      { role: { $regex: /^faculty$/i } },
      "fullName email department"
    ).sort({ fullName: 1 });

    res
      .status(200)
      .json({ success: true, count: supervisors.length, supervisors });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Request resubmission
export const requestResubmission = async (req, res) => {
  try {
    const { thesisId, reason, facultyId } = req.body;

    if (!thesisId || !reason || !facultyId) {
      return res.status(400).json({
        success: false,
        message: "Thesis ID, reason, and faculty ID are required",
      });
    }

    const thesis = await Thesis.findById(thesisId).populate(
      "supervisorId",
      "fullName email"
    );

    if (!thesis) {
      return res
        .status(404)
        .json({ success: false, message: "Thesis not found" });
    }

    // Check if faculty is authorized to request resubmission for this thesis
    if (thesis.supervisorId._id.toString() !== facultyId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to request resubmission for this thesis",
      });
    }

    // Update thesis status and resubmission fields
    thesis.status = "Resubmit";
    thesis.resubmissionRequested = true;
    thesis.resubmissionRequestedAt = new Date();
    thesis.resubmissionRequestedBy = facultyId;
    thesis.resubmissionReason = reason;

    await thesis.save();

    // Create notification for student
    const notification = new (
      await import("../models/Notification.js")
    ).default({
      email: thesis.studentId, // This should be student's email
      userId: thesis.studentId,
      type: "resubmission_request",
      title: "Thesis Resubmission Required",
      message: `Your supervisor has requested a resubmission of your thesis. Reason: ${reason}`,
      relatedThesisId: thesisId,
      actionUrl: "/thesis-resubmission",
      actionLabel: "Submit Revised Thesis",
      priority: "high",
      scheduledAt: new Date(),
      read: false,
      delivered: false,
      metadata: {
        supervisorName: thesis.supervisorId.fullName,
        originalStatus: thesis.status,
      },
    });

    await notification.save();

    res.status(200).json({
      success: true,
      message: "Resubmission requested successfully",
      thesis,
    });
  } catch (error) {
    console.error("Error requesting resubmission:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Submit resubmission
export const submitResubmission = async (req, res) => {
  try {
    const { originalThesisId, studentId, fileUrl, studentName, department } =
      req.body;

    if (!originalThesisId || !studentId || !fileUrl) {
      return res.status(400).json({
        success: false,
        message: "Original thesis ID, student ID, and file URL are required",
      });
    }

    const originalThesis = await Thesis.findById(originalThesisId).populate(
      "supervisorId"
    );

    if (!originalThesis) {
      return res
        .status(404)
        .json({ success: false, message: "Original thesis not found" });
    }

    console.log(
      "Checking authorization - Original thesis studentId:",
      originalThesis.studentId
    );
    console.log("Checking authorization - Request studentId:", studentId);

    // More flexible student ID matching
    const studentIdMatch =
      originalThesis.studentId === studentId ||
      originalThesis.studentId.toLowerCase() === studentId.toLowerCase() ||
      studentId.includes(originalThesis.studentId) ||
      originalThesis.studentId.includes(studentId);

    if (!studentIdMatch) {
      return res.status(403).json({
        success: false,
        message: `Not authorized to resubmit this thesis. Original studentId: ${originalThesis.studentId}, Request studentId: ${studentId}`,
      });
    }

    if (!originalThesis.resubmissionRequested) {
      return res.status(400).json({
        success: false,
        message: "Resubmission was not requested for this thesis",
      });
    }

    // Get the current highest version for this thesis
    let highestVersion = originalThesis.version;

    // Find other versions of this thesis
    const otherVersions = await Thesis.find({
      $or: [
        { parentThesisId: originalThesisId },
        {
          originalSubmissionId:
            originalThesis.originalSubmissionId || originalThesisId,
        },
      ],
    });

    otherVersions.forEach((version) => {
      if (version.version > highestVersion) {
        highestVersion = version.version;
      }
    });

    const newVersion = highestVersion + 1;

    // Add current submission to history before creating new version
    originalThesis.submissionHistory.push({
      version: originalThesis.version,
      submittedAt: originalThesis.createdAt,
      fileUrl: originalThesis.fileUrl,
      status: originalThesis.status,
    });

    // Create new thesis submission for resubmission
    const resubmittedThesis = new Thesis({
      studentName: studentName || originalThesis.studentName,
      studentId,
      fileUrl,
      department: department || originalThesis.department,
      supervisorId: originalThesis.supervisorId._id,
      status: "Under Review",
      isResubmission: true,
      version: newVersion,
      parentThesisId: originalThesisId,
      originalSubmissionId:
        originalThesis.originalSubmissionId || originalThesisId,
      submissionHistory: [...originalThesis.submissionHistory],
    });

    await resubmittedThesis.save();
    await resubmittedThesis.populate(
      "supervisorId",
      "fullName email department"
    );

    // Update original thesis
    originalThesis.status = "Resubmitted";
    originalThesis.resubmissionRequested = false;
    await originalThesis.save();

    // Create notification for supervisor
    const notification = new (
      await import("../models/Notification.js")
    ).default({
      email: originalThesis.supervisorId.email,
      userId: originalThesis.supervisorId._id,
      type: "resubmission_received",
      title: "Revised Thesis Submitted",
      message: `Student ${
        studentName || originalThesis.studentName
      } has submitted a revised thesis (Version ${newVersion}).`,
      relatedThesisId: resubmittedThesis._id,
      actionUrl: `/faculty-thesis-review`,
      actionLabel: "Review Thesis",
      priority: "medium",
      scheduledAt: new Date(),
      read: false,
      delivered: false,
      metadata: {
        studentName: studentName || originalThesis.studentName,
        version: newVersion,
        previousVersion: originalThesis.version,
      },
    });

    await notification.save();

    res.status(201).json({
      success: true,
      message: "Resubmission submitted successfully",
      thesis: resubmittedThesis,
    });
  } catch (error) {
    console.error("Error submitting resubmission:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Get thesis version history
export const getThesisVersionHistory = async (req, res) => {
  try {
    const { thesisId } = req.params;

    const thesis = await Thesis.findById(thesisId).populate(
      "supervisorId",
      "fullName email department"
    );

    if (!thesis) {
      return res
        .status(404)
        .json({ success: false, message: "Thesis not found" });
    }

    // Get the original submission ID
    const originalSubmissionId = thesis.originalSubmissionId || thesisId;

    // Find all versions of this thesis
    const allVersions = await Thesis.find({
      $or: [
        { _id: originalSubmissionId },
        { originalSubmissionId: originalSubmissionId },
        { parentThesisId: originalSubmissionId },
      ],
    })
      .populate("supervisorId", "fullName email department")
      .sort({ version: -1 }); // Sort by version descending (newest first)

    res.status(200).json({
      success: true,
      originalThesisId: originalSubmissionId,
      currentVersion: thesis.version,
      totalVersions: allVersions.length,
      versions: allVersions,
    });
  } catch (error) {
    console.error("Error fetching version history:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Check if resubmission is requested for a student
export const checkResubmissionStatus = async (req, res) => {
  try {
    const { studentId } = req.params;

    console.log("=== BACKEND RESUBMISSION CHECK ===");
    console.log("📥 Checking resubmission status for studentId:", studentId);

    // First, let's see what theses exist for this student
    const allTheses = await Thesis.find({
      studentId: studentId,
    }).populate("supervisorId", "fullName email department");

    console.log("📋 Found", allTheses.length, "theses for this student:");
    allTheses.forEach((thesis) => {
      console.log(`  - Thesis ID: ${thesis._id}`);
      console.log(`  - Student ID: ${thesis.studentId}`);
      console.log(`  - Status: ${thesis.status}`);
      console.log(
        `  - Resubmission Requested: ${thesis.resubmissionRequested}`
      );
      console.log(`  - Version: ${thesis.version}`);
      console.log("  ---");
    });

    // Try multiple ways to find the thesis with resubmission requested
    const thesis = await Thesis.findOne({
      studentId: studentId,
      resubmissionRequested: true,
    }).populate("supervisorId", "fullName email department");

    console.log(
      "🔍 Found thesis with resubmission requested:",
      thesis ? thesis._id : "none"
    );

    if (!thesis) {
      console.log("❌ No resubmission requested for this student");
      return res.status(200).json({
        success: true,
        resubmissionRequested: false,
        message: "No resubmission requested",
      });
    }

    console.log("✅ Resubmission IS requested, returning data");
    console.log("=== END BACKEND DEBUG ===");

    res.status(200).json({
      success: true,
      resubmissionRequested: true,
      thesis: {
        _id: thesis._id,
        reason: thesis.resubmissionReason,
        requestedAt: thesis.resubmissionRequestedAt,
        supervisor: thesis.supervisorId,
        version: thesis.version,
        studentId: thesis.studentId,
        studentName: thesis.studentName,
      },
    });
  } catch (error) {
    console.error("💥 Error checking resubmission status:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};