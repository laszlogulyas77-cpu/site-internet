const brandStyles = document.createElement('link');
brandStyles.rel = 'stylesheet';
brandStyles.href = 'assets/css/brand-fix.css?v=20260811-stable-v18';
document.head.appendChild(brandStyles);

const applyBrandLogo = (src = 'assets/uploads/chatgpt-image-10-aout-2026-235845.png') => {
  document.querySelectorAll('.logo, .footer-logo').forEach(container => {
    const logoClass = container.classList.contains('footer-logo') ? 'footer-brand-logo' : 'brand-logo';
    container.innerHTML = `<img class="${logoClass}" data-cms-logo src="${src}" alt="Logo SERILEC">`;
  });
};
applyBrandLogo();

const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-links');
if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? '✕' : '☰';
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.textContent = '☰';
  }));
}

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });
const observeReveals = () => document.querySelectorAll('.reveal:not(.is-visible)').forEach(el => observer.observe(el));
observeReveals();

const projectFilterState = { mode: 'sector', filter: 'all' };

const normalizeProjectService = value => String(value || '')
  .trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '');

const getProjectServices = project => {
  if (Array.isArray(project.services) && project.services.length) {
    const aliases = {
      cfo: 'cfo', courantsforts: 'cfo', courantfort: 'cfo', hta: 'cfo', moyennetension: 'cfo',
      cfa: 'cfa', courantsfaibles: 'cfa', courantfaible: 'cfa',
      ssi: 'ssi', securiteincendie: 'ssi', incendie: 'ssi',
      gtb: 'gtb', gestiontechniquedubatiment: 'gtb',
      photovoltaique: 'photovoltaique', solaire: 'photovoltaique',
      irve: 'irve', bornederecharge: 'irve', bornesderecharge: 'irve'
    };
    return [...new Set(project.services.map(value => aliases[normalizeProjectService(value)] || normalizeProjectService(value)).filter(Boolean))];
  }

  const text = [project.title, project.category_label, project.description, project.location]
    .filter(Boolean).join(' ').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const services = [];
  if (/\bcfo\b|courants?\s*forts?|tgbt|tableaux?\s+electri|poste\s+(ht|hta)|transformateur|distribution\s+generale|eclairage|alimentation\s+generale/i.test(text)) services.push('cfo');
  if (/\bcfa\b|courants?\s*faibles?|vdi|fibre|wi-?fi|reseau\s+informatique|controle\s+d.?acces|videosurveillance|videoprotection|interphonie|videophonie|sonorisation|intrusion/i.test(text)) services.push('cfa');
  if (/\bssi\b|securite\s+incendie|detection\s+incendie|cmsi/i.test(text)) services.push('ssi');
  if (/\bgtb\b|gestion\s+technique\s+du\s+batiment|supervision\s+technique/i.test(text)) services.push('gtb');
  if (/photovolta|panneaux?\s+solaires?|autoconsommation|production\s+solaire/i.test(text)) services.push('photovoltaique');
  if (/\birve\b|bornes?\s+de\s+recharge|recharge\s+(de\s+)?vehicules?\s+electriques?/i.test(text)) services.push('irve');
  return [...new Set(services)];
};

const escapeProjectHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

const renderProjectFallback = project => {
  const image = project.image || 'assets/uploads/references/photo-a-ajouter.svg';
  const services = getProjectServices(project).join(' ');
  const metadata = [
    project.client ? `<span><strong>MOA</strong> ${escapeProjectHtml(project.client)}</span>` : '',
    project.year ? `<span><strong>Année</strong> ${escapeProjectHtml(project.year)}</span>` : ''
  ].filter(Boolean).join('');
  return `<article class="project-card reveal is-visible" data-category="${escapeProjectHtml(project.category)}" data-premium="${project.premium === true ? 'true' : 'false'}" data-services="${escapeProjectHtml(services)}"><img src="${escapeProjectHtml(image)}?v=${Date.now()}" alt="${escapeProjectHtml(project.alt || project.title)}"><div class="project-overlay"><span class="project-tag">${escapeProjectHtml(project.category_label || '')}</span><h3>${escapeProjectHtml(project.title)}</h3><p>${project.location ? `${escapeProjectHtml(project.location)} — ` : ''}${escapeProjectHtml(project.description || '')}</p>${metadata ? `<div class="project-meta">${metadata}</div>` : ''}</div></article>`;
};

const ensureProjectsRendered = async () => {
  const fullGrid = document.querySelector('[data-cms-projects]');
  const featuredGrid = document.querySelector('[data-cms-featured-projects]');
  if (!fullGrid && !featuredGrid) return;
  try {
    const response = await fetch(`data/projects.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const projects = (await response.json()).filter(item => item.published !== false);
    if (fullGrid && !fullGrid.children.length) {
      fullGrid.innerHTML = projects.map(renderProjectFallback).join('');
    }
    if (featuredGrid && !featuredGrid.children.length) {
      featuredGrid.innerHTML = projects.filter(item => item.featured).slice(0, 3).map(renderProjectFallback).join('');
    }
    observeReveals();
    applyProjectFilter();
  } catch (error) {
    console.warn('Chargement de secours des projets indisponible.', error);
  }
};

const applyProjectFilter = () => {
  const cards = [...document.querySelectorAll('.project-card[data-category]')];
  if (!cards.length) return;

  let visibleCount = 0;
  cards.forEach(card => {
    let visible = true;
    if (projectFilterState.filter !== 'all') {
      if (projectFilterState.mode === 'sector') {
        visible = card.dataset.category === projectFilterState.filter ||
          (projectFilterState.filter === 'premium' && card.dataset.premium === 'true');
      } else {
        const services = String(card.dataset.services || '').split(/\s+/).filter(Boolean);
        visible = services.includes(projectFilterState.filter);
      }
    }
    card.dataset.hidden = String(!visible);
    if (visible) visibleCount += 1;
  });

  const emptyState = document.querySelector('[data-project-filter-empty]');
  if (emptyState) emptyState.hidden = visibleCount > 0;
};

const selectFilterMode = mode => {
  projectFilterState.mode = mode;
  projectFilterState.filter = 'all';

  document.querySelectorAll('[data-filter-mode]').forEach(button => {
    const active = button.dataset.filterMode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });

  document.querySelectorAll('[data-filter-group]').forEach(group => {
    const active = group.dataset.filterGroup === mode;
    group.hidden = !active;
    group.querySelectorAll('.filter-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.filter === 'all');
    });
  });

  applyProjectFilter();
};

document.addEventListener('click', event => {
  const modeButton = event.target.closest('[data-filter-mode]');
  if (modeButton) {
    selectFilterMode(modeButton.dataset.filterMode);
    return;
  }

  const button = event.target.closest('[data-filter-group] .filter-btn');
  if (!button) return;

  const group = button.closest('[data-filter-group]');
  if (!group || group.dataset.filterGroup !== projectFilterState.mode) return;

  group.querySelectorAll('.filter-btn').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  projectFilterState.filter = button.dataset.filter || 'all';
  applyProjectFilter();
});

document.addEventListener('cms:projects-rendered', () => {
  observeReveals();
  applyProjectFilter();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureProjectsRendered, { once: true });
} else {
  ensureProjectsRendered();
}

document.querySelectorAll('[data-demo-form]').forEach(form => form.addEventListener('submit', event => {
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]');
  if (!submit) return;
  const original = submit.textContent;
  submit.textContent = 'Merci — demande enregistrée';
  submit.disabled = true;
  setTimeout(() => { submit.textContent = original; submit.disabled = false; form.reset(); }, 3500);
}));
