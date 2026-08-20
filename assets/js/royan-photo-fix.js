(() => {
  const previousFetch = window.fetch.bind(window);
  const projectsPattern = /(?:^|\/)data\/projects\.json(?:\?|$)/i;
  const externalImagesPattern = /(?:^|\/)data\/project-external-images\.json(?:\?|$)/i;

  const title = 'Thalazur Royan';
  const mainImage = 'https://thalazurspa.hotelroyan.com/data/Photos/OriginalPhoto/15439/1543988/1543988506.JPEG';
  const knownPreviousImages = new Set([
    'assets/uploads/thalazur-royan.jpg',
    'https://www.thalazur.fr/_hotels/assets/images/cordouan/location/header.jpg'
  ]);
  const galleryImages = [
    'https://francetoday.com/wp-content/uploads/2025/01/thalazur_royan_exterieur_piscine_DSCF9324_emma_millas.jpg',
    'https://www.guide-charente-maritime.com/_bibli/annonces/13074/hd/thalazur-royan-25-09.jpg',
    'https://www.thalazur.fr/_hotels/upload/images/header/restaurant_Royan.png'
  ];

  const jsonResponse = data => new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });

  const patchProjects = projects => (Array.isArray(projects) ? projects : []).map(project => {
    if (project?.title !== title) return project;
    const localGallery = Array.isArray(project.gallery)
      ? project.gallery.filter(Boolean)
      : project.gallery
        ? [project.gallery]
        : [];

    // Une future galerie renseignée dans Pages CMS reste prioritaire.
    if (localGallery.length >= 2 || !knownPreviousImages.has(String(project.image || ''))) return project;

    return {
      ...project,
      image: mainImage,
      alt: 'Hôtel Thalazur Royan face à l’océan'
    };
  });

  const patchExternalImages = data => ({
    ...(data || {}),
    [title]: {
      images: galleryImages,
      source_url: 'https://www.thalazur.fr/royan/hotel/galerie/',
      source_label: 'Thalazur Royan — extérieur, piscine, chambre et restaurant'
    }
  });

  window.fetch = async (input, init) => {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    const response = await previousFetch(input, init);
    if (!response.ok) return response;

    try {
      if (projectsPattern.test(requestUrl)) {
        const projects = await response.clone().json();
        return jsonResponse(patchProjects(projects));
      }
      if (externalImagesPattern.test(requestUrl)) {
        const images = await response.clone().json();
        return jsonResponse(patchExternalImages(images));
      }
    } catch (error) {
      console.warn('La sélection photo Thalazur Royan utilise la version précédente.', error);
    }

    return response;
  };
})();
