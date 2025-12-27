// controllers/thesisFolderController.js
import ThesisFolder from "../models/ThesisFolder.js";
import Event from "../models/Event.js";
import FolderSchedule from "../models/FolderSchedule.js";
import { createFolder } from "../config/cloudinary.js";

// Create thesis folders for a specific event
export const createThesisFoldersForEvent = async (eventId) => {
  try {
    const event = await Event.findById(eventId);
    
    if (!event) {
      return {
        success: false,
        message: 'Event not found'
      };
    }

    // Only create folders for thesis events
    if (!event.type.includes('Thesis')) {
      return {
        success: false,
        message: 'Folder creation only available for thesis events'
      };
    }

    // Check if folders already exist for this event
    const existingFolder = await ThesisFolder.findOne({ eventId });
    if (existingFolder) {
      return {
        success: true,
        message: 'Folders already exist for this event',
        folder: existingFolder
      };
    }

    // Calculate folder creation date (2 weeks before due date)
    const dueDate = new Date(event.endDate);
    const folderCreationDate = new Date(dueDate);
    folderCreationDate.setDate(dueDate.getDate() - 14);

    // Create folder in Cloudinary
    const folderPath = `thesis-submissions/${event.type.toLowerCase().replace(' ', '-')}/${eventId}`;
    let folderUrl;
    
    try {
      folderUrl = await createFolder(folderPath);
    } catch (error) {
      console.warn('Cloudinary folder creation failed:', error.message);
      folderUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${folderPath}`;
    }

    // Create thesis folder record
    const thesisFolder = new ThesisFolder({
      eventId: event._id,
      eventName: event.name,
      eventType: event.type,
      dueDate: event.endDate,
      folderCreationDate: folderCreationDate,
      folderPath: folderPath,
      folderUrl: folderUrl,
      virtualFolderId: `thesis-${event._id}-${Date.now()}`,
      status: 'created',
      metadata: {
        totalStudents: 0,
        submissionsReceived: 0,
        department: 'All Departments'
      }
    });

    await thesisFolder.save();

    // Update event with folder info
    event.thesisFolderCreated = true;
    event.thesisFolderPath = folderPath;
    event.thesisFolderUrl = folderUrl;
    event.folderCreatedAt = new Date();
    await event.save();

    // Update folder schedule if exists
    await FolderSchedule.findOneAndUpdate(
      { eventId: eventId.toString() },
      { 
        status: 'created',
        folderPath: folderPath,
        folderUrl: folderUrl,
        lastAttempt: new Date()
      }
    );

    return {
      success: true,
      message: 'Thesis folders created successfully',
      folder: thesisFolder
    };
  } catch (error) {
    console.error('Error creating thesis folders:', error);
    
    // Update folder schedule with error
    await FolderSchedule.findOneAndUpdate(
      { eventId: eventId.toString() },
      { 
        status: 'failed',
        error: error.message,
        lastAttempt: new Date()
      }
    );
    
    return {
      success: false,
      message: 'Failed to create thesis folders',
      error: error.message
    };
  }
};

// Schedule folder creation for thesis events
export const scheduleFolderCreation = async (eventData) => {
  try {
    const { eventId, eventName, eventType, dueDate } = eventData;
    
    if (!eventId || !dueDate) {
      return {
        success: false, 
        message: 'Event ID and due date are required' 
      };
    }

    // Calculate 2 weeks before due date
    const due = new Date(dueDate);
    const folderCreationDate = new Date(due);
    folderCreationDate.setDate(due.getDate() - 14);
    
    // Check if already scheduled
    const existingSchedule = await FolderSchedule.findOne({ eventId });
    if (existingSchedule) {
      return {
        success: true, 
        message: 'Folder creation already scheduled',
        folderCreationDate: existingSchedule.folderCreationDate 
      };
    }
    
    // Create new schedule
    const folderSchedule = new FolderSchedule({
      eventId,
      eventName,
      eventType,
      dueDate: due,
      folderCreationDate: folderCreationDate,
      status: 'scheduled',
      createdAt: new Date()
    });
    
    await folderSchedule.save();
    
    // Set up folder creation
    const now = new Date();
    const delay = folderCreationDate.getTime() - now.getTime();
    
    if (delay > 0) {
      console.log(`⏰ Folder creation scheduled for event ${eventId} in ${Math.round(delay / (1000 * 60 * 60 * 24))} days`);
      
      setTimeout(async () => {
        try {
          await createThesisFoldersForEvent(eventId);
        } catch (error) {
          console.error(`❌ Failed to create folder for event ${eventId}:`, error);
        }
      }, delay);
    } else {
      // If the date has already passed, create folder immediately
      console.log(`⚠️ Folder creation date passed, creating folder immediately for event ${eventId}`);
      await createThesisFoldersForEvent(eventId);
    }
    
    return {
      success: true, 
      message: 'Folder creation scheduled successfully',
      folderCreationDate: folderCreationDate.toISOString(),
      eventId: eventId
    };
  } catch (error) {
    console.error('Error scheduling folder creation:', error);
    return {
      success: false, 
      message: 'Internal server error' 
    };
  }
};

// Execute thesis folder creation (for manual trigger)
export const executeThesisFolderCreation = async () => {
  try {
    const now = new Date();
    const twoWeeksFromNow = new Date(now);
    twoWeeksFromNow.setDate(now.getDate() + 14);

    // Find events that need folder creation
    const eventsNeedingFolders = await Event.find({
      type: { $in: ['Thesis Submission', 'Thesis Resubmission'] },
      endDate: { $lte: twoWeeksFromNow, $gte: now },
      thesisFolderCreated: false
    });

    const results = [];
    
    for (const event of eventsNeedingFolders) {
      try {
        const result = await createThesisFoldersForEvent(event._id);
        results.push({
          eventId: event._id,
          eventName: event.name,
          success: result.success,
          message: result.message
        });
      } catch (error) {
        results.push({
          eventId: event._id,
          eventName: event.name,
          success: false,
          message: error.message
        });
      }
    }

    return {
      success: true,
      message: `Processed ${eventsNeedingFolders.length} events`,
      results: results
    };
  } catch (error) {
    console.error('Error executing folder creation:', error);
    return {
      success: false,
      message: 'Failed to execute folder creation',
      error: error.message
    };
  }
};

// Manual folder creation for specific event
export const manuallyCreateFoldersForEvent = async (data) => {
  try {
    const { eventId } = data;
    
    if (!eventId) {
      return {
        success: false,
        message: 'Event ID is required'
      };
    }

    const result = await createThesisFoldersForEvent(eventId);
    return result;
  } catch (error) {
    console.error('Error in manual folder creation:', error);
    return {
      success: false,
      message: 'Failed to create folders manually',
      error: error.message
    };
  }
};

// Check folder status for an event
export const getFolderStatus = async (eventId) => {
  try {
    const folder = await ThesisFolder.findOne({ eventId });
    const event = await Event.findById(eventId);
    
    if (!event) {
      return {
        success: false,
        message: 'Event not found'
      };
    }

    return {
      success: true,
      event: {
        _id: event._id,
        name: event.name,
        type: event.type,
        endDate: event.endDate,
        thesisFolderCreated: event.thesisFolderCreated || false,
        thesisFolderPath: event.thesisFolderPath,
        thesisFolderUrl: event.thesisFolderUrl
      },
      folder: folder ? {
        status: folder.status,
        folderCreationDate: folder.folderCreationDate,
        virtualFolderId: folder.virtualFolderId,
        folderPath: folder.folderPath,
        folderUrl: folder.folderUrl,
        metadata: folder.metadata
      } : null
    };
  } catch (error) {
    console.error('Error getting folder status:', error);
    return {
      success: false,
      message: 'Failed to get folder status',
      error: error.message
    };
  }
};

// Get all scheduled folders
export const getScheduledFolders = async () => {
  try {
    const folders = await FolderSchedule.find().sort({ folderCreationDate: 1 });
    return { 
      success: true, 
      folders 
    };
  } catch (error) {
    console.error('Error fetching scheduled folders:', error);
    return {
      success: false, 
      message: 'Internal server error' 
    };
  }
};