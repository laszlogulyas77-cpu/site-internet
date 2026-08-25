(() => {
  const normalize = value => String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const decorateNews = async () => {
    const grid = document.querySelector('[data-cms-news]');
    if (!grid) return;
    try {
      const response = await fetch(`data/news.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const items = await response.json();
      const byTitle = new Map((items || []).map(item => [normalize(item.title), item]));
      const apply = () => {
        grid.querySelectorAll('.news-card').forEach(card => {
          if (card.dataset.projectBridgeReady === 'true') return;
          const title = normalize(card.querySelector('h3')?.textContent);
          const item = byTitle.get(title);
          if (!item?.project_link) return;
          const content = card.querySelector('.news-card-content');
          if (!content) return;
          const link = document.createElement('a');
          link.className = 'news-project-link';
          link.href = item.project_link;
          link.textContent = item.project_title || 'Voir le projet';
          link.addEventListener('click', event => event.stopPropagation());
          content.appendChild(link);
          card.dataset.projectBridgeReady = 'true';
        });
      };
      apply();
      new MutationObserver(apply).observe(grid, { childList: true, subtree: true });
    } catch (error) {
      console.warn('Passerelle actualité/projet indisponible.', error);
    }
  };

  const openRequestedProject = () => {
    const grid = document.querySelector('[data-cms-projects]');
    if (!grid) return;
    const slug = new URLSearchParams(window.location.search).get('projet');
    if (!slug) return;
    const wanted = normalize(slug.replace(/^hotel-/, 'hotel '));
    const tryOpen = () => {
      const card = [...grid.querySelectorAll('.project-card')].find(item => {
        const title = normalize(item.querySelector('h3')?.textContent);
        return title === normalize(slug) || title === wanted || title.includes(normalize(slug));
      });
      if (!card) return false;
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => card.click(), 250);
      return true;
    };
    if (tryOpen()) return;
    const observer = new MutationObserver(() => {
      if (tryOpen()) observer.disconnect();
    });
    observer.observe(grid, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 5000);
  };

  const style = document.createElement('style');
  style.textContent = '.news-project-link{display:inline-flex;margin-top:10px;font-weight:700;text-decoration:none;color:#0b4f8a}.news-project-link:hover{text-decoration:underline}';
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { decorateNews(); openRequestedProject(); }, { once: true });
  } else {
    decorateNews();
    openRequestedProject();
  }
})();
