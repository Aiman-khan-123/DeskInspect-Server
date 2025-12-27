// models/Event.js
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      trim: true
    },
    type: { 
      type: String, 
      required: true,
      enum: ['Thesis Submission', 'Thesis Resubmission', 'General', 'Meeting', 'Workshop', 'Deadline'],
      default: "General"
    },
    startDate: { 
      type: Date 
    },
    endDate: { 
      type: Date, 
      required: true 
    },
    // Thesis folder management fields
    thesisFolderCreated: { 
      type: Boolean, 
      default: false 
    },
    thesisFolderPath: { 
      type: String 
    },
    thesisFolderUrl: { 
      type: String 
    },
    folderCreatedAt: { 
      type: Date 
    },
    description: {
      type: String,
      trim: true
    }
  },
  { 
    timestamps: true 
  }
);

// Index for efficient querying
eventSchema.index({ type: 1, endDate: 1 });
eventSchema.index({ thesisFolderCreated: 1 });
eventSchema.index({ createdAt: -1 });

const Event = mongoose.model('Event', eventSchema);

export default Event;