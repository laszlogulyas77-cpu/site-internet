(() => {
  const previousFetch = window.fetch.bind(window);
  const projectsPattern = /(?:^|\/)data\/projects\.json(?:\?|$)/i;
  const externalImagesPattern = /(?:^|\/)data\/project-external-images\.json(?:\?|$)/i;

  const normalizeKey = value => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');

  const isBlank = value => value === undefined || value === null || String(value).trim() === '';
  const isPlaceholderDescription = value => {
    const text = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return /reference serilec|site historique|details?.{0,100}(completer|preciser)|a completer|a preciser/.test(text);
  };

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

  const uniqueValues = values => [...new Set(
    (values || [])
      .map(value => typeof value === 'string' ? value.trim() : value)
      .filter(Boolean)
  )];

  const automaticServiceAdditions = project => {
    const title = normalizeKey(project?.title);
    const client = normalizeKey(project?.client);
    return title.includes('thalazur') || client.includes('boissee')
      ? ['Photovoltaïque']
      : [];
  };

  const shouldReplaceField = (currentValue, correction, field) => {
    if (correction[`force_${field}`] === true || isBlank(currentValue)) return true;
    const acceptedCurrentValues = correction[`replace_${field}_values`];
    if (!Array.isArray(acceptedCurrentValues)) return false;
    const currentKey = normalizeKey(currentValue);
    return acceptedCurrentValues.some(value => normalizeKey(value) === currentKey);
  };

  const applyProjectCorrection = (project, correction) => {
    if (!correction || typeof correction !== 'object') return { ...project };

    const next = { ...project };
    if (correction.description && (
      correction.force_description === true ||
      isBlank(next.description) ||
      isPlaceholderDescription(next.description)
    )) {
      next.description = correction.description;
    }

    [
      'location',
      'zone',
      'client',
      'year',
      'category',
      'category_label',
      'premium',
      'featured',
      'published',
      'image',
      'alt'
    ].forEach(field => {
      if (correction[field] === undefined) return;
      if (shouldReplaceField(next[field], correction, field)) next[field] = correction[field];
    });

    if (Array.isArray(correction.services) && correction.services.length) {
      const existing = Array.isArray(next.services) ? next.services : [];
      next.services = uniqueValues([...existing, ...correction.services]);
    }

    return next;
  };

  const mergeProjects = async baseResponse => {
    const [baseProjects, extraProjects, serviceOverrides, contentCorrections] = await Promise.all([
      baseResponse.json(),
      fetchJsonOr('data/projects-irve.json', []),
      fetchJsonOr('data/project-service-overrides.json', {}),
      fetchJsonOr('data/project-content-corrections.json', {})
    ]);

    const overrideIndex = new Map(
      Object.entries(serviceOverrides || {}).map(([title, services]) => [
        normalizeKey(title),
        Array.isArray(services) ? services : []
      ])
    );
    const correctionIndex = new Map(
      Object.entries(contentCorrections || {}).map(([title, correction]) => [
        normalizeKey(title),
        correction || {}
      ])
    );

    const enrichProject = project => {
      const projectKey = normalizeKey(project?.title);
      const corrected = applyProjectCorrection(project, correctionIndex.get(projectKey));
      const additions = [
        ...(overrideIndex.get(projectKey) || []),
        ...automaticServiceAdditions(corrected)
      ];
      const existing = Array.isArray(corrected?.services) ? corrected.services : [];
      return {
        ...corrected,
        services: uniqueValues([...existing, ...additions]),
        published: projectKey === 'urbanhive' ? true : corrected.published
      };
    };

    const projects = (Array.isArray(baseProjects) ? baseProjects : []).map(enrichProject);
    const knownTitles = new Set(projects.map(project => normalizeKey(project.title)));

    (Array.isArray(extraProjects) ? extraProjects : []).forEach(project => {
      const key = normalizeKey(project?.title);
      if (!key || knownTitles.has(key)) return;
      projects.push(enrichProject(project));
      knownTitles.add(key);
    });

    return projects;
  };

  const findRecordKey = (collection, title) => {
    const target = normalizeKey(title);
    return Object.keys(collection || {}).find(key => normalizeKey(key) === target) || title;
  };

  const mergeImageRecord = (collection, title, record, replace = false) => {
    if (!record || typeof record !== 'object') return;
    const key = findRecordKey(collection, title);
    const current = collection[key] || {};
    const { replace: ignoredReplace, ...cleanRecord } = record;
    const currentImages = Array.isArray(current.images) ? current.images : [];
    const incomingImages = Array.isArray(cleanRecord.images) ? cleanRecord.images : [];
    const images = replace
      ? uniqueValues(incomingImages)
      : uniqueValues([...currentImages, ...incomingImages]);

    collection[key] = {
      ...current,
      ...cleanRecord,
      images: images.slice(0, 12),
      source_url: cleanRecord.source_url !== undefined
        ? cleanRecord.source_url
        : current.source_url || '',
      source_label: cleanRecord.source_label !== undefined
        ? cleanRecord.source_label
        : current.source_label || ''
    };
  };

  const mergeExternalImages = async baseResponse => {
    const [baseData, irveData, corrections] = await Promise.all([
      baseResponse.json(),
      fetchJsonOr('data/project-external-images-irve.json', {}),
      fetchJsonOr('data/project-external-images-corrections.json', {})
    ]);

    const merged = { ...(baseData || {}) };
    Object.entries(irveData || {}).forEach(([title, record]) => {
      mergeImageRecord(merged, title, record, false);
    });
    Object.entries(corrections || {}).forEach(([title, record]) => {
      mergeImageRecord(merged, title, record, record?.replace === true);
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
        console.warn('Fusion des photos complémentaires indisponible.', error);
        return previousFetch(input, init);
      }
    }

    return previousFetch(input, init);
  };
})();
