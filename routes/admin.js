// routes/admin.js - UPDATED STUDENT PROGRESS QUERY
import express from "express";
import User from "../models/User.js";
import Thesis from "../models/Thesis.js";
import Report from "../models/Report.js";

const router = express.Router();

// Helper function to get faculty name mapping
const getFacultyNameMap = async () => {
  try {
    const facultyMembers = await User.find({
      role: {
        $in: [
          "faculty",
          "supervisor",
          "Faculty",
          "Supervisor",
          "admin",
          "Admin",
        ],
      },
    })
      .select("_id fullName name email")
      .lean();

    const facultyMap = {};
    facultyMembers.forEach((faculty) => {
      facultyMap[faculty._id.toString()] =
        faculty.fullName ||
        faculty.name ||
        `Faculty ${faculty._id.toString().slice(-4)}`;
    });

    return facultyMap;
  } catch (error) {
    console.error("Error creating faculty name map:", error);
    return {};
  }
};

// GET /api/admin/students-debug - Debug endpoint to check ALL user data
router.get("/students-debug", async (req, res) => {
  try {
    console.log("🔍 DEBUG: Fetching ALL user records from database...");

    // Get ALL users to see what's actually in the database
    const allUsers = await User.find({}).lean();
    console.log(`📊 DEBUG: Found ${allUsers.length} total users in database`);

    // Log all users to see their structure
    if (allUsers.length > 0) {
      console.log("📝 DEBUG: All user records:");
      allUsers.forEach((user, index) => {
        console.log(`User ${index + 1}:`, {
          _id: user._id,
          studentId: user.studentId,
          fullName: user.fullName,
          email: user.email,
          department: user.department,
          role: user.role,
          hasPassword: !!user.password,
          allFields: Object.keys(user),
        });
      });
    }

    // Check for actual students only
    const actualStudents = await User.find({
      $and: [
        { studentId: { $exists: true, $ne: null } },
        {
          role: {
            $nin: [
              "admin",
              "faculty",
              "supervisor",
              "Admin",
              "Faculty",
              "Supervisor",
            ],
          },
        },
      ],
    }).lean();
    console.log(
      `🎓 DEBUG: Found ${actualStudents.length} actual students (with studentId and not faculty)`
    );

    res.json({
      success: true,
      debug: {
        totalUsers: allUsers.length,
        actualStudents: actualStudents.length,
        allUsers: allUsers.slice(0, 10),
        actualStudentsSample: actualStudents.slice(0, 3),
      },
    });
  } catch (error) {
    console.error("❌ DEBUG Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/admin/students-progress - Get all students with their progress data
router.get("/students-progress", async (req, res) => {
  try {
    const { department, status } = req.query;

    console.log("🔍 Fetching student progress with filters:", {
      department,
      status,
    });

    // STRICT QUERY: Only users with studentId AND not faculty/admin
    const studentQuery = {
      $and: [
        { studentId: { $exists: true, $ne: null } }, // Must have studentId
        {
          role: {
            $nin: [
              "admin",
              "faculty",
              "supervisor",
              "Admin",
              "Faculty",
              "Supervisor",
              "professor",
              "Professor",
              "staff",
              "Staff",
            ],
          },
        }, // Must not be faculty/admin
      ],
    };

    // Add department filter if specified
    if (department && department !== "all") {
      studentQuery.department = department;
    }

    const students = await User.find(studentQuery).lean();
    console.log(
      `📊 Found ${students.length} actual students (with studentId and not faculty)`
    );

    if (students.length === 0) {
      console.log("❌ No actual students found with studentId field");
      return res.json({
        success: true,
        data: [],
        students: [],
        departments: [],
        summary: {
          totalStudents: 0,
          submittedTheses: 0,
          approvedTheses: 0,
          averageScore: 0,
          departments: 0,
        },
        note: "No student records found in database. Students must have studentId field and not be faculty/admin.",
      });
    }

    // Log what we found for debugging
    console.log(
      "🎓 Actual students found:",
      students.slice(0, 3).map((s) => ({
        fullName: s.fullName,
        studentId: s.studentId,
        department: s.department,
        role: s.role,
      }))
    );

    // Get student IDs
    const studentIdentifiers = students
      .map((student) => student.studentId)
      .filter(Boolean);

    console.log(
      `🔍 Looking for theses with student identifiers:`,
      studentIdentifiers
    );

    let theses = [];
    let reports = [];

    if (studentIdentifiers.length > 0) {
      const thesisQuery = {
        $or: [
          { studentId: { $in: studentIdentifiers } },
          { studentID: { $in: studentIdentifiers } },
          { "student.id": { $in: studentIdentifiers } },
        ],
      };

      theses = await Thesis.find(thesisQuery).lean();
      reports = await Report.find({
        studentId: { $in: studentIdentifiers },
      }).lean();
    }

    console.log(
      `📚 Found ${theses.length} theses and ${reports.length} reports for these students`
    );

    // Process student progress data
    const studentsWithProgress = students.map((student) => {
      const studentIdentifier = student.studentId;

      const studentTheses = theses.filter((thesis) => {
        return (
          thesis.studentId === studentIdentifier ||
          thesis.studentID === studentIdentifier ||
          thesis.student?.id === studentIdentifier ||
          thesis.studentId?.toString() === studentIdentifier.toString()
        );
      });

      const studentReports = reports.filter(
        (report) => report.studentId === studentIdentifier
      );

      const latestThesis = studentTheses.sort(
        (a, b) =>
          new Date(b.createdAt || b.updatedAt || b.date) -
          new Date(a.createdAt || a.updatedAt || a.date)
      )[0];

      const thesisEvaluationReports = studentReports.filter(
        (r) => r.reportType === "thesis-evaluation"
      );
      const scores = thesisEvaluationReports
        .filter(
          (r) =>
            r.reportData &&
            (typeof r.reportData.score === "number" ||
              typeof r.reportData.overallScore === "number")
        )
        .map((r) => r.reportData.score || r.reportData.overallScore);

      const avgScore =
        scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : latestThesis?.score || 0;

      return {
        _id: student._id,
        id: studentIdentifier,
        studentId: studentIdentifier,
        fullName: student.fullName || student.name || "Unknown Student",
        name: student.fullName || student.name || "Unknown Student",
        email: student.email || "No email",
        department: student.department || student.dept || "General",
        contactNumber: student.contactNumber || student.phone || "N/A",
        role: student.role || "student",

        status: latestThesis?.status || "Not Submitted",
        version: latestThesis?.version || latestThesis?.submissionVersion || 1,
        lastSubmission:
          latestThesis?.createdAt ||
          latestThesis?.updatedAt ||
          latestThesis?.submissionDate ||
          null,
        thesisTitle:
          latestThesis?.title ||
          latestThesis?.thesisTitle ||
          latestThesis?.studentName ||
          "No Thesis Submitted",
        isResubmission: latestThesis?.isResubmission || false,

        overallScore: Math.round(avgScore),
        submissionCount: studentTheses.length,
        approvalRate:
          studentTheses.length > 0
            ? Math.round(
                (studentTheses.filter((t) => t.status === "Approved").length /
                  studentTheses.length) *
                  100
              )
            : 0,
        avgThesisScore: Math.round(avgScore),

        createdAt: student.createdAt,
        updatedAt: student.updatedAt,
      };
    });

    // Filter by status if provided
    let filteredStudents = studentsWithProgress;
    if (status && status !== "All" && status !== "all") {
      filteredStudents = studentsWithProgress.filter(
        (student) => student.status === status
      );
    }

    // Get unique departments for filter dropdown
    const departments = [
      ...new Set(students.map((s) => s.department || s.dept).filter(Boolean)),
    ];

    console.log(
      `🎯 Final result: ${filteredStudents.length} students after filtering`
    );

    res.json({
      success: true,
      data: filteredStudents,
      students: filteredStudents,
      departments,
      summary: {
        totalStudents: filteredStudents.length,
        submittedTheses: filteredStudents.filter(
          (s) => s.status !== "Not Submitted"
        ).length,
        approvedTheses: filteredStudents.filter((s) => s.status === "Approved")
          .length,
        averageScore:
          filteredStudents.length > 0
            ? Math.round(
                filteredStudents.reduce((acc, s) => acc + s.overallScore, 0) /
                  filteredStudents.length
              )
            : 0,
        departments: departments.length,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching student progress:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching student progress data",
      error: error.message,
    });
  }
});

// GET /api/admin/students-progress/filter/:status - Filter students by status
router.get("/students-progress/filter/:status", async (req, res) => {
  try {
    const { status } = req.params;
    console.log(`🔍 Filtering students by status: ${status}`);

    // Use the same strict query as above
    const students = await User.find({
      $and: [
        { studentId: { $exists: true, $ne: null } },
        {
          role: {
            $nin: [
              "admin",
              "faculty",
              "supervisor",
              "Admin",
              "Faculty",
              "Supervisor",
            ],
          },
        },
      ],
    }).lean();

    if (students.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: 0,
      });
    }

    const studentIds = students.map((s) => s.studentId).filter(Boolean);
    let theses = [];

    if (studentIds.length > 0) {
      theses = await Thesis.find({ studentId: { $in: studentIds } }).lean();
    }

    const filteredStudents = students
      .map((student) => {
        const studentTheses = theses.filter(
          (t) => t.studentId === student.studentId
        );
        const latestThesis = studentTheses.sort(
          (a, b) =>
            new Date(b.createdAt || b.updatedAt) -
            new Date(a.createdAt || a.updatedAt)
        )[0];

        return {
          id: student.studentId,
          _id: student._id,
          studentId: student.studentId,
          name: student.fullName || "Unknown Student",
          fullName: student.fullName || "Unknown Student",
          email: student.email || "No email",
          department: student.department || "General",
          status: latestThesis?.status || "Not Submitted",
          version: latestThesis?.version || 1,
          lastSubmission:
            latestThesis?.createdAt || latestThesis?.updatedAt || null,
          createdAt: student.createdAt,
        };
      })
      .filter((student) => status === "All" || student.status === status);

    console.log(
      `✅ Returning ${filteredStudents.length} students filtered by status: ${status}`
    );

    res.json({
      success: true,
      data: filteredStudents,
      total: filteredStudents.length,
    });
  } catch (error) {
    console.error("❌ Error filtering student progress:", error);
    res.status(500).json({
      success: false,
      message: "Error filtering student progress data",
      error: error.message,
    });
  }
});
// GET /api/admin/reports - Get all reports with analytics data
router.get("/reports", async (req, res) => {
  try {
    const {
      timeRange,
      reportType,
      facultyId,
      page = 1,
      limit = 50,
    } = req.query;

    console.log("📊 Fetching reports with filters:", {
      timeRange,
      reportType,
      facultyId,
      page,
      limit,
    });

    // Build date filter based on time range
    let dateFilter = {};
    const now = new Date();

    switch (timeRange) {
      case "week":
        dateFilter = {
          createdAt: { $gte: new Date(now.setDate(now.getDate() - 7)) },
        };
        break;
      case "month":
        dateFilter = {
          createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 1)) },
        };
        break;
      case "quarter":
        dateFilter = {
          createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 3)) },
        };
        break;
      case "year":
        dateFilter = {
          createdAt: { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) },
        };
        break;
      default:
        dateFilter = {
          createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 1)) },
        };
    }

    // Build report type filter
    let typeFilter = {};
    if (reportType && reportType !== "all") {
      typeFilter = { reportType };
    }

    // Build faculty filter
    let facultyFilter = {};
    if (facultyId && facultyId !== "all") {
      facultyFilter = { facultyId };
    }

    const combinedFilter = { ...dateFilter, ...typeFilter, ...facultyFilter };

    // Get reports with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const reports = await Report.find(combinedFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get faculty name mapping
    const facultyMap = await getFacultyNameMap();
    console.log(
      `👨‍🏫 Loaded faculty name mapping for ${
        Object.keys(facultyMap).length
      } faculty members`
    );

    // Get total count for pagination
    const totalReports = await Report.countDocuments(combinedFilter);

    // Get analytics data for charts
    const allReportsForAnalytics = await Report.find(dateFilter).lean();

    // Report type distribution
    const reportTypeDistribution = allReportsForAnalytics.reduce(
      (acc, report) => {
        acc[report.reportType] = (acc[report.reportType] || 0) + 1;
        return acc;
      },
      {}
    );

    // Monthly trends
    const monthlyTrends = allReportsForAnalytics.reduce((acc, report) => {
      const month = new Date(report.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
      if (!acc[month]) {
        acc[month] = {
          month,
          total: 0,
          "thesis-evaluation": 0,
          "plagiarism-detection": 0,
          "ai-detection": 0,
        };
      }
      acc[month].total++;
      acc[month][report.reportType]++;
      return acc;
    }, {});

    const monthlyTrendsData = Object.keys(monthlyTrends)
      .map((month) => ({
        ...monthlyTrends[month],
      }))
      .sort((a, b) => new Date(a.month) - new Date(b.month));

    // Faculty report activity - using faculty names
    const facultyActivity = allReportsForAnalytics.reduce((acc, report) => {
      const facultyId = report.facultyId;
      const facultyName =
        facultyMap[facultyId] || `Faculty ${facultyId?.slice(-4) || "Unknown"}`;

      if (!acc[facultyName]) {
        acc[facultyName] = {
          facultyName: facultyName,
          facultyId: facultyId,
          total: 0,
          "thesis-evaluation": 0,
          "plagiarism-detection": 0,
          "ai-detection": 0,
        };
      }
      acc[facultyName].total++;
      acc[facultyName][report.reportType]++;
      return acc;
    }, {});

    const facultyActivityData = Object.values(facultyActivity)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Report status distribution
    const statusDistribution = allReportsForAnalytics.reduce((acc, report) => {
      acc[report.status] = (acc[report.status] || 0) + 1;
      return acc;
    }, {});

    console.log(`✅ Returning ${reports.length} reports with faculty names`);

    res.json({
      success: true,
      reports: reports.map((report) => ({
        _id: report._id,
        reportId: report.reportId,
        studentId: report.studentId,
        studentName: report.studentName,
        facultyId: report.facultyId,
        facultyName:
          facultyMap[report.facultyId] ||
          `Faculty ${report.facultyId?.slice(-4) || "Unknown"}`,
        thesisId: report.thesisId,
        thesisTitle: report.thesisTitle,
        reportType: report.reportType,
        filename: report.filename,
        status: report.status,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        reportData: report.reportData,
      })),
      analytics: {
        totalReports: allReportsForAnalytics.length,
        reportTypeDistribution,
        monthlyTrends: monthlyTrendsData,
        facultyActivity: facultyActivityData,
        statusDistribution,
        timeRange,
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalReports / parseInt(limit)),
        totalReports,
        hasNext: skip + reports.length < totalReports,
        hasPrev: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching reports:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching reports data",
      error: error.message,
    });
  }
});

