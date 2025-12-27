import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    required: true,
    unique: true,
  },
  studentId: {
    type: String,
    required: true,
  },
  studentName: {
    type: String,
    required: true,
  },
  facultyId: {
    type: String,
    required: true,
  },
  thesisId: {
    type: String,
    required: true,
  },
  thesisVersion: {
    type: Number,
    default: 1,
  },
  thesisTitle: String,
  filename: String,
  reportType: {
    type: String,
    enum: ["thesis-evaluation", "plagiarism-detection", "ai-detection"],
    required: true,
  },
  reportData: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  status: {
    type: String,
    enum: ["draft", "saved", "sent"],
    default: "sent",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Add index for better query performance
reportSchema.index({ facultyId: 1, createdAt: -1 });
reportSchema.index({ studentId: 1, status: 1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;