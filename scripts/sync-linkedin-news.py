#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import html
import json
import mimetypes
import os
import re
import struct
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEWS_FILE = ROOT / "data" / "news.json"
PROJECTS_FILE = ROOT / "data" / "projects.json"
UPLOADS = ROOT / "assets" / "uploads"
LINKEDIN_UPLOADS = UPLOADS / "linkedin"

COMPANY_URLS = [
    "https://fr.linkedin.com/company/groupe-serilec",
    "https://www.linkedin.com/company/groupe-serilec",
    "https://fr.linkedin.com/company/groupe-serilec/posts?trk=organization_guest_main-feed-card_feed-article-content",
]
SEARCH_URLS = [
    "https://www.google.com/search?q=" + urllib.parse.quote("site:fr.linkedin.com/posts/groupe-serilec SERILEC"),
    "https://www.bing.com/search?q=" + urllib.parse.quote("site:fr.linkedin.com/posts/groupe-serilec SERILEC"),
    "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote("site:fr.linkedin.com/posts/groupe-serilec SERILEC"),
]
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
    "Mozilla/5.0 (compatible; SERILEC-Site-Sync/2.0; +https://www.groupe-serilec.fr/)",
]
POST_RE = re.compile(
    r"https?://(?:www\.|fr\.)?linkedin\.com/posts/groupe-serilec_[^\s\"'<>]*?activity-(\d+)-[^\s\"'<>?&]*",
    re.I,
)
ACTIVITY_RE = re.compile(r"activity-(\d+)", re.I)
MEDIA_URL_RE = re.compile(r"https?://[^\s\"'<>]*(?:media|static-exp\d*)\.licdn\.com/[^\s\"'<>]+", re.I)
JSON_IMAGE_URL_RE = re.compile(r'(?:(?:contentUrl|url|imageUrl|rootUrl|downloadUrl)\s*[\"\']?\s*[:=]\s*[\"\'])(https?:\/\/[^\"\']+)', re.I)
LINKEDIN_LI_AT = os.getenv("LINKEDIN_LI_AT", "").strip()
LINKEDIN_JSESSIONID = os.getenv("LINKEDIN_JSESSIONID", "").strip()

STOPWORDS = {
    "serilec", "actualite", "projet", "projets", "chantier", "chantiers",
    "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "a", "au",
    "aux", "pour", "sur", "dans", "avec", "notre", "nos", "votre", "vos",
    "plus", "mieux", "nous", "vous", "ce", "cette", "ces", "son", "ses",
}


class MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, str] = {}
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs):
        data = {str(k).lower(): str(v) for k, v in attrs if k and v is not None}
        if tag.lower() == "meta":
            key = (data.get("property") or data.get("name") or "").lower()
            value = data.get("content", "")
            if key and value:
                self.meta[key] = value
        elif tag.lower() == "a":
            href = data.get("href", "")
            if href:
                self.links.append(href)


def linkedin_cookie_header() -> str:
    cookies = []
    if LINKEDIN_LI_AT:
        cookies.append(f"li_at={LINKEDIN_LI_AT}")
    if LINKEDIN_JSESSIONID:
        jsession = LINKEDIN_JSESSIONID
        if not (jsession.startswith('"') and jsession.endswith('"')):
            jsession = f'"{jsession}"'
        cookies.append(f"JSESSIONID={jsession}")
    return "; ".join(cookies)


def fetch(url: str, binary: bool = False, attempts: int = 3):
    last = None
    for attempt in range(attempts):
        for ua in USER_AGENTS:
            headers = {
                "User-Agent": ua,
                "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.6",
                "Accept": "*/*" if binary else "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": "https://www.linkedin.com/",
            }
            cookie = linkedin_cookie_header()
            if cookie and "linkedin.com" in urllib.parse.urlparse(url).netloc:
                headers["Cookie"] = cookie
                if LINKEDIN_JSESSIONID:
                    headers["csrf-token"] = LINKEDIN_JSESSIONID.strip('"')
            req = urllib.request.Request(url, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=30) as response:
                    payload = response.read()
                    ctype = response.headers.get_content_type()
                    final_url = response.geturl()
                if binary:
                    return payload, ctype, final_url
                return payload.decode("utf-8", errors="replace"), ctype, final_url
            except Exception as exc:  # noqa: BLE001
                last = exc
        if attempt < attempts - 1:
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Impossible de récupérer {url}: {last}")


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text).lower()
    return re.sub(r"\s+", " ", text).strip()


