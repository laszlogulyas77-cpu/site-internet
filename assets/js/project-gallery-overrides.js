(() => {
  const nativeFetch = window.fetch.bind(window);
  const projectsPattern = /(?:^|\/)data\/projects\.json(?:\?|$)/i;

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await nativeFetch(input, init);
    if (!projectsPattern.test(url) || !response.ok) return response;

    try {
      const projects = await response.clone().json();
      const corrected = (Array.isArray(projects) ? projects : []).map(project => {
        if (String(project.title || '').trim() !== 'Hôtel Miromesnil') return project;
        return {
          ...project,
          gallery: [
            'assets/uploads/miromesnil-2.jpg',
            'assets/uploads/linkedin/7490701536017403904.jpg'
          ],
          alt: 'Hôtel Leev Miromesnil, 48 rue de Miromesnil à Paris'
        };
      });

      return new Response(JSON.stringify(corrected), {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      });
    } catch (error) {
      console.warn('Surcharge de galerie Miromesnil indisponible.', error);
      return response;
    }
  };
})();
