import { apiFetch, getInitials, getRoleBadgeClass, getStatusBadgeClass } from './utils.js';

// ===== Attendee Landing Page =====

// ----- 5 Demo/Test Attendees (used if API is unavailable) -----
const DEMO_ATTENDEES = {
  'STU-001': {
    id: 'STU-001',
    name: 'Brianna Campbell',
    email: 'brianna.campbell@student.utech.edu.jm',
    role: 'Student',
    tableNumber: '3',
    dietary: 'None',
    checkinStatus: 'Not Checked In',
  },
  'STU-002': {
    id: 'STU-002',
    name: 'Jamal Edwards',
    email: 'jamal.edwards@student.utech.edu.jm',
    role: 'Student',
    tableNumber: '7',
    dietary: 'Vegetarian',
    checkinStatus: 'Not Checked In',
  },
  'FAC-001': {
    id: 'FAC-001',
    name: 'Dr. Karen Thompson',
    email: 'karen.thompson@utech.edu.jm',
    role: 'Facilitator',
    tableNumber: '1',
    dietary: 'Halal',
    checkinStatus: 'Checked In',
  },
  'SPK-001': {
    id: 'SPK-001',
    name: 'Nadine Stewart',
    email: 'nadine.stewart@email.com',
    role: 'Speaker',
    tableNumber: '2',
    dietary: 'Vegan',
    checkinStatus: 'Not Checked In',
  },
  'GST-001': {
    id: 'GST-001',
    name: 'Marcus Reid',
    email: 'marcus.reid@gmail.com',
    role: 'Guest',
    tableNumber: '10',
    dietary: 'Gluten-Free',
    checkinStatus: 'Not Checked In',
  },
};

// ----- Menu options per dietary restriction -----
const MENU_OPTIONS = {
  None: {
    starter: 'Garden Salad with Tropical Vinaigrette',
    starterDesc: 'Fresh greens, mango, avocado, passion fruit dressing',
    main: 'Jerk Chicken with Rice & Peas',
    mainDesc: 'Traditional jerk chicken, coconut rice & peas, steamed vegetables',
    notice: null,
  },
  Vegetarian: {
    starter: 'Garden Salad with Tropical Vinaigrette',
    starterDesc: 'Fresh greens, mango, avocado, passion fruit dressing',
    main: 'Ackee & Callaloo Stew with Rice & Peas',
    mainDesc: 'Traditional Jamaican ackee sautéed with callaloo, served with coconut rice',
    notice: 'Your meal has been prepared as a vegetarian option. Please inform staff of any additional allergies.',
  },
  Vegan: {
    starter: 'Fresh Tropical Fruit Medley',
    starterDesc: 'Seasonal Jamaican fruits with lime and mint',
    main: 'Ital Stew with Provisions & Brown Rice',
    mainDesc: 'Hearty Rastafarian-inspired stew with yam, dasheen, cho cho, and seasoning',
    notice: 'Your meal is fully plant-based. Dessert will be a coconut sorbet instead of rum cake.',
  },
  'Gluten-Free': {
    starter: 'Garden Salad with Tropical Vinaigrette',
    starterDesc: 'Fresh greens, mango, avocado, passion fruit dressing (GF)',
    main: 'Grilled Jerk Chicken with Roasted Provisions',
    mainDesc: 'Jerk chicken with roasted sweet potato, yam, and steamed vegetables (gluten-free)',
    notice: 'Your meal has been prepared gluten-free. Please inform staff if you have celiac disease.',
  },
  Halal: {
    starter: 'Garden Salad with Tropical Vinaigrette',
    starterDesc: 'Fresh greens, mango, avocado, passion fruit dressing',
    main: 'Halal Grilled Chicken with Rice & Peas',
    mainDesc: 'Halal-certified grilled chicken with Jamaican seasoning, coconut rice & peas',
    notice: 'Your meal is halal-certified. Please notify staff of any additional dietary requirements.',
  },
  'Nut Allergy': {
    starter: 'Garden Salad with Citrus Dressing',
    starterDesc: 'Fresh greens with citrus vinaigrette (nut-free preparation)',
    main: 'Jerk Chicken with Rice & Peas',
    mainDesc: 'Traditional jerk chicken, coconut rice & peas (nut-free kitchen)',
    notice: '⚠️ Your meal is prepared in a nut-free environment. Please alert staff to your allergy upon arrival.',
  },
  'Lactose Intolerant': {
    starter: 'Garden Salad with Tropical Vinaigrette',
    starterDesc: 'Fresh greens, mango, avocado, passion fruit dressing (dairy-free)',
    main: 'Jerk Chicken with Rice & Peas',
    mainDesc: 'Traditional jerk chicken, coconut rice & peas (dairy-free preparation)',
    notice: 'Your meal has been prepared without any dairy products.',
  },
  Pescatarian: {
    starter: 'Escovitch-Style Pickled Vegetables',
    starterDesc: 'Tangy pickled vegetables in traditional Jamaican escovitch sauce',
    main: 'Escovitch Fish with Festival & Rice',
    mainDesc: 'Pan-fried red snapper with escovitch sauce, festival dumplings, and seasoned rice',
    notice: 'Your meal features a pescatarian option. Please inform staff of any seafood allergies.',
  },
};

