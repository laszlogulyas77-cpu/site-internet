from __future__ import annotations

import json
from datetime import date
from html import escape
from pathlib import Path

ROOT = Path('.')
BASE = 'https://www.groupe-serilec.fr'

site = json.loads((ROOT / 'data/site.json').read_text(encoding='utf-8'))
hero_image = (site.get('home') or {}).get('hero_image') or ''
hero_url = f"{BASE}/{hero_image}" if hero_image else f"{BASE}/assets/uploads/chatgpt-image-10-aout-2026-235845.png"
logo_url = f"{BASE}/{site.get('logo', 'assets/uploads/chatgpt-image-10-aout-2026-235845.png')}"

pages = {
    'index.html': {
        'path': '/',
        'title': 'SERILEC — Électricité tertiaire, hôtels, bureaux et retail',
        'description': 'SERILEC réalise les installations électriques CFO, CFA, SSI, GTB, photovoltaïque et IRVE, avec études d’exécution et maintenance, pour les projets tertiaires, hôteliers et retail.',
        'priority': '1.0',
        'changefreq': 'weekly',
    },
    'competences.html': {
        'path': '/competences.html',
        'title': 'Compétences — SERILEC',
        'description': 'CFO, CFA, SSI, GTB, photovoltaïque, IRVE, HTA/BT, études d’exécution, maintenance électrique, certifications et qualifications SERILEC.',
        'priority': '0.9',
        'changefreq': 'monthly',
    },
    'projets.html': {
        'path': '/projets.html',
        'title': 'Projets réalisés — SERILEC',
        'description': 'Découvrez les réalisations SERILEC dans l’hôtellerie, les bureaux, le haut de gamme, le retail, la restauration, la santé et l’enseignement.',
        'priority': '0.9',
        'changefreq': 'weekly',
    },
    'partenaires.html': {
        'path': '/partenaires.html',
        'title': 'Clients & Partenaires — SERILEC',
        'description': 'Découvrez les clients qui font confiance à SERILEC, nos partenaires techniques et les témoignages liés à nos opérations.',
        'priority': '0.7',
        'changefreq': 'monthly',
    },
    'actualites.html': {
        'path': '/actualites.html',
        'title': 'Actualités — SERILEC',
        'description': 'Les actualités SERILEC : chantiers, équipes, innovations et vie de l’entreprise.',
        'priority': '0.6',
        'changefreq': 'weekly',
    },
    'mentions-legales.html': {
        'path': '/mentions-legales.html',
        'title': 'Mentions légales — SERILEC',
        'description': 'Mentions légales, éditeur, hébergement OVH, propriété intellectuelle et protection des données du site SERILEC.',
        'priority': '0.2',
        'changefreq': 'yearly',
    },
}

for filename, cfg in pages.items():
    path = ROOT / filename
    if not path.exists():
        continue
    html = path.read_text(encoding='utf-8')
    canonical = f"{BASE}{cfg['path']}"
    indexable = cfg.get('index', True)
    robots = 'index,follow,max-image-preview:large' if indexable else 'noindex,follow'
    seo = (
        f'<meta name="robots" content="{robots}">'
        f'<meta name="author" content="SERILEC">'
        f'<link rel="canonical" href="{escape(canonical)}">'
        f'<meta property="og:type" content="website">'
        f'<meta property="og:site_name" content="SERILEC">'
        f'<meta property="og:title" content="{escape(cfg["title"])}">'
        f'<meta property="og:description" content="{escape(cfg["description"])}">'
        f'<meta property="og:url" content="{escape(canonical)}">'
        f'<meta property="og:image" content="{escape(hero_url)}">'
        f'<meta name="twitter:card" content="summary_large_image">'
        f'<meta name="twitter:title" content="{escape(cfg["title"])}">'
        f'<meta name="twitter:description" content="{escape(cfg["description"])}">'
        f'<meta name="twitter:image" content="{escape(hero_url)}">'
    )

    if filename == 'index.html':
        org = {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            'name': 'SERILEC',
            'legalName': 'SERILEC',
            'url': f'{BASE}/',
            'logo': logo_url,
            'email': site.get('email', 'contact@groupe-serilec.fr'),
            'telephone': '+33 1 60 63 87 54',
            'address': {
                '@type': 'PostalAddress',
                'streetAddress': '43 rue de la Fontaine',
                'postalCode': '77240',
                'addressLocality': 'Cesson',
                'addressCountry': 'FR',
            },
            'sameAs': [site.get('linkedin_url', 'https://www.linkedin.com/company/groupe-serilec')],
        }
        seo += f'<script type="application/ld+json">{json.dumps(org, ensure_ascii=False, separators=(",", ":"))}</script>'
        if hero_image and (ROOT / hero_image).exists():
            safe_hero = hero_image.replace("'", '%27')
            seo += (
                f'<link rel="preload" as="image" href="{escape(hero_image)}">'
                '<style id="cms-hero-initial">'
                '.hero{background-image:linear-gradient(90deg,rgba(0,20,43,.98) 0%,rgba(0,26,54,.9) 42%,rgba(0,26,54,.28) 76%),'
                f"url('{safe_hero}')!important;background-position:center!important;background-size:cover!important}}"
                '</style>'
            )
        html = html.replace('<link rel="stylesheet" href="assets/css/hero-cache-fix.css?v=20260824-hero-cache-fix-v1">', '')

    html = html.replace('</head>', seo + '</head>', 1)
    path.write_text(html, encoding='utf-8')

error_page = ROOT / '404.html'
if error_page.exists():
    html = error_page.read_text(encoding='utf-8')
    if 'name="robots"' not in html:
        html = html.replace('</head>', '<meta name="robots" content="noindex,follow"></head>', 1)
    error_page.write_text(html, encoding='utf-8')

today = date.today().isoformat()
entries = []
for filename, cfg in pages.items():
    if cfg.get('index', True) is False:
        continue
    loc = f"{BASE}{cfg['path']}"
    entries.append(
        '  <url>\n'
        f'    <loc>{loc}</loc>\n'
        f'    <lastmod>{today}</lastmod>\n'
        f'    <changefreq>{cfg["changefreq"]}</changefreq>\n'
        f'    <priority>{cfg["priority"]}</priority>\n'
        '  </url>'
    )
(ROOT / 'sitemap.xml').write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + '\n'.join(entries)
    + '\n</urlset>\n',
    encoding='utf-8',
)
(ROOT / 'robots.txt').write_text(
    'User-agent: *\nAllow: /\n\nSitemap: https://www.groupe-serilec.fr/sitemap.xml\n',
    encoding='utf-8',
)