def clean_post_text(text: str) -> str:
    text = html.unescape(text or "")
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"(?:\s+#\w+)+\s*$", "", text)
    return text.strip()


def activity_date(activity: str) -> str:
    # Les activity-id LinkedIn sont des snowflakes : timestamp ms dans les bits hauts.
    timestamp_ms = int(activity) >> 22
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).date().isoformat()


def first_sentence(text: str, limit: int = 96) -> str:
    text = clean_post_text(text)
    text = re.sub(r"^[^\wÀ-ÿ]+", "", text)
    parts = re.split(r"(?<=[.!?])\s+", text)
    candidate = parts[0].strip() if parts else text
    candidate = re.sub(r"\s*[|•·]\s*.*$", "", candidate)
    if len(candidate) > limit:
        candidate = candidate[:limit].rsplit(" ", 1)[0].rstrip(" ,;:") + "…"
    return candidate or "Actualité SERILEC"


def classify(text: str) -> str:
    n = normalize(text)
    if "recrut" in n or "emploi" in n or "candidature" in n:
        return "Recrutement"
    if "fin de chantier" in n or "livraison" in n or "livre" in n or "commission de securite" in n:
        return "Projet livré"
    if "nouveau chantier" in n or "nouveau projet" in n or "demarrage" in n:
        return "Nouveau chantier"
    if "cfo" in n or "cfa" in n or "courant fort" in n or "courant faible" in n:
        return "Expertise technique"
    if "ssi" in n or "securite incendie" in n:
        return "SSI & sécurité"
    if "photovolt" in n:
        return "Photovoltaïque"
    if "equipe" in n or "collaborateur" in n or "alternance" in n:
        return "Équipe & transmission"
    if "abonne" in n or "merci" in n or "linkedin" in n:
        return "Vie de l'entreprise"
    if "chantier" in n or "travaux" in n or "renovation" in n or "rehabilitation" in n:
        return "Chantier"
    return "SERILEC"


def better_title(text: str, category: str) -> str:
    n = normalize(text)
    if "1000 abonne" in n or "1 000 abonne" in text:
        return "SERILEC franchit le cap des 1 000 abonnés sur LinkedIn"
    if category == "Recrutement":
        m = re.search(r"recrut(?:e|ement).*?(Chef de Chantier|Conducteur de travaux|Chargé d’affaires|Électricien)", text, re.I)
        if m:
            return f"SERILEC recrute : {m.group(1)}"
    raw = first_sentence(text)
    raw = re.sub(r"^(SERILEC\s*[:\-–—]?\s*)", "", raw, flags=re.I)
    if len(raw) < 18:
        return f"{category} : actualité SERILEC"
    return raw[0].upper() + raw[1:]


def discover_posts() -> list[tuple[int, str]]:
    found: dict[str, str] = {}
    errors: list[str] = []
    sources = COMPANY_URLS + SEARCH_URLS
    for url in sources:
        try:
            body, _, _ = fetch(url)
        except Exception as exc:  # noqa: BLE001
            errors.append(str(exc))
            continue
        decoded = html.unescape(body).replace("\\u0026", "&").replace("\\/", "/")
        for match in POST_RE.finditer(decoded):
            activity = match.group(1)
            post_url = match.group(0).split("&", 1)[0]
            found[activity] = post_url
        parser = MetaParser()
        try:
            parser.feed(decoded)
        except Exception:
            pass
        for href in parser.links:
            href = html.unescape(href)
            if href.startswith("/"):
                href = urllib.parse.urljoin("https://fr.linkedin.com", href)
            m = POST_RE.search(href)
            if m:
                found[m.group(1)] = m.group(0).split("&", 1)[0]
    if not found:
        if errors:
            print("LinkedIn bloque ou limite la découverte directe depuis GitHub ; aucune nouveauté détectée par ce canal.", file=sys.stderr)
            for error in errors[-3:]:
                print(f"- {error}", file=sys.stderr)
        return []
    return sorted(((int(a), u) for a, u in found.items()), reverse=True)


