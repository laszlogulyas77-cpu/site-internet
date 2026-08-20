(() => {
  const normalizeText = value => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  let newsPromise = null;
  let lastFocusedElement = null;

  const getNews = () => {
    if (!newsPromise) {
      newsPromise = fetch(`data/news.json?v=${Date.now()}`, { cache: 'no-store' })
        .then(response => {
          if (!response.ok) throw new Error('Impossible de charger les actualités');
          return response.json();
        })
        .then(items => (Array.isArray(items) ? items : []).filter(item => item.published !== false));
    }
    return newsPromise;
  };

  const formatDate = value => {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const modal = document.createElement('div');
  modal.className = 'article-detail-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="article-detail-backdrop" data-article-close></div>
    <div class="article-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="article-detail-title" aria-describedby="article-detail-body">
      <button class="article-detail-close" type="button" aria-label="Fermer l’article" data-article-close>×</button>
      <div class="article-detail-media">
        <img data-article-image src="" alt="">
      </div>
      <div class="article-detail-content">
        <div class="article-detail-meta">
          <span class="article-detail-category" data-article-category></span>
          <time data-article-date></time>
        </div>
        <h2 id="article-detail-title" data-article-title></h2>
        <p class="article-detail-lead" data-article-lead hidden></p>
        <div class="article-detail-body" id="article-detail-body" data-article-body></div>
        <a class="article-detail-link" data-article-link href="" target="_blank" rel="noopener noreferrer" hidden>Voir la publication liée <span aria-hidden="true">↗</span></a>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const dialog = modal.querySelector('.article-detail-dialog');
  const closeButton = modal.querySelector('.article-detail-close');
  const image = modal.querySelector('[data-article-image]');
  const category = modal.querySelector('[data-article-category]');
  const date = modal.querySelector('[data-article-date]');
  const title = modal.querySelector('[data-article-title]');
  const lead = modal.querySelector('[data-article-lead]');
  const body = modal.querySelector('[data-article-body]');
  const link = modal.querySelector('[data-article-link]');

  const closeArticle = () => {
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('article-modal-open');
    window.setTimeout(() => {
      modal.hidden = true;
      image.removeAttribute('src');
      if (lastFocusedElement?.focus) lastFocusedElement.focus();
      lastFocusedElement = null;
    }, 180);
  };

  const openArticle = (article, card) => {
    lastFocusedElement = card || document.activeElement;
    const fullText = String(article.content || article.body || article.excerpt || '').trim();
    const excerpt = String(article.excerpt || '').trim();
    const hasSeparateLead = Boolean(excerpt && fullText && excerpt !== fullText);

    image.src = article.image || '';
    image.alt = article.alt || article.title || 'Actualité SERILEC';
    category.textContent = article.category || 'Actualité';
    date.textContent = formatDate(article.date);
    date.dateTime = article.date || '';
    title.textContent = article.title || 'Actualité SERILEC';

    lead.hidden = !hasSeparateLead;
    lead.textContent = hasSeparateLead ? excerpt : '';
    body.textContent = fullText || excerpt;

    if (article.link) {
      link.hidden = false;
      link.href = article.link;
    } else {
      link.hidden = true;
      link.removeAttribute('href');
    }

    modal.hidden = false;
    document.body.classList.add('article-modal-open');
    requestAnimationFrame(() => {
      modal.classList.add('is-open');
      closeButton.focus();
    });
  };

  const findArticleForCard = (items, card) => {
    const cardTitle = normalizeText(card.querySelector('h3')?.textContent);
    if (!cardTitle) return null;
    return items.find(item => normalizeText(item.title) === cardTitle) || null;
  };

  const decorateCard = card => {
    if (!card || card.dataset.newsDetailReady === 'true') return;
    card.dataset.newsDetailReady = 'true';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const cardTitle = card.querySelector('h3')?.textContent?.trim() || 'cette actualité';
    card.setAttribute('aria-label', `Lire l’article ${cardTitle}`);

    const oldLink = card.querySelector('.news-link');
    const hint = document.createElement('span');
    hint.className = 'news-open-hint';
    hint.innerHTML = 'Lire l’article <span aria-hidden="true">↗</span>';
    if (oldLink) oldLink.replaceWith(hint);
    else card.querySelector('.news-card-content')?.appendChild(hint);

    const activate = async event => {
      if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
      if (event.type === 'keydown') event.preventDefault();
      if (event.type === 'click') event.preventDefault();
      try {
        const items = await getNews();
        const article = findArticleForCard(items, card);
        if (article) openArticle(article, card);
      } catch (error) {
        console.warn('L’article détaillé ne peut pas être ouvert.', error);
      }
    };

    card.addEventListener('click', activate);
    card.addEventListener('keydown', activate);
  };

  const decorateCards = root => {
    if (!root) return;
    if (root.matches?.('.news-card')) decorateCard(root);
    root.querySelectorAll?.('.news-card').forEach(decorateCard);
  };

  modal.querySelectorAll('[data-article-close]').forEach(element => {
    element.addEventListener('click', closeArticle);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) closeArticle();
    if (event.key !== 'Tab' || modal.hidden) return;

    const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.hidden && element.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const init = () => {
    const grid = document.querySelector('[data-cms-news]');
    if (!grid) return;
    decorateCards(grid);
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) decorateCards(node);
      }));
    });
    observer.observe(grid, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
