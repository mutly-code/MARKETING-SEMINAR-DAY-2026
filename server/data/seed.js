import dotenv from 'dotenv';
import { ensureSheet, addAttendeesBatch, clearAttendees } from '../sheets.js';

dotenv.config();

const BASE_URL = process.env.BASE_URL || 'https://marketing-seminar-day-2026.onrender.com';

// ----- Jamaican-style name data for realistic attendees -----
const firstNames = [
  'Abigail', 'Andre', 'Brianna', 'Brandon', 'Camille', 'Christopher',
  'Danielle', 'David', 'Gabrielle', 'Giovanni', 'Imani', 'Isaiah',
  'Jada', 'Jamal', 'Keisha', 'Kevin', 'Latoya', 'Liam', 'Marcia',
  'Marcus', 'Natasha', 'Nathan', 'Olivia', 'Omar', 'Patrice',
  'Peter', 'Rashida', 'Ryan', 'Sasha', 'Sean', 'Tamara', 'Trevor',
  'Vanessa', 'Wayne', 'Yolanda', 'Zion', 'Aaliyah', 'Adrian',
  'Bianca', 'Carl', 'Destiny', 'Devon', 'Ebony', 'Elijah',
  'Fiona', 'Floyd', 'Grace', 'Gordon', 'Hazel', 'Howard',
  'Iris', 'Ivan', 'Jasmine', 'Jerome', 'Kyla', 'Kyle',
  'Leona', 'Leon', 'Michelle', 'Michael', 'Nicole', 'Nigel',
  'Opal', 'Owen', 'Paula', 'Paul', 'Quinn', 'Quentin',
  'Renee', 'Ricardo', 'Simone', 'Sheldon', 'Tanya', 'Terrence',
  'Ursula', 'Victor', 'Wendy', 'Xavier', 'Yvette', 'Zachary',
];

const lastNames = [
  'Brown', 'Campbell', 'Chambers', 'Clarke', 'Davis', 'Edwards',
  'Francis', 'Gordon', 'Graham', 'Green', 'Hamilton', 'Harris',
  'Henry', 'Hines', 'Jackson', 'James', 'Johnson', 'Jones',
  'King', 'Lawrence', 'Lewis', 'Martin', 'McKenzie', 'Miller',
  'Mitchell', 'Morgan', 'Nelson', 'Palmer', 'Patterson', 'Phillips',
  'Powell', 'Reid', 'Robinson', 'Scott', 'Simpson', 'Smith',
  'Stewart', 'Taylor', 'Thomas', 'Thompson', 'Walker', 'Watson',
  'White', 'Williams', 'Wilson', 'Wright', 'Young', 'Bennett',
  'Brooks', 'Cole',
];

const dietaryOptions = [
  'None', 'None', 'None', 'None', 'None', 'None',  // weighted toward "None"
  'Vegetarian', 'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Halal',
  'Nut Allergy',
  'Lactose Intolerant',
  'Pescatarian',
];

const facilitatorNames = [
  'Ms. Suzette Townsend',
  'Mr. Nigel Mcfarlane',
  'Ms. Kris-Ann Taylor',
  'Mr. MichaelLee',
];

const speakerNames = [
  'MP Damion Crawford', 'Brithney Clarke', 'Anadeen Nembhard', 'Dr Djavila Ho',
  'Bryan Henry', 'Glenessa Martin', 'Wyomi Hopkins', 'Kajay Rowe',
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEmail(name, role) {
  const clean = name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, '.');
  const domains = {
    Student: 'student.utech.edu.jm',
    Facilitator: 'utech.edu.jm',
    Speaker: 'email.com',
    Guest: 'gmail.com',
  };
  return `${clean}@${domains[role] || 'gmail.com'}`;
}

