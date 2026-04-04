import express from 'express';
const router = express.Router();

const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'Mktsem123';

// POST /api/auth/login — verify admin passcode
router.post('/login', (req, res) => {
  const { passcode } = req.body;

  if (passcode === ADMIN_PASSCODE) {
    return res.json({ success: true, message: 'Access granted' });
  }

  return res.status(401).json({ success: false, message: 'Invalid passcode' });
});

export default router;