def post_source_urls(activity: str, canonical_url: str) -> list[str]:
    urls = [
        canonical_url,
        f"https://www.linkedin.com/feed/update/urn:li:activity:{activity}/",
        f"https://www.linkedin.com/embed/feed/update/urn:li:activity:{activity}",
        f"https://fr.linkedin.com/feed/update/urn:li:activity:{activity}/",
    ]
    seen = set()
    result = []
    for url in urls:
        if url and url not in seen:
            seen.add(url)
            result.append(url)
    return result


def decode_linkedin_url(value: str) -> str:
    value = html.unescape(value or "")
    value = value.replace("\\u0026", "&").replace("\\u002F", "/").replace("\\/", "/")
    try:
        value = urllib.parse.unquote(value)
    except Exception:
        pass
    return value.strip().rstrip("\\")


def collect_image_candidates(body: str, parser: MetaParser) -> list[str]:
    candidates: list[str] = []
    for key in ("og:image", "og:image:secure_url", "twitter:image", "twitter:image:src"):
        if parser.meta.get(key):
            candidates.append(parser.meta[key])
    decoded = html.unescape(body).replace("\\u0026", "&").replace("\\u002F", "/").replace("\\/", "/")
    candidates.extend(m.group(0) for m in MEDIA_URL_RE.finditer(decoded))
    candidates.extend(m.group(1) for m in JSON_IMAGE_URL_RE.finditer(decoded))
    clean: list[str] = []
    seen = set()
    for candidate in candidates:
        url = decode_linkedin_url(candidate)
        if not url.startswith("http"):
            continue
        low = url.lower()
        if any(term in low for term in ("profile-displayphoto", "company-logo", "ghost", "emoji")):
            continue
        if url not in seen:
            seen.add(url)
            clean.append(url)
    return clean


def image_dimensions(payload: bytes, ctype: str | None = None) -> tuple[int, int] | None:
    try:
        if payload.startswith(b"\x89PNG\r\n\x1a\n") and len(payload) >= 24:
            return struct.unpack(">II", payload[16:24])
        if payload[:2] == b"\xff\xd8":
            pos = 2
            while pos + 9 < len(payload):
                if payload[pos] != 0xFF:
                    pos += 1
                    continue
                marker = payload[pos + 1]
                pos += 2
                if marker in (0xD8, 0xD9):
                    continue
                if pos + 2 > len(payload):
                    break
                size = int.from_bytes(payload[pos:pos + 2], "big")
                if size < 2 or pos + size > len(payload):
                    break
                if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF) and size >= 7:
                    height = int.from_bytes(payload[pos + 3:pos + 5], "big")
                    width = int.from_bytes(payload[pos + 5:pos + 7], "big")
                    return width, height
                pos += size
    except Exception:
        return None
    return None


def score_image(payload: bytes, ctype: str | None, url: str) -> tuple[int, int, int, str]:
    dims = image_dimensions(payload, ctype)
    width, height = dims or (0, 0)
    area = width * height
    ratio_bonus = 500_000 if width and height and 0.75 <= width / height <= 2.1 else 0
    domain_bonus = 500_000 if "licdn.com" in url else 0
    return (area + ratio_bonus + domain_bonus, len(payload), width + height, url)


