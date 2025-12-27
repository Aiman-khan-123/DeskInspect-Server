// config/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if Cloudinary credentials are configured
const isCloudinaryConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

let cloudinaryInstance = null;
let storage;

if (isCloudinaryConfigured) {
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  cloudinaryInstance = cloudinary;

  // Configure Cloudinary storage for multer
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: "profile_pictures",
      allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
      transformation: [{ width: 500, height: 500, crop: "limit" }],
    },
  });

  console.log("✅ Cloudinary configured successfully");
} else {
  // Fallback to local storage if Cloudinary is not configured
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, "../uploads/"));
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  });

  console.log(
    "⚠️  Cloudinary not configured. Using local storage. Add CLOUDINARY credentials to .env to enable cloud storage."
  );
}

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Function to create a folder in Cloudinary
const createFolder = async (folderPath) => {
  if (!isCloudinaryConfigured) {
    throw new Error("Cloudinary is not configured");
  }

  try {
    // In Cloudinary, folders are created automatically when you upload files
    // We'll create a tiny transparent PNG as a placeholder
    const result = await cloudinary.uploader.upload(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      {
        folder: folderPath,
        public_id: '.folder-placeholder',
        overwrite: true
      }
    );
    
    // Return the folder URL (remove the filename part)
    const folderUrl = result.secure_url.replace('/.folder-placeholder', '');
    console.log(`✅ Cloudinary folder created: ${folderPath}`);
    return folderUrl;
  } catch (error) {
    console.error('❌ Error creating Cloudinary folder:', error);
    throw error;
  }
};

// Function to upload thesis files to specific folders
const uploadThesisFile = async (fileBuffer, fileName, folderPath) => {
  if (!isCloudinaryConfigured) {
    throw new Error("Cloudinary is not configured");
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath,
        resource_type: 'raw', // For PDF/DOCX files
        public_id: fileName,
        overwrite: true
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
};

export { 
  cloudinaryInstance as cloudinary, 
  upload, 
  isCloudinaryConfigured,
  createFolder,
  uploadThesisFile
};