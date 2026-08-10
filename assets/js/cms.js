(() => {
  const brandVersion = '20260810-logo-photos-v3';
  const brandCss = document.createElement('link');
  brandCss.rel = 'stylesheet';
  brandCss.href = `assets/css/brand-fix.css?v=${brandVersion}`;
  document.head.appendChild(brandCss);

  const projectStyles = document.createElement('style');
  projectStyles.textContent = `.project-overlay p{margin-bottom:10px}.project-meta{display:flex;flex-wrap:wrap;gap:7px 14px;padding-top:10px;border-top:1px solid rgba(255,255,255,.18);font-size:.72rem;color:#e6edf4}.project-meta span{display:inline-flex;gap:5px}.project-meta strong{color:#fff;font-weight:700}.project-card{min-height:455px}@media(max-width:680px){.project-card{min-height:440px}}`;
  document.head.appendChild(projectStyles);

  const projectImageOverrides = {
    'Hôtel Ampère': 'https://d3q7x7f8c6hxga.cloudfront.net/eyJidWNrZXQiOiJtZWRpYS5ibmV0d29yay5jb20iLCJrZXkiOiJQcm9kL0hvdGVscy8wZmNlMzYzZi1mMjFkLTQ1MjQtYjMzNi0xNTFmMzk1N2E5OGYvRnJvbnQuanBnIiwiZWRpdHMiOnsicmVzaXplIjpudWxsfSwiVXJsQ2FjaGVLZXkiOjB9',
    'Hôtel Bellechasse': 'https://media.cool-cities.com/bellechasse037mk_mob.jpg?h=530',
    'Thalazur Carnac': 'https://www.thalazur.fr/_hotels/assets/images/salines/galleries/big/vue-hotel-carnac-exterieur.jpg',
    'Thalazur Royan': 'https://cdn.generationvoyage.fr/2024/08/Thalazur-Royan-Hotel-Spa.jpg',
    'Hôtel Tiquetonne': 'https://hapi.mmcreation.com/hapidam/a11d5c5a-af21-4ba7-88fc-d5be05a0530f/le-tiquetonne-partie-commune-016.png?size=lg',
    'Hôtel Courcelles': 'https://z.cdrst.com/foto/hotel-sf/2454/granderesp/courcelles-etoile-exterior-11c47565.jpg',
    'Ambassade des Émirats Arabes Unis': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Emirati_embassy_in_Paris.jpg/960px-Emirati_embassy_in_Paris.jpg',
    'Boutique Ladurée Champs-Élysées': 'https://laduree.com/cdn/shop/files/yext-DsuNy4q3Eeo4UjFUaHXAGmG0m9Wd3_xWNX5Ry_GLjas-1600x1200.jpg?crop=center&height=650&v=1783410307&width=573',
    'Boutique Ladurée': 'https://laduree.com/cdn/shop/files/yext-DsuNy4q3Eeo4UjFUaHXAGmG0m9Wd3_xWNX5Ry_GLjas-1600x1200.jpg?crop=center&height=650&v=1783410307&width=573',
    'Flagship Lacoste': 'https://laduree.com/cdn/shop/files/yext-DsuNy4q3Eeo4UjFUaHXAGmG0m9Wd3_xWNX5Ry_GLjas-1600x1200.jpg?crop=center&height=650&v=1783410307&width=573'
  };

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
    document.querySelectorAll('[data-cms-logo]').forEach(el => {
      if (site.logo) el.src = site.logo;
      el.alt = `Logo ${site.company_name || 'SERILEC'}`;
    });
  };
  const normalizeProject = project => {
    if (project.title !== 'Flagship Lacoste') return project;
    return {
      ...project,
      title: 'Boutique Ladurée Champs-Élysées',
      category: 'retail',
      category_label: 'Boutique',
      location: '75 avenue des Champs-Élysées, 75008 Paris',
      description: "Rénovation et agrandissement de la boutique : CFO, CFA, SSI, contrôle d'accès et vidéosurveillance.",
      client: 'PATISSERIE E. LADUREE',
      amount: '520 000 €',
      year: '2022-2023'
    };
  };
  const renderProject = sourceProject => {
    const project = normalizeProject(sourceProject);
    const metadata = [
      project.client ? `<span><strong>MOA</strong> ${escapeHtml(project.client)}</span>` : '',
      project.amount ? `<span><strong>Travaux</strong> ${escapeHtml(project.amount)}</span>` : '',
      project.year ? `<span><strong>Année</strong> ${escapeHtml(project.year)}</span>` : ''
    ].filter(Boolean).join('');
    const image = projectImageOverrides[project.title] || projectImageOverrides[sourceProject.title] || project.image;
    return `<article class="project-card reveal is-visible" data-category="${escapeHtml(project.category)}"><img src="${escapeHtml(image)}" alt="${escapeHtml(project.alt || project.title)}"><div class="project-overlay"><span class="project-tag">${escapeHtml(project.category_label)}</span><h3>${escapeHtml(project.title)}</h3><p>${project.location ? `${escapeHtml(project.location)} — ` : ''}${escapeHtml(project.description)}</p>${metadata ? `<div class="project-meta">${metadata}</div>` : ''}</div></article>`;
  };
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
