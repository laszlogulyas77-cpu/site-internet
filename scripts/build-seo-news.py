#!/usr/bin/env python3
"""Génère les actualités SEO à partir de contenus SERILEC déjà publiés et approuvés.

Aucune récupération réseau. Les nouvelles découvertes LinkedIn restent invisibles
jusqu'à validation explicite de leur activity_id dans data/seo-approved-activities.json.
Exécuter avant prepare-production.py et augment-sitemap-articles.py, puis --verify.
"""
from __future__ import annotations

import argparse
import html
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://www.groupe-serilec.fr'
NEWS = ROOT / 'data/news.json'
APPROVED = ROOT / 'data/seo-approved-activities.json'
INDEX = ROOT / 'actualites.html'
ARTICLES = ROOT / 'actualites'
MARKER = '<!-- GENERATED_BY_SERILEC_SEO_NEWS -->'
EXISTING = {
    'Coordination chantier : plusieurs métiers, un même objectif': 'actualites/coordination-chantier.html',
    'Évolution d’équipe : Éric Arasse et Constantin Sinnesal prennent de nouvelles responsabilités': 'actualites/evolution-equipe-eric-arasse-constantin-sinnesal.html',
    'SERILEC dévoile son nouveau site internet': 'actualites/nouveau-site-serilec.html',
    'La rentrée est lancée chez SERILEC': 'actualites/rentree-2026.html',
    'Ronan Perennes : une relation de confiance construite dans la durée': 'actualites/temoignage-client-hotellerie-opale-noire-rayz-vendome.html',
}
MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']


def clean(value: object) -> str:
    return str(value or '').strip()


def h(value: object) -> str:
    return html.escape(clean(value), quote=True)


