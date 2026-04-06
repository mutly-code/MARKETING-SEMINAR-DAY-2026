import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateQRCode } from './qrcode.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cloudinary-hosted white logo for email templates
const LOGO_URL = 'https://res.cloudinary.com/dvrzwuxaw/image/upload/v1775297798/white_logo_tnnti3.png';

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;
const BASE_URL = process.env.BASE_URL || 'https://marketing-seminar-day-2026.onrender.com';

/**
 * Create email transporter (Gmail SMTP)
 */
function getTransporter() {
  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {
    throw new Error('Email not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD in .env');
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    family: 4, // Force IPv4 — Render free tier doesn't support IPv6
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_APP_PASSWORD,
    },
  });
}

/**
 * Generate the personalized HTML email for an attendee
 */
export function buildEmailHtml(attendee) {
  const attendeeUrl = `${BASE_URL}/?id=${attendee.id}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="only light">
  <meta name="supported-color-schemes" content="only light">
  <style>
    :root { color-scheme: only light; }
    * { color-scheme: only light !important; }
  </style>
</head>
<body bgcolor="#0A1628" style="margin: 0; padding: 0; background-color: #0A1628; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0A1628" style="background-color: #0A1628; padding: 40px 20px;">
    <tr>
      <td align="center" bgcolor="#0A1628">
        <table width="600" cellpadding="0" cellspacing="0" bgcolor="#0F2440" style="background-color: #0F2440; border-radius: 12px; overflow: hidden; max-width: 100%;">
          
          <!-- Gold Accent Bar -->
          <tr>
            <td bgcolor="#D4A843" style="height: 5px; background-color: #D4A843; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header — Deep Navy -->
          <tr>
            <td bgcolor="#0A1628" style="background-color: #0A1628; padding: 36px 40px 28px; text-align: center;">
              <img src="${LOGO_URL}" alt="UTech Marketing Seminar" style="display: block; margin: 0 auto 18px; max-height: 90px; max-width: 220px; height: auto; width: auto;" />
              <h1 style="color: #ffffff !important; font-size: 21px; margin: 0 0 6px; letter-spacing: 0.5px; font-weight: 700;">44th UTech Marketing Seminar 2026</h1>
              <p style="color: #D4A843 !important; font-size: 13px; margin: 0; font-style: italic; letter-spacing: 0.3px;">
                "Your Brand, Your Balance: Thriving as a Marketing Graduate"
              </p>
            </td>
          </tr>

          <!-- Welcome -->
          <tr>
            <td bgcolor="#0F2440" style="padding: 30px 40px 20px; background-color: #0F2440;">
              <p style="font-size: 16px; color: #E2E8F0 !important; margin: 0 0 8px;">Dear <strong style="color: #ffffff !important;">${attendee.name}</strong>,</p>
              <p style="font-size: 14px; color: #94A3B8 !important; line-height: 1.6; margin: 0;">
                You are cordially invited to the <strong style="color: #ffffff !important;">44th UTech Marketing Seminar</strong>. 
                Below you will find your personalized event pass with all the details you need.
              </p>
            </td>
          </tr>

          <!-- Event Details -->
          <tr>
            <td bgcolor="#0F2440" style="padding: 0 40px 20px; background-color: #0F2440;">
              <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#1E293B" style="background-color: #1E293B; border-radius: 8px; border: 1px solid #334155;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%" style="padding: 8px 0; vertical-align: top;">
                          <span style="font-size: 11px; color: #64748B !important; text-transform: uppercase; letter-spacing: 0.05em;">Date</span><br>
                          <strong style="font-size: 14px; color: #ffffff !important;">Wednesday, April 8, 2026</strong>
                        </td>
                        <td width="50%" style="padding: 8px 0; vertical-align: top;">
                          <span style="font-size: 11px; color: #64748B !important; text-transform: uppercase; letter-spacing: 0.05em;">Time</span><br>
                          <strong style="font-size: 14px; color: #ffffff !important;">9:00 AM – 4:00 PM</strong>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding: 8px 0; vertical-align: top;">
                          <span style="font-size: 11px; color: #64748B !important; text-transform: uppercase; letter-spacing: 0.05em;">Venue</span><br>
                          <strong style="font-size: 14px; color: #ffffff !important;">Hope Fellowship Church</strong><br>
                          <span style="font-size: 12px; color: #94A3B8 !important;">Hope Fellowship Auditorium</span><br>
                          <a href="https://maps.app.goo.gl/t4LmsQx8TP5ZSTvn6" target="_blank" style="font-size: 11px; color: #60A5FA !important; text-decoration: none; display: inline-block; margin-top: 4px;">View on Google Maps</a>
                        </td>
                        <td width="50%" style="padding: 8px 0; vertical-align: top;">
                          <span style="font-size: 11px; color: #64748B !important; text-transform: uppercase; letter-spacing: 0.05em;">Role</span><br>
                          <strong style="font-size: 14px; color: #D4A843 !important;">${attendee.role}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding: 8px 0; vertical-align: top;">
                          <span style="font-size: 11px; color: #64748B !important; text-transform: uppercase; letter-spacing: 0.05em;">Table Number</span><br>
                          <strong style="font-size: 18px; color: #ffffff !important;">Table ${attendee.tableNumber}</strong>
                        </td>
                        <td width="50%" style="padding: 8px 0; vertical-align: top;">
                          <span style="font-size: 11px; color: #64748B !important; text-transform: uppercase; letter-spacing: 0.05em;">Dietary</span><br>
                          <strong style="font-size: 14px; color: #ffffff !important;">${attendee.dietary || 'None'}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- QR Code -->
          <tr>
            <td bgcolor="#0F2440" style="padding: 0 40px 20px; text-align: center; background-color: #0F2440;">
              <p style="font-size: 14px; color: #94A3B8 !important; margin: 0 0 12px;">
                Present this QR code at the registration desk for check-in:
              </p>
              <div style="display: inline-block; background-color: #ffffff; padding: 16px; border-radius: 12px; border: 2px solid #D4A843;">
                <img src="cid:qrcode" alt="Your QR Code" width="180" height="180" style="display: block;" />
              </div>
              <p style="font-size: 12px; color: #64748B !important; margin: 12px 0 0;">
                ID: ${attendee.id}
              </p>
            </td>
          </tr>

          <!-- View Event Pass Button — Gold -->
          <tr>
            <td bgcolor="#0F2440" style="padding: 0 40px 30px; text-align: center; background-color: #0F2440;">
              <a href="${attendeeUrl}" style="display: inline-block; background-color: #D4A843; color: #0A1628 !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 700; margin-bottom: 16px;">
                View Your Full Event Pass
              </a>
              <br>
              <a href="${BASE_URL}/" style="color: #D4A843 !important; text-decoration: none; font-size: 13px; font-weight: 600;">
                Visit Event Website to View Speakers
              </a>
            </td>
          </tr>

          <!-- Schedule Preview -->
          <tr>
            <td bgcolor="#0F2440" style="padding: 0 40px 30px; background-color: #0F2440;">
              <h3 style="font-size: 15px; color: #ffffff !important; margin: 0 0 12px; border-bottom: 2px solid #D4A843; padding-bottom: 8px;">Schedule Highlights</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
                <tr><td style="padding: 6px 0; color: #ffffff !important; width: 80px;"><strong>8:15 AM</strong></td><td style="padding: 6px 0; color: #CBD5E1 !important;">Registration</td></tr>
                <tr><td style="padding: 6px 0; color: #ffffff !important;"><strong>9:35 AM</strong></td><td style="padding: 6px 0; color: #CBD5E1 !important;">Keynote Address — MP Damion Crawford</td></tr>
                <tr><td style="padding: 6px 0; color: #ffffff !important;"><strong>10:30 AM</strong></td><td style="padding: 6px 0; color: #CBD5E1 !important;">Coffee Break</td></tr>
                <tr><td style="padding: 6px 0; color: #ffffff !important;"><strong>12:10 PM</strong></td><td style="padding: 6px 0; color: #CBD5E1 !important;">Lunch</td></tr>
                <tr><td style="padding: 6px 0; color: #ffffff !important;"><strong>2:55 PM</strong></td><td style="padding: 6px 0; color: #CBD5E1 !important;">Panel Discussion and Q&amp;A</td></tr>
                <tr><td style="padding: 6px 0; color: #ffffff !important;"><strong>3:55 PM</strong></td><td style="padding: 6px 0; color: #CBD5E1 !important;">Closing</td></tr>
              </table>
            </td>
          </tr>

          <!-- Footer — Navy -->
          <tr>
            <td bgcolor="#0A1628" style="background-color: #0A1628; padding: 20px 40px; text-align: center;">
              <p style="font-size: 12px; color: #94A3B8 !important; margin: 0;">
                University of Technology, Jamaica<br>
                44th Marketing Seminar &bull; April 8, 2026
              </p>
              <div style="width: 40px; height: 2px; background-color: #D4A843; margin: 10px auto 0;"></div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send a personalized email to a single attendee
 */
export async function sendEmail(attendee) {
  const transporter = getTransporter();
  const attendeeUrl = `${BASE_URL}/?id=${attendee.id}`;

  // Generate QR code as data URL
  const { qrDataUrl } = await generateQRCode(attendee.id);
  // Convert data URL to buffer for email attachment
  const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
  const qrBuffer = Buffer.from(base64Data, 'base64');

  // Read logo — no longer needed, using Cloudinary URL

  const attachments = [
    {
      filename: 'qrcode.png',
      content: qrBuffer,
      cid: 'qrcode',
    },
  ];

  const mailOptions = {
    from: `"44th UTech Marketing Seminar" <${EMAIL_USER}>`,
    to: attendee.email,
    subject: `Your Event Pass — 44th UTech Marketing Seminar 2026`,
    html: buildEmailHtml(attendee),
    attachments,
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId, to: attendee.email };
}

/**
 * Send emails to multiple attendees with progress callback
 */
export async function sendBulkEmails(attendees, onProgress) {
  const results = { sent: 0, failed: 0, errors: [] };

  for (let i = 0; i < attendees.length; i++) {
    const attendee = attendees[i];

    try {
      await sendEmail(attendee);
      results.sent++;
    } catch (error) {
      results.failed++;
      results.errors.push({ id: attendee.id, name: attendee.name, error: error.message });
    }

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: attendees.length,
        sent: results.sent,
        failed: results.failed,
        lastSent: attendee.name,
      });
    }

    // Small delay between emails to avoid rate limiting
    if (i < attendees.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
