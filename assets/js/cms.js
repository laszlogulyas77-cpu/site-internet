(() => {
  const brandVersion = '20260811-project-filters-v17';
  const assetVersion = Date.now();
  const brandCss = document.createElement('link');
  brandCss.rel = 'stylesheet';
  brandCss.href = `assets/css/brand-fix.css?v=${brandVersion}`;
  document.head.appendChild(brandCss);

  const extraStyles = document.createElement('style');
  extraStyles.textContent = `.project-overlay p{margin-bottom:10px}.project-meta{display:flex;flex-wrap:wrap;gap:7px 14px;padding-top:10px;border-top:1px solid rgba(255,255,255,.18);font-size:.72rem;color:#e6edf4}.project-meta span{display:inline-flex;gap:5px}.project-meta strong{color:#77a9dc;font-weight:700}.project-card{min-height:455px}.partner img{width:100%;height:72px;object-fit:contain}.partner{background:#fff}.partner-name{font:700 .84rem 'Manrope',sans-serif;margin-top:9px;color:#45576b}.partner-link{color:inherit;text-decoration:none;cursor:pointer;transition:transform .22s ease,box-shadow .22s ease,background .22s ease}.partner-link:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(0,26,54,.10);background:#f8fafc}.partner-link:focus-visible{outline:3px solid #fff200;outline-offset:-3px}@media(max-width:680px){.project-card{min-height:440px}.partner img{height:60px}}`;
  document.head.appendChild(extraStyles);

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const withAssetVersion = src => {
    if (!src || /^https?:\/\//i.test(src) || src.startsWith('data:')) return src;
    return `${src}${src.includes('?') ? '&' : '?'}v=${assetVersion}`;
  };
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

    if (site.logo) {
      const logoSrc = withAssetVersion(site.logo);
      const logoAlt = `Logo ${site.company_name || 'SERILEC'}`;
      document.querySelectorAll('.site-header .logo').forEach(el => {
        el.innerHTML = `<img class="brand-logo" data-cms-logo src="${escapeHtml(logoSrc)}" alt="${escapeHtml(logoAlt)}">`;
      });
      document.querySelectorAll('.footer-logo').forEach(el => {
        el.innerHTML = `<img class="footer-brand-logo" data-cms-logo src="${escapeHtml(logoSrc)}" alt="${escapeHtml(logoAlt)}">`;
      });
    }
  };

  const normalizeService = value => {
    const normalized = String(value || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
    const aliases = {
      cfo: 'cfo', courantsforts: 'cfo', courantfort: 'cfo', hta: 'cfo', moyennetension: 'cfo',
      cfa: 'cfa', courantsfaibles: 'cfa', courantfaible: 'cfa',
      ssi: 'ssi', securiteincendie: 'ssi', incendie: 'ssi',
      gtb: 'gtb', gestiontechniquedubatiment: 'gtb',
      photovoltaique: 'photovoltaique', solaire: 'photovoltaique',
      irve: 'irve', bornederecharge: 'irve', bornesderecharge: 'irve'
    };
    return aliases[normalized] || normalized;
  };

  const inferProjectServices = project => {
    if (Array.isArray(project.services) && project.services.length) {
      return [...new Set(project.services.map(normalizeService).filter(Boolean))];
    }

    const text = [project.title, project.category_label, project.description, project.location]
      .filter(Boolean).join(' ').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const services = [];

    if (/\bcfo\b|courants?\s*forts?|tgbt|tableaux?\s+electri|tableaux?\s+de\s+distribution|poste\s+(ht|hta)|transformateur|distribution\s+generale|eclairage|alimentation\s+generale/i.test(text)) services.push('cfo');
    if (/\bcfa\b|courants?\s*faibles?|vdi|fibre|wi-?fi|reseau\s+informatique|controle\s+d.?acces|videosurveillance|videoprotection|interphonie|videophonie|sonorisation|intrusion/i.test(text)) services.push('cfa');
    if (/\bssi\b|securite\s+incendie|detection\s+incendie|cmsi/i.test(text)) services.push('ssi');
    if (/\bgtb\b|gestion\s+technique\s+du\s+batiment|supervision\s+technique/i.test(text)) services.push('gtb');
    if (/photovolta|panneaux?\s+solaires?|autoconsommation|production\s+solaire/i.test(text)) services.push('photovoltaique');
    if (/\birve\b|bornes?\s+de\s+recharge|recharge\s+(de\s+)?vehicules?\s+electriques?/i.test(text)) services.push('irve');

    return [...new Set(services)];
  };

  const renderProject = project => {
    const metadata = [
      project.client ? `<span><strong>MOA</strong> ${escapeHtml(project.client)}</span>` : '',
      project.year ? `<span><strong>Année</strong> ${escapeHtml(project.year)}</span>` : ''
    ].filter(Boolean).join('');
    const image = withAssetVersion(project.image || 'assets/uploads/references/photo-a-ajouter.svg');
    const services = inferProjectServices(project).join(' ');
    return `<article class="project-card reveal is-visible" data-category="${escapeHtml(project.category)}" data-premium="${project.premium === true ? 'true' : 'false'}" data-services="${escapeHtml(services)}"><img src="${escapeHtml(image)}" alt="${escapeHtml(project.alt || project.title)}"><div class="project-overlay"><span class="project-tag">${escapeHtml(project.category_label || '')}</span><h3>${escapeHtml(project.title)}</h3><p>${project.location ? `${escapeHtml(project.location)} — ` : ''}${escapeHtml(project.description || '')}</p>${metadata ? `<div class="project-meta">${metadata}</div>` : ''}</div></article>`;
  };

  const renderCertification = item => {
    const labels = (item.labels || []).map(label => `<span class="certification-badge">${escapeHtml(label)}</span>`).join('');
    const bullets = (item.bullets || []).map(bullet => `<li>${escapeHtml(bullet)}</li>`).join('');
    return `<article class="card certification-card reveal is-visible"><div class="certification-kicker">${escapeHtml(item.kicker || '')}</div><h3>${escapeHtml(item.title || '')}</h3>${labels ? `<div class="certification-badges">${labels}</div>` : ''}${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}${bullets ? `<ul>${bullets}</ul>` : ''}</article>`;
  };

  const getWebLogo = website => {
    if (!website) return '';
    try {
      const hostname = new URL(website).hostname.replace(/^www\./, '');
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=256`;
    } catch (error) {
      return '';
    }
  };

  const renderLogoItem = item => {
    const fallbackLogo = getWebLogo(item.website);
    const logoSource = item.logo ? withAssetVersion(item.logo) : fallbackLogo;
    const fallbackAttribute = fallbackLogo ? ` onerror="this.onerror=null;this.src='${escapeHtml(fallbackLogo)}'"` : '';
    const logo = logoSource ? `<img src="${escapeHtml(logoSource)}" alt="Logo ${escapeHtml(item.name)}" loading="lazy"${fallbackAttribute}>` : '';
    const name = `<div class="partner-name">${escapeHtml(item.name)}</div>`;
    const description = item.description ? `<small>${escapeHtml(item.description)}</small>` : '';
    const content = `${logo}${name}${description}`;
    if (item.website) {
      return `<a class="partner partner-link" href="${escapeHtml(item.website)}" target="_blank" rel="noopener noreferrer" aria-label="Visiter le site de ${escapeHtml(item.name)}">${content}</a>`;
    }
    return `<div class="partner">${content}</div>`;
  };

  const renderNews = item => {
    const image = withAssetVersion(item.image);
    return `<article class="card news-card reveal is-visible"><img src="${escapeHtml(image)}" alt="${escapeHtml(item.alt || item.title)}"><div class="news-card-content"><span class="news-meta">${escapeHtml(item.category)}${item.date ? ` • ${new Date(item.date).toLocaleDateString('fr-FR')}` : ''}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.excerpt)}</p>${item.link ? `<a class="news-link" href="${escapeHtml(item.link)}">Lire l’article</a>` : '<span class="news-link">Actualité SERILEC</span>'}</div></article>`;
  };

  document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('a[href="partenaires.html"]').forEach(link => {
      if (link.closest('.nav-links') || link.closest('.footer-links')) link.textContent = 'Clients & Partenaires';
    });

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
        const hero = document.querySelector('.hero');
        if (hero && site.home?.hero_image) {
          const heroImage = withAssetVersion(site.home.hero_image);
          hero.style.backgroundImage = `linear-gradient(90deg,rgba(0,20,43,.98) 0%,rgba(0,26,54,.9) 42%,rgba(0,26,54,.28) 76%),url(${JSON.stringify(heroImage)})`;
          hero.style.backgroundPosition = 'center';
          hero.style.backgroundSize = 'cover';
        }
        setText('[data-cms-home-about-eyebrow]', site.home?.about_eyebrow);
        setText('[data-cms-home-about-title]', site.home?.about_title);
        setText('[data-cms-home-about-text]', site.home?.about_text);
        const stats = site.home?.stats || {};
        [1, 2, 3, 4].forEach((number) => {
          const stat = stats[`stat_${number}`];
          if (!stat) return;
          setText(`.stats-strip .stat:nth-child(${number}) strong`, stat.value);
          setText(`.stats-strip .stat:nth-child(${number}) span`, stat.label);
        });
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

    const certificationGrid = document.querySelector('[data-cms-certifications]');
    if (certificationGrid) {
      try {
        const items = (await fetchJson('data/certifications.json')).filter(item => item.published !== false);
        certificationGrid.innerHTML = items.map(renderCertification).join('');
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

    const clientGrid = document.querySelector('[data-cms-clients]');
    if (clientGrid) {
      try {
        const clients = (await fetchJson('data/clients.json')).filter(item => item.published !== false);
        clientGrid.innerHTML = clients.map(renderLogoItem).join('');
      } catch (error) { console.warn(error); }
    }

    const partnerGrid = document.querySelector('[data-cms-partners]');
    if (partnerGrid) {
      try {
        const partners = (await fetchJson('data/partners.json')).filter(item => item.published !== false);
        partnerGrid.innerHTML = partners.map(renderLogoItem).join('');
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