// GET /api/admin/reports/analytics - Get detailed analytics for reports
router.get("/reports/analytics", async (req, res) => {
  try {
    const { timeRange = "month" } = req.query;

    console.log(
      "📈 Fetching detailed report analytics for time range:",
      timeRange
    );

    // Date filtering logic
    let dateFilter = {};
    const now = new Date();
    switch (timeRange) {
      case "week":
        dateFilter = {
          createdAt: { $gte: new Date(now.setDate(now.getDate() - 7)) },
        };
        break;
      case "month":
        dateFilter = {
          createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 1)) },
        };
        break;
      case "quarter":
        dateFilter = {
          createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 3)) },
        };
        break;
      case "year":
        dateFilter = {
          createdAt: { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) },
        };
        break;
      default:
        dateFilter = {
          createdAt: { $gte: new Date(now.setMonth(now.getMonth() - 1)) },
        };
    }

    const reports = await Report.find(dateFilter).lean();
    console.log(`📊 Found ${reports.length} reports for analytics`);

    // Get faculty name mapping for analytics
    const facultyMap = await getFacultyNameMap();

    // Comprehensive analytics
    const analytics = {
      summary: {
        totalReports: reports.length,
        thesisEvaluations: reports.filter(
          (r) => r.reportType === "thesis-evaluation"
        ).length,
        plagiarismChecks: reports.filter(
          (r) => r.reportType === "plagiarism-detection"
        ).length,
        aiDetections: reports.filter((r) => r.reportType === "ai-detection")
          .length,
        sentReports: reports.filter((r) => r.status === "sent").length,
        savedReports: reports.filter((r) => r.status === "saved").length,
        draftReports: reports.filter((r) => r.status === "draft").length,
      },
      trends: {
        daily: generateDailyTrends(reports),
        weekly: generateWeeklyTrends(reports),
        monthly: generateMonthlyTrends(reports),
      },
      performance: {
        avgProcessingTime: calculateAvgProcessingTime(reports),
        facultyPerformance: calculateFacultyPerformance(reports, facultyMap),
        departmentDistribution: calculateDepartmentDistribution(reports),
      },
      qualityMetrics: {
        avgThesisScores: calculateAvgThesisScores(reports),
        plagiarismStats: calculatePlagiarismStats(reports),
        aiDetectionStats: calculateAIDetectionStats(reports),
      },
    };

    res.json({
      success: true,
      analytics,
      timeRange,
    });
  } catch (error) {
    console.error("❌ Error fetching report analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching report analytics",
      error: error.message,
    });
  }
});

