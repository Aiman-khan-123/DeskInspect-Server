// routes/temporaryReports.js
import express from 'express';

const router = express.Router();

// In-memory storage for temporary reports (in production, use Redis or database)
const temporaryReports = {
  thesis: {},
  plagiarism: {}, 
  ai: {}
};

// Store temporary report
router.post('/store', async (req, res) => {
  try {
    const { type, id, data } = req.body;
    const validTypes = ['thesis', 'plagiarism', 'ai'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report type'
      });
    }

    if (!id || !data) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: id and data'
      });
    }

    // Store the report
    temporaryReports[type][id] = {
      ...data,
      timestamp: new Date().toISOString(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    console.log(`✅ Stored temporary ${type} report:`, id);
    
    res.json({
      success: true,
      message: 'Temporary report stored successfully',
      reportId: id
    });

  } catch (error) {
    console.error('Error storing temporary report:', error);
    res.status(500).json({
      success: false,
      message: 'Error storing temporary report',
      error: error.message
    });
  }
});

// Get temporary report
router.get('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const validTypes = ['thesis', 'plagiarism', 'ai'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report type'
      });
    }

    const report = temporaryReports[type][id];
    
    if (!report) {
      console.log(`❌ Temporary report not found: ${type}/${id}`);
      return res.status(404).json({
        success: false,
        message: 'Temporary report not found or expired'
      });
    }

    // Check if report has expired
    if (Date.now() > report.expiresAt) {
      delete temporaryReports[type][id];
      return res.status(404).json({
        success: false,
        message: 'Temporary report has expired'
      });
    }

    console.log(`✅ Retrieved temporary ${type} report:`, id);
    
    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Error fetching temporary report:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching temporary report',
      error: error.message
    });
  }
});

// Clean up expired reports (optional endpoint)
router.delete('/cleanup', async (req, res) => {
  try {
    const now = Date.now();
    let cleanedCount = 0;

    Object.keys(temporaryReports).forEach(type => {
      Object.keys(temporaryReports[type]).forEach(id => {
        if (now > temporaryReports[type][id].expiresAt) {
          delete temporaryReports[type][id];
          cleanedCount++;
        }
      });
    });

    res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} expired temporary reports`
    });
  } catch (error) {
    console.error('Error cleaning temporary reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error cleaning temporary reports'
    });
  }
});

// Health check
router.get('/health', async (req, res) => {
  try {
    const counts = {};
    Object.keys(temporaryReports).forEach(type => {
      counts[type] = Object.keys(temporaryReports[type]).length;
    });

    res.json({
      success: true,
      message: 'Temporary reports service is healthy',
      counts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Temporary reports service is unhealthy'
    });
  }
});

export default router;