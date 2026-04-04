import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env explicitly in this isolated module first
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

if (process.env.CLOUDINARY_URL) {
  // Use config to apply the url specifically
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL,
  });
} else {
  console.warn('⚠️ CLOUDINARY_URL is missing from environment variables');
}

export default cloudinary;
