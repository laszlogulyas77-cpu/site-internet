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
linkedin_url = site.get('linkedin_url', 'https://www.linkedin.com/company/groupe-serilec')

pages = {
    'index.html': {
        'path': '/',
        'label': 'Accueil',
        'title': 'Entreprise d’électricité tertiaire à Paris & Île-de-France | SERILEC',
        'description': 'SERILEC, entreprise familiale créée en 1980, réalise les installations électriques CFO, CFA, SSI, GTB, photovoltaïque, IRVE et maintenance pour hôtels, bureaux et bâtiments tertiaires à Paris, en Île-de-France et en France.',
        'priority': '1.0',
        'changefreq': 'weekly',
    },
    'competences.html': {
        'path': '/competences.html',
        'label': 'Compétences',
        'title': 'CFO, CFA, SSI, GTB & maintenance électrique | SERILEC',
        'description': 'Découvrez les compétences SERILEC en courants forts, courants faibles, SSI, VDI, GTB, HTA/BT, photovoltaïque, IRVE, études d’exécution et maintenance électrique.',
        'priority': '0.9',
        'changefreq': 'monthly',
    },
    'projets.html': {
        'path': '/projets.html',
        'label': 'Projets réalisés',
        'title': 'Réalisations électriques hôtels, bureaux & tertiaire | SERILEC',
        'description': 'Réalisations SERILEC en électricité CFO/CFA et SSI : hôtels, bureaux, tertiaire, restauration, santé, enseignement et bâtiments haut de gamme à Paris, en Île-de-France et en France.',
        'priority': '0.9',
        'changefreq': 'weekly',
    },
    'partenaires.html': {
        'path': '/partenaires.html',
        'label': 'Clients & Partenaires',
        'title': 'Clients, partenaires & témoignages | SERILEC',
        'description': 'Découvrez les clients et partenaires de SERILEC ainsi que des témoignages liés à nos opérations électriques dans l’hôtellerie, les bureaux et le tertiaire.',
        'priority': '0.7',
        'changefreq': 'monthly',
    },
    'actualites.html': {
        'path': '/actualites.html',
        'label': 'Actualités',
        'title': 'Actualités chantiers & expertise électrique | SERILEC',
        'description': 'Suivez les chantiers, livraisons, innovations, expertises techniques et temps forts de SERILEC dans l’électricité tertiaire, l’hôtellerie et les bureaux.',
        'priority': '0.7',
        'changefreq': 'weekly',
    },
    'mentions-legales.html': {
        'path': '/mentions-legales.html',
        'label': 'Mentions légales',
        'title': 'Mentions légales | SERILEC',
        'description': 'Mentions légales, éditeur, hébergement OVH, propriété intellectuelle et protection des données du site SERILEC.',
        'priority': '0.2',
        'changefreq': 'yearly',
    },
}

organization_id = f'{BASE}/#organization'
website_id = f'{BASE}/#website'
organization = {
    '@type': ['Organization', 'Electrician'],
    '@id': organization_id,
    'name': 'SERILEC',
    'legalName': 'SERILEC',
    'alternateName': ['SERILEC Cesson', 'SERILEC Électricité'],
    'url': f'{BASE}/',
    'logo': {
        '@type': 'ImageObject',
        'url': logo_url,
    },
    'image': hero_url,
    'description': 'Entreprise familiale d’électricité générale spécialisée dans les installations CFO, CFA, SSI, VDI, GTB et la maintenance pour les projets tertiaires, hôteliers et de bureaux.',
    'foundingDate': '1980',
    'email': site.get('email', 'contact@groupe-serilec.fr'),
    'telephone': '+33 1 60 63 87 54',
    'address': {
        '@type': 'PostalAddress',
        'streetAddress': '43 rue de la Fontaine',
        'postalCode': '77240',
        'addressLocality': 'Cesson',
        'addressRegion': 'Île-de-France',
        'addressCountry': 'FR',
    },
    'identifier': {
        '@type': 'PropertyValue',
        'propertyID': 'SIREN',
        'value': '318584554',
    },
    'areaServed': [
        {'@type': 'City', 'name': 'Paris'},
        {'@type': 'AdministrativeArea', 'name': 'Île-de-France'},
        {'@type': 'Country', 'name': 'France'},
    ],
    'knowsAbout': [
        'Courants forts (CFO)',
        'Courants faibles (CFA)',
        'Sécurité incendie (SSI)',
        'VDI',
        'Gestion technique du bâtiment (GTB)',
        'Installations HTA/BT',
        'Photovoltaïque',
        'IRVE',
        'Maintenance électrique',
        'Électricité tertiaire',
        'Électricité hôtelière',
    ],
    'sameAs': [linkedin_url],
}
website = {
    '@type': 'WebSite',
    '@id': website_id,
    'url': f'{BASE}/',
    'name': 'SERILEC',
    'alternateName': 'SERILEC — Électricité tertiaire',
    'inLanguage': 'fr-FR',
    'publisher': {'@id': organization_id},
}

