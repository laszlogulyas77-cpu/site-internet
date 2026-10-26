from __future__ import annotations

import re
from datetime import date
from pathlib import Path

ROOT = Path('.')
BASE = 'https://www.groupe-serilec.fr'
SITEMAP = ROOT / 'sitemap.xml'
ARTICLES = ROOT / 'actualites'

if not SITEMAP.exists() or not ARTICLES.exists():
    raise SystemExit(0)

xml = SITEMAP.read_text(encoding='utf-8')
entries: list[str] = []

for article in sorted(ARTICLES.glob('*.html')):
    html = article.read_text(encoding='utf-8')
    # Les actualités très courtes restent consultables, mais ne sont pas indexées.
    if re.search(r'<meta\s+name=["\']robots["\'][^>]*content=["\']noindex', html, flags=re.I):
        continue
    loc = f'{BASE}/actualites/{article.name}'
    if f'<loc>{loc}</loc>' in xml:
        continue
    # Ne pas annoncer une modification SEO à chaque redéploiement du site.
    published = re.search(r'"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})"', html)
    if not published:
        published = re.search(r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"', html)
    lastmod = published.group(1) if published else date.today().isoformat()
    entries.append(
        '  <url>\n'
        f'    <loc>{loc}</loc>\n'
        f'    <lastmod>{lastmod}</lastmod>\n'
        '    <changefreq>monthly</changefreq>\n'
        '    <priority>0.7</priority>\n'
        '  </url>'
    )

if entries:
    xml = xml.replace('</urlset>', '\n'.join(entries) + '\n</urlset>', 1)
    SITEMAP.write_text(xml, encoding='utf-8')
