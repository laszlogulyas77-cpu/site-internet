(() => {
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const fetchJson = async path => {
    const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Impossible de charger ${path}`);
    return response.json();
  };
  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) el.textContent = value;
  };
  const setContactLinks = site => {
    document.querySelectorAll('[data-cms-email]').forEach(el => {
      el.textContent = site.email || '';
      if (el.tagName === 'A') el.href = `mailto:${site.email}`;
    });
    document.querySelectorAll('[data-cms-phone]').forEach(el => {
      el.textContent = site.phone || '';
      if (el.tagName === 'A') el.href = `tel:${String(site.phone || '').replace(/\s/g, '')}`;
    });
    document.querySelectorAll('[data-cms-address]').forEach(el => el.textContent = site.address || '');
    document.querySelectorAll('[data-cms-location]').forEach(el => el.textContent = site.location_label || '');
    document.querySelectorAll('[data-cms-footer-description]').forEach(el => el.textContent = site.footer_description || '');
  };
  const renderProject = project => `<article class="project-card reveal is-visible" data-category="${escapeHtml(project.category)}"><img src="${escapeHtml(project.image)}" alt="${escapeHtml(project.alt || project.title)}"><div class="project-overlay"><span class="project-tag">${escapeHtml(project.category_label)}</span><h3>${escapeHtml(project.title)}</h3><p>${project.location ? `${escapeHtml(project.location)} — ` : ''}${escapeHtml(project.description)}</p></div></article>`;
  const renderNews = item => `<article class="card news-card reveal is-visible"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || item.title)}"><div class="news-card-content"><span class="news-meta">${escapeHtml(item.category)}${item.date ? ` • ${new Date(item.date).toLocaleDateString('fr-FR')}` : ''}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.excerpt)}</p>${item.link ? `<a class="news-link" href="${escapeHtml(item.link)}">Lire l’article</a>` : '<span class="news-link">Actualité SERILEC</span>'}</div></article>`;
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const site = await fetchJson('data/site.json');
      setContactLinks(site);
      const pageKey = document.body.dataset.cmsPage;
      if (pageKey && site.pages?.[pageKey]) {
        setText('[data-cms-page-eyebrow]', site.pages[pageKey].eyebrow);
        setText('[data-cms-page-title]', site.pages[pageKey].title);
        setText('[data-cms-page-intro]', site.pages[pageKey].intro);
      }
      if (document.body.dataset.cmsPage === 'home') {
        setText('[data-cms-home-hero-eyebrow]', site.home?.hero_eyebrow);
        setText('[data-cms-home-hero-title]', site.home?.hero_title);
        setText('[data-cms-home-hero-highlight]', site.home?.hero_highlight);
        setText('[data-cms-home-hero-lead]', site.home?.hero_lead);
        setText('[data-cms-home-about-eyebrow]', site.home?.about_eyebrow);
        setText('[data-cms-home-about-title]', site.home?.about_title);
        setText('[data-cms-home-about-text]', site.home?.about_text);
        setText('[data-cms-home-contact-eyebrow]', site.home?.contact_eyebrow);
        setText('[data-cms-home-contact-title]', site.home?.contact_title);
        setText('[data-cms-home-contact-text]', site.home?.contact_text);
      }
    } catch (error) { console.warn(error); }

    const competenceGrid = document.querySelector('[data-cms-competences]');
    if (competenceGrid) {
      try {
        const items = (await fetchJson('data/competences.json')).filter(item => item.published !== false);
        competenceGrid.innerHTML = items.map(item => `<article class="card service-card reveal is-visible"><div class="service-no">${escapeHtml(item.number)} / ${escapeHtml(item.kicker)}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><ul>${(item.bullets || []).map(bullet => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul></article>`).join('');
      } catch (error) { console.warn(error); }
    }

    const projectGrid = document.querySelector('[data-cms-projects]');
    if (projectGrid) {
      try {
        const projects = (await fetchJson('data/projects.json')).filter(item => item.published !== false);
        projectGrid.innerHTML = projects.map(renderProject).join('');
        document.dispatchEvent(new CustomEvent('cms:projects-rendered'));
      } catch (error) { console.warn(error); }
    }

    const featuredProjects = document.querySelector('[data-cms-featured-projects]');
    if (featuredProjects) {
      try {
        const projects = (await fetchJson('data/projects.json')).filter(item => item.published !== false && item.featured).slice(0, 3);
        featuredProjects.innerHTML = projects.map(renderProject).join('');
      } catch (error) { console.warn(error); }
    }

    const partnerGrid = document.querySelector('[data-cms-partners]');
    if (partnerGrid) {
      try {
        const partners = (await fetchJson('data/partners.json')).filter(item => item.published !== false);
        partnerGrid.innerHTML = partners.map(item => `<div class="partner">${item.logo ? `<img src="${escapeHtml(item.logo)}" alt="Logo ${escapeHtml(item.name)}">` : escapeHtml(item.name)}<small>${escapeHtml(item.description || item.category || '')}</small></div>`).join('');
      } catch (error) { console.warn(error); }
    }

    const newsGrid = document.querySelector('[data-cms-news]');
    if (newsGrid) {
      try {
        const news = (await fetchJson('data/news.json')).filter(item => item.published !== false).sort((a,b) => String(b.date).localeCompare(String(a.date)));
        newsGrid.innerHTML = news.map(renderNews).join('');
      } catch (error) { console.warn(error); }
    }
  });
})();
