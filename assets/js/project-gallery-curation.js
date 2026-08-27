(() => {
  const nativeFetch = window.fetch.bind(window);
  const projectsPattern = /(?:^|\/)data\/projects\.json(?:\?|$)/;

  const excludedByProject = new Map([
    ['Hôtel Miromesnil', new Set([
      'assets/uploads/miromesnil-3.jpg',
      'assets/uploads/miromesnil-3-1.jpg',
      'assets/uploads/miromesnil-4.jpg'
    ])]
  ]);

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await nativeFetch(input, init);
    if (!projectsPattern.test(url) || !response.ok) return response;

    try {
      const projects = await response.clone().json();
      projects.forEach(project => {
        const exclusions = excludedByProject.get(project.title);
        if (!exclusions || !Array.isArray(project.gallery)) return;
        project.gallery = project.gallery.filter(src => !exclusions.has(String(src || '').trim()));
      });

      return new Response(JSON.stringify(projects), {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      });
    } catch (error) {
      console.warn('Curation de la galerie projets indisponible.', error);
      return response;
    }
  };
})();
