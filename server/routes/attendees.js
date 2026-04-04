import { Router } from 'express';
import {
  getAttendees,
  getAttendeeById,
  addAttendee,
  ensureSheet,
} from '../sheets.js';
import { generateQRCode } from '../qrcode.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * GET /api/attendees
 * List all attendees (for admin dashboard)
 */
router.get('/', async (req, res) => {
  try {
    const attendees = await getAttendees();

    // Optional: filter by role
    const { role, search } = req.query;
    let filtered = attendees;

    if (role) {
      filtered = filtered.filter(
        (a) => a.role.toLowerCase() === role.toLowerCase()
      );
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q)
      );
    }

    res.json({ success: true, data: filtered, total: filtered.length });
  } catch (error) {
    console.error('Error fetching attendees:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/attendees/:id
 * Get a single attendee by ID (for personalized landing page)
 */
router.get('/:id', async (req, res) => {
  try {
    const attendee = await getAttendeeById(req.params.id);

    if (!attendee) {
      return res
        .status(404)
        .json({ success: false, error: 'Attendee not found' });
    }

    res.json({ success: true, data: attendee });
  } catch (error) {
    console.error('Error fetching attendee:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/attendees
 * Add a new attendee
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, role, tableNumber, dietary } = req.body;

    if (!name || !email) {
      return res
        .status(400)
        .json({ success: false, error: 'Name and email are required' });
    }

    const id = `ATT-${uuidv4().slice(0, 8).toUpperCase()}`;
    const { url: qrCodeUrl } = await generateQRCode(id);

    const attendee = await addAttendee({
      id,
      name,
      email,
      role: role || 'Guest',
      tableNumber: tableNumber || '',
      dietary: dietary || 'None',
      qrCodeUrl,
    });

    res.status(201).json({ success: true, data: attendee });
  } catch (error) {
    console.error('Error adding attendee:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/attendees/:id/qrcode
 * Generate and return QR code for an attendee
 */
router.get('/:id/qrcode', async (req, res) => {
  try {
    const attendee = await getAttendeeById(req.params.id);

    if (!attendee) {
      return res
        .status(404)
        .json({ success: false, error: 'Attendee not found' });
    }

    const { qrDataUrl } = await generateQRCode(req.params.id);
    res.json({ success: true, data: { id: req.params.id, qrDataUrl } });
  } catch (error) {
    console.error('Error generating QR code:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
