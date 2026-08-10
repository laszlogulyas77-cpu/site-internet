const brandStyles = document.createElement('link');
brandStyles.rel = 'stylesheet';
brandStyles.href = 'assets/css/serilec-brand.css';
document.head.appendChild(brandStyles);

const applyBrandLogo = (src = 'assets/img/logo-serilec.svg') => {
  document.querySelectorAll('.logo, .footer-logo').forEach(container => {
    container.innerHTML = `<img class="brand-logo" data-cms-logo src="${src}" alt="Logo SERILEC">`;
  });
};
applyBrandLogo();

const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-links');
if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? '✕' : '☰';
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.textContent = '☰';
  }));
}

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });
const observeReveals = () => document.querySelectorAll('.reveal:not(.is-visible)').forEach(el => observer.observe(el));
observeReveals();

document.addEventListener('click', event => {
  const button = event.target.closest('.filter-btn');
  if (!button) return;
  document.querySelectorAll('.filter-btn').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  const filter = button.dataset.filter;
  document.querySelectorAll('.project-card[data-category]').forEach(card => {
    const visible = filter === 'all' || card.dataset.category === filter || (filter === 'premium' && card.dataset.premium === 'true');
    card.dataset.hidden = String(!visible);
  });
});

document.addEventListener('cms:projects-rendered', observeReveals);

document.querySelectorAll('[data-demo-form]').forEach(form => form.addEventListener('submit', event => {
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]');
  if (!submit) return;
  const original = submit.textContent;
  submit.textContent = 'Merci — demande enregistrée';
  submit.disabled = true;
  setTimeout(() => { submit.textContent = original; submit.disabled = false; form.reset(); }, 3500);
}));
