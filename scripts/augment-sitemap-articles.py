from __future__ import annotations

from datetime import date
from pathlib import Path

ROOT = Path('.')
BASE = 'https://www.groupe-serilec.fr'
SITEMAP = ROOT / 'sitemap.xml'
ARTICLES = ROOT / 'actualites'

if not SITEMAP.exists() or not ARTICLES.exists():
    raise SystemExit(0)

xml = SITEMAP.read_text(encoding='utf-8')
today = date.today().isoformat()
entries: list[str] = []

for article in sorted(ARTICLES.glob('*.html')):
    loc = f'{BASE}/actualites/{article.name}'
    if f'<loc>{loc}</loc>' in xml:
        continue
    entries.append(
        '  <url>\n'
        f'    <loc>{loc}</loc>\n'
        f'    <lastmod>{today}</lastmod>\n'
        '    <changefreq>monthly</changefreq>\n'
        '    <priority>0.7</priority>\n'
        '  </url>'
    )

if entries:
    block = '\n'.join(entries) + '\n'
    xml = xml.replace('</urlset>', block + '</urlset>', 1)
    SITEMAP.write_text(xml, encoding='utf-8')
