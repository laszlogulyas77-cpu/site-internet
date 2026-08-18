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

  const ibisOverride = {
    images: [
      'https://www.technilum.com/app/uploads/2024/08/D-La-Rochelle-hotel-ibis-2.jpg',
      'https://www.technilum.com/app/uploads/2024/08/D-La-Rochelle-hotel-ibis-3.jpg',
      'https://static.apidae-tourisme.com/filestore/objets-touristiques/images/55/63/40714039-diaporama.jpg',
      'https://cf.bstatic.com/xdata/images/hotel/max1024x768/77529584.jpg?hp=1&k=77eaafc452c757c74a08e107820628a82b6dc442ebbb37460044945d09667a0c&o='
    ],
    source_url: 'https://www.cbarchitectes.fr/projet/combo-greet-ibis-budget',
    source_label: 'Combo Greet / Ibis Budget, CBA Architectes et Office de tourisme'
  };

  // Le fichier historique du carrousel définit encore deux photos pour ce projet.
  // On remplace uniquement cette entrée au moment où son index interne est créé.
  const nativeMapSet = Map.prototype.set;
  Map.prototype.set = function(key, value) {
    if (key === 'ibisbudgetlarochellegreethotel') {
      Map.prototype.set = nativeMapSet;
      return nativeMapSet.call(this, key, ibisOverride);
    }
    return nativeMapSet.call(this, key, value);
  };

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

    return merged;
  };

  const fetchJsonOrEmpty = async url => {
    try {
      const response = await nativeFetch(url, { cache: 'no-store' });
      return response.ok ? response.json() : {};
    } catch (error) {
      console.warn(`Photos complémentaires indisponibles : ${url}`, error);
      return {};
    }
  };

  window.fetch = async (input, init) => {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    if (!baseFilePattern.test(requestUrl)) return nativeFetch(input, init);

    try {
      const version = Date.now();
      const [baseResponse, extraData, extraData2] = await Promise.all([
        nativeFetch(input, init),
        fetchJsonOrEmpty(`data/project-external-images-extra.json?v=${version}`),
        fetchJsonOrEmpty(`data/project-external-images-extra-3.json?v=${version}`)
      ]);
      if (!baseResponse.ok) return baseResponse;

      const baseData = await baseResponse.json();
      const mergedData = mergeCollections(baseData, extraData, extraData2, builtInExtras);

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
