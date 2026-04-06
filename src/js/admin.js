import {
  apiFetch,
  showToast,
  getInitials,
  getRoleBadgeClass,
  getStatusBadgeClass,
  formatTime,
} from './utils.js';

// ===== Admin Dashboard =====

let allAttendees = [];
let scannerInstance = null;
let scannerActive = false;
let pollingInterval = null;
const POLL_INTERVAL_MS = 30000; // 30 seconds

// ----- EmailJS Configuration -----
const EMAILJS_SERVICE_ID = 'service_go8tysc';
const EMAILJS_TEMPLATE_ID = 'template_39coob5';
const BASE_URL = 'https://marketing-seminar-day-2026.onrender.com';

/**
 * Send email via EmailJS (client-side)
 */
async function sendEmailViaEmailJS(attendee) {
  // Generate QR code URL using public API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(attendee.id)}`;
  const eventPassUrl = `${BASE_URL}/?id=${attendee.id}`;
  const scheduleText = [
    '8:15 AM — Registration',
    '9:50 AM — Keynote Address',
    '10:20 AM — Coffee Break',
    '12:00 PM — Lunch',
    '2:00 PM — Panel Discussion and Q&A',
    '3:55 PM — Closing',
  ].join('\n');

  const templateParams = {
    to_email: attendee.email,
    to_name: attendee.name,
    attendee_name: attendee.name,
    attendee_id: attendee.id,
    attendee_role: attendee.role,
    table_number: attendee.tableNumber || 'TBA',
    dietary: attendee.dietary || 'None',
    qr_code_url: qrCodeUrl,
    event_pass_url: eventPassUrl,
    base_url: BASE_URL,
    event_date: 'Wednesday, April 8, 2026',
    event_time: '9:00 AM – 4:00 PM',
    venue_name: 'Hope Fellowship Church',
    venue_room: 'Hope Fellowship Auditorium',
    venue_map_url: 'https://maps.app.goo.gl/t4LmsQx8TP5ZSTvn6',
    schedule_text: scheduleText,
  };

  // eslint-disable-next-line no-undef
  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
}

// ----- Data Loading -----