def extract_post(url: str) -> tuple[str, str | None]:
    m = ACTIVITY_RE.search(url)
    activity = m.group(1) if m else ""
    best_description = ""
    image_candidates: list[str] = []
    errors: list[str] = []

    sources = post_source_urls(activity, url) if activity else [url]
    for source in sources:
        try:
            body, _, _ = fetch(source)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{source}: {exc}")
            continue

        parser = MetaParser()
        try:
            parser.feed(body)
        except Exception:
            pass

        description = (
            parser.meta.get("description")
            or parser.meta.get("og:description")
            or parser.meta.get("twitter:description")
            or ""
        )
        description = clean_post_text(description)
        description = re.sub(r"^.*?SERILEC\s+\d[\d\s ]*\s+abonnés\s+", "", description, flags=re.I)
        if len(description) > len(best_description):
            best_description = description

        image_candidates.extend(collect_image_candidates(body, parser))

        if len(best_description) < 40:
            visible = re.sub(r"<script\b[^>]*>.*?</script>", " ", body, flags=re.I | re.S)
            visible = re.sub(r"<style\b[^>]*>.*?</style>", " ", visible, flags=re.I | re.S)
            visible = re.sub(r"<[^>]+>", " ", visible)
            visible = clean_post_text(visible)
            anchor = visible.find("SERILEC")
            if anchor >= 0:
                visible = visible[anchor:]
            if len(visible) > len(best_description):
                best_description = visible[:4000]

    if len(best_description) < 40:
        raise RuntimeError(f"Texte LinkedIn inexploitable pour {url}. " + " | ".join(errors[-2:]))

    image_url = None
    ranked = []
    seen = set()
    for candidate in image_candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        try:
            payload, ctype, final_url = fetch(candidate, binary=True, attempts=2)
        except Exception:
            continue
        if len(payload) < 12_000 or not str(ctype).startswith("image/"):
            continue
        dims = image_dimensions(payload, ctype)
        if dims and (dims[0] < 400 or dims[1] < 220):
            continue
        selected_url = final_url or candidate
        ranked.append((score_image(payload, ctype, selected_url), selected_url))

    if ranked:
        ranked.sort(reverse=True)
        image_url = ranked[0][1]

    return best_description, image_url


def project_match(text: str, projects: list[dict]) -> dict | None:
    n = normalize(text)
    best = None
    best_score = 0
    for project in projects:
        title = normalize(project.get("title", ""))
        location = normalize(project.get("location", ""))
        client = normalize(project.get("client", ""))
        score = 0
        if title and len(title) >= 5 and title in n:
            score += 7
        for token in title.split():
            if len(token) >= 5 and token in n:
                score += 1
        if location and any(tok in n for tok in location.split() if len(tok) >= 6):
            score += 2
        if client and len(client) >= 4 and client in n:
            score += 2
        if score > best_score:
            best_score, best = score, project
    return best if best_score >= 4 else None


def is_project_post(text: str) -> bool:
    n = normalize(text)
    return any(k in n for k in ("chantier", "travaux", "renovation", "rehabilitation", "livraison", "hotel", "bureaux", "projet"))


def concise_content(text: str, project: dict | None) -> str:
    text = clean_post_text(text)
    sentences = re.split(r"(?<=[.!?])\s+", text)
    kept: list[str] = []
    size = 0
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence or sentence.startswith("#"):
            continue
        kept.append(sentence)
        size += len(sentence)
        if size >= 650 or len(kept) >= 5:
            break
    result = " ".join(kept).strip()
    if project and is_project_post(text):
        desc = clean_post_text(str(project.get("description", "")))
        if desc and normalize(desc) not in normalize(result):
            result += " " + desc
    return result[:1100].strip()


def excerpt_from(text: str) -> str:
    text = clean_post_text(text)
    if len(text) <= 210:
        return text
    return text[:210].rsplit(" ", 1)[0].rstrip(" ,;:") + "…"


def file_hash(path: Path) -> str | None:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except Exception:
        return None


def recent_image_hashes(news: list[dict]) -> set[str]:
    hashes: set[str] = set()
    for entry in news[:5]:
        p = ROOT / str(entry.get("image", ""))
        h = file_hash(p)
        if h:
            hashes.add(h)
    return hashes


