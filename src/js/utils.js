// ===== Shared Utilities =====

const API_BASE = '/api';

/**
 * Fetch wrapper with error handling
 */
export async function apiFetch(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * Show a toast notification
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '',
    error: '',
    warning: '',
    info: '',
  };

  toast.innerHTML = `${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/**
 * Get initials from a name
 */
export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get a badge class for a role
 */
export function getRoleBadgeClass(role) {
  const classes = {
    Student: 'badge-info',
    Facilitator: 'badge-gold',
    Speaker: 'badge-emerald',
    Guest: 'badge-neutral',
  };
  return classes[role] || 'badge-neutral';
}

/**
 * Get a badge class for check-in status
 */
export function getStatusBadgeClass(status) {
  return status === 'Checked In' ? 'badge-emerald' : 'badge-warning';
}

/**
 * Format an ISO date string to readable format
 */
export function formatTime(isoString) {
  if (!isoString) return '--';
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
