const brandStyles = document.createElement('link');
brandStyles.rel = 'stylesheet';
brandStyles.href = 'assets/css/serilec-brand.css';
document.head.appendChild(brandStyles);

const applyBrandLogo = (src = 'assets/img/logo-serilec.svg') => {
  document.querySelectorAll('.logo, .footer-logo').forEach(container => {
    container.innerHTML = `<img class="brand-logo" data-cms-logo src="${src}" alt="Logo SERILEC">`;
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

document.querySelectorAll('[data-demo-form]').forEach(form => form.addEventListener('submit', event => {
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]');
  if (!submit) return;
  const original = submit.textContent;
  submit.textContent = 'Merci — demande enregistrée';
  submit.disabled = true;
  setTimeout(() => { submit.textContent = original; submit.disabled = false; form.reset(); }, 3500);
}));