def download_visual(activity: str, image_url: str | None, recent_hashes: set[str]) -> str | None:
    if not image_url:
        return None
    try:
        payload, ctype, _ = fetch(image_url, binary=True)
    except Exception:
        return None
    if len(payload) < 12_000 or not str(ctype).startswith("image/"):
        return None
    dims = image_dimensions(payload, ctype)
    if dims and (dims[0] < 400 or dims[1] < 220):
        return None
    digest = hashlib.sha256(payload).hexdigest()
    if digest in recent_hashes:
        return None
    ext = mimetypes.guess_extension(ctype or "") or ".jpg"
    if ext == ".jpe":
        ext = ".jpg"
    LINKEDIN_UPLOADS.mkdir(parents=True, exist_ok=True)
    target = LINKEDIN_UPLOADS / f"{activity}{ext}"
    target.write_bytes(payload)
    return target.relative_to(ROOT).as_posix()


def unique_fallback_svg(activity: str, title: str, category: str) -> str:
    LINKEDIN_UPLOADS.mkdir(parents=True, exist_ok=True)
    target = LINKEDIN_UPLOADS / f"{activity}.svg"
    safe_title = html.escape(title)
    safe_cat = html.escape(category)
    # Découpage simple pour éviter les débordements.
    words = title.split()
    lines: list[str] = []
    line = ""
    for word in words:
        candidate = (line + " " + word).strip()
        if len(candidate) > 32 and line:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    lines = lines[:3]
    text_nodes = "\n".join(
        f'<text x="110" y="{270 + i*72}" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="700" fill="#0b1f33">{html.escape(line)}</text>'
        for i, line in enumerate(lines)
    )
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0b1f33"/>
  <rect x="62" y="62" width="1076" height="506" rx="28" fill="#ffffff"/>
  <rect x="62" y="62" width="18" height="506" rx="9" fill="#e30613"/>
  <text x="110" y="150" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#e30613">SERILEC • {safe_cat}</text>
  {text_nodes}
  <text x="110" y="530" font-family="Arial, Helvetica, sans-serif" font-size="25" fill="#5a6c7d">Actualité publiée sur LinkedIn</text>