for filename, cfg in pages.items():
    path = ROOT / filename
    if not path.exists():
        continue
    html = path.read_text(encoding='utf-8')
    canonical = f"{BASE}{cfg['path']}"
    indexable = cfg.get('index', True)
    robots = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' if indexable else 'noindex,follow'
    seo = (
        f'<meta name="robots" content="{robots}">'
        f'<meta name="author" content="SERILEC">'
        f'<meta name="application-name" content="SERILEC">'
        f'<link rel="canonical" href="{escape(canonical)}">'
        f'<link rel="alternate" hreflang="fr-FR" href="{escape(canonical)}">'
        f'<meta property="og:type" content="website">'
        f'<meta property="og:locale" content="fr_FR">'
        f'<meta property="og:site_name" content="SERILEC">'
        f'<meta property="og:title" content="{escape(cfg["title"])}">'
        f'<meta property="og:description" content="{escape(cfg["description"])}">'
        f'<meta property="og:url" content="{escape(canonical)}">'
        f'<meta property="og:image" content="{escape(hero_url)}">'
        f'<meta property="og:image:alt" content="SERILEC — entreprise d’électricité tertiaire">'
        f'<meta name="twitter:card" content="summary_large_image">'
        f'<meta name="twitter:title" content="{escape(cfg["title"])}">'
        f'<meta name="twitter:description" content="{escape(cfg["description"])}">'
        f'<meta name="twitter:image" content="{escape(hero_url)}">'
    )

    graph = [organization, website]
    if filename != 'index.html':
        graph.append({
            '@type': 'BreadcrumbList',
            '@id': f'{canonical}#breadcrumb',
            'itemListElement': [
                {
                    '@type': 'ListItem',
                    'position': 1,
                    'name': 'Accueil',
                    'item': f'{BASE}/',
                },
                {
                    '@type': 'ListItem',
                    'position': 2,
                    'name': cfg['label'],
                    'item': canonical,
                },
            ],
        })

    if filename == 'projets.html':
        try:
            projects = json.loads((ROOT / 'data/projects.json').read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError):
            projects = []
        published_projects = [item for item in projects if item.get('published', True) is not False]
        graph.append({
            '@type': 'CollectionPage',
            '@id': f'{canonical}#collection',
            'url': canonical,
            'name': cfg['title'],
            'description': cfg['description'],
            'isPartOf': {'@id': website_id},
            'about': {'@id': organization_id},
            'mainEntity': {
                '@type': 'ItemList',
                'numberOfItems': len(published_projects),
                'itemListElement': [
                    {
                        '@type': 'ListItem',
                        'position': index,
                        'name': str(item.get('title', '')).strip(),
                        'item': {
                            '@type': 'Thing',
                            'name': str(item.get('title', '')).strip(),
                            'description': str(item.get('description', '')).strip(),
                        },
                    }
                    for index, item in enumerate(published_projects, start=1)
                    if str(item.get('title', '')).strip()
                ],
            },
        })

    if filename == 'actualites.html':
        try:
            news = json.loads((ROOT / 'data/news.json').read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError):
            news = []
        published_news = [item for item in news if item.get('published', True) is not False]
        graph.append({
            '@type': 'CollectionPage',
            '@id': f'{canonical}#collection',
            'url': canonical,
            'name': cfg['title'],
            'description': cfg['description'],
            'isPartOf': {'@id': website_id},
            'about': {'@id': organization_id},
            'mainEntity': {
                '@type': 'ItemList',
                'numberOfItems': len(published_news),
                'itemListElement': [
                    {
                        '@type': 'ListItem',
                        'position': index,
                        'name': str(item.get('title', '')).strip(),
                    }
                    for index, item in enumerate(published_news, start=1)
                    if str(item.get('title', '')).strip()
                ],
            },
        })

    seo += (
        '<script type="application/ld+json">'
        + json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, separators=(',', ':'))
        + '</script>'
    )

    if filename == 'index.html' and hero_image and (ROOT / hero_image).exists():
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
