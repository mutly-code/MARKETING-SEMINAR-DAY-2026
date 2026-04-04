/**
 * Gallery Module — Fetches gallery images from API and renders them.
 * Falls back to placeholder images if no uploads exist yet.
 */

const FALLBACK_IMAGES = [
  { url: 'https://res.cloudinary.com/dvrzwuxaw/image/upload/v1775278855/DSC05864_oqemcd.jpg', caption: 'Marketing Seminar Day' },
  { url: 'https://res.cloudinary.com/dvrzwuxaw/image/upload/v1775278853/DSC05874_nek8wp.jpg', caption: 'Attendee Networking' },
  { url: 'https://res.cloudinary.com/dvrzwuxaw/image/upload/v1775278854/DSC05842_pk3eek.jpg', caption: 'Event Moments' },
  { url: 'https://res.cloudinary.com/dvrzwuxaw/image/upload/v1775278853/DSC05874_nek8wp.jpg', caption: 'Audience Engagement' },
  { url: 'https://res.cloudinary.com/dvrzwuxaw/image/upload/v1775278852/DSC05882-Edit_xyinkv.jpg', caption: 'Seminar Highlights' },
  { url: 'https://res.cloudinary.com/dvrzwuxaw/image/upload/v1775281243/DSC07554_czhxr2.jpg', caption: 'In Action' },
  { url: 'https://res.cloudinary.com/dvrzwuxaw/image/upload/v1775278854/DSC05857_v6zchd.jpg', caption: 'Event Atmosphere' },
  { url: 'https://res.cloudinary.com/dvrzwuxaw/image/upload/v1775278853/DSC05870_cnxp8c.jpg', caption: 'Attendees' },
];

export async function initGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  let images = [];

  try {
    const res = await fetch('/api/gallery');
    if (res.ok) {
      images = await res.json();
    }
  } catch (err) {
    console.error('Error fetching gallery:', err);
  }

  // Use API images if available, otherwise fallback
  const displayImages = images.length > 0 ? images : FALLBACK_IMAGES;

  displayImages.forEach(img => {
    const item = document.createElement('a');
    item.href = '#';
    item.className = 'gallery-item';
    item.innerHTML = `<img class="gallery-img" src="${img.url}" alt="${img.caption || 'Gallery photo'}" loading="lazy">`;
    item.onclick = (e) => {
      e.preventDefault();
      const modal = document.getElementById('gallery-modal');
      const modalImg = document.getElementById('gallery-modal-img');
      if (modal && modalImg) {
        modalImg.src = img.url;
        modal.showModal();
      }
    };
    grid.appendChild(item);
  });
}