</svg>'''
    target.write_text(svg, encoding="utf-8")
    return target.relative_to(ROOT).as_posix()


def pick_project_visual(project: dict | None, news: list[dict]) -> str | None:
    if not project:
        return None
    candidate = str(project.get("image", ""))
    if not candidate:
        return None
    recent = {str(n.get("image", "")) for n in news[:5]}
    path = ROOT / candidate
    if candidate not in recent and path.exists() and path.stat().st_size > 0:
        return candidate
    return None


def meaningful_tokens(text: str) -> set[str]:
    return {
        token
        for token in normalize(text).split()
        if len(token) >= 4 and token not in STOPWORDS
    }


def dedup(news: list[dict], activity: str, link: str, title: str, text: str, project: dict | None) -> bool:
    nt = normalize(title)
    candidate_text = normalize(text)
    candidate_tokens = meaningful_tokens(text + " " + title)
    project_title = normalize(project.get("title", "")) if project else ""
    for entry in news:
        e_link = str(entry.get("link", ""))
        if activity in e_link or e_link == link:
            return True

        entry_title = str(entry.get("title", ""))
        entry_excerpt = str(entry.get("excerpt", ""))
        entry_content = str(entry.get("content", ""))
        entry_norm_title = normalize(entry_title)
        if nt and entry_norm_title == nt:
            return True

        e_title_tokens = meaningful_tokens(entry_title)
        if e_title_tokens:
            overlap = len(e_title_tokens & candidate_tokens) / len(e_title_tokens)
            if overlap >= 0.70:
                return True

        combined = normalize(entry_title + " " + entry_excerpt + " " + entry_content)
        distinctive = meaningful_tokens(entry_title + " " + entry_excerpt)
        if len(distinctive) >= 3:
            present = sum(1 for token in distinctive if token in candidate_text)
            if present / len(distinctive) >= 0.75:
                return True

        if project_title and project_title in combined and project_title in candidate_text:
            e_tokens = meaningful_tokens(entry_content + " " + entry_excerpt)
            if e_tokens:
                denom = min(len(e_tokens), max(1, len(candidate_tokens)))
                similarity = len(e_tokens & candidate_tokens) / denom
                if similarity >= 0.55:
                    return True
    return False


def recent_image_hashes_excluding(news: list[dict], skip_index: int) -> set[str]:
    hashes: set[str] = set()
    for index, entry in enumerate(news[:5]):
        if index == skip_index:
            continue
        h = file_hash(ROOT / str(entry.get("image", "")))
        if h:
            hashes.add(h)
    return hashes


def upgrade_recent_visuals(news: list[dict]) -> int:
    changed = 0
    for index, entry in enumerate(news[:6]):
        link = str(entry.get("link", ""))
        m = ACTIVITY_RE.search(link)
        if not m:
            continue
        activity = m.group(1)
        current = str(entry.get("image", ""))
        if current.startswith(f"assets/uploads/linkedin/{activity}."):
            continue
        try:
            _, image_url = extract_post(link)
        except Exception:
            continue
        visual = download_visual(activity, image_url, recent_image_hashes_excluding(news, index))
        if not visual:
            continue
        entry["image"] = visual
        entry["alt"] = f"Visuel exact de la publication LinkedIn SERILEC : {entry.get('title', 'Actualité SERILEC')}"
        changed += 1
    return changed


def validate_latest_images(news: list[dict]) -> None:
    images = [str(n.get("image", "")) for n in news[:5]]
    if len(images) != len(set(images)):
        raise RuntimeError("Doublon de chemin image dans les 5 dernières actualités")
    hashes: list[str] = []
    for img in images:
        h = file_hash(ROOT / img)
        if h:
            hashes.append(h)
    if len(hashes) != len(set(hashes)):
        raise RuntimeError("Doublon visuel détecté parmi les 5 dernières actualités")


def main() -> int:
    news = json.loads(NEWS_FILE.read_text(encoding="utf-8"))
    projects = json.loads(PROJECTS_FILE.read_text(encoding="utf-8"))
    existing_ids = {
        m.group(1)
        for entry in news
        for m in [ACTIVITY_RE.search(str(entry.get("link", "")))]
        if m
    }

    visual_upgrades = upgrade_recent_visuals(news)
    candidates = discover_posts()
    missing = [(str(activity), url) for activity, url in candidates if str(activity) not in existing_ids]
    if not missing and not visual_upgrades:
        print("Aucune nouvelle publication SERILEC à synchroniser.")
        return 0

    # Traite du plus ancien au plus récent pour conserver l'ordre final.
    changed = 0
    for activity, url in reversed(missing[:6]):
        if any(activity in str(n.get("link", "")) for n in news):
            continue
        text, image_url = extract_post(url)
        category = classify(text)
        title = better_title(text, category)
        project = project_match(text, projects) if is_project_post(text) else None
        if dedup(news, activity, url, title, text, project):
            continue

        recent_hashes = recent_image_hashes(news)
        image = download_visual(activity, image_url, recent_hashes)
        if not image:
            image = pick_project_visual(project, news)
        if not image:
            image = unique_fallback_svg(activity, title, category)

        alt = f"Visuel de la publication LinkedIn SERILEC : {title}"
        if project:
            alt = str(project.get("alt") or f"Projet SERILEC {project.get('title', title)}")

        entry = {
            "title": title,
            "category": category,
            "date": activity_date(activity),
            "excerpt": excerpt_from(text),
            "content": concise_content(text, project),
            "image": image,
            "alt": alt,
            "link": url,
            "published": True,
        }
        news.insert(0, entry)
        changed += 1

    if not changed and not visual_upgrades:
        print("Nouvelles URLs détectées mais aucune actualité valide à ajouter.")
        return 0

    validate_latest_images(news)
    NEWS_FILE.write_text(json.dumps(news, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{changed} publication(s) SERILEC synchronisée(s), {visual_upgrades} visuel(s) exact(s) actualisé(s).")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"ERREUR SYNC LINKEDIN: {exc}", file=sys.stderr)
        raise
