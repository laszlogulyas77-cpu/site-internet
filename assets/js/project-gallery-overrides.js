(() => {
  const nativeFetch = window.fetch.bind(window);
  const projectsPattern = /(?:^|\/)data\/projects\.json(?:\?|$)/i;
  const externalPattern = /(?:^|\/)data\/project-external-images\.json(?:\?|$)/i;

  const miromesnilExternal = {
    images: [
      'https://h-img1.us2.cloudbeds.com/uploads/186166809841792/1~~6a5ea76065639.jpg',
      'https://h-img2.us2.cloudbeds.com/uploads/186166809841792/1~~6a5ea8f0bd64a.jpg',
      'https://h-img1.us2.cloudbeds.com/uploads/186166809841792/1~~6a5ea9b2a0e98.jpeg',
      'https://h-img3.us2.cloudbeds.com/uploads/186166809841792/1~~6a5eaabc0b62d.jpg'
    ],
    source_url: 'https://us2.cloudbeds.com/reservation/3nrjRV',
    source_label: 'Leev Miromesnil — galerie officielle de réservation'
  };

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await nativeFetch(input, init);
    if (!response.ok) return response;

    if (projectsPattern.test(url)) {
      try {
        const projects = await response.clone().json();
        const corrected = (Array.isArray(projects) ? projects : []).map(project => {
          if (String(project.title || '').trim() !== 'Hôtel Miromesnil') return project;
          return {
            ...project,
            // On garde la photo SERILEC principale, puis project-detail.js ajoute
            // les visuels officiels ci-dessous comme photos complémentaires.
            gallery: [],
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
    }

    if (externalPattern.test(url)) {
      try {
        const data = await response.clone().json();
        return new Response(JSON.stringify({
          ...(data || {}),
          'Hôtel Miromesnil': miromesnilExternal
        }), {
          status: response.status,
          statusText: response.statusText,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
          }
        });
      } catch (error) {
        console.warn('Photos officielles Miromesnil indisponibles.', error);
        return response;
      }
    }

    return response;
  };
})();
