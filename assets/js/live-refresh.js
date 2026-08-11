(() => {
  const VERSION_URL = 'data/deploy-version.json';
  const CHECK_INTERVAL_MS = 10000;
  let currentVersion = null;
  let reloading = false;

  const checkForNewDeployment = async () => {
    try {
      const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) return;

      const data = await response.json();
      const version = data.sha || data.version;
      if (!version) return;

      if (currentVersion === null) {
        currentVersion = version;
        return;
      }

      if (version !== currentVersion && !reloading) {
        reloading = true;
        const url = new URL(window.location.href);
        url.searchParams.set('_site', String(version).slice(0, 10));
        window.location.replace(url.toString());
      }
    } catch (error) {
      // Une indisponibilité temporaire ne doit jamais gêner la navigation.
    }
  };

  checkForNewDeployment();
  window.setInterval(checkForNewDeployment, CHECK_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForNewDeployment();
  });
})();
