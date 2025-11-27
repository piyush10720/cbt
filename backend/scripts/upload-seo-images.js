const cloudinary = require('cloudinary').v2;
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const IMAGES_DIR = path.join(__dirname, '../../frontend/public');
const IMAGES_TO_UPLOAD = [
  'cbt-exam-library.png',
  'cbt-pdf-parsing.png',
  'cbt-student-exam -interfcae.png',
  'cbt-teacher-dashboard.png',
  'cbt.png',
  'og-image.png'
];

async function uploadImages() {
  console.log('Starting image upload...');
  const results = {};

  for (const filename of IMAGES_TO_UPLOAD) {
    const filePath = path.join(IMAGES_DIR, filename);
    try {
      // Check if file exists
      await fs.access(filePath);
      
      console.log(`Uploading ${filename}...`);
      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'cbt-assets',
        public_id: path.parse(filename).name,
        overwrite: true,
        resource_type: 'image'
      });
      
      results[filename] = result.secure_url;
      console.log(`Uploaded ${filename} -> ${result.secure_url}`);
    } catch (error) {
      console.error(`Failed to upload ${filename}:`, error.message);
    }
  }

  console.log('\nUpload complete. Results:');
  console.log(JSON.stringify(results, null, 2));
  
  await fs.writeFile(path.join(__dirname, 'upload-results.json'), JSON.stringify(results, null, 2));
  console.log('Results saved to upload-results.json');
}

uploadImages();
