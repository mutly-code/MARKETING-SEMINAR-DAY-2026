import express from 'express';
import multer from 'multer';
import cloudinary from '../cloudinary.js';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'speakers.json');

const router = express.Router();

// Memory storage for multer (we stream directly to Cloudinary)
const upload = multer({ storage: multer.memoryStorage() });

// --- Helper Functions ---
function getSpeakers() {
  try {
    const data = readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading speakers.json:', error);
    return [];
  }
}

function saveSpeakers(speakers) {
  try {
    writeFileSync(DB_PATH, JSON.stringify(speakers, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing speakers.json:', error);
    return false;
  }
}

// --- Routes ---

// GET /api/speakers
router.get('/', (req, res) => {
  const speakers = getSpeakers();
  res.json(speakers);
});

// POST /api/speakers/:id/image
router.post('/:id/image', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const speakers = getSpeakers();
    const speakerIndex = speakers.findIndex(s => s.id === id);

    if (speakerIndex === -1) {
      return res.status(404).json({ success: false, error: 'Speaker not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }

    // Use a stream to upload directly to Cloudinary from memory
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'marketing_seminar_2026/speakers',
        public_id: `speaker_${id}_image`,
        overwrite: true,
        resource_type: 'image'
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return res.status(500).json({ success: false, error: error.message });
        }
        
        // Update the speaker document with the secure URL from Cloudinary
        speakers[speakerIndex].image = result.secure_url;
        saveSpeakers(speakers);
        
        return res.json({ 
          success: true, 
          message: 'Image uploaded successfully',
          imageUrl: result.secure_url,
          speaker: speakers[speakerIndex]
        });
      }
    );

    // Pipe the multer buffer to the cloudinary stream
    uploadStream.end(req.file.buffer);

  } catch (error) {
    console.error('Upload route error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
