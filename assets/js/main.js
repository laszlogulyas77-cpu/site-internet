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
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

const filters = document.querySelectorAll('.filter-btn');
const projects = document.querySelectorAll('.project-card[data-category]');
filters.forEach(button => button.addEventListener('click', () => {
  filters.forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  const category = button.dataset.filter;
  projects.forEach(card => {
    card.dataset.hidden = String(category !== 'all' && card.dataset.category !== category);
  });
}));

document.querySelectorAll('[data-demo-form]').forEach(form => form.addEventListener('submit', event => {
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]');
  if (!submit) return;
  const original = submit.textContent;
  submit.textContent = 'Merci — demande enregistrée';
  submit.disabled = true;
  setTimeout(() => { submit.textContent = original; submit.disabled = false; form.reset(); }, 3500);
}));