def activity_id(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in ('www.linkedin.com', 'fr.linkedin.com', 'linkedin.com'):
        raise ValueError(f'Source LinkedIn invalide : {url}')
    if not (parsed.path.startswith('/posts/groupe-serilec_') or parsed.path.startswith('/feed/update/urn:li:activity:')):
        raise ValueError(f'URL LinkedIn non attribuable au flux SERILEC : {url}')
    match = re.search(r'activity[:-](\d{16,20})', parsed.path)
    if not match:
        raise ValueError(f'Identifiant LinkedIn absent : {url}')
    return match.group(1)


def checked_date(item: dict, aid: str) -> date:
    try:
        published = date.fromisoformat(clean(item.get('date')))
        from_id = datetime.fromtimestamp((int(aid) >> 22) / 1000, tz=timezone.utc).date()
    except (ValueError, OverflowError) as exc:
        raise ValueError(f'Date LinkedIn invalide : {item.get("title")}') from exc
    if published > date.today() or abs((published - from_id).days) > 1:
        raise ValueError(f'Date incohérente : {item.get("title")}, site={published}, LinkedIn={from_id}')
    return published


def read_entries() -> list[dict]:
    entries = json.loads(NEWS.read_text(encoding='utf-8'))
    approvals = json.loads(APPROVED.read_text(encoding='utf-8'))['approved_activity_ids']
    if len(approvals) != len(set(approvals)):
        raise ValueError('Doublons dans la liste des publications approuvées')
    approved = set(approvals)
    seen_ids: set[str] = set()
    seen_content: set[tuple[str, str]] = set()
    published: list[dict] = []
    for item in entries:
        url = clean(item.get('link'))
        aid = activity_id(url)
        if aid in seen_ids:
            raise ValueError(f'Doublon LinkedIn dans data/news.json : {aid}')
        seen_ids.add(aid)
        when = checked_date(item, aid)
        if item.get('published') is not True:
            continue
        if aid not in approved:
            raise ValueError(f'Publication non validée bloquée : {aid} ({item.get("title")})')
        title = clean(item.get('title'))
        body = clean(item.get('content'))
        if len(title) < 8 or len(body) < 180:
            raise ValueError(f'Contenu insuffisant pour publier : {aid}')
        fingerprint = (title.casefold(), body.casefold())
        if fingerprint in seen_content:
            raise ValueError(f'Actualité en doublon : {title}')
        seen_content.add(fingerprint)
        item['_id'] = aid
        item['_when'] = when
        published.append(item)
    published.sort(key=lambda item: (item['_when'], int(item['_id'])), reverse=True)
    return published


def page_for(item: dict) -> tuple[str, bool]:
    path = clean(item.get('page')) or EXISTING.get(clean(item.get('title')))
    generated = f'actualites/linkedin-{item["_id"]}.html'
    if path == generated:
        return path, True
    if path:
        if not path.startswith('actualites/') or '..' in Path(path).parts or not path.endswith('.html'):
            raise ValueError(f'Chemin de page non sûr : {path}')
        if not (ROOT / path).is_file():
            raise ValueError(f'Page éditoriale manquante : {path}')
        return path, False
    return generated, True


def local_image(item: dict) -> str:
    image = clean(item.get('image')).lstrip('/')
    if not image.startswith('assets/uploads/') or '..' in Path(image).parts:
        return ''
    return image if (ROOT / image).is_file() else ''


def indexable(item: dict) -> bool:
    category = clean(item.get('category')).casefold()
    return len(clean(item.get('content'))) >= 320 and category not in {"vie de l'entreprise", 'engagement'}


def french_date(d: date) -> str:
    return f'{d.day} {MONTHS[d.month - 1]} {d.year}'


def article_html(item: dict, path: str) -> str:
    title = clean(item['title'])
    excerpt = clean(item.get('excerpt')) or clean(item['content'])[:155]
    description = excerpt[:157].rsplit(' ', 1)[0].rstrip(' ,;:') if len(excerpt) > 157 else excerpt
    canonical = f'{BASE}/{path}'
    image = local_image(item)
    image_url = f'{BASE}/{image}' if image else ''
    date_str = item['_when'].isoformat()
    robots = 'index,follow,max-image-preview:large' if indexable(item) else 'noindex,follow'
    schema = {
        '@context': 'https://schema.org', '@type': 'Article',
        'headline': title, 'description': description, 'datePublished': date_str,
        'dateModified': date_str, 'inLanguage': 'fr-FR',
        'mainEntityOfPage': canonical,
        'author': {'@type': 'Organization', 'name': 'SERILEC', 'url': f'{BASE}/'},
        'publisher': {'@type': 'Organization', 'name': 'SERILEC', 'url': f'{BASE}/'},
        'isBasedOn': clean(item['link']),
    }
    if image_url:
        schema['image'] = image_url
    json_ld = json.dumps(schema, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    paragraphs = [f'<p>{h(part)}</p>' for part in re.split(r'\n\s*\n', clean(item['content'])) if part.strip()]
    image_html = f'<img src="/{h(image)}" alt="{h(item.get("alt") or title)}" loading="eager" style="width:100%;max-height:480px;object-fit:cover;border-radius:16px;margin-bottom:24px">' if image else ''
    og_image = f'<meta property="og:image" content="{h(image_url)}">' if image else ''
    og_image += f'<meta property="article:published_time" content="{date_str}">'
    extra_link = '/competences.html'
    if 'hôtel' in (title + ' ' + clean(item.get('content'))).lower():
        extra_link = '/electricite-hotellerie-paris.html'
    elif 'maintenance' in (title + ' ' + clean(item.get('content'))).lower():
        extra_link = '/maintenance-electrique-tertiaire-paris-ile-de-france.html'
    elif 'cfo' in (title + ' ' + clean(item.get('content'))).lower():
        extra_link = '/cfo-cfa-paris-ile-de-france.html'
    return f'''<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#041b34"><title>{h(title)} | SERILEC</title><meta name="description" content="{h(description)}"><meta name="robots" content="{robots}"><link rel="canonical" href="{h(canonical)}"><meta property="og:type" content="article"><meta property="og:title" content="{h(title)}"><meta property="og:description" content="{h(description)}"><meta property="og:url" content="{h(canonical)}">{og_image}<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/css/styles.css"><link rel="stylesheet" href="/assets/css/brand-fix.css?v=20260921-news"><script type="application/ld+json">{json_ld}</script></head><body>{MARKER}<header class="site-header"><div class="container nav-wrap"><a class="logo" href="/" aria-label="SERILEC — Accueil"><img class="brand-logo" src="/assets/img/logo-serilec.svg" alt="SERILEC"></a><button class="menu-toggle" aria-label="Ouvrir le menu" aria-expanded="false">☰</button><nav class="nav-links" aria-label="Navigation principale"><a href="/">Accueil</a><a href="/competences.html">Compétences</a><a href="/projets.html">Projets réalisés</a><a href="/partenaires.html">Clients &amp; Partenaires</a><a class="active" href="/actualites.html">Actualités</a><a class="nav-cta" href="/#contact">Nous contacter</a></nav></div></header><main><section class="page-hero actualites"><div class="container reveal is-visible"><span class="eyebrow">{h(item.get('category') or 'Actualités')}</span><h1>{h(title)}</h1></div></section><section class="section"><div class="container"><article class="card" style="max-width:960px;margin:0 auto;padding:28px">{image_html}<p class="news-meta"><time datetime="{date_str}">{french_date(item['_when'])}</time> • {h(item.get('category') or 'Actualités')}</p>{''.join(paragraphs)}<p style="display:flex;flex-wrap:wrap;gap:12px;margin-top:24px"><a class="btn btn-primary" href="{extra_link}">Découvrir nos compétences</a><a class="btn btn-outline" href="/projets.html">Nos réalisations</a></p><p><a href="{h(item['link'])}" target="_blank" rel="noopener noreferrer">Publication originale sur LinkedIn ↗</a></p><p><a href="/actualites.html">← Toutes les actualités SERILEC</a></p></article></div></section></main><footer class="site-footer"><div class="container"><div class="footer-bottom"><span>© 2026 SERILEC</span><span>Entreprise générale d’électricité — Cesson</span></div></div></footer><script src="/assets/js/main.js?v=20260921-news"></script></body></html>\n'''


def card_html(item: dict) -> str:
    path = clean(item['page'])
    image = local_image(item)
    image_html = f'<img src="/{h(image)}" alt="{h(item.get("alt") or item["title"])}" loading="lazy">' if image else ''
    when = item['_when']
    return (f'<article class="card news-card reveal is-visible">{image_html}'
            f'<div class="news-card-content"><span class="news-meta">{h(item.get("category"))} • '
            f'<time datetime="{when.isoformat()}">{french_date(when)}</time></span>'
            f'<h3>{h(item["title"])}</h3><p>{h(item.get("excerpt"))}</p>'
            f'<a class="news-link" href="/{h(path)}">Lire l’article</a></div></article>')


def replace_slot(source: str, attribute: str, content: str) -> str:
    start = f'<!-- SEO_{attribute}_START -->'
    end = f'<!-- SEO_{attribute}_END -->'
    block = start + content + end
    if start in source and end in source:
        return re.sub(re.escape(start) + r'.*?' + re.escape(end), lambda _: block, source, count=1, flags=re.S)
    tag = {'FEATURED': '<div class="news-grid" data-cms-featured-news aria-live="polite"></div>',
           'ARCHIVE': '<div class="news-grid" data-cms-news></div>'}[attribute]
    if source.count(tag) != 1:
        raise ValueError(f'Conteneur Actualités introuvable ou ambigu : {attribute}')
    return source.replace(tag, tag.replace('></div>', '>' + block + '</div>'), 1)


def build() -> None:
    entries = json.loads(NEWS.read_text(encoding='utf-8'))
    published = read_entries()
    assigned = {}
    generated = set()
    for item in published:
        path, should_generate = page_for(item)
        if path in assigned:
            raise ValueError(f'Deux actualités pointent vers la même page : {path}')
        assigned[path] = item['_id']
        item['page'] = path
        if should_generate:
            target = ROOT / path
            if target.exists() and MARKER not in target.read_text(encoding='utf-8'):
                raise ValueError(f'Page manuelle protégée contre un écrasement : {path}')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(article_html(item, path), encoding='utf-8')
            generated.add(target)

    for stale in ARTICLES.glob('linkedin-*.html'):
        if stale not in generated:
            if MARKER not in stale.read_text(encoding='utf-8'):
                raise ValueError(f'Fichier non généré protégé : {stale}')
            stale.unlink()

    pages_by_id = {item['_id']: item['page'] for item in published}
    for item in entries:
        aid = activity_id(clean(item['link']))
        if aid in pages_by_id:
            item['page'] = pages_by_id[aid]
        elif clean(item.get('page')).startswith('actualites/linkedin-'):
            item.pop('page', None)
    entries.sort(key=lambda item: (clean(item.get('date')), int(activity_id(clean(item.get('link'))))), reverse=True)
    NEWS.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    index = INDEX.read_text(encoding='utf-8')
    index = replace_slot(index, 'FEATURED', ''.join(card_html(item) for item in published[:3]))
    index = replace_slot(index, 'ARCHIVE', ''.join(card_html(item) for item in published[3:]))
    if len(published) > 3:
        index = index.replace('data-news-section hidden', 'data-news-section')
    INDEX.write_text(index, encoding='utf-8')
    print(f'Actualités approuvées : {len(published)} ; pages HTML générées : {len(generated)} ; pages éditoriales préservées : {len(published)-len(generated)}.')


def verify() -> None:
    published = read_entries()
    index = INDEX.read_text(encoding='utf-8')
    sitemap = ElementTree.parse(ROOT / 'sitemap.xml').getroot()
    urls = [node.text for node in sitemap.iter() if node.tag.endswith('loc')]
    if len(urls) != len(set(urls)):
        raise ValueError('URLs en doublon dans le sitemap')
    for item in published:
        path = clean(item.get('page'))
        if not path or not (ROOT / path).is_file():
            raise ValueError(f'Page manquante : {item["title"]}')
        if f'href="/{h(path)}"' not in index:
            raise ValueError(f'Lien HTML statique absent : {path}')
        content = (ROOT / path).read_text(encoding='utf-8')
        url = f'{BASE}/{path}'
        if f'<link rel="canonical" href="{h(url)}"' not in content:
            raise ValueError(f'Canonical absente ou incorrecte : {path}')
        noindex = bool(re.search(r'<meta\s+name="robots"\s+content="noindex', content, re.I))
        if (url in urls) == noindex:
            raise ValueError(f'Sitemap et robots incohérents : {path}')
        if path.startswith('actualites/linkedin-'):
            if MARKER not in content or f'"datePublished":"{item["_when"].isoformat()}"' not in content:
                raise ValueError(f'Article généré non conforme : {path}')
    order = [date.fromisoformat(s) for s in re.findall(r'<time datetime="(\d{4}-\d{2}-\d{2})"', index)]
    if order != sorted(order, reverse=True):
        raise ValueError('Chronologie des liens statiques incorrecte')
    print(f'VÉRIFIÉ : {len(published)} actualités approuvées, liens HTML, canonical, dates et sitemap cohérents.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    verify() if args.verify else build()
