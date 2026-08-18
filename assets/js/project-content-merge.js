(() => {
  const previousFetch = window.fetch.bind(window);
  const projectsPattern = /(?:^|\/)data\/projects\.json(?:\?|$)/i;
  const externalImagesPattern = /(?:^|\/)data\/project-external-images\.json(?:\?|$)/i;

  const normalizeKey = value => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');

  const fetchJsonOr = async (path, fallback) => {
    try {
      const response = await previousFetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
      return response.ok ? response.json() : fallback;
    } catch (error) {
      console.warn(`Contenu complémentaire indisponible : ${path}`, error);
      return fallback;
    }
  };

  const jsonResponse = data => new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });

  const mergeProjects = async baseResponse => {
    const [baseProjects, extraProjects, serviceOverrides] = await Promise.all([
      baseResponse.json(),
      fetchJsonOr('data/projects-irve.json', []),
      fetchJsonOr('data/project-service-overrides.json', {})
    ]);

    const overrideIndex = new Map(
      Object.entries(serviceOverrides || {}).map(([title, services]) => [normalizeKey(title), Array.isArray(services) ? services : []])
    );

    const projects = (Array.isArray(baseProjects) ? baseProjects : []).map(project => {
      const additions = overrideIndex.get(normalizeKey(project.title)) || [];
      const existing = Array.isArray(project.services) ? project.services : [];
      return {
        ...project,
        services: [...new Set([...existing, ...additions].filter(Boolean))]
      };
    });

    const knownTitles = new Set(projects.map(project => normalizeKey(project.title)));
    (Array.isArray(extraProjects) ? extraProjects : []).forEach(project => {
      const key = normalizeKey(project?.title);
      if (!key || knownTitles.has(key)) return;
      projects.push(project);
      knownTitles.add(key);
    });

    return projects;
  };

  const mergeExternalImages = async baseResponse => {
    const [baseData, irveData] = await Promise.all([
      baseResponse.json(),
      fetchJsonOr('data/project-external-images-irve.json', {})
    ]);

    const merged = { ...(baseData || {}) };
    Object.entries(irveData || {}).forEach(([title, record]) => {
      const current = merged[title] || {};
      const images = [...new Set([
        ...(Array.isArray(current.images) ? current.images : []),
        ...(Array.isArray(record?.images) ? record.images : [])
      ].map(value => String(value || '').trim()).filter(Boolean))];

      merged[title] = {
        ...current,
        ...(record || {}),
        images: images.slice(0, 4),
        source_url: record?.source_url || current.source_url || '',
        source_label: record?.source_label || current.source_label || ''
      };
    });

    return merged;
  };

  window.fetch = async (input, init) => {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';

    if (projectsPattern.test(requestUrl)) {
      const baseResponse = await previousFetch(input, init);
      if (!baseResponse.ok) return baseResponse;
      try {
        return jsonResponse(await mergeProjects(baseResponse));
      } catch (error) {
        console.warn('Fusion des références complémentaires indisponible.', error);
        return previousFetch(input, init);
      }
    }

    if (externalImagesPattern.test(requestUrl)) {
      const baseResponse = await previousFetch(input, init);
      if (!baseResponse.ok) return baseResponse;
      try {
        return jsonResponse(await mergeExternalImages(baseResponse));
      } catch (error) {
        console.warn('Fusion des photos IRVE indisponible.', error);
        return previousFetch(input, init);
      }
    }

    return previousFetch(input, init);
  };
})();
