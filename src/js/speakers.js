/**
 * Speakers Module — Editorial CSS Grid with Modal popup
 * Fetches speakers from API and renders portrait cards.
 * Click opens the existing <dialog> speaker modal.
 */
export async function initSpeakers() {
  const container = document.getElementById('speakers-container');
  if (!container) return;

  let speakers = [];
  try {
    const res = await fetch('/api/speakers');
    if (res.ok) {
      speakers = await res.json();
    } else {
      console.error('Failed to load speakers via API');
    }
  } catch (error) {
    console.error('Error fetching speakers:', error);
  }

  if (speakers.length === 0) return;

  // Build grid HTML
  const grid = document.createElement('div');
  grid.className = 'speakers-grid';

  speakers.forEach((speaker) => {
    const isKeynote = speaker.role === 'Keynote Speaker';
    const card = document.createElement('div');
    card.className = `speaker-card${isKeynote ? ' speaker-card--keynote' : ''}`;
    card.dataset.id = speaker.id;
    card.innerHTML = `
      <img class="speaker-card__img" src="${speaker.image}" alt="${speaker.name}" loading="lazy" />
      <div class="speaker-card__gradient"></div>
      <span class="speaker-card__number">${speaker.number}</span>
      <div class="speaker-card__content">
        <span class="speaker-card__badge">${speaker.role}</span>
        <h3 class="speaker-card__name">${speaker.name}</h3>
        ${speaker.title ? `<p class="speaker-card__title">${speaker.title}</p>` : ''}
        ${speaker.topic ? `<p class="speaker-card__topic">${speaker.topic}</p>` : ''}
      </div>
    `;

    // Click handler — open modal
    card.addEventListener('click', () => openSpeakerModal(speaker));
    grid.appendChild(card);
  });

  container.appendChild(grid);

  // ========== Scroll To Top ==========
  const scrollToTopBtn = document.querySelector('.scrollToTopBtn');
  const rootElement = document.documentElement;

  function handleScroll() {
    const scrollTotal = rootElement.scrollHeight - rootElement.clientHeight;
    if (rootElement.scrollTop / scrollTotal > 0.8) {
      if (scrollToTopBtn) scrollToTopBtn.classList.add('showBtn');
    } else {
      if (scrollToTopBtn) scrollToTopBtn.classList.remove('showBtn');
    }
  }

  function scrollToTop() {
    rootElement.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (scrollToTopBtn) {
    scrollToTopBtn.addEventListener('click', scrollToTop);
    document.addEventListener('scroll', handleScroll);
  }
}

/**
 * Opens the speaker modal dialog with the given speaker data.
 */
function openSpeakerModal(speaker) {
  const modal = document.getElementById('speaker-modal');
  if (!modal) return;

  document.getElementById('speaker-modal-img').src = speaker.image;
  document.getElementById('speaker-modal-img').alt = speaker.name;
  document.getElementById('speaker-modal-name').textContent = speaker.name;
  document.getElementById('speaker-modal-role').textContent = `${speaker.role}${speaker.title ? ' — ' + speaker.title : ''}`;
  document.getElementById('speaker-modal-bio').textContent = speaker.bio;

  modal.showModal();
}

/**
 * Close modal — attached to window for the HTML onclick handler.
 */
window.closeSpeakerModal = function () {
  const modal = document.getElementById('speaker-modal');
  if (modal) modal.close();
};
