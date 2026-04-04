import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import attendeesRouter from './routes/attendees.js';
import checkinRouter from './routes/checkin.js';
import authRouter from './routes/auth.js';
import emailRouter from './routes/email.js';
import speakersRouter from './routes/speakers.js';
import galleryRouter from './routes/gallery.js';
import { ensureSheet } from './sheets.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ===== Security Middleware =====

// Helmet — sets secure HTTP headers (XSS, clickjacking, MIME sniffing, etc.)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Vite dev server injects inline scripts
}));

// CORS — allow localhost in dev + production BASE_URL
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
];
if (process.env.BASE_URL && !process.env.BASE_URL.includes('localhost')) {
  allowedOrigins.push(process.env.BASE_URL);
}
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Body parser
app.use(express.json({ limit: '5mb' }));

// Rate limiting — login (5 attempts per 15 min window)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting — email sending (10 requests per 15 min)
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many email requests. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use('/api/attendees', attendeesRouter);
app.use('/api/checkin', checkinRouter);
app.use('/api/auth', loginLimiter, authRouter);
app.use('/api/email', emailLimiter, emailRouter);
app.use('/api/speakers', speakersRouter);
app.use('/api/gallery', galleryRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== Production: Serve built frontend =====
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distPath = join(__dirname, '..', 'dist');

if (existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA fallback — serve index.html for any non-API route
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(join(distPath, 'index.html'));
    }
  });

  console.log('Production mode: serving static files from dist/');
}

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Initialize Google Sheet (create Attendees tab + headers if needed)
  try {
    await ensureSheet();
    console.log('Google Sheets connected — Attendees tab ready');
  } catch (error) {
    console.error('Google Sheets setup warning:', error.message);
    console.log('The app will still work in demo mode. Configure Google Sheets at /setup.html');
  }
});
