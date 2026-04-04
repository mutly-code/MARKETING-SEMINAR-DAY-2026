import { google } from 'googleapis';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = join(__dirname, 'credentials.json');
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = 'Attendees';

// Column mapping (0-indexed)
const COLUMNS = {
  ID: 0,
  NAME: 1,
  EMAIL: 2,
  ROLE: 3,
  TABLE_NUMBER: 4,
  DIETARY: 5,
  CHECKIN_STATUS: 6,
  CHECKIN_TIME: 7,
  QR_CODE_URL: 8,
};

let sheetsClient = null;

/**
 * Get authenticated Google Sheets client
 */
async function getClient() {
  if (sheetsClient) return sheetsClient;

  if (!existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      'credentials.json not found. Please follow the setup guide at /setup.html'
    );
  }

  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  return sheetsClient;
}

/**
 * Ensure the sheet exists with proper headers
 */
export async function ensureSheet() {
  const client = await getClient();

  try {
    // Check if sheet exists
    const spreadsheet = await client.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });

    const sheetExists = spreadsheet.data.sheets.some(
      (s) => s.properties.title === SHEET_NAME
    );

    if (!sheetExists) {
      // Add the Attendees sheet
      await client.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: SHEET_NAME },
              },
            },
          ],
        },
      });
    }

    // Check if headers exist
    const headerResponse = await client.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:I1`,
    });

    if (!headerResponse.data.values || headerResponse.data.values.length === 0) {
      // Add headers
      await client.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A1:I1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [
            [
              'ID',
              'Name',
              'Email',
              'Role',
              'Table Number',
              'Dietary Restrictions',
              'Check-in Status',
              'Check-in Time',
              'QR Code URL',
            ],
          ],
        },
      });
    }

    return true;
  } catch (error) {
    console.error('Error ensuring sheet:', error.message);
    throw error;
  }
}

/**
 * Get all attendees
 */
export async function getAttendees() {
  const client = await getClient();

  const response = await client.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A2:I`,
  });

  const rows = response.data.values || [];

  return rows.map((row) => ({
    id: row[COLUMNS.ID] || '',
    name: row[COLUMNS.NAME] || '',
    email: row[COLUMNS.EMAIL] || '',
    role: row[COLUMNS.ROLE] || '',
    tableNumber: row[COLUMNS.TABLE_NUMBER] || '',
    dietary: row[COLUMNS.DIETARY] || 'None',
    checkinStatus: row[COLUMNS.CHECKIN_STATUS] || 'Not Checked In',
    checkinTime: row[COLUMNS.CHECKIN_TIME] || '',
    qrCodeUrl: row[COLUMNS.QR_CODE_URL] || '',
  }));
}

/**
 * Get a single attendee by ID
 */
export async function getAttendeeById(id) {
  const attendees = await getAttendees();
  return attendees.find((a) => a.id === id) || null;
}

/**
 * Find the row number for an attendee ID (1-indexed, accounting for header)
 */
async function findRowByAttendeeId(id) {
  const attendees = await getAttendees();
  const index = attendees.findIndex((a) => a.id === id);
  return index >= 0 ? index + 2 : -1; // +2 for header row and 1-indexing
}

/**
 * Update check-in status for an attendee
 */
export async function updateCheckIn(id, status = 'Checked In') {
  const client = await getClient();
  const rowNumber = await findRowByAttendeeId(id);

  if (rowNumber < 0) {
    throw new Error(`Attendee ${id} not found`);
  }

  const now = new Date().toISOString();

  await client.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!G${rowNumber}:H${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[status, now]],
    },
  });

  return { id, checkinStatus: status, checkinTime: now };
}

/**
 * Add a single attendee row
 */
export async function addAttendee(attendee) {
  const client = await getClient();

  await client.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:I`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        [
          attendee.id,
          attendee.name,
          attendee.email,
          attendee.role,
          attendee.tableNumber,
          attendee.dietary || 'None',
          'Not Checked In',
          '',
          attendee.qrCodeUrl || '',
        ],
      ],
    },
  });

  return attendee;
}

/**
 * Add multiple attendees at once (for seeding)
 */
export async function addAttendeesBatch(attendees) {
  const client = await getClient();

  const values = attendees.map((a) => [
    a.id,
    a.name,
    a.email,
    a.role,
    a.tableNumber,
    a.dietary || 'None',
    'Not Checked In',
    '',
    a.qrCodeUrl || '',
  ]);

  await client.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:I`,
    valueInputOption: 'RAW',
    requestBody: {
      values,
    },
  });

  return attendees;
}

/**
 * Clear all attendee data (keep headers)
 */
export async function clearAttendees() {
  const client = await getClient();

  await client.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A2:I`,
  });
}

/**
 * Get check-in statistics
 */
export async function getCheckInStats() {
  const attendees = await getAttendees();
  const total = attendees.length;
  const checkedIn = attendees.filter(
    (a) => a.checkinStatus === 'Checked In'
  ).length;

  const byRole = {};
  attendees.forEach((a) => {
    if (!byRole[a.role]) {
      byRole[a.role] = { total: 0, checkedIn: 0 };
    }
    byRole[a.role].total++;
    if (a.checkinStatus === 'Checked In') {
      byRole[a.role].checkedIn++;
    }
  });

  return {
    total,
    checkedIn,
    remaining: total - checkedIn,
    percentage: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
    byRole,
  };
}
