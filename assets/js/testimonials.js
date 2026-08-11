(() => {
  const ROTATION_MS = 6500;

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const versionedAsset = src => {
    if (!src || /^https?:\/\//i.test(src) || src.startsWith('data:')) return src;
    return `${src}${src.includes('?') ? '&' : '?'}v=${Date.now()}`;
  };

  const renderTestimonial = (item, index) => {
    const logo = item.logo ? `<img src="${escapeHtml(versionedAsset(item.logo))}" alt="Logo ${escapeHtml(item.company)}" loading="lazy"><span class="testimonial-logo-fallback" hidden>${escapeHtml(item.company)}</span>` : `<span class="testimonial-logo-fallback">${escapeHtml(item.company)}</span>`;
    const author = item.author_name ? `<span class="testimonial-author">${escapeHtml(item.author_name)}</span>` : '';
    const role = item.author_role ? `<span class="testimonial-role">${escapeHtml(item.author_role)}</span>` : '';
    const project = item.project ? `<span class="testimonial-project">Projet : ${escapeHtml(item.project)}</span>` : '';

    return `<article class="testimonial-slide" data-testimonial-slide aria-hidden="${index === 0 ? 'false' : 'true'}">
      <div class="testimonial-logo-panel">${logo}</div>
      <div class="testimonial-content">
        <blockquote class="testimonial-quote">${escapeHtml(item.quote)}</blockquote>
        <div class="testimonial-signature">
          ${author}${role}<span class="testimonial-company">${escapeHtml(item.company)}</span>${project}
        </div>
      </div>
    </article>`;
  };

  const init = async () => {
    const section = document.querySelector('[data-testimonials-section]');
    const shell = document.querySelector('[data-testimonials-shell]');
    const track = document.querySelector('[data-testimonials-track]');
    const dots = document.querySelector('[data-testimonials-dots]');
    const previous = document.querySelector('[data-testimonial-prev]');
    const next = document.querySelector('[data-testimonial-next]');
    if (!section || !shell || !track || !dots) return;

    try {
      const response = await fetch(`data/testimonials.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Impossible de charger les témoignages clients.');
      const items = (await response.json()).filter(item => item.published !== false && item.company && item.quote);
      if (!items.length) return;

      track.innerHTML = items.map(renderTestimonial).join('');
      dots.innerHTML = items.map((item, index) => `<button class="testimonial-dot${index === 0 ? ' active' : ''}" type="button" data-testimonial-dot="${index}" aria-label="Afficher le témoignage ${index + 1}" aria-current="${index === 0 ? 'true' : 'false'}"></button>`).join('');
      section.hidden = false;
      shell.classList.toggle('is-single', items.length === 1);

      track.querySelectorAll('.testimonial-logo-panel img').forEach(image => {
        image.addEventListener('error', () => {
          image.hidden = true;
          const fallback = image.nextElementSibling;
          if (fallback) fallback.hidden = false;
        }, { once: true });
      });

      let current = 0;
      let timer = null;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const show = index => {
        current = (index + items.length) % items.length;
        track.style.transform = `translateX(-${current * 100}%)`;
        track.querySelectorAll('[data-testimonial-slide]').forEach((slide, slideIndex) => {
          slide.setAttribute('aria-hidden', String(slideIndex !== current));
        });
        dots.querySelectorAll('[data-testimonial-dot]').forEach((dot, dotIndex) => {
          const active = dotIndex === current;
          dot.classList.toggle('active', active);
          dot.setAttribute('aria-current', String(active));
        });
      };

      const stop = () => {
        if (timer) window.clearInterval(timer);
        timer = null;
      };

      const start = () => {
        stop();
        if (items.length < 2 || reduceMotion || document.hidden) return;
        timer = window.setInterval(() => show(current + 1), ROTATION_MS);
      };

      previous?.addEventListener('click', () => {
        show(current - 1);
        start();
      });
      next?.addEventListener('click', () => {
        show(current + 1);
        start();
      });
      dots.addEventListener('click', event => {
        const dot = event.target.closest('[data-testimonial-dot]');
        if (!dot) return;
        show(Number(dot.dataset.testimonialDot));
        start();
      });

      shell.addEventListener('mouseenter', stop);
      shell.addEventListener('mouseleave', start);
      shell.addEventListener('focusin', stop);
      shell.addEventListener('focusout', event => {
        if (!shell.contains(event.relatedTarget)) start();
      });
      document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());

      show(0);
      start();
    } catch (error) {
      console.warn(error);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
