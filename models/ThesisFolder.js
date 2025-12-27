// models/ThesisFolder.js
import mongoose from "mongoose";

const thesisFolderSchema = new mongoose.Schema(
  {
    eventId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Event', 
      required: true 
    },
    eventName: { 
      type: String, 
      required: true 
    },
    eventType: {
      type: String,
      required: true
    },
    dueDate: { 
      type: Date, 
      required: true 
    },
    folderCreationDate: { 
      type: Date, 
      required: true 
    },
    folderPath: { 
      type: String 
    },
    folderUrl: {
      type: String
    },
    virtualFolderId: { 
      type: String, 
      required: true, 
      unique: true 
    },
    status: { 
      type: String, 
      enum: ['scheduled', 'created', 'active', 'archived'],
      default: 'scheduled' 
    },
    studentSubmissions: [{
      studentId: { 
        type: String, 
        required: true 
      },
      studentName: { 
        type: String, 
        required: true 
      },
      submissionPath: { 
        type: String 
      },
      submittedAt: { 
        type: Date 
      },
      fileUrl: {
        type: String
      }
    }],
    metadata: {
      totalStudents: { 
        type: Number, 
        default: 0 
      },
      submissionsReceived: { 
        type: Number, 
        default: 0 
      },
      department: { 
        type: String 
      }
    }
  },
  { 
    timestamps: true 
  }
);

// Indexes for efficient querying
thesisFolderSchema.index({ eventId: 1 });
thesisFolderSchema.index({ dueDate: 1 });
thesisFolderSchema.index({ status: 1 });
thesisFolderSchema.index({ virtualFolderId: 1 });

const ThesisFolder = mongoose.model('ThesisFolder', thesisFolderSchema);

export default ThesisFolder;