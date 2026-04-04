import express from 'express';
import { getAttendees, getAttendeeById } from '../sheets.js';
import { sendEmail, sendBulkEmails, buildEmailHtml } from '../email.js';

const router = express.Router();

// POST /api/email/send/:id — Send email to a single attendee
router.post('/send/:id', async (req, res) => {
  try {
    const attendee = await getAttendeeById(req.params.id);
    if (!attendee) {
      return res.status(404).json({ success: false, error: 'Attendee not found' });
    }

    if (!attendee.email) {
      return res.status(400).json({ success: false, error: 'Attendee has no email address' });
    }

    const result = await sendEmail(attendee);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Email send error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/email/send-all — Send emails to all attendees
router.post('/send-all', async (req, res) => {
  try {
    const attendees = await getAttendees();
    const withEmail = attendees.filter((a) => a.email && a.email.includes('@'));

    if (withEmail.length === 0) {
      return res.status(400).json({ success: false, error: 'No attendees with valid email addresses' });
    }

    // Send immediately and respond, then process in background
    res.json({
      success: true,
      message: `Sending ${withEmail.length} emails in background...`,
      total: withEmail.length,
    });

    // Process emails in background
    const results = await sendBulkEmails(withEmail, (progress) => {
      console.log(`Email progress: ${progress.current}/${progress.total} — Last: ${progress.lastSent}`);
    });

    console.log(`Email send complete: ${results.sent} sent, ${results.failed} failed`);
    if (results.errors.length > 0) {
      console.log('Failed emails:', results.errors.map((e) => `${e.name}: ${e.error}`).join(', '));
    }
  } catch (error) {
    console.error('Bulk email error:', error.message);
    // Response already sent, just log
  }
});

// POST /api/email/test — Send a test email to the admin
router.post('/test', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address required' });
    }

    const testAttendee = {
      id: 'ADMIN-TEST',
      name: 'Admin Test',
      email: email,
      role: 'Admin',
      tableNumber: 'VIP',
      dietary: 'None',
    };

    const result = await sendEmail(testAttendee);
    res.json({ success: true, data: result, message: `Test email sent to ${email}` });
  } catch (error) {
    console.error('Test email error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/email/preview — Get a preview of the email template
router.get('/preview', async (req, res) => {
  const testAttendee = {
    id: 'PREVIEW-12345',
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'Guest',
    tableNumber: '1',
    dietary: 'Vegetarian',
  };

  let htmlContent = buildEmailHtml(testAttendee);
  
  // Browsers cannot render "cid:logo" email attachments in an iframe.
  // We must replace it with a direct link to the logo asset for preview purposes.
  htmlContent = htmlContent.replace('cid:logo', '/assets/logo.png');
  
  res.send(htmlContent);
});

export default router;
