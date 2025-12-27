// routes/evaluationRoutes.js
import express from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, DOC, and TXT files are allowed'), false);
    }
  }
});

// Store reports in memory (in production, use database)
const reportsStorage = {
  thesis: {},
  plagiarism: {},
  ai: {}
};

// Thesis Evaluation Route - Only runs thesis evaluation agent
router.post('/thesis-evaluation', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    console.log('Received thesis evaluation request for file:', req.file.originalname);

    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    formData.append('analysis_type', 'thesis'); // Changed from 'full' to 'thesis'

    const pythonResponse = await axios.post('http://localhost:8000/evaluate', formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 500000,
    });

    // Store the report
    const reportId = `thesis_${Date.now()}`;
    reportsStorage.thesis[reportId] = {
      id: reportId,
      type: 'thesis-evaluation',
      timestamp: new Date().toISOString(),
      filename: req.file.originalname,
      data: pythonResponse.data
    };

    res.json({
      success: true,
      message: 'Thesis evaluation completed successfully',
      data: pythonResponse.data,
      reportId: reportId
    });

  } catch (error) {
    console.error('Error in thesis evaluation route:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: 'Thesis evaluation service is currently unavailable. Please ensure the Python server is running on port 8000.'
      });
    }

    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: error.response.data.detail || 'Error from evaluation service',
        data: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during thesis evaluation',
      error: error.message
    });
  }
});

// Plagiarism Detection Route - Only runs plagiarism detection agent
router.post('/plagiarism-detection', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    console.log('Received plagiarism detection request for file:', req.file.originalname);

    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    formData.append('analysis_type', 'plagiarism');

    const pythonResponse = await axios.post('http://localhost:8000/evaluate', formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 300000,
    });

    // Store the report
    const reportId = `plagiarism_${Date.now()}`;
    reportsStorage.plagiarism[reportId] = {
      id: reportId,
      type: 'plagiarism-detection',
      timestamp: new Date().toISOString(),
      filename: req.file.originalname,
      data: pythonResponse.data
    };

    res.json({
      success: true,
      message: 'Plagiarism detection completed successfully',
      data: pythonResponse.data,
      reportId: reportId
    });

  } catch (error) {
    console.error('Error in plagiarism detection route:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: 'Plagiarism detection service is currently unavailable.'
      });
    }

    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: error.response.data.detail || 'Error from plagiarism detection service'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during plagiarism detection',
      error: error.message
    });
  }
});

// AI Content Detection Route - Only runs AI detection agent
router.post('/ai-detection', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    console.log('Received AI detection request for file:', req.file.originalname);

    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    formData.append('analysis_type', 'ai');

    const pythonResponse = await axios.post('http://localhost:8000/evaluate', formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 300000,
    });

    // Store the report
    const reportId = `ai_${Date.now()}`;
    reportsStorage.ai[reportId] = {
      id: reportId,
      type: 'ai-detection',
      timestamp: new Date().toISOString(),
      filename: req.file.originalname,
      data: pythonResponse.data
    };

    res.json({
      success: true,
      message: 'AI content detection completed successfully',
      data: pythonResponse.data,
      reportId: reportId
    });

  } catch (error) {
    console.error('Error in AI detection route:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: 'AI detection service is currently unavailable.'
      });
    }

    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: error.response.data.detail || 'Error from AI detection service'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during AI detection',
      error: error.message
    });
  }
});

// Get all reports by type
router.get('/reports/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['thesis', 'plagiarism', 'ai'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report type'
      });
    }

    const reports = Object.values(reportsStorage[type]);
    
    res.json({
      success: true,
      data: reports
    });

  } catch (error) {
    console.error('Error fetching reports:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message
    });
  }
});

// Get specific report
router.get('/report/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const validTypes = ['thesis', 'plagiarism', 'ai'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report type'
      });
    }

    const report = reportsStorage[type][id];
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    console.error('Error fetching report:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching report',
      error: error.message
    });
  }
});

// Health check for evaluation service
router.get('/health', async (req, res) => {
  try {
    const pythonResponse = await axios.get('http://localhost:8000/health', {
      timeout: 5000
    });
    
    res.json({
      success: true,
      message: 'Evaluation service is running',
      pythonService: pythonResponse.data
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Evaluation service is unavailable',
      error: error.message
    });
  }
});

export default router;