// ----- Main loader -----

async function loadAttendee() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    showError('No attendee ID provided. Please use a valid QR code link.');
    return;
  }

  let attendee = null;
  let qrDataUrl = null;

  // Try API first, fall back to demo data
  try {
    const { data } = await apiFetch(`/attendees/${id}`);
    attendee = data;

    try {
      const { data: qrData } = await apiFetch(`/attendees/${id}/qrcode`);
      qrDataUrl = qrData.qrDataUrl;
    } catch {
      // QR generation failed, we'll generate client-side
    }
  } catch {
    // API unavailable — use demo data
    if (DEMO_ATTENDEES[id]) {
      attendee = DEMO_ATTENDEES[id];
    } else {
      showError(
        `Attendee "${id}" not found. For demo, try: STU-001, STU-002, FAC-001, SPK-001, or GST-001`
      );
      return;
    }
  }

  // Generate QR code client-side if not available from server
  if (!qrDataUrl) {
    qrDataUrl = await generateClientQR(id);
  }

  renderAttendee(attendee, qrDataUrl);

  // Start silent live-polling every 45 seconds to keep pass up-to-date
  startPolling(id);
}

// ----- Live Polling -----
let pollingInterval;
function startPolling(id) {
  if (pollingInterval) clearInterval(pollingInterval);
  
  pollingInterval = setInterval(async () => {
    try {
      const { data } = await apiFetch(`/attendees/${id}`);
      if (data) {
        renderAttendee(data, null, true); // silent update
      }
    } catch (e) {
      // ignore network errors on silent polls
    }
  }, 45000); // 45 seconds
}

// ----- Client-side QR code generation (using QR code API) -----

async function generateClientQR(id) {
  const pageUrl = `${window.location.origin}/?id=${id}`;
  // Use a public QR code API as fallback
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pageUrl)}&color=0a1628&bgcolor=ffffff&margin=10`;
}

// ----- Render attendee data -----

function renderAttendee(attendee, qrDataUrl, isSilent = false) {
  if (!isSilent) {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('attendee-content').style.display = 'block';
  }

  // Avatar & Name
  const cleanName = String(attendee.name || '')
    .replace(/\s*[|:,-]?\s*[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\s*$/i, '')
    .trim();
  const displayName = cleanName || attendee.name || '';

  document.getElementById('avatar-initials').textContent = getInitials(displayName);
  document.getElementById('attendee-name').textContent = displayName;

  // Badges
  document.getElementById('role-badge').textContent = attendee.role;
  document.getElementById('role-badge').className = `badge ${getRoleBadgeClass(attendee.role)}`;

  const checkinBadge = document.getElementById('checkin-badge');
  checkinBadge.textContent = attendee.checkinStatus === 'Checked In' ? 'Checked In' : 'Not Checked In';
  checkinBadge.className = `badge ${getStatusBadgeClass(attendee.checkinStatus)}`;

  // Info Cards
  document.getElementById('table-number').textContent = `Table ${attendee.tableNumber}`;
  document.getElementById('dietary-info').textContent = attendee.dietary;
  document.getElementById('email-info').textContent = attendee.email || '--';
  document.getElementById('attendee-id').textContent = attendee.id;

  // QR Code
  if (qrDataUrl && !isSilent) {
    document.getElementById('qr-code-img').src = qrDataUrl;
  }
  document.getElementById('qr-url').textContent =
    `${window.location.origin}/?id=${attendee.id}`;

  // Menu customization
  const menu = MENU_OPTIONS[attendee.dietary] || MENU_OPTIONS['None'];
  document.getElementById('menu-starter').textContent = menu.starter;
  document.getElementById('menu-starter-desc').textContent = menu.starterDesc;
  document.getElementById('menu-main').textContent = menu.main;
  document.getElementById('menu-main-desc').textContent = menu.mainDesc;

  if (menu.notice) {
    const noticeEl = document.getElementById('dietary-notice');
    noticeEl.style.display = 'block';
    document.getElementById('dietary-notice-text').textContent = menu.notice;
  }

  // Update page title
  document.title = `${displayName} — 44th UTech Marketing Seminar 2026`;
}

function showError(message) {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('error-state').style.display = 'block';
  document.getElementById('error-message').textContent = message;
}

/**
 * Initialize attendee page — exported so index.html can call it conditionally
 */
export function initAttendee() {
  loadAttendee();
}
