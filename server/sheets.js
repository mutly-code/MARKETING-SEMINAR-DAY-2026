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
  NAME: -1,
  FIRST_NAME: 1,
  LAST_NAME: 2,
  EMAIL: 3,
  ROLE: 4,
  TABLE_NUMBER: 5,
  DIETARY: 6,
  CHECKIN_STATUS: 7,
  CHECKIN_TIME: 8,
  QR_CODE_URL: 9,
  EMAIL_SENT: 10,
  EMAIL_SENT_TIME: 11,
};

let sheetsClient = null;

const HEADER_ALIASES = {
  ID: ['id', 'attendee id'],
  NAME: ['name', 'full name'],
  FIRST_NAME: ['first name', 'firstname', 'first'],
  LAST_NAME: ['last name', 'lastname', 'last', 'surname'],
  EMAIL: ['email', 'email address'],
  ROLE: ['role'],
  TABLE_NUMBER: ['table number', 'table', 'table no', 'table #'],
  DIETARY: ['dietary restrictions', 'dietary', 'dietary notes'],
  CHECKIN_STATUS: ['check-in status', 'check in status', 'checkin status'],
  CHECKIN_TIME: ['check-in time', 'check in time', 'checkin time'],
  QR_CODE_URL: ['qr code url', 'qr url', 'qrcode url'],
  EMAIL_SENT: ['email sent', 'sent'],
  EMAIL_SENT_TIME: ['email sent time', 'sent time'],
};

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isTruthySheetValue(value) {
  const normalized = String(value || '')
    .toLowerCase()
    .trim();
  return ['yes', 'y', 'true', '1', 'sent'].includes(normalized);
}

function resolveColumns(headers = []) {
  const resolved = { ...COLUMNS };
  const normalizedHeaders = headers.map((h) => normalizeHeader(h));

  Object.entries(HEADER_ALIASES).forEach(([key, aliases]) => {
    const matchIndex = normalizedHeaders.findIndex((header) =>
      aliases.some((alias) => normalizeHeader(alias) === header)
    );
    if (matchIndex >= 0) {
      resolved[key] = matchIndex;
    }
  });

  return resolved;
}

async function getSheetRowsAndColumns(client) {
  const response = await client.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:Z`,
  });

  const allRows = response.data.values || [];
  const headers = allRows[0] || [];
  const rows = allRows.slice(1);
  const columns = resolveColumns(headers);

  // Track actual sheet row numbers (1-indexed, +1 for header)
  const rowNumbers = rows.map((_, idx) => idx + 2);

  return { rows, columns, rowNumbers };
}

function toColumnLetter(index) {
  let num = index + 1;
  let letter = '';
  while (num > 0) {
    const rem = (num - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    num = Math.floor((num - 1) / 26);
  }
  return letter;
}

/**
 * Get authenticated Google Sheets client
 */
async function getClient() {
  if (sheetsClient) return sheetsClient;

  let credentials;

  // 1. Try to load from environment variable (Recommended for Production/Render)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch (parseError) {
      throw new Error('Invalid JSON format in GOOGLE_SERVICE_ACCOUNT_JSON environment variable.');
    }
  }
  // 2. Fall back to local credentials.json file
  else if (existsSync(CREDENTIALS_PATH)) {
    credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  }
  // 3. Fail if neither is available
  else {
    throw new Error(
      'Google Sheets credentials not found. Set GOOGLE_SERVICE_ACCOUNT_JSON or provide credentials.json'
    );
  }

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
      range: `${SHEET_NAME}!A1:L1`,
    });

    if (!headerResponse.data.values || headerResponse.data.values.length === 0) {
      // Add headers
      await client.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A1:L1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [
            [
              'ID',
              'First Name',
              'Last Name',
              'Email',
              'Role',
              'Table Number',
              'Dietary Restrictions',
              'Check-in Status',
              'Check-in Time',
              'QR Code URL',
              'Email Sent',
              'Email Sent Time',
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
  const { rows, columns, rowNumbers } = await getSheetRowsAndColumns(client);

  return rows.map((row, idx) => ({
    id: row[columns.ID] || '',
    firstName: row[columns.FIRST_NAME] || '',
    lastName: row[columns.LAST_NAME] || '',
    name:
      `${row[columns.FIRST_NAME] || ''} ${row[columns.LAST_NAME] || ''}`.trim() ||
      row[columns.NAME] ||
      '',
    email: row[columns.EMAIL] || '',
    role: row[columns.ROLE] || '',
    tableNumber: row[columns.TABLE_NUMBER] || '',
    dietary: row[columns.DIETARY] || 'None',
    checkinStatus: row[columns.CHECKIN_STATUS] || 'Not Checked In',
    checkinTime: row[columns.CHECKIN_TIME] || '',
    qrCodeUrl: row[columns.QR_CODE_URL] || '',
    emailSent: isTruthySheetValue(row[columns.EMAIL_SENT]),
    emailSentTime: row[columns.EMAIL_SENT_TIME] || '',
    _sheetRow: rowNumbers[idx], // Track actual sheet row for updates
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
 * Find the row number for an attendee ID (1-indexed)
 * Returns the actual sheet row number, not calculated from array index
 */
async function findRowByAttendeeId(id) {
  const attendees = await getAttendees();
  const attendee = attendees.find((a) => a.id === id);
  return attendee ? attendee._sheetRow : -1;
}

/**
 * Update check-in status for an attendee
 */
export async function updateCheckIn(id, status = 'Checked In') {
  const client = await getClient();
  const rowNumber = await findRowByAttendeeId(id);
  const { columns } = await getSheetRowsAndColumns(client);

  if (rowNumber < 0) {
    throw new Error(`Attendee ${id} not found`);
  }

  const now = new Date().toISOString();
  const statusCol = toColumnLetter(columns.CHECKIN_STATUS);
  const timeCol = toColumnLetter(columns.CHECKIN_TIME);

  await client.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!${statusCol}${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[status]] },
  });

  await client.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!${timeCol}${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[now]] },
  });

  return { id, checkinStatus: status, checkinTime: now };
}

/**
 * Update email sent status for an attendee
 */
export async function updateEmailSent(id) {
  const client = await getClient();
  const rowNumber = await findRowByAttendeeId(id);
  const { columns } = await getSheetRowsAndColumns(client);

  if (rowNumber < 0) {
    throw new Error(`Attendee ${id} not found`);
  }

  const now = new Date().toISOString();
  const sentCol = toColumnLetter(columns.EMAIL_SENT);
  const sentTimeCol = toColumnLetter(columns.EMAIL_SENT_TIME);

  await client.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!${sentCol}${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Yes']] },
  });

  await client.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!${sentTimeCol}${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[now]] },
  });

  return { id, emailSent: true, emailSentTime: now };
}

/**
 * Add a single attendee row
 */
export async function addAttendee(attendee) {
  const client = await getClient();

  await client.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:L`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        [
          attendee.id,
          attendee.firstName,
          attendee.lastName,
          attendee.email,
          attendee.role,
          attendee.tableNumber,
          attendee.dietary || 'None',
          'Not Checked In',
          '',
          attendee.qrCodeUrl || '',
          'No',
          '',
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
    a.firstName,
    a.lastName,
    a.email,
    a.role,
    a.tableNumber,
    a.dietary || 'None',
    'Not Checked In',
    '',
    a.qrCodeUrl || '',
    'No',
    '',
  ]);

  await client.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:L`,
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
    range: `${SHEET_NAME}!A2:L`,
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
