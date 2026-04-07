/**
 * Messages Carousel — Auto-rotating testimonials with fade transitions
 * Rotates every 5 seconds, pauses on hover, supports dot navigation
 */
export function initQuotesCarousel() {
  const track = document.querySelector('.quotes-track');
  const dotsContainer = document.getElementById('quotes-dots');
  if (!track || !dotsContainer) return;

  const cards = track.querySelectorAll('.quote-card');
  if (cards.length === 0) return;

  let currentIndex = 0;
  let interval = null;

  function syncTrackHeight() {
    const activeCard = cards[currentIndex];
    if (!activeCard) return;

    const wasActive = activeCard.classList.contains('active');
    if (!wasActive) activeCard.classList.add('active');
    const height = activeCard.offsetHeight;
    if (!wasActive) activeCard.classList.remove('active');

    if (height > 0) {
      track.style.minHeight = `${height}px`;
    }
  }

  // Build dot indicators
  cards.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = `quotes-dot${i === 0 ? ' active' : ''}`;
    dot.setAttribute('aria-label', `View message ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsContainer.appendChild(dot);
  });

  function goTo(index) {
    // Remove active from old
    cards[currentIndex].classList.remove('active');
    dotsContainer.children[currentIndex].classList.remove('active');

    currentIndex = index;

    // Add active to new
    cards[currentIndex].classList.add('active');
    dotsContainer.children[currentIndex].classList.add('active');
    syncTrackHeight();

    // Reset the interval so the timer starts fresh after manual navigation
    startAutoPlay();
  }

  function next() {
    goTo((currentIndex + 1) % cards.length);
  }

  function prev() {
    goTo((currentIndex - 1 + cards.length) % cards.length);
  }

  // Bind navigation buttons if present
  const prevBtn = document.getElementById('quotes-prev');
  const nextBtn = document.getElementById('quotes-next');
  if (prevBtn) prevBtn.addEventListener('click', prev);
  if (nextBtn) nextBtn.addEventListener('click', next);

  function startAutoPlay() {
    if (interval) clearInterval(interval);
    interval = setInterval(next, 10000);
  }

  // Pause on hover
  const carousel = document.getElementById('quotes-carousel');
  if (carousel) {
    carousel.addEventListener('mouseenter', () => {
      if (interval) clearInterval(interval);
    });
    carousel.addEventListener('mouseleave', () => {
      startAutoPlay();
    });
  }

  // Start
  syncTrackHeight();
  window.addEventListener('resize', syncTrackHeight);
  setTimeout(syncTrackHeight, 250);
  startAutoPlay();
}
