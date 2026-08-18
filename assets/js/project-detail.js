(() => {
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
'&': '&amp;',
'<': '&lt;',
'>': '&gt;',
"'": '&#39;',
'"': '&quot;'
}[char]));
const normalizeText = value => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
const normalizeKey = value => normalizeText(value)
.normalize('NFD')
.replace(/[\u0300-\u036f]/g, '')
.replace(/[^a-z0-9]+/g, '');
const placeholderImage = 'assets/uploads/references/photo-a-ajouter.svg';
const isPlaceholderImage = value => /(?:^|\/)photo-a-ajouter\.svg(?:\?|$)/i.test(String(value || ''));
const serviceLabels = {
cfo: 'CFO',
cfa: 'CFA',
ssi: 'SSI',
gtb: 'GTB',
photovoltaique: 'Photovoltaïque',
'photovoltaïque': 'Photovoltaïque',
irve: 'IRVE'
};
let projectsPromise = null;
let externalImagesPromise = null;
let lastFocusedElement = null;
let galleryItems = [];
let galleryIndex = 0;
let activeProject = null;
let touchStartX = null;
let failedGalleryUrls = new Set();
const getProjects = () => {
if (!projectsPromise) {
projectsPromise = fetch(`data/projects.json?v=${Date.now()}`, { cache: 'no-store' })
.then(response => {
if (!response.ok) throw new Error('Impossible de charger les réalisations');
return response.json();
})
.then(items => items.filter(item => item.published !== false));
}
return projectsPromise;
};
const getExternalImages = () => {
if (!externalImagesPromise) {
externalImagesPromise = fetch(`data/project-external-images.json?v=${Date.now()}`, { cache: 'no-store' })
.then(response => {
if (!response.ok) return {};
return response.json();
})
.then(data => {
const mergedData = {
...(data || {}),
"Restaurant L'Astrance": {
images: [
'https://parisbymouth.com/wp-content/uploads/2024/01/Astrance-dining-room.jpg',
'https://parisbymouth.com/wp-content/uploads/2024/01/Kitchen-at-Astrance-restaurant-in-Paris.jpg',
'https://parisbymouth.com/wp-content/uploads/2024/01/Hallway-at-Astrance-restaurant-in-Paris.jpg'
],
source_url: 'https://parisbymouth.com/lastrance/',
source_label: 'Paris by Mouth, nouvelle adresse rue de Longchamp'
},
'Ibis Budget La Rochelle & Greet Hôtel': {
images: [
'https://www.technilum.com/app/uploads/2024/08/D-La-Rochelle-hotel-ibis-2.jpg',
'https://www.technilum.com/app/uploads/2024/08/D-La-Rochelle-hotel-ibis-3.jpg'
],
source_url: 'https://www.cbarchitectes.fr/projet/combo-greet-ibis-budget',
source_label: 'Combo Greet / Ibis Budget, CBA Architectes'
}
};
const index = new Map();
Object.entries(mergedData).forEach(([title, record]) => {
index.set(normalizeKey(title), record || {});
});
return index;
})
.catch(error => {
console.warn('Les photos complémentaires en ligne ne sont pas disponibles.', error);
return new Map();
});
}
return externalImagesPromise;
};
const modal = document.createElement('div');
modal.className = 'project-detail-modal';
modal.hidden = true;
modal.innerHTML = `
<div class="project-detail-backdrop" data-project-close></div>
<div class="project-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="project-detail-title" aria-describedby="project-detail-description">
<button class="project-detail-close" type="button" aria-label="Fermer la réalisation" data-project-close>×</button>
<div class="project-detail-media" data-project-detail-media>
<img data-project-detail-image src="" alt="">
<button class="project-gallery-arrow project-gallery-prev" type="button" aria-label="Photo précédente" data-project-gallery-prev hidden>‹</button>
<button class="project-gallery-arrow project-gallery-next" type="button" aria-label="Photo suivante" data-project-gallery-next hidden>›</button>
<div class="project-gallery-footer" data-project-gallery-footer hidden>
<div class="project-gallery-dots" data-project-gallery-dots aria-label="Navigation dans les photos"></div>
<span class="project-gallery-counter" data-project-gallery-counter></span>
</div>
</div>
<div class="project-detail-content">
<span class="project-detail-kicker" data-project-detail-category></span>
<h2 id="project-detail-title" data-project-detail-title></h2>
<p class="project-detail-location" data-project-detail-location></p>
<p class="project-detail-description" id="project-detail-description" data-project-detail-description></p>
<div class="project-detail-meta" data-project-detail-meta></div>
<div class="project-detail-services" data-project-detail-services></div>
<p class="project-detail-photo-source" data-project-detail-photo-source hidden>
<span>Photo complémentaire : </span><a href="" target="_blank" rel="noopener noreferrer" data-project-detail-photo-source-link></a>
</p>
</div>
</div>`;
document.body.appendChild(modal);
const collectCards = root => {
if (!root || root.nodeType !== 1) return [];
const cards = [];
if (root.matches?.('.project-card')) cards.push(root);
root.querySelectorAll?.('.project-card').forEach(card => cards.push(card));
return cards;
};
const findProjectForCard = (projects, card) => {
const cardTitle = normalizeText(card.querySelector('h3')?.textContent);
if (!cardTitle) return null;
return projects.find(item => normalizeText(item.title) === cardTitle) || null;
};
const getLocalImageUrls = project => {
const extraImages = Array.isArray(project.gallery) ? project.gallery : project.gallery ? [project.gallery] : [];
return [...new Set([project.image, ...extraImages]
.map(value => typeof value === 'string' ? value.trim() : '')
.filter(Boolean))];
};
const getRealLocalImageUrls = project => getLocalImageUrls(project).filter(url => !isPlaceholderImage(url));
const getExternalRecord = (project, externalIndex) => externalIndex.get(normalizeKey(project.title)) || null;
const getGalleryItems = (project, externalIndex) => {
const localImages = getRealLocalImageUrls(project);
const items = localImages.map(url => ({ url, external: false }));
if (localImages.length < 2) {
const record = getExternalRecord(project, externalIndex);
const externalImages = Array.isArray(record?.images) ? record.images : [];
externalImages
.map(value => typeof value === 'string' ? value.trim() : '')
.filter(Boolean)
.forEach(url => {
if (items.some(item => item.url === url)) return;
items.push({
url,
external: true,
sourceUrl: record.source_url || '',
sourceLabel: record.source_label || 'Source de la photo'
});
});
}
if (!items.length) items.push({ url: project.image || placeholderImage, external: false });
return items;
};
const enhanceCard = card => {
if (card.dataset.projectDetailReady !== 'true') {
card.dataset.projectDetailReady = 'true';
card.setAttribute('role', 'button');
card.setAttribute('tabindex', '0');
const title = card.querySelector('h3')?.textContent?.trim() || 'cette réalisation';
card.setAttribute('aria-label', `Voir la réalisation ${title}`);
const overlay = card.querySelector('.project-overlay');
if (overlay && !overlay.querySelector('.project-open-hint')) {
const hint = document.createElement('span');
hint.className = 'project-open-hint';
hint.innerHTML = 'Voir le projet <span aria-hidden="true">↗</span>';
overlay.appendChild(hint);
}
}
};
const applyExternalCardFallback = async card => {
if (card.dataset.externalPhotoChecked === 'true') return;
card.dataset.externalPhotoChecked = 'true';
try {
const [projects, externalIndex] = await Promise.all([getProjects(), getExternalImages()]);
const project = findProjectForCard(projects, card);
if (!project || getRealLocalImageUrls(project).length) return;
const record = getExternalRecord(project, externalIndex);
const candidates = Array.isArray(record?.images) ? record.images.filter(Boolean) : [];
if (!candidates.length) return;
const image = card.querySelector(':scope > img') || card.querySelector('img');
if (!image) return;
let candidateIndex = 0;
const tryNextImage = () => {
if (candidateIndex >= candidates.length) {
image.onerror = null;
image.src = project.image || placeholderImage;
return;
}
image.src = candidates[candidateIndex++];
};
image.loading = 'lazy';
image.decoding = 'async';
image.onerror = tryNextImage;
image.alt = project.alt || project.title || 'Réalisation SERILEC';
tryNextImage();
} catch (error) {
console.warn('La photo complémentaire de la vignette n’a pas pu être chargée.', error);
}
};
const decorateCards = root => {
collectCards(root).forEach(card => {
enhanceCard(card);
applyExternalCardFallback(card);
});
};
const renderMeta = project => {
const zone = project.zone || project.geo_zone || '';
const zoneLabel = zone === 'paris'
? 'Paris'
: zone === 'idf'
? 'Île-de-France hors Paris'
: zone === 'france'
? 'France hors Île-de-France'
: zone;
const items = [
project.client ? ['Maître d’ouvrage / client', project.client] : null,
project.year ? ['Année', project.year] : null,
zoneLabel ? ['Zone', zoneLabel] : null
].filter(Boolean);
return items.map(([label, value]) => `<div class="project-detail-meta-item"><span class="project-detail-meta-label">${escapeHtml(label)}</span><span class="project-detail-meta-value">${escapeHtml(value)}</span></div>`).join('');
};
const renderServices = project => {
if (!Array.isArray(project.services) || !project.services.length) return '';
return [...new Set(project.services
.map(value => serviceLabels[String(value || '').toLowerCase()] || String(value || '').toUpperCase())
.filter(Boolean))]
.map(label => `<span class="project-detail-service">${escapeHtml(label)}</span>`)
.join('');
};
const updatePhotoSource = item => {
const source = modal.querySelector('[data-project-detail-photo-source]');
const link = modal.querySelector('[data-project-detail-photo-source-link]');
if (!source || !link) return;
if (!item?.external || !item.sourceUrl) {
source.hidden = true;
link.removeAttribute('href');
link.textContent = '';
return;
}
source.hidden = false;
link.href = item.sourceUrl;
link.textContent = item.sourceLabel || 'Voir la source';
};
const showGalleryImage = (index, failedAttempts = 0) => {
if (!galleryItems.length || !activeProject) return;
galleryIndex = (index + galleryItems.length) % galleryItems.length;
const item = galleryItems[galleryIndex];
const image = modal.querySelector('[data-project-detail-image]');
image.onerror = () => {
image.onerror = null;
failedGalleryUrls.add(item.url);
if (galleryItems.length > 1 && failedAttempts < galleryItems.length - 1) {
showGalleryImage(galleryIndex + 1, failedAttempts + 1);
return;
}
image.src = placeholderImage;
updatePhotoSource(null);
};
image.src = item.url;
image.alt = galleryIndex === 0 && activeProject.alt
? activeProject.alt
: `Photo ${galleryIndex + 1} sur ${galleryItems.length} — ${activeProject.title || 'Réalisation SERILEC'}`;
modal.querySelectorAll('[data-project-gallery-index]').forEach(dot => {
const active = Number(dot.dataset.projectGalleryIndex) === galleryIndex;
dot.classList.toggle('active', active);
dot.setAttribute('aria-current', active ? 'true' : 'false');
});
const counter = modal.querySelector('[data-project-gallery-counter]');
if (counter) counter.textContent = `${galleryIndex + 1} / ${galleryItems.length}`;
updatePhotoSource(item);
};
const setupGallery = (project, externalIndex) => {
activeProject = project;
galleryItems = getGalleryItems(project, externalIndex);
galleryIndex = 0;
failedGalleryUrls = new Set();
const hasGallery = galleryItems.length > 1;
const prev = modal.querySelector('[data-project-gallery-prev]');
const next = modal.querySelector('[data-project-gallery-next]');
const footer = modal.querySelector('[data-project-gallery-footer]');
const dots = modal.querySelector('[data-project-gallery-dots]');
prev.hidden = !hasGallery;
next.hidden = !hasGallery;
footer.hidden = !hasGallery;
dots.innerHTML = hasGallery
? galleryItems.map((_, index) => `<button class="project-gallery-dot${index === 0 ? ' active' : ''}" type="button" data-project-gallery-index="${index}" aria-label="Voir la photo ${index + 1}" aria-current="${index === 0 ? 'true' : 'false'}"></button>`).join('')
: '';
showGalleryImage(0);
};
const openProject = async card => {
try {
const [projects, externalIndex] = await Promise.all([getProjects(), getExternalImages()]);
const project = findProjectForCard(projects, card);
if (!project) return;
lastFocusedElement = document.activeElement;
setupGallery(project, externalIndex);
modal.querySelector('[data-project-detail-category]').textContent = project.category_label || 'Réalisation';
modal.querySelector('[data-project-detail-title]').textContent = project.title || '';
const location = modal.querySelector('[data-project-detail-location]');
location.textContent = project.location || '';
location.hidden = !project.location;
modal.querySelector('[data-project-detail-description]').textContent = project.description || '';
const meta = modal.querySelector('[data-project-detail-meta]');
meta.innerHTML = renderMeta(project);
meta.hidden = !meta.innerHTML;
const services = modal.querySelector('[data-project-detail-services]');
services.innerHTML = renderServices(project);
services.hidden = !services.innerHTML;
modal.hidden = false;
document.body.classList.add('project-modal-open');
requestAnimationFrame(() => modal.classList.add('is-open'));
modal.querySelector('.project-detail-close')?.focus();
} catch (error) {
console.warn('Ouverture de la réalisation indisponible.', error);
}
};
const closeProject = () => {
if (modal.hidden) return;
modal.classList.remove('is-open');
document.body.classList.remove('project-modal-open');
window.setTimeout(() => {
modal.hidden = true;
activeProject = null;
galleryItems = [];
failedGalleryUrls = new Set();
updatePhotoSource(null);
if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus();
}, 220);
};
document.addEventListener('click', event => {
if (event.target.closest('[data-project-close]')) {
closeProject();
return;
}
if (event.target.closest('[data-project-gallery-prev]')) {
showGalleryImage(galleryIndex - 1);
return;
}
if (event.target.closest('[data-project-gallery-next]')) {
showGalleryImage(galleryIndex + 1);
return;
}
const dot = event.target.closest('[data-project-gallery-index]');
if (dot) {
showGalleryImage(Number(dot.dataset.projectGalleryIndex));
return;
}
const card = event.target.closest('.project-card[data-project-detail-ready="true"]');
if (!card || event.target.closest('a,button')) return;
openProject(card);
});
document.addEventListener('keydown', event => {
if (!modal.hidden) {
if (event.key === 'Escape') {
closeProject();
return;
}
if (galleryItems.length > 1 && event.key === 'ArrowLeft') {
event.preventDefault();
showGalleryImage(galleryIndex - 1);
return;
}
if (galleryItems.length > 1 && event.key === 'ArrowRight') {
event.preventDefault();
showGalleryImage(galleryIndex + 1);
return;
}
}
if ((event.key === 'Enter' || event.key === ' ') && modal.hidden) {
const card = event.target.closest?.('.project-card[data-project-detail-ready="true"]');
if (card) {
event.preventDefault();
openProject(card);
}
}
});
const media = modal.querySelector('[data-project-detail-media]');
media.addEventListener('touchstart', event => {
touchStartX = event.touches?.[0]?.clientX ?? null;
}, { passive: true });
media.addEventListener('touchend', event => {
if (touchStartX === null || galleryItems.length < 2) return;
const touchEndX = event.changedTouches?.[0]?.clientX;
if (typeof touchEndX !== 'number') return;
const delta = touchEndX - touchStartX;
touchStartX = null;
if (Math.abs(delta) < 45) return;
showGalleryImage(delta > 0 ? galleryIndex - 1 : galleryIndex + 1);
}, { passive: true });
decorateCards(document.body);
const observer = new MutationObserver(mutations => {
mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
if (node.nodeType === 1) decorateCards(node);
}));
});
observer.observe(document.body, { childList: true, subtree: true });
})();
