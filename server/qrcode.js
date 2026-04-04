import QRCode from 'qrcode';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

/**
 * Generate a QR code data URL for an attendee
 * The QR code encodes a URL to the attendee's personalized landing page
 */
export async function generateQRCode(attendeeId) {
  const url = `${BASE_URL}/?id=${attendeeId}`;

  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: {
      dark: '#0a1628',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });

  return { qrDataUrl, url };
}

/**
 * Generate a QR code as a Buffer (for saving to file)
 */
export async function generateQRBuffer(attendeeId) {
  const url = `${BASE_URL}/?id=${attendeeId}`;

  const buffer = await QRCode.toBuffer(url, {
    width: 400,
    margin: 2,
    color: {
      dark: '#0a1628',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });

  return buffer;
}
