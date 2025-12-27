// models/FolderSchedule.js
import mongoose from 'mongoose';

const folderScheduleSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true
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
  status: {
    type: String,
    enum: ['scheduled', 'created', 'failed'],
    default: 'scheduled'
  },
  folderPath: {
    type: String
  },
  folderUrl: {
    type: String
  },
  error: {
    type: String
  },
  lastAttempt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
folderScheduleSchema.index({ eventId: 1 });
folderScheduleSchema.index({ folderCreationDate: 1 });
folderScheduleSchema.index({ status: 1 });

const FolderSchedule = mongoose.model('FolderSchedule', folderScheduleSchema);

export default FolderSchedule;