function generateAttendees() {
  const attendees = [];
  let tableCounter = 1;
  let seatInTable = 0;

  function assignTable() {
    seatInTable++;
    if (seatInTable > 10) {
      seatInTable = 1;
      tableCounter++;
    }
    return tableCounter;
  }

  // Helper to split name into first/last
  function splitName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  // 76 Students
  const usedNames = new Set();
  for (let i = 0; i < 76; i++) {
    let fullName;
    do {
      fullName = `${randomItem(firstNames)} ${randomItem(lastNames)}`;
    } while (usedNames.has(fullName));
    usedNames.add(fullName);

    const { firstName, lastName } = splitName(fullName);
    const id = `STU-${String(i + 1).padStart(3, '0')}`;
    attendees.push({
      id,
      firstName,
      lastName,
      email: generateEmail(fullName, 'Student'),
      role: 'Student',
      tableNumber: String(assignTable()),
      dietary: randomItem(dietaryOptions),
      qrCodeUrl: `${BASE_URL}/?id=${id}`,
    });
  }

  // 4 Facilitators
  facilitatorNames.forEach((name, i) => {
    const { firstName, lastName } = splitName(name);
    const id = `FAC-${String(i + 1).padStart(3, '0')}`;
    attendees.push({
      id,
      firstName,
      lastName,
      email: generateEmail(name, 'Facilitator'),
      role: 'Facilitator',
      tableNumber: String(assignTable()),
      dietary: randomItem(dietaryOptions),
      qrCodeUrl: `${BASE_URL}/?id=${id}`,
    });
  });

  // 10 Speakers
  speakerNames.forEach((name, i) => {
    const { firstName, lastName } = splitName(name);
    const id = `SPK-${String(i + 1).padStart(3, '0')}`;
    attendees.push({
      id,
      firstName,
      lastName,
      email: generateEmail(name, 'Speaker'),
      role: 'Speaker',
      tableNumber: String(assignTable()),
      dietary: randomItem(dietaryOptions),
      qrCodeUrl: `${BASE_URL}/?id=${id}`,
    });
  });

  // 60 Guests (to reach 150 total)
  for (let i = 0; i < 60; i++) {
    let fullName;
    do {
      fullName = `${randomItem(firstNames)} ${randomItem(lastNames)}`;
    } while (usedNames.has(fullName));
    usedNames.add(fullName);

    const { firstName, lastName } = splitName(fullName);
    const id = `GST-${String(i + 1).padStart(3, '0')}`;
    attendees.push({
      id,
      firstName,
      lastName,
      email: generateEmail(fullName, 'Guest'),
      role: 'Guest',
      tableNumber: String(assignTable()),
      dietary: randomItem(dietaryOptions),
      qrCodeUrl: `${BASE_URL}/?id=${id}`,
    });
  }

  return attendees;
}

// ----- Main seed function -----
async function seed() {
  console.log('🌱 Seeding attendee data...\n');

  try {
    // Ensure sheet exists with headers
    await ensureSheet();
    console.log('✅ Sheet verified with headers');

    // Clear existing data
    await clearAttendees();
    console.log('🧹 Cleared existing attendee data');

    // Generate attendees
    const attendees = generateAttendees();
    console.log(`📋 Generated ${attendees.length} attendees:`);
    console.log(`   - Students:     ${attendees.filter(a => a.role === 'Student').length}`);
    console.log(`   - Facilitators: ${attendees.filter(a => a.role === 'Facilitator').length}`);
    console.log(`   - Speakers:     ${attendees.filter(a => a.role === 'Speaker').length}`);
    console.log(`   - Guests:       ${attendees.filter(a => a.role === 'Guest').length}`);

    // Batch insert
    await addAttendeesBatch(attendees);
    console.log('\n✅ All attendees seeded successfully!');
    console.log(`\n📊 Tables assigned: 1 through ${Math.ceil(attendees.length / 10)}`);
    console.log(`🔗 Base URL: ${BASE_URL}`);
    console.log(`\n🎉 Done! Open your Google Sheet to verify.\n`);
  } catch (error) {
    console.error('\n❌ Seed failed:', error.message);
    console.error('\nMake sure you have:');
    console.error('  1. Created a Google Cloud service account');
    console.error('  2. Placed credentials.json in the server/ folder');
    console.error('  3. Set GOOGLE_SHEET_ID in .env');
    console.error('  4. Shared the sheet with your service account email');
    process.exit(1);
  }
}

seed();
