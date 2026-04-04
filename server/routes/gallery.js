import express from 'express';
import multer from 'multer';
import cloudinary from '../cloudinary.js';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'gallery.json');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// --- Helper Functions ---
function getGallery() {
  try {
    const data = readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading gallery.json:', error);
    return [];
  }
}

function saveGallery(gallery) {
  try {
    writeFileSync(DB_PATH, JSON.stringify(gallery, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing gallery.json:', error);
    return false;
  }
}

// --- Routes ---

// GET /api/gallery — return all gallery images
router.get('/', (req, res) => {
  const gallery = getGallery();
  res.json(gallery);
});

// POST /api/gallery — upload a new gallery image
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }

    const id = crypto.randomUUID();
    const caption = req.body.caption || '';

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'marketing_seminar_2026/gallery',
        public_id: `gallery_${id}`,
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { width: 600, height: 450, crop: 'fill', gravity: 'auto', quality: 'auto', fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary gallery upload error:', error);
          return res.status(500).json({ success: false, error: error.message });
        }

        const gallery = getGallery();
        const newImage = {
          id,
          url: result.secure_url,
          caption,
          uploadedAt: new Date().toISOString()
        };
        gallery.push(newImage);
        saveGallery(gallery);

        return res.json({
          success: true,
          message: 'Gallery image uploaded successfully',
          image: newImage
        });
      }
    );

    uploadStream.end(req.file.buffer);

  } catch (error) {
    console.error('Gallery upload route error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/gallery/:id — remove a gallery image
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const gallery = getGallery();
    const index = gallery.findIndex(img => img.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    // Remove from Cloudinary
    try {
      await cloudinary.uploader.destroy(`marketing_seminar_2026/gallery/gallery_${id}`);
    } catch (cloudError) {
      console.error('Cloudinary delete warning:', cloudError.message);
    }

    gallery.splice(index, 1);
    saveGallery(gallery);

    return res.json({ success: true, message: 'Image deleted' });

  } catch (error) {
    console.error('Gallery delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
