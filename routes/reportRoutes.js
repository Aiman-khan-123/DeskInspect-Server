import express from "express";
import Report from "../models/Report.js";
import User from "../models/User.js";

const router = express.Router();

// Save report as draft (for faculty)
router.post("/save-report", async (req, res) => {
  try {
    const {
      studentId,
      studentName,
      facultyId,
      thesisTitle,
      filename,
      reportType,
      reportData,
      thesisVersion,
    } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!studentId) missingFields.push("studentId");
    if (!studentName) missingFields.push("studentName");
    if (!facultyId) missingFields.push("facultyId");
    if (!reportType) missingFields.push("reportType");

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
        missingFields,
      });
    }

    // Validate reportType
    const validReportTypes = [
      "thesis-evaluation",
      "plagiarism-detection",
      "ai-detection",
    ];
    if (!validReportTypes.includes(reportType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid report type. Must be one of: ${validReportTypes.join(
          ", "
        )}`,
      });
    }

    // Generate unique report ID
    const reportId = `report_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Create and save report as DRAFT (not sent to student)
    const report = new Report({
      reportId,
      studentId: studentId.trim(),
      studentName: studentName.trim(),
      facultyId: facultyId.trim(),
      thesisId: reportId,
      thesisVersion: thesisVersion || 1,
      thesisTitle: (thesisTitle || "Thesis Document").trim(),
      filename: (filename || "document.pdf").trim(),
      reportType: reportType.trim(),
      reportData: reportData || {},
      status: "draft", // Save as draft
      isSentToStudent: false, // Not sent to student
      sentDate: null, // No sent date for drafts
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedReport = await report.save();

    res.json({
      success: true,
      message: "Report saved successfully as draft!",
      report: {
        _id: savedReport._id,
        reportId: savedReport.reportId,
        studentName: savedReport.studentName,
        reportType: savedReport.reportType,
        status: savedReport.status,
        isSentToStudent: savedReport.isSentToStudent,
      },
    });
  } catch (error) {
    console.error("Save report error:", error);

    if (error.name === "ValidationError") {
      const validationErrors = {};
      Object.keys(error.errors).forEach((key) => {
        validationErrors[key] = error.errors[key].message;
      });

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        validationErrors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error while saving report",
      error: error.message,
    });
  }
});

// Send report to student using ObjectId
router.put("/report/:id/send-to-student", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report ID format",
      });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Verify the student exists and get their proper studentId
    const student = await User.findOne({
      $or: [
        { studentId: report.studentId },
        { registrationNumber: report.studentId },
      ],
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found with the provided student ID",
      });
    }

    // Update the report with the verified student ID
    const updatedReport = await Report.findByIdAndUpdate(
      id,
      {
        studentId: student.studentId || student.registrationNumber, // Use the verified ID
        status: "sent",
        isSentToStudent: true,
        sentDate: new Date(),
        updatedAt: new Date(),
      },
      { new: true }
    );

    // Update thesis status to 'Approved' when report is sent to student
    if (updatedReport.reportType === "thesis-evaluation") {
      const Thesis = (await import("../models/Thesis.js")).default;
      // Update the most recent thesis for this student to Approved
      const updatedThesis = await Thesis.findOneAndUpdate(
        { studentId: updatedReport.studentId },
        {
          status: "Approved",
          resubmissionRequested: false, // Clear resubmission flag when approved
        },
        { sort: { version: -1, createdAt: -1 }, new: true } // Get the latest version
      );
      if (updatedThesis) {
        console.log(
          "✅ Thesis status updated to Approved for student:",
          updatedReport.studentId,
          "Version:",
          updatedThesis.version
        );
      } else {
        console.log(
          "⚠️ No thesis found to update for student:",
          updatedReport.studentId
        );
      }
    }

    console.log("✅ Report sent to student:", {
      reportId: updatedReport._id,
      studentId: updatedReport.studentId,
      studentName: updatedReport.studentName,
    });

    res.json({
      success: true,
      message: "Report sent to student successfully",
      data: {
        _id: updatedReport._id,
        studentId: updatedReport.studentId,
        studentName: updatedReport.studentName,
        status: updatedReport.status,
        isSentToStudent: updatedReport.isSentToStudent,
        sentDate: updatedReport.sentDate,
      },
    });
  } catch (error) {
    console.error("Error sending report:", error);
    res.status(500).json({
      success: false,
      message: "Error sending report to student",
      error: error.message,
    });
  }
});

