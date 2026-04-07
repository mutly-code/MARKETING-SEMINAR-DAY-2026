/**
 * Vanilla JS Slide Tabs — port of the React SlideTabs component.
 * Renders a pill-shaped navigation bar with a sliding cursor that
 * follows hover and locks onto the actively selected section.
 */
export function initSlideTabs() {
  const tabs = [
    { label: 'Home',     target: '#landing-content' },
    { label: 'Messages', target: '#quotes' },
    { label: 'Speakers', target: '#speakers' },
    { label: 'Schedule', target: '#schedule' },
    { label: 'Team',     target: '#team' },
    { label: 'Gallery',  target: '#gallery' },
  ];

  // --- Build DOM ---
  const nav = document.createElement('nav');
  nav.className = 'slide-tabs';
  nav.setAttribute('aria-label', 'Section navigation');

  const ul = document.createElement('ul');
  ul.className = 'slide-tabs__list';

  const cursor = document.createElement('li');
  cursor.className = 'slide-tabs__cursor';
  cursor.setAttribute('aria-hidden', 'true');

  tabs.forEach((tab, i) => {
    const li = document.createElement('li');
    li.className = 'slide-tabs__tab';
    li.textContent = tab.label;
    li.dataset.index = i;
    li.dataset.target = tab.target;
    if (i === 0) li.classList.add('is-selected');
    ul.appendChild(li);
  });

  ul.appendChild(cursor);
  nav.appendChild(ul);

  // Insert as the first child of #landing-content
  const landingContent = document.getElementById('landing-content');
  if (landingContent) {
    landingContent.insertBefore(nav, landingContent.firstChild);
  }

  // Calculate navbar height for sticky offset
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    nav.style.top = navbar.offsetHeight + 'px';
  }

  // --- Cursor positioning helpers ---
  const allTabs = ul.querySelectorAll('.slide-tabs__tab');
  let selectedIndex = 0;

  function moveCursor(tab) {
    cursor.style.left = tab.offsetLeft + 'px';
    cursor.style.width = tab.offsetWidth + 'px';
    cursor.style.opacity = '1';
    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function setCursorToSelected() {
    const tab = allTabs[selectedIndex];
    if (tab) moveCursor(tab);
  }

  // --- Events ---
  allTabs.forEach((tab) => {
    tab.addEventListener('mouseenter', () => moveCursor(tab));
    tab.addEventListener('click', () => {
      const idx = Number(tab.dataset.index);
      selectedIndex = idx;

      // Update visual selection
      allTabs.forEach(t => t.classList.remove('is-selected'));
      tab.classList.add('is-selected');
      moveCursor(tab);

      // Smooth-scroll to the target section
      const targetEl = document.querySelector(tab.dataset.target);
      if (targetEl) {
        const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 0;
        const tabsHeight = nav.offsetHeight || 0;
        const y = targetEl.getBoundingClientRect().top + window.scrollY - navbarHeight - tabsHeight - 10;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    });
  });

  ul.addEventListener('mouseleave', () => setCursorToSelected());

  // --- Intersection Observer to auto-highlight on scroll ---
  const sectionTargets = tabs.map(t => document.querySelector(t.target)).filter(Boolean);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = sectionTargets.indexOf(entry.target);
        if (idx !== -1 && idx !== selectedIndex) {
          selectedIndex = idx;
          allTabs.forEach(t => t.classList.remove('is-selected'));
          allTabs[idx].classList.add('is-selected');
          setCursorToSelected();
        }
      }
    });
  }, { rootMargin: '-40% 0px -40% 0px', threshold: 0 });

  sectionTargets.forEach(el => observer.observe(el));

  // Initial cursor position (wait for layout)
  requestAnimationFrame(() => setCursorToSelected());
  window.addEventListener('resize', () => setCursorToSelected());
}
