// ============================================
import mongoose from "mongoose";

const thesisSchema = new mongoose.Schema(
  {
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    studentId: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Assuming supervisors are stored in User collection
      required: true,
    },
    status: {
      type: String,
      enum: [
        "Not Submitted",
        "Submitted",
        "Under Review",
        "Resubmit",
        "Approved",
        "Rejected",
        "Resubmission Requested",
        "Resubmitted",
      ],
      default: "Not Submitted",
    },
    // Resubmission fields
    isResubmission: {
      type: Boolean,
      default: false,
    },
    version: {
      type: Number,
      default: 1,
    },
    parentThesisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Thesis",
      default: null,
    },
    originalSubmissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Thesis",
      default: null,
    },
    resubmissionRequested: {
      type: Boolean,
      default: false,
    },
    resubmissionRequestedAt: {
      type: Date,
      default: null,
    },
    resubmissionRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resubmissionReason: {
      type: String,
      default: null,
    },
    submissionHistory: [
      {
        version: Number,
        submittedAt: Date,
        fileUrl: String,
        score: Number,
        feedback: String,
        status: String,
      },
    ],
  },
  { timestamps: true }
);

const Thesis = mongoose.model("Thesis", thesisSchema);

export default Thesis;
// ============================================