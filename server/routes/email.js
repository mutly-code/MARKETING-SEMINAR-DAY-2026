import express from 'express';
import { getAttendees, getAttendeeById, updateEmailSent } from '../sheets.js';
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
    
    // Mark email as sent in the sheet
    await updateEmailSent(req.params.id);
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Email send error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/email/send-all — Send emails to all attendees (excludes already sent)
router.post('/send-all', async (req, res) => {
  try {
    const { includeAlreadySent } = req.body; // Optional: force resend
    const attendees = await getAttendees();
    let withEmail = attendees.filter((a) => a.email && a.email.includes('@'));
    
    // By default, exclude attendees who already received emails
    if (!includeAlreadySent) {
      withEmail = withEmail.filter((a) => !a.emailSent);
    }

    if (withEmail.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: includeAlreadySent 
          ? 'No attendees with valid email addresses' 
          : 'No attendees pending email (all have been sent). Use "includeAlreadySent" to resend.'
      });
    }

    // Send immediately and respond, then process in background
    res.json({
      success: true,
      message: `Sending ${withEmail.length} emails in background...`,
      total: withEmail.length,
    });

    // Process emails in background with tracking
    for (const attendee of withEmail) {
      try {
        await sendEmail(attendee);
        await updateEmailSent(attendee.id);
      } catch (error) {
        console.error(`Failed to send to ${attendee.name}:`, error.message);
      }
      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Bulk email error:', error.message);
    // Response already sent, just log
  }
});

// POST /api/email/mark-sent/:id — Mark an attendee's email as sent (for client-side EmailJS)
router.post('/mark-sent/:id', async (req, res) => {
  try {
    const result = await updateEmailSent(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Mark email sent error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/email/test — Send a test email to the admin
router.post('/test', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address required' });
    }

    // Check env vars first
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      return res.status(500).json({
        success: false,
        error: 'Email not configured on server. Set EMAIL_USER and EMAIL_APP_PASSWORD environment variables.',
        diagnosis: {
          EMAIL_USER_SET: !!process.env.EMAIL_USER,
          EMAIL_APP_PASSWORD_SET: !!process.env.EMAIL_APP_PASSWORD,
        },
      });
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
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || null,
      responseCode: error.responseCode || null,
    });
  }
});

// GET /api/email/diagnose — Check email configuration
router.get('/diagnose', async (req, res) => {
  const EMAIL_USER = process.env.EMAIL_USER;
  const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;

  const diagnosis = {
    EMAIL_USER_SET: !!EMAIL_USER,
    EMAIL_USER_VALUE: EMAIL_USER ? `${EMAIL_USER.substring(0, 3)}***@${EMAIL_USER.split('@')[1] || '?'}` : null,
    EMAIL_APP_PASSWORD_SET: !!EMAIL_APP_PASSWORD,
    EMAIL_APP_PASSWORD_LENGTH: EMAIL_APP_PASSWORD ? EMAIL_APP_PASSWORD.length : 0,
    BASE_URL: process.env.BASE_URL || '(not set)',
  };

  // Test SMTP connection
  if (EMAIL_USER && EMAIL_APP_PASSWORD) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        family: 4,
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_APP_PASSWORD,
        },
      });

      await transporter.verify();
      diagnosis.SMTP_CONNECTION = 'SUCCESS';
    } catch (error) {
      diagnosis.SMTP_CONNECTION = 'FAILED';
      diagnosis.SMTP_ERROR = error.message;
    }
  } else {
    diagnosis.SMTP_CONNECTION = 'SKIPPED (missing credentials)';
  }

  res.json(diagnosis);
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
