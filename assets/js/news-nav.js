(() => {
  const setNewsVisibility = hasNews => {
    document.querySelectorAll('a[href="actualites.html"]').forEach(link => {
      link.hidden = !hasNews;
      link.setAttribute('aria-hidden', hasNews ? 'false' : 'true');
      if (!hasNews) link.setAttribute('tabindex', '-1');
      else link.removeAttribute('tabindex');
    });

    const metaRobots = document.querySelector('meta[name="robots"]');
    if (document.body?.dataset?.cmsPage === 'news' && metaRobots) {
      metaRobots.setAttribute('content', hasNews ? 'index,follow' : 'noindex,follow');
    }
  };

  const run = async () => {
    try {
      const response = await fetch(`data/news.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Actualités indisponibles');
      const news = await response.json();
      const hasNews = Array.isArray(news) && news.some(item => item && item.published !== false);
      setNewsVisibility(hasNews);
    } catch (error) {
      setNewsVisibility(false);
      console.warn('Impossible de vérifier les actualités.', error);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