// GET /api/admin/dashboard-stats - Get dashboard statistics
router.get("/dashboard-stats", async (req, res) => {
  try {
    console.log("📊 Fetching dashboard statistics");

    const totalStudents = await User.countDocuments({ role: "student" });
    const totalTheses = await Thesis.countDocuments();
    const totalReports = await Report.countDocuments();
    const pendingTheses = await Thesis.countDocuments({
      status: { $in: ["Not Submitted", "Submitted"] },
    });
    const approvedTheses = await Thesis.countDocuments({ status: "Approved" });

    // Recent activity
    const recentTheses = await Thesis.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const recentReports = await Report.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    console.log(
      `✅ Dashboard stats: ${totalStudents} students, ${totalTheses} theses, ${totalReports} reports`
    );

    res.json({
      success: true,
      stats: {
        totalStudents,
        totalTheses,
        totalReports,
        pendingTheses,
        approvedTheses,
        approvalRate:
          totalTheses > 0
            ? Math.round((approvedTheses / totalTheses) * 100)
            : 0,
      },
      recentActivity: {
        theses: recentTheses,
        reports: recentReports,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics",
      error: error.message,
    });
  }
});

// Utility functions for analytics
function generateDailyTrends(reports) {
  const dailyData = reports.reduce((acc, report) => {
    const date = new Date(report.createdAt).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = { date, total: 0, thesis: 0, plagiarism: 0, ai: 0 };
    }
    acc[date].total++;
    if (report.reportType === "thesis-evaluation") acc[date].thesis++;
    if (report.reportType === "plagiarism-detection") acc[date].plagiarism++;
    if (report.reportType === "ai-detection") acc[date].ai++;
    return acc;
  }, {});

  return Object.values(dailyData)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-30);
}

