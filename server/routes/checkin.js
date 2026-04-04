import { Router } from 'express';
import { updateCheckIn, getAttendeeById, getCheckInStats } from '../sheets.js';

const router = Router();

/**
 * POST /api/checkin/:id
 * Mark an attendee as checked in
 */
router.post('/:id', async (req, res) => {
  try {
    const attendee = await getAttendeeById(req.params.id);

    if (!attendee) {
      return res
        .status(404)
        .json({ success: false, error: 'Attendee not found' });
    }

    if (attendee.checkinStatus === 'Checked In') {
      return res.json({
        success: true,
        data: attendee,
        message: `${attendee.name} is already checked in`,
        alreadyCheckedIn: true,
      });
    }

    const result = await updateCheckIn(req.params.id, 'Checked In');

    res.json({
      success: true,
      data: { ...attendee, ...result },
      message: `${attendee.name} has been checked in successfully!`,
      alreadyCheckedIn: false,
    });
  } catch (error) {
    console.error('Error checking in:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/checkin/:id/undo
 * Undo a check-in (set status back to Not Checked In)
 */
router.post('/:id/undo', async (req, res) => {
  try {
    const result = await updateCheckIn(req.params.id, 'Not Checked In');
    res.json({ success: true, data: result, message: 'Check-in undone' });
  } catch (error) {
    console.error('Error undoing check-in:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/checkin/stats
 * Get check-in statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getCheckInStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting stats:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
