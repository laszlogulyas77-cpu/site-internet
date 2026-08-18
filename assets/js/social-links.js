(() => {
  const fallbackLinkedIn = 'https://www.linkedin.com/company/groupe-serilec';

  const addStyles = () => {
    if (document.getElementById('serilec-social-links-style')) return;
    const style = document.createElement('style');
    style.id = 'serilec-social-links-style';
    style.textContent = `
      .footer-socials{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
      .footer-social-link{display:inline-flex;align-items:center;gap:9px;min-height:42px;padding:0 14px;border:1px solid rgba(255,255,255,.18);border-radius:999px;color:#eef4fb;font-size:.82rem;font-weight:750;transition:background .2s ease,border-color .2s ease,transform .2s ease}
      .footer-social-link svg{width:18px;height:18px;fill:currentColor;flex:0 0 auto}
      .footer-social-link:hover{background:#fff;color:#001a36;border-color:#fff;transform:translateY(-2px)}
      .footer-social-link:focus-visible{outline:3px solid #fff200;outline-offset:3px}
    `;
    document.head.appendChild(style);
  };

  const render = linkedInUrl => {
    if (!linkedInUrl) return;
    addStyles();

    document.querySelectorAll('.footer-brand').forEach(footerBrand => {
      if (footerBrand.querySelector('[data-serilec-linkedin]')) return;
      const socials = document.createElement('div');
      socials.className = 'footer-socials';
      socials.innerHTML = `
        <a class="footer-social-link" data-serilec-linkedin href="${linkedInUrl}" target="_blank" rel="noopener noreferrer" aria-label="Suivre SERILEC sur LinkedIn">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.86-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V8.99h3.41v1.57h.05c.47-.9 1.63-1.86 3.36-1.86 3.6 0 4.27 2.37 4.27 5.46v6.29zM5.33 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.11 20.45H3.55V8.99h3.56v11.46z"/></svg>
          <span>Suivre SERILEC sur LinkedIn</span>
        </a>`;
      footerBrand.appendChild(socials);
    });

    if (!document.getElementById('serilec-organization-schema')) {
      const schema = document.createElement('script');
      schema.id = 'serilec-organization-schema';
      schema.type = 'application/ld+json';
      schema.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'SERILEC',
        url: 'https://www.groupe-serilec.fr/',
        sameAs: [linkedInUrl]
      });
      document.head.appendChild(schema);
    }
  };

  const init = async () => {
    try {
      const response = await fetch(`data/site.json?v=${Date.now()}`, { cache: 'no-store' });
      const site = response.ok ? await response.json() : {};
      render(site.linkedin_url || fallbackLinkedIn);
    } catch (error) {
      console.warn('Le lien LinkedIn SERILEC utilise sa valeur de secours.', error);
      render(fallbackLinkedIn);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