router.get("/student-reports", async (req, res) => {
  try {
    const { studentId, studentObjectId } = req.query;

    if (!studentId && !studentObjectId) {
      return res.status(400).json({
        success: false,
        message: "Either studentId or studentObjectId is required",
      });
    }

    console.log("🔍 Student reports query:", { studentId, studentObjectId });

    let actualStudentId = studentId;

    // If using ObjectId, get the actual student ID from User collection
    if (studentObjectId && studentObjectId.match(/^[0-9a-fA-F]{24}$/)) {
      const student = await User.findById(studentObjectId);
      if (student) {
        actualStudentId = student.studentId || student.registrationNumber;
        console.log("🎯 Resolved ObjectId to studentId:", actualStudentId);
      } else {
        return res.status(404).json({
          success: false,
          message: "Student not found with the provided ObjectId",
        });
      }
    }

    if (!actualStudentId) {
      return res.status(400).json({
        success: false,
        message: "Could not resolve student identifier",
      });
    }

    // Clean the student ID - remove spaces and make consistent
    const cleanStudentId = actualStudentId.trim();
    console.log("🎯 Clean studentId:", cleanStudentId);

    // Build query - try multiple approaches to find reports
    const query = {
      $and: [
        {
          $or: [{ status: "sent" }, { isSentToStudent: true }],
        },
        {
          $or: [
            { studentId: cleanStudentId },
            { studentId: { $regex: new RegExp(`^${cleanStudentId}$`, "i") } },
            { studentId: cleanStudentId + " " }, // Handle trailing space
            { studentId: " " + cleanStudentId }, // Handle leading space
          ],
        },
      ],
    };

    console.log("🔍 Final query:", JSON.stringify(query, null, 2));

    // Find reports for the student
    const reports = await Report.find(query)
      .sort({ sentDate: -1, createdAt: -1 })
      .select("-reportData");

    console.log(
      `✅ Found ${reports.length} reports for student ${cleanStudentId}`
    );

    // If no reports found, show what student IDs actually exist in reports
    if (reports.length === 0) {
      const allStudentIds = await Report.distinct("studentId");
      console.log("📊 All student IDs in reports collection:", allStudentIds);
    }

    res.json({
      success: true,
      data: reports,
      count: reports.length,
      queryUsed: query,
      studentIdUsed: cleanStudentId,
    });
  } catch (error) {
    console.error("Get student reports error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching student reports",
      error: error.message,
    });
  }
});
// Get specific report by MongoDB ObjectId
router.get("/report/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow valid ObjectIds
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report ID format",
      });
    }

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Get report error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching report",
      error: error.message,
    });
  }
});

// Get reports for faculty using facultyId (ObjectId) - ALL reports including drafts
router.get("/faculty-reports/:facultyId", async (req, res) => {
  try {
    const { facultyId } = req.params;

    // Get all reports for faculty (including drafts and sent reports)
    const reports = await Report.find({ facultyId })
      .sort({ createdAt: -1 })
      .select("-reportData");

    res.json({
      success: true,
      data: reports,
      count: reports.length,
    });
  } catch (error) {
    console.error("Get faculty reports error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching faculty reports",
      error: error.message,
    });
  }
});

// Delete report by ObjectId
router.delete("/report/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report ID format",
      });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    await Report.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting report",
      error: error.message,
    });
  }
});

// Health check
router.get("/health", async (req, res) => {
  try {
    const reportCount = await Report.countDocuments();
    const sentReports = await Report.countDocuments({
      status: "sent",
      isSentToStudent: true,
    });

    res.json({
      success: true,
      message: "Reports service is healthy",
      database: {
        totalReports: reportCount,
        sentReports: sentReports,
        connected: true,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({
      success: false,
      message: "Reports service is unhealthy",
      error: error.message,
    });
  }
});

export default router;