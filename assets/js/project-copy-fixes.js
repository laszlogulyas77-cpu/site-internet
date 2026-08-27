(() => {
  const previousFetch = window.fetch.bind(window);
  const projectsPattern = /(?:^|\/)data\/projects\.json(?:\?|$)/i;
  const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');

  const fixes = new Map([
    ['hotelmiromesnil', {
      description: "Hôtel 4 étoiles situé dans le 8e arrondissement de Paris. Ancien immeuble de bureaux transformé en hôtel de 37 chambres sur 7 niveaux. SERILEC a accompagné le client sur les installations de courant fort, courant faible et CVC."
    }],
    ['hotellopalenoire', { description: "Hôtel Bellechasse transformé et rénové en L'Opale Noire. Courants forts et faibles repensés, SSI déployé sur l'ensemble du site, sonorisation et éclairage décoratif remis au goût du jour." }],
    ['hotelmercureangouleme', { description: "Hôtel 4 étoiles de 85 chambres rénovées, avec reprise complète de la cuisine professionnelle, des services généraux et du restaurant." }],
    ['polemedicalchessy', { description: "Aménagement électrique de 105 cabinets, des parties communes et de deux niveaux de sous-sols. Lot CFO/CFA complet, mise en place d'une GTB autonome pour l'ensemble du bâtiment et éclairage décoratif haut de gamme." }],
    ['restaurantletaillevent', { description: "Restaurant de renommée, pour lequel SERILEC a réalisé l'ensemble des lots techniques électricité : CFO, CFA, SSI, contrôle d'accès et vidéosurveillance." }],
    ['hagerelectroshowroombureaux', { description: "Rénovation lourde d'un immeuble de bureaux pour l’aménagement d'un showroom et des bureaux Hager Electro. Courants forts et courants faibles réalisés, avec SSI et intégration complète d'une GTB." }]
  ]);

  const galleryExclusions = new Map([
    ['hotelmiromesnil', new Set([
      'assets/uploads/miromesnil-3.jpg',
      'assets/uploads/miromesnil-3-1.jpg',
      'assets/uploads/miromesnil-4.jpg'
    ])]
  ]);

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const response = await previousFetch(input, init);
    if (!projectsPattern.test(url) || !response.ok) return response;
    try {
      const items = await response.json();
      const corrected = (Array.isArray(items) ? items : []).map(item => {
        const key = normalize(item.title);
        const next = { ...item, ...(fixes.get(key) || {}) };
        const exclusions = galleryExclusions.get(key);
        if (exclusions && Array.isArray(next.gallery)) {
          next.gallery = next.gallery.filter(src => !exclusions.has(String(src || '').trim()));
        }
        return next;
      });
      return new Response(JSON.stringify(corrected), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
    } catch (error) {
      console.warn('Corrections éditoriales des projets indisponibles.', error);
      return response;
    }
  };
})();