async function loadStats() {
  try {
    const { data: stats } = await apiFetch('/checkin/stats');

    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-checked').textContent = stats.checkedIn;
    document.getElementById('stat-remaining').textContent = stats.remaining;
    document.getElementById('stat-percent').textContent = `${stats.percentage}%`;

    // Progress bar
    document.getElementById('progress-fill').style.width = `${stats.percentage}%`;
    document.getElementById('progress-label').textContent = `${stats.checkedIn} of ${stats.total} checked in`;
    document.getElementById('progress-percent').textContent = `${stats.percentage}%`;
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

async function loadAttendees() {
  try {
    const { data } = await apiFetch('/attendees');
    allAttendees = data;
    renderAttendeeTable(data);
  } catch (error) {
    console.error('Failed to load attendees:', error);
    document.getElementById('attendee-tbody').innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--danger);">
          Failed to load attendees. Is the server running?<br>
          <small style="color: var(--gray-500);">${error.message}</small>
        </td>
      </tr>
    `;
  }
}

function renderAttendeeTable(attendees) {
  const tbody = document.getElementById('attendee-tbody');

  if (attendees.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--gray-400);">
          No attendees found matching your filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = attendees
    .map(
      (a) => `
    <tr id="row-${a.id}">
      <td style="text-align: center;"><input type="checkbox" class="attendee-cb" data-id="${a.id}" onchange="updateSelectedCount()" /></td>
      <td>
        <div class="attendee-name-cell">
          <div class="avatar-sm">${getInitials(a.name)}</div>
          <div>
            <div style="font-weight: 600; color: var(--gray-900);">${escapeHtml(a.name)}</div>
            <div style="font-size: 0.75rem; color: var(--gray-500);">${escapeHtml(a.id)}</div>
          </div>
        </div>
      </td>
      <td><span class="badge ${getRoleBadgeClass(a.role)}">${a.role}</span></td>
      <td style="text-align: center; font-weight: 600;">${a.tableNumber}</td>
      <td>
        <span class="badge ${getStatusBadgeClass(a.checkinStatus)}">
          ${a.checkinStatus}
        </span>
      </td>
      <td>
        <span class="badge ${a.emailSent ? 'badge-success' : 'badge-warning'}" title="${a.emailSent && a.emailSentTime ? 'Sent: ' + formatTime(a.emailSentTime) : 'Not sent yet'}">
          ${a.emailSent ? '<i class="ph ph-check"></i> Sent' : '<i class="ph ph-clock"></i> Pending'}
        </span>
      </td>
      <td style="display: flex; gap: 8px; align-items: center;">
        ${a.checkinStatus === 'Checked In'
          ? `<button class="btn btn-outline btn-sm" onclick="undoCheckIn('${a.id}')">Undo</button>`
          : `<button class="btn btn-success btn-sm" onclick="checkInAttendee('${a.id}')">Check In</button>`
        }
        <button class="btn btn-outline btn-sm btn-icon ${a.emailSent ? 'btn-sent' : ''}" id="email-btn-${a.id}" onclick="sendEmailToAttendee('${a.id}')" title="${a.emailSent ? 'Resend Email Pass' : 'Send Email Pass'}"><i class="ph ${a.emailSent ? 'ph-paper-plane-tilt' : 'ph-envelope-simple'}"></i></button>
        <a href="/?id=${a.id}" target="_blank" class="btn btn-outline btn-sm btn-icon" title="View Event Pass Open in new tab"><i class="ph ph-identification-card"></i></a>
      </td>
    </tr>
  `
    )
    .join('');
}

// ----- Check-in Actions -----

window.checkInAttendee = async function (id) {
  try {
    const { data, message, alreadyCheckedIn } = await apiFetch(`/checkin/${id}`, {
      method: 'POST',
    });

    if (alreadyCheckedIn) {
      showToast(`${data.name} is already checked in`, 'warning');
    } else {
      showToast(message, 'success');
    }

    // Refresh data
    await Promise.all([loadStats(), loadAttendees()]);
    filterAttendees();
  } catch (error) {
    showToast(`Check-in failed: ${error.message}`, 'error');
  }
};

window.undoCheckIn = async function (id) {
  try {
    await apiFetch(`/checkin/${id}/undo`, { method: 'POST' });
    showToast('Check-in undone', 'info');

    await Promise.all([loadStats(), loadAttendees()]);
    filterAttendees();
  } catch (error) {
    showToast(`Undo failed: ${error.message}`, 'error');
  }
};

// ----- QR Scanner -----

async function startScanner() {
  const startBtn = document.getElementById('start-scanner-btn');
  const stopBtn = document.getElementById('stop-scanner-btn');

  startBtn.style.display = 'none';
  stopBtn.style.display = 'inline-flex';

  try {
    scannerInstance = new Html5Qrcode('qr-reader');
    scannerActive = true;

    await scannerInstance.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1,
      },
      onScanSuccess,
      () => { } // ignore scan failures
    );
  } catch (error) {
    console.error('Scanner error:', error);
    showToast('Could not access camera. Please check permissions.', 'error');
    stopScanner();
  }
}

function stopScanner() {
  const startBtn = document.getElementById('start-scanner-btn');
  const stopBtn = document.getElementById('stop-scanner-btn');

  if (scannerInstance && scannerActive) {
    scannerInstance.stop().catch(() => { });
  }

  scannerActive = false;
  startBtn.style.display = 'inline-flex';
  stopBtn.style.display = 'none';
}

let lastScannedId = null;
let scanCooldown = false;

async function onScanSuccess(decodedText) {
  // Prevent rapid duplicate scans
  if (scanCooldown) return;
  scanCooldown = true;
  setTimeout(() => {
    scanCooldown = false;
  }, 2000);

  // Extract attendee ID from URL
  let attendeeId;
  try {
    const url = new URL(decodedText);
    attendeeId = url.searchParams.get('id');
  } catch {
    // Maybe it's just an ID string
    attendeeId = decodedText;
  }

  if (!attendeeId) {
    showScanResult('error', 'Invalid QR Code', 'Could not extract attendee ID');
    return;
  }

  // Avoid duplicate toast for same person
  if (attendeeId === lastScannedId) return;
  lastScannedId = attendeeId;
  setTimeout(() => {
    lastScannedId = null;
  }, 5000);

  try {
    const result = await apiFetch(`/checkin/${attendeeId}`, { method: 'POST' });
    const { data, alreadyCheckedIn } = result;

    if (alreadyCheckedIn) {
      showScanResult('warning', data.name, `${data.role} — Table ${data.tableNumber} — Already checked in`);
      showToast(`${data.name} is already checked in`, 'warning');
    } else {
      showScanResult('success', data.name, `${data.role} — Table ${data.tableNumber} — Checked in!`);
      showToast(`${data.name} checked in!`, 'success');
    }

    // Refresh data
    await Promise.all([loadStats(), loadAttendees()]);
    filterAttendees();
  } catch (error) {
    showScanResult('error', 'Error', error.message);
    showToast(`Scan error: ${error.message}`, 'error');
  }
}

function showScanResult(type, name, role) {
  const el = document.getElementById('scan-result');
  el.style.display = 'block';
  el.className = `scan-result show ${type}`;

  const iconMap = { success: 'check-circle', warning: 'warning', error: 'x-circle' };
  document.getElementById('scan-icon').innerHTML = `<i class="ph ph-${iconMap[type] || 'info'}" style="font-size: 3rem;"></i>`;
  document.getElementById('scan-name').textContent = name;
  document.getElementById('scan-role').textContent = role;

  // Auto-hide after 5s
  setTimeout(() => {
    el.style.display = 'none';
  }, 5000);
}

// ----- Search & Filter -----

window.filterAttendees = function () {
  const search = (document.getElementById('search-input').value || '').toLowerCase();
  const roleFilter = document.getElementById('role-filter').value;
  const statusFilter = document.getElementById('status-filter').value;
  const emailFilter = document.getElementById('email-filter').value;

  let filtered = allAttendees;

  if (search) {
    filtered = filtered.filter(
      (a) =>
        a.name.toLowerCase().includes(search) ||
        (a.email && a.email.toLowerCase().includes(search)) ||
        a.id.toLowerCase().includes(search)
    );
  }

  if (roleFilter) {
    filtered = filtered.filter((a) => a.role === roleFilter);
  }

  if (statusFilter) {
    filtered = filtered.filter((a) => a.checkinStatus === statusFilter);
  }

  if (emailFilter) {
    if (emailFilter === 'sent') {
      filtered = filtered.filter((a) => a.emailSent === true);
    } else if (emailFilter === 'pending') {
      filtered = filtered.filter((a) => a.emailSent !== true);
    }
  }

  renderAttendeeTable(filtered);
};

// ----- Load Data -----

window.loadData = async function (silent = false) {
  const btn = document.getElementById('refresh-btn');
  if (btn && !silent) {
    btn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Refreshing...';
    btn.disabled = true;
  }

  await Promise.all([loadStats(), loadAttendees()]);
  filterAttendees();

  if (btn && !silent) {
    btn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Refresh';
    btn.disabled = false;
  }
  if (!silent) showToast('Data refreshed', 'success');
};

// ----- Auto-Polling (Live Sync) -----

function startPolling() {
  if (pollingInterval) return;
  pollingInterval = setInterval(() => {
    loadData(true); // silent refresh
  }, POLL_INTERVAL_MS);
  updateLiveIndicator(true);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  updateLiveIndicator(false);
}

function updateLiveIndicator(active) {
  const indicator = document.getElementById('live-indicator');
  if (!indicator) return;
  if (active) {
    indicator.classList.add('active');
    indicator.title = 'Auto-syncing with Google Sheets every 30s';
  } else {
    indicator.classList.remove('active');
    indicator.title = 'Auto-sync paused (tab not visible)';
  }
}

// Pause polling when tab is hidden, resume when visible
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPolling();
  } else {
    loadData(true); // refresh immediately on tab focus
    startPolling();
  }
});

// ----- Email Functions -----

window.sendTestEmail = async function () {
  const emailInput = document.getElementById('test-email-input');
  const btn = document.getElementById('test-email-btn');
  const email = emailInput.value.trim();

  if (!email) {
    showToast('Please enter an email address', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Sending...';

  try {
    // Create test attendee data
    const testAttendee = {
      id: 'TEST-' + Date.now(),
      name: 'Test User',
      email: email,
      role: 'Guest',
      tableNumber: 'VIP',
      dietary: 'None',
    };

    await sendEmailViaEmailJS(testAttendee);
    showToast(`Test email sent to ${email}`, 'success');
  } catch (error) {
    console.error('EmailJS error:', error);
    showToast(`Failed: ${error.text || error.message || 'Unknown error'}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> Send Test';
  }
};

window.previewEmailTemplate = async function () {
  const btn = document.getElementById('preview-email-btn');
  const modal = document.getElementById('email-preview-modal');
  const iframe = document.getElementById('email-preview-frame');

  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Loading...';

  try {
    const res = await fetch('/api/email/preview');
    if (!res.ok) throw new Error('Failed to load preview');
    
    let htmlContent = await res.text();
    
    // Replace CID images with actual URLs or placeholders for preview purposes
    htmlContent = htmlContent.replace('cid:logo', '/assets/logo.png');
    // Replace QR core placeholder visually
    htmlContent = htmlContent.replace('cid:qrcode', 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=PREVIEW-12345');

    iframe.srcdoc = htmlContent;
    modal.showModal();
    // Native dialog backdrop styling
    modal.style.setProperty('::backdrop', 'background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);');
  } catch (error) {
    showToast(`Error loading preview: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-envelope-open"></i> Preview Template';
  }
};

window.closeEmailPreview = function () {
  const modal = document.getElementById('email-preview-modal');
  modal.close();
};

window.sendAllEmails = async function () {
  // Filter: has email AND not already sent
  const pending = allAttendees.filter((a) => a.email && a.email.includes('@') && !a.emailSent);
  const alreadySent = allAttendees.filter((a) => a.email && a.email.includes('@') && a.emailSent).length;

  if (pending.length === 0) {
    if (alreadySent > 0) {
      showToast(`All ${alreadySent} attendees have already received emails`, 'info');
    } else {
      showToast('No attendees with valid email addresses', 'warning');
    }
    return;
  }

  const message = alreadySent > 0
    ? `This will send emails to ${pending.length} attendees who haven't received one yet.\n(${alreadySent} already sent — skipping them)\n\nProceed?`
    : `This will send personalized emails to ${pending.length} attendees.\n\nAre you sure you want to proceed?`;

  const confirmed = confirm(message);
  if (!confirmed) return;

  const btn = document.getElementById('send-all-btn');
  const progressDiv = document.getElementById('email-progress');
  const progressFill = document.getElementById('email-progress-fill');
  const progressText = document.getElementById('email-progress-text');

  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Sending...';
  progressDiv.style.display = 'block';
  progressFill.style.width = '0%';

  let sent = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < pending.length; i++) {
    const attendee = pending[i];
    progressText.textContent = `Sending ${i + 1}/${pending.length}: ${attendee.name}...`;
    progressFill.style.width = `${((i + 1) / pending.length) * 100}%`;

    try {
      await sendEmailViaEmailJS(attendee);
      // Mark as sent in backend
      try {
        await apiFetch(`/email/mark-sent/${attendee.id}`, { method: 'POST' });
      } catch (e) {
        console.warn('Could not update email sent status:', e);
      }
      sent++;
    } catch (error) {
      failed++;
      errors.push({ name: attendee.name, error: error.text || error.message });
      console.error(`Failed to send to ${attendee.name}:`, error);
    }

    // Small delay to avoid rate limiting (EmailJS has limits)
    if (i < pending.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  progressFill.style.width = '100%';
  progressText.textContent = `Complete! ${sent} sent, ${failed} failed.`;

  if (failed > 0) {
    showToast(`Sent ${sent} emails. ${failed} failed.`, 'warning');
    console.log('Failed emails:', errors);
  } else {
    showToast(`All ${sent} emails sent successfully!`, 'success');
  }

  // Refresh data to update UI
  await loadAttendees();
  filterAttendees();

  btn.disabled = false;
  btn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> Send All';
};

window.sendEmailToAttendee = async function (id) {
  const btn = document.querySelector(`#email-btn-${id}`);
  const attendee = allAttendees.find((a) => a.id === id);

  if (!attendee) {
    showToast('Attendee not found', 'error');
    return;
  }

  if (!attendee.email) {
    showToast('Attendee has no email address', 'warning');
    return;
  }

  // Warn if already sent
  if (attendee.emailSent) {
    const confirmResend = confirm(`Email was already sent to ${attendee.name}. Send again?`);
    if (!confirmResend) return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i>';
  }

  try {
    await sendEmailViaEmailJS(attendee);
    
    // Mark as sent in backend
    try {
      await apiFetch(`/email/mark-sent/${id}`, { method: 'POST' });
    } catch (e) {
      console.warn('Could not update email sent status:', e);
    }
    
    showToast(`Email sent to ${attendee.email}`, 'success');
    if (btn) btn.innerHTML = '<i class="ph ph-check"></i>';
    
    // Refresh data to update UI
    await loadAttendees();
    filterAttendees();
  } catch (error) {
    console.error('EmailJS error:', error);
    showToast(`Failed: ${error.text || error.message || 'Unknown error'}`, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ph ph-envelope-simple"></i>';
    }
  }
};

// ----- Helpers -----

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

// ----- Email Selection -----

window.updateSelectedCount = function () {
  const checkboxes = document.querySelectorAll('.attendee-cb:checked');
  const count = checkboxes.length;
  const btn = document.getElementById('send-selected-btn');
  const countEl = document.getElementById('selected-count');
  if (countEl) countEl.textContent = count;
  if (btn) btn.disabled = count === 0;

  // Update select-all checkbox state
  const allCheckboxes = document.querySelectorAll('.attendee-cb');
  const selectAllCb = document.getElementById('select-all-cb');
  if (selectAllCb) {
    selectAllCb.checked = allCheckboxes.length > 0 && count === allCheckboxes.length;
    selectAllCb.indeterminate = count > 0 && count < allCheckboxes.length;
  }
};

function wireSelectAll() {
  const selectAllCb = document.getElementById('select-all-cb');
  if (selectAllCb) {
    selectAllCb.addEventListener('change', () => {
      const checkboxes = document.querySelectorAll('.attendee-cb');
      checkboxes.forEach(cb => { cb.checked = selectAllCb.checked; });
      updateSelectedCount();
    });
  }
}

window.sendSelectedEmails = async function () {
  const checkboxes = document.querySelectorAll('.attendee-cb:checked');
  const selectedIds = Array.from(checkboxes).map(cb => cb.dataset.id);

  if (selectedIds.length === 0) {
    showToast('No attendees selected', 'warning');
    return;
  }

  const selectedAttendees = allAttendees.filter(a => selectedIds.includes(a.id) && a.email);
  const alreadySent = selectedAttendees.filter(a => a.emailSent).length;

  if (selectedAttendees.length === 0) {
    showToast('No selected attendees have email addresses', 'warning');
    return;
  }

  let message = `Send personalized emails to ${selectedAttendees.length} selected attendee(s)?`;
  if (alreadySent > 0) {
    message += `\n\nNote: ${alreadySent} of these have already received emails and will be resent.`;
  }

  const confirmed = confirm(message);
  if (!confirmed) return;

  const btn = document.getElementById('send-selected-btn');
  const progressDiv = document.getElementById('email-progress');
  const progressFill = document.getElementById('email-progress-fill');
  const progressText = document.getElementById('email-progress-text');

  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Sending...';
  progressDiv.style.display = 'block';
  progressFill.style.width = '0%';

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < selectedAttendees.length; i++) {
    const attendee = selectedAttendees[i];
    progressText.textContent = `Sending ${i + 1}/${selectedAttendees.length}: ${attendee.name}...`;

    try {
      await sendEmailViaEmailJS(attendee);
      // Mark as sent in backend
      try {
        await apiFetch(`/email/mark-sent/${attendee.id}`, { method: 'POST' });
      } catch (e) {
        console.warn('Could not update email sent status:', e);
      }
      sent++;
    } catch (error) {
      failed++;
      console.error(`Failed to send to ${attendee.name}:`, error);
    }

    const progress = Math.round(((i + 1) / selectedAttendees.length) * 100);
    progressFill.style.width = `${progress}%`;

    // Small delay to avoid rate limiting
    if (i < selectedAttendees.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  progressFill.style.width = '100%';
  progressText.textContent = `Done! ${sent} sent, ${failed} failed.`;
  showToast(`Emails sent: ${sent} successful, ${failed} failed`, sent > 0 ? 'success' : 'error');

  // Refresh data to update UI
  await loadAttendees();
  filterAttendees();

  btn.disabled = false;
  btn.innerHTML = `<i class="ph ph-paper-plane-tilt"></i> Send to Selected (<span id="selected-count">0</span>)`;
};

// ----- Initialize -----

document.addEventListener('DOMContentLoaded', async () => {
  // Wire up scanner buttons
  const startBtn = document.getElementById('start-scanner-btn');
  const stopBtn = document.getElementById('stop-scanner-btn');
  if (startBtn) startBtn.addEventListener('click', startScanner);
  if (stopBtn) stopBtn.addEventListener('click', stopScanner);

  // Wire up search/filter
  const searchInput = document.getElementById('search-input');
  const roleFilter = document.getElementById('role-filter');
  const statusFilter = document.getElementById('status-filter');
  const emailFilterEl = document.getElementById('email-filter');
  if (searchInput) searchInput.addEventListener('input', filterAttendees);
  if (roleFilter) roleFilter.addEventListener('change', filterAttendees);
  if (statusFilter) statusFilter.addEventListener('change', filterAttendees);
  if (emailFilterEl) emailFilterEl.addEventListener('change', filterAttendees);

  // Load data
  await Promise.all([loadStats(), loadAttendees()]);

  // Wire up select-all checkbox for email selection
  wireSelectAll();

  // Load speakers for upload UI
  loadAdminSpeakers();

  // Load gallery management
  loadAdminGallery();

  // Start auto-polling for live sync
  startPolling();
});

// ----- Speaker Management -----

async function loadAdminSpeakers() {
  const container = document.getElementById('speakers-admin-list');
  if (!container) return; // not on admin page or missing section

  try {
    const res = await fetch('/api/speakers');
    if (!res.ok) throw new Error('Failed to fetch speakers');
    
    const speakers = await res.json();
    
    if (speakers.length === 0) {
      container.innerHTML = `<p class="text-muted text-center" style="grid-column: 1 / -1; padding: 2rem;">No speakers found.</p>`;
      return;
    }

    container.innerHTML = speakers.map(s => `
      <div class="card" style="display: flex; gap: 1rem; align-items: center; padding: 1rem;">
        <img src="${s.image}" alt="${escapeHtml(s.name)}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; background: var(--gray-200); border: 2px solid var(--accent-color, var(--gold));">
        <div style="flex: 1;">
          <h4 style="margin: 0; font-size: 1rem; color: var(--gray-900);">${escapeHtml(s.name)}</h4>
          <p style="margin: 0; font-size: 0.8rem; color: var(--gray-500);">${escapeHtml(s.role)}</p>
        </div>
        <div style="position: relative;">
          <input type="file" id="upload-${s.id}" accept="image/*" style="opacity: 0; position: absolute; width: 0; height: 0;" onchange="uploadSpeakerImage(event, '${s.id}')">
          <label for="upload-${s.id}" class="btn btn-outline btn-sm" id="btn-upload-${s.id}" style="cursor: pointer; display: inline-flex;">
            <i class="ph ph-upload-simple"></i> Upload
          </label>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    container.innerHTML = `<p class="text-danger" style="grid-column: 1 / -1;">Error loading speakers: ${error.message}</p>`;
  }
}

window.uploadSpeakerImage = async function(event, id) {
  const file = event.target.files[0];
  if (!file) return;

  const btn = document.getElementById(`btn-upload-${id}`);
  const originalText = btn.innerHTML;
  
  btn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Uploading...';
  btn.style.pointerEvents = 'none';

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch(`/api/speakers/${id}/image`, {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Speaker profile updated successfully!', 'success');
      loadAdminSpeakers(); // Reload the list to show new image
    } else {
      throw new Error(data.error || 'Upload failed');
    }
  } catch (error) {
    showToast(`Error uploading image: ${error.message}`, 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.style.pointerEvents = 'auto';
  }
};

// ----- Gallery Management -----

async function loadAdminGallery() {
  const grid = document.getElementById('admin-gallery-grid');
  if (!grid) return;

  try {
    const res = await fetch('/api/gallery');
    if (!res.ok) throw new Error('Failed to fetch gallery');
    const images = await res.json();

    if (images.length === 0) {
      grid.innerHTML = `<p class="text-muted text-center" style="grid-column: 1 / -1; padding: 2rem;">No gallery photos yet. Upload your first one above!</p>`;
      return;
    }

    grid.innerHTML = images.map(img => `
      <div style="position: relative; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--gray-200); background: var(--gray-100);">
        <img src="${img.url}" alt="${escapeHtml(img.caption || 'Gallery photo')}" style="width: 100%; height: 140px; object-fit: cover; display: block;">
        <div style="padding: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.72rem; color: var(--gray-500); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(img.caption || 'No caption')}</span>
          <button class="btn btn-danger btn-sm" onclick="deleteGalleryImage('${img.id}')" style="padding: 2px 8px; font-size: 0.7rem;">
            <i class="ph ph-trash"></i>
          </button>
        </div>
      </div>
    `).join('');

  } catch (error) {
    grid.innerHTML = `<p style="color: var(--danger); grid-column: 1 / -1;">Error: ${error.message}</p>`;
  }
}

window.uploadGalleryImage = async function () {
  const fileInput = document.getElementById('gallery-file-input');
  const captionInput = document.getElementById('gallery-caption-input');
  const btn = document.getElementById('gallery-upload-btn');
  const progress = document.getElementById('gallery-upload-progress');

  const file = fileInput.files[0];
  if (!file) {
    showToast('Please select a photo first', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Uploading...';
  progress.style.display = 'block';

  const formData = new FormData();
  formData.append('image', file);
  formData.append('caption', captionInput.value.trim());

  try {
    const res = await fetch('/api/gallery', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      showToast('Photo uploaded to gallery!', 'success');
      fileInput.value = '';
      captionInput.value = '';
      loadAdminGallery(); // Refresh the grid
    } else {
      throw new Error(data.error || 'Upload failed');
    }
  } catch (error) {
    showToast(`Upload error: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ph ph-upload-simple"></i> Upload';
    progress.style.display = 'none';
  }
};

window.deleteGalleryImage = async function (id) {
  if (!confirm('Delete this gallery photo?')) return;

  try {
    const res = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      showToast('Photo deleted', 'success');
      loadAdminGallery();
    } else {
      throw new Error(data.error || 'Delete failed');
    }
  } catch (error) {
    showToast(`Delete error: ${error.message}`, 'error');
  }
};
