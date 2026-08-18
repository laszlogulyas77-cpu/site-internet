(() => {
  const nativeFetch = window.fetch.bind(window);
  const baseFilePattern = /(?:^|\/)data\/project-external-images\.json(?:\?|$)/;
  const placeholderProjects = new Set([
    'Hôtel Le Pilgrim',
    'CNIT - Centre des Nouvelles Industries et Technologies',
    'Ibis Budget La Rochelle & Greet Hôtel',
    'Lacoste - Flagship Champs-Élysées',
    'Passage Jouffroy'
  ]);

  const builtInExtras = {
    'CNIT - Centre des Nouvelles Industries et Technologies': {
      images: [
        'https://upload.wikimedia.org/wikipedia/commons/e/e2/CNIT_%40_La_D%C3%A9fense_%40_Paris_%2824083156786%29.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/1/1d/CNIT_%40_La_D%C3%A9fense_%40_Paris_%288099214060%29.jpg'
      ],
      source_url: 'https://commons.wikimedia.org/wiki/Category:Centre_des_nouvelles_industries_et_technologies',
      source_label: 'CNIT, Wikimedia Commons — photographies sous licence Creative Commons'
    },
    'Passage Jouffroy': {
      images: [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Passage_Jouffroy.jpg/1920px-Passage_Jouffroy.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/7/75/PassageJouffroy1.jpg'
      ],
      source_url: 'https://commons.wikimedia.org/wiki/Category:Passage_Jouffroy_(Paris)',
      source_label: 'Passage Jouffroy, Wikimedia Commons — photographies sous licence Creative Commons'
    }
  };

  const mergeRecord = (target, title, record) => {
    if (!record || typeof record !== 'object') return;
    const current = target[title] || {};
    const images = [...new Set([
      ...(Array.isArray(current.images) ? current.images : []),
      ...(Array.isArray(record.images) ? record.images : [])
    ].map(value => String(value || '').trim()).filter(Boolean))];
    target[title] = {
      ...current,
      ...record,
      images,
      source_url: record.source_url || current.source_url || '',
      source_label: record.source_label || current.source_label || ''
    };
  };

  const mergeCollections = (...collections) => {
    const merged = {};
    collections.forEach(collection => {
      Object.entries(collection || {}).forEach(([title, record]) => mergeRecord(merged, title, record));
    });

    Object.entries(merged).forEach(([title, record]) => {
      const limit = placeholderProjects.has(title) ? 4 : 3;
      record.images = (record.images || []).slice(0, limit);
    });

    // Le script principal possède encore un ancien jeu de deux photos pour ce projet.
    // Cet alias, normalisé de la même façon, est volontairement placé après pour conserver les quatre visuels exacts.
    const ibis = merged['Ibis Budget La Rochelle & Greet Hôtel'];
    if (ibis) merged['Ibis Budget La Rochelle & Greet Hotel'] = { ...ibis, images: (ibis.images || []).slice(0, 4) };

    return merged;
  };

  window.fetch = async (input, init) => {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    if (!baseFilePattern.test(requestUrl)) return nativeFetch(input, init);

    try {
      const extraUrl = `data/project-external-images-extra.json?v=${Date.now()}`;
      const [baseResponse, extraResponse] = await Promise.all([
        nativeFetch(input, init),
        nativeFetch(extraUrl, { cache: 'no-store' })
      ]);
      if (!baseResponse.ok) return baseResponse;

      const baseData = await baseResponse.json();
      const extraData = extraResponse.ok ? await extraResponse.json() : {};
      const mergedData = mergeCollections(baseData, extraData, builtInExtras);

      return new Response(JSON.stringify(mergedData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      });
    } catch (error) {
      console.warn('Fusion des photos complémentaires indisponible.', error);
      return nativeFetch(input, init);
    }
  };
})();