function generateWeeklyTrends(reports) {
  const weeklyData = reports.reduce((acc, report) => {
    const date = new Date(report.createdAt);
    const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
    const weekKey = weekStart.toLocaleDateString();

    if (!acc[weekKey]) {
      acc[weekKey] = { week: weekKey, total: 0 };
    }
    acc[weekKey].total++;
    return acc;
  }, {});

  return Object.values(weeklyData).sort(
    (a, b) => new Date(a.week) - new Date(b.week)
  );
}

function generateMonthlyTrends(reports) {
  const monthlyData = reports.reduce((acc, report) => {
    const month = new Date(report.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
    if (!acc[month]) {
      acc[month] = { month, total: 0 };
    }
    acc[month].total++;
    return acc;
  }, {});

  return Object.values(monthlyData).sort(
    (a, b) => new Date(a.month) - new Date(b.month)
  );
}

function calculateAvgProcessingTime(reports) {
  return 0;
}

function calculateFacultyPerformance(reports, facultyMap) {
  const facultyPerf = reports.reduce((acc, report) => {
    const facultyName =
      facultyMap[report.facultyId] ||
      `Faculty ${report.facultyId?.slice(-4) || "Unknown"}`;
    if (!acc[facultyName]) {
      acc[facultyName] = { facultyName: facultyName, reports: 0, completed: 0 };
    }
    acc[facultyName].reports++;
    if (report.status === "sent") {
      acc[facultyName].completed++;
    }
    return acc;
  }, {});

  return Object.values(facultyPerf).map((faculty) => ({
    ...faculty,
    completionRate: Math.round((faculty.completed / faculty.reports) * 100),
  }));
}

function calculateDepartmentDistribution(reports) {
  return [];
}

function calculateAvgThesisScores(reports) {
  const thesisReports = reports.filter(
    (r) =>
      r.reportType === "thesis-evaluation" &&
      r.reportData &&
      (typeof r.reportData.score === "number" ||
        typeof r.reportData.overallScore === "number")
  );

  const scores = thesisReports.map(
    (r) => r.reportData.score || r.reportData.overallScore
  );
  const avgScore =
    scores.length > 0
      ? scores.reduce((acc, score) => acc + score, 0) / scores.length
      : 0;

  return {
    average: Math.round(avgScore),
    totalEvaluated: thesisReports.length,
    scoreDistribution: {
      excellent: thesisReports.filter(
        (r) => (r.reportData.score || r.reportData.overallScore) >= 90
      ).length,
      good: thesisReports.filter(
        (r) =>
          (r.reportData.score || r.reportData.overallScore) >= 70 &&
          (r.reportData.score || r.reportData.overallScore) < 90
      ).length,
      average: thesisReports.filter(
        (r) =>
          (r.reportData.score || r.reportData.overallScore) >= 50 &&
          (r.reportData.score || r.reportData.overallScore) < 70
      ).length,
      poor: thesisReports.filter(
        (r) => (r.reportData.score || r.reportData.overallScore) < 50
      ).length,
    },
  };
}

function calculatePlagiarismStats(reports) {
  const plagiarismReports = reports.filter(
    (r) =>
      r.reportType === "plagiarism-detection" &&
      r.reportData &&
      typeof r.reportData.similarityPercentage === "number"
  );

  const percentages = plagiarismReports.map(
    (r) => r.reportData.similarityPercentage
  );
  const avgPercentage =
    percentages.length > 0
      ? percentages.reduce((a, b) => a + b, 0) / percentages.length
      : 0;

  return {
    averageSimilarity: Math.round(avgPercentage),
    totalChecked: plagiarismReports.length,
    highSimilarity: plagiarismReports.filter(
      (r) => r.reportData.similarityPercentage > 25
    ).length,
    mediumSimilarity: plagiarismReports.filter(
      (r) =>
        r.reportData.similarityPercentage > 10 &&
        r.reportData.similarityPercentage <= 25
    ).length,
    lowSimilarity: plagiarismReports.filter(
      (r) => r.reportData.similarityPercentage <= 10
    ).length,
  };
}

function calculateAIDetectionStats(reports) {
  const aiReports = reports.filter(
    (r) =>
      r.reportType === "ai-detection" &&
      r.reportData &&
      typeof r.reportData.aiProbability === "number"
  );

  const probabilities = aiReports.map((r) => r.reportData.aiProbability);
  const avgProbability =
    probabilities.length > 0
      ? probabilities.reduce((a, b) => a + b, 0) / probabilities.length
      : 0;

  return {
    averageProbability: Math.round(avgProbability),
    totalChecked: aiReports.length,
    highProbability: aiReports.filter((r) => r.reportData.aiProbability > 70)
      .length,
    mediumProbability: aiReports.filter(
      (r) => r.reportData.aiProbability > 30 && r.reportData.aiProbability <= 70
    ).length,
    lowProbability: aiReports.filter((r) => r.reportData.aiProbability <= 30)
      .length,
  };
}

export default router;