(() => {
  const shell = document.querySelector('[data-project-filters]');
  const grid = document.querySelector('[data-cms-projects]');
  if (!shell || !grid) return;

  const state = { mode: 'sector', filter: 'all' };
  let projectsByTitle = new Map();

  const normalizeText = value => String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const normalizeZone = value => {
    const zone = normalizeText(value).replace(/[^a-z0-9]+/g, '');
    const aliases = {
      paris: 'paris',
      idf: 'idf', iledefrance: 'idf', iledefrancehorsparis: 'idf',
      france: 'france', francehorsidf: 'france', francehorsiledefrance: 'france'
    };
    return aliases[zone] || '';
  };

  const inferZone = project => {
    const manualZone = normalizeZone(project?.zone);
    if (manualZone) return manualZone;

    const location = normalizeText(project?.location);
    if (!location) return '';

    if (/\bparis\b|\b75\d{3}\b/.test(location)) return 'paris';
    if (/\b(?:77|78|91|92|93|94|95)\d{3}\b/.test(location)) return 'idf';
    if (/\b(chessy|barbizon|puteaux|courbevoie|cesson|boulogne[- ]billancourt|neuilly[- ]sur[- ]seine|levallois[- ]perret|saint[- ]denis|versailles)\b/.test(location)) return 'idf';

    return 'france';
  };

  const extractYears = value => [...new Set(String(value || '').match(/(?:19|20)\d{2}/g) || [])];

  const getCardTitle = card => String(card.querySelector('h3')?.textContent || '').trim();

  const getCardYearText = card => {
    const yearSpan = [...card.querySelectorAll('.project-meta span')]
      .find(span => normalizeText(span.textContent).startsWith('annee'));
    return yearSpan?.textContent || '';
  };

  const getCardLocation = card => {
    const text = String(card.querySelector('.project-overlay p')?.textContent || '');
    const separator = text.indexOf(' — ');
    return separator >= 0 ? text.slice(0, separator).trim() : '';
  };

  const decorateCards = () => {
    const cards = [...grid.querySelectorAll('.project-card[data-category]')];
    cards.forEach(card => {
      const project = projectsByTitle.get(getCardTitle(card));
      const years = project ? extractYears(project.year) : extractYears(getCardYearText(card));
      const zone = project ? inferZone(project) : inferZone({ location: getCardLocation(card) });
      card.dataset.years = years.join(' ');
      card.dataset.zone = zone;
    });

    buildYearButtons(cards);
    applyFilter();
  };

  const buildYearButtons = cards => {
    const group = shell.querySelector('[data-filter-group="year"]');
    if (!group) return;

    const years = [...new Set(cards.flatMap(card => String(card.dataset.years || '').split(/\s+/).filter(Boolean)))]
      .sort((a, b) => Number(b) - Number(a));

    if (state.mode === 'year' && state.filter !== 'all' && !years.includes(state.filter)) {
      state.filter = 'all';
    }

    group.innerHTML = [
      `<button class="filter-btn${state.mode === 'year' && state.filter === 'all' ? ' active' : ''}" type="button" data-filter="all">Toutes les années</button>`,
      ...years.map(year => `<button class="filter-btn${state.mode === 'year' && state.filter === year ? ' active' : ''}" type="button" data-filter="${escapeHtml(year)}">${escapeHtml(year)}</button>`)
    ].join('');
  };

  const applyFilter = () => {
    const cards = [...grid.querySelectorAll('.project-card[data-category]')];
    if (!cards.length) return;

    let visibleCount = 0;
    cards.forEach(card => {
      let visible = true;

      if (state.filter !== 'all') {
        if (state.mode === 'sector') {
          visible = card.dataset.category === state.filter ||
            (state.filter === 'premium' && card.dataset.premium === 'true');
        } else if (state.mode === 'service') {
          const services = String(card.dataset.services || '').split(/\s+/).filter(Boolean);
          visible = services.includes(state.filter);
        } else if (state.mode === 'year') {
          const years = String(card.dataset.years || '').split(/\s+/).filter(Boolean);
          visible = years.includes(state.filter);
        } else if (state.mode === 'zone') {
          visible = card.dataset.zone === state.filter;
        }
      }

      card.dataset.hidden = String(!visible);
      if (visible) visibleCount += 1;
    });

    const emptyState = document.querySelector('[data-project-filter-empty]');
    if (emptyState) emptyState.hidden = visibleCount > 0;
  };

  const selectMode = mode => {
    state.mode = mode;
    state.filter = 'all';

    shell.querySelectorAll('[data-filter-mode]').forEach(button => {
      const active = button.dataset.filterMode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });

    shell.querySelectorAll('[data-filter-group]').forEach(group => {
      const active = group.dataset.filterGroup === mode;
      group.hidden = !active;
      group.querySelectorAll('.filter-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.filter === 'all');
      });
    });

    applyFilter();
  };

  document.addEventListener('click', event => {
    const modeButton = event.target.closest('[data-project-filters] [data-filter-mode]');
    const filterButton = event.target.closest('[data-project-filters] [data-filter-group] .filter-btn');
    if (!modeButton && !filterButton) return;

    event.preventDefault();
    event.stopPropagation();

    if (modeButton) {
      selectMode(modeButton.dataset.filterMode || 'sector');
      return;
    }

    const group = filterButton.closest('[data-filter-group]');
    if (!group || group.dataset.filterGroup !== state.mode) return;

    group.querySelectorAll('.filter-btn').forEach(button => button.classList.remove('active'));
    filterButton.classList.add('active');
    state.filter = filterButton.dataset.filter || 'all';
    applyFilter();
  }, true);

  const loadProjects = async () => {
    try {
      const response = await fetch(`data/projects.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const projects = (await response.json()).filter(item => item.published !== false);
      projectsByTitle = new Map(projects.map(project => [String(project.title || '').trim(), project]));
    } catch (error) {
      console.warn('Métadonnées de filtres projets indisponibles.', error);
    }
  };

  const observer = new MutationObserver(() => decorateCards());
  observer.observe(grid, { childList: true });

  document.addEventListener('cms:projects-rendered', decorateCards);

  const start = async () => {
    await loadProjects();
    decorateCards();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
