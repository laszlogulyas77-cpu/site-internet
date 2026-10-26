#!/usr/bin/env python3
"""Veille LinkedIn Pages SERILEC via Windsor.ai (sans publication automatique).

Requires WINDSOR_API_KEY in the environment (GitHub Actions secret).
No API key is stored or printed. Output is an editorial review queue only.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEWS_FILE = ROOT / "data/news.json"
PENDING_FILE = ROOT / "data/linkedin-pending.json"
CONNECTOR_URL = "https://connectors.windsor.ai/linkedin_organic"
FIELDS = (
    "account_id,account_name,share_activity,share_audience_type_all_followers,"
    "share_text,share_title,share_published_time,post_id,share_url"
)
ACTIVITY_PATTERN = re.compile(r"(?:urn:li:activity:|activity[-:])([0-9]{16,20})")
ACCOUNT_PATTERN = re.compile(r"\bSERILEC\b", re.I)


def normalized(value: object) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFKD", str(value or ""))
        if not unicodedata.combining(ch)
    )


def activity_id(value: object) -> str | None:
    match = ACTIVITY_PATTERN.search(str(value or ""))
    return match.group(1) if match else None


def linkedin_date(aid: str) -> date:
    return datetime.fromtimestamp((int(aid) >> 22) / 1000, tz=timezone.utc).date()


def parsed_date(value: object) -> date | None:
    if value is None or value == "":
        return None
    try:
        if isinstance(value, (int, float)) or str(value).isdigit():
            raw = float(value)
            return datetime.fromtimestamp(raw / 1000 if raw > 10**11 else raw, timezone.utc).date()
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
    except (ValueError, TypeError, OverflowError):
        try:
            return date.fromisoformat(str(value)[:10])
        except ValueError:
            return None


def rows_from_response(payload: object) -> list[dict]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        if payload.get("error") or payload.get("errors"):
            # Never print the provider's raw error; it might contain the key.
            raise ValueError("Windsor signale une erreur de source ou d'autorisation.")
        for key in ("data", "rows", "results"):
            if isinstance(payload.get(key), list):
                return [row for row in payload[key] if isinstance(row, dict)]
    raise ValueError("Format de réponse Windsor inattendu (données absentes).")


def fetch_posts() -> list[dict]:
    key = os.environ.get("WINDSOR_API_KEY", "").strip()
    if not key:
        raise ValueError("Secret GitHub WINDSOR_API_KEY manquant.")
    query = urllib.parse.urlencode({
        "api_key": key,
        "date_preset": "last_30d",
        "fields": FIELDS,
    })
    request = urllib.request.Request(
        f"{CONNECTOR_URL}?{query}",
        headers={
            "Accept": "application/json",
            "User-Agent": "SERILEC-SEO-Linkedin-Sync/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=70) as response:
            payload = response.read(3_000_000)
    except urllib.error.HTTPError as exc:
        # HTTPError.url peut contenir le secret : ne pas afficher exc, l'URL,
        # les en-têtes ni une réponse brute.
        try:
            details = json.loads(exc.read(8192).decode("utf-8", "replace"))
            problem = details.get("error") or details.get("message") or details.get("detail") or ""
            if isinstance(problem, dict):
                reason = str(problem.get("message") or problem.get("code") or "erreur fournisseur")
            else:
                reason = str(problem)
        except (ValueError, UnicodeError):
            reason = "requête rejetée sans message JSON"
        # Nettoyage défensif, même si Windsor rappelle la clé dans son erreur.
        reason = reason.replace(key, "[SECRET]")
        reason = re.sub(r"https?://\\S+", "[URL]", reason)
        reason = re.sub(r"(?i)(?:api[_-]?key|token|secret)\\s*[:=]\\s*[^\\s,;&]+", "[PARAMÈTRE MASQUÉ]", reason)
        reason = re.sub(r"\\b[a-fA-F0-9]{30,}\\b", "[VALEUR MASQUÉE]", reason)
        reason = re.sub(r"[\\r\\n\\t]+", " ", reason).strip()[:240]
        raise ValueError(f"Windsor LinkedIn Pages HTTP {exc.code} : {reason or 'erreur non précisée'}") from None
    except (urllib.error.URLError, TimeoutError):
        raise ValueError("Impossible de joindre Windsor LinkedIn Pages (réseau ou délai dépassé).") from None
    try:
        return rows_from_response(json.loads(payload))
    except (ValueError, UnicodeError):
        raise ValueError("Réponse Windsor invalide ou connecteur LinkedIn non configuré.") from None


def public_flag(value: object) -> bool | None:
    if value is True or str(value).strip().lower() in {"true", "1", "yes"}:
        return True
    if value is False or str(value).strip().lower() in {"false", "0", "no"}:
        return False
    return None


def candidate(row: dict, expected_account: str = "") -> dict | None:
    name = str(row.get("account_name") or "").strip()
    account_id = str(row.get("account_id") or "").strip()
    owner = str(row.get("share_owner") or "")
    if expected_account:
        if account_id != expected_account:
            return None
    elif not ACCOUNT_PATTERN.search(normalized(name)):
        # Never accidentally ingest another connected company's posts.
        return None
    aid = activity_id(row.get("share_activity"))
    if not aid:
        share_url = str(row.get("share_url") or "")
        if "linkedin.com" in share_url and ("/posts/groupe-serilec_" in share_url or "/feed/update/urn:li:activity:" in share_url):
            aid = activity_id(share_url)
    if not aid:
        # post_id may be a *share* id, NOT a LinkedIn activity id. Do not guess.
        return None
    derived = linkedin_date(aid)
    provider = parsed_date(row.get("share_published_time"))
    if derived > date.today() + timedelta(days=1):
        return None
    if provider and abs((derived - provider).days) > 1:
        status = "date_a_verifier"
    else:
        status = "pending"
    is_public = public_flag(row.get("share_audience_type_all_followers"))
    if is_public is False:
        return None
    text = str(row.get("share_text") or "").strip()
    title = str(row.get("share_title") or "").strip()
    if not title or len(title) < 8:
        title = text.splitlines()[0].strip()[:160] if text else ""
    if not title:
        title = "Publication SERILEC à vérifier"
    permalink = f"https://www.linkedin.com/feed/update/urn:li:activity:{aid}/"
    return {
        "activity_id": aid,
        "url": permalink,
        "date": (provider or derived).isoformat() if status == "pending" else derived.isoformat(),
        "title": title[:200],
        "excerpt": re.sub(r"\s+", " ", text)[:400] if is_public is True else "",
        "source": "windsor_linkedin_organic",
        "account_name": name,
        "public_visibility": "declared_public" if is_public is True else "to_verify",
        "review_status": status,
    }


def merge_pending(rows: list[dict]) -> tuple[int, int, int, int]:
    news = json.loads(NEWS_FILE.read_text(encoding="utf-8"))
    pending = json.loads(PENDING_FILE.read_text(encoding="utf-8")) if PENDING_FILE.exists() else []
    if not isinstance(pending, list):
        raise ValueError("Fichier des actualités en attente invalide.")
    published = {activity_id(row.get("link")) for row in news}
    existing: dict[str, dict] = {}
    for entry in pending:
        if not isinstance(entry, dict):
            continue
        aid = str(entry.get("activity_id") or "")
        if aid and aid not in published and aid not in existing:
            existing[aid] = entry
    expected_account = os.environ.get("WINDSOR_LINKEDIN_ACCOUNT_ID", "").strip()
    recognized = 0
    rejected = 0
    added = 0
    for row in rows:
        item = candidate(row, expected_account)
        if item is None:
            rejected += 1
            continue
        recognized += 1
        aid = item["activity_id"]
        if aid in published or aid in existing:
            continue
        existing[aid] = item
        added += 1
    queue = sorted(existing.values(), key=lambda item: int(item.get("activity_id", "0")), reverse=True)
    serialized = json.dumps(queue, ensure_ascii=False, indent=2) + "\n"
    if not PENDING_FILE.exists() or PENDING_FILE.read_text(encoding="utf-8") != serialized:
        PENDING_FILE.write_text(serialized, encoding="utf-8")
    return recognized, rejected, added, len(queue)


def self_test() -> None:
    def activity_at(when: str) -> str:
        ms = int(datetime.fromisoformat(when).replace(tzinfo=timezone.utc).timestamp() * 1000)
        return str((ms << 22) + 1048576)
    aid = activity_at("2026-10-18T12:00:00")
    good = {
        "account_name": "Groupe SERILEC", "account_id": "999",
        "share_activity": f"urn:li:activity:{aid}",
        "share_audience_type_all_followers": True,
        "share_text": "Actualité publique SERILEC", "share_title": "Nouveau chantier",
        "share_published_time": "2026-10-18T12:00:00Z",
    }
    c = candidate(good)
    assert c and c["activity_id"] == aid and c["review_status"] == "pending"
    assert c["public_visibility"] == "declared_public"
    assert candidate({**good, "account_name": "SERIELEC"}) is None
    assert candidate({**good, "share_audience_type_all_followers": False}) is None
    assert candidate({**good, "share_activity": "", "post_id": aid}) is None
    assert candidate({**good, "share_published_time": "2025-10-18"})["review_status"] == "date_a_verifier"
    assert candidate(good, expected_account="888") is None
    assert rows_from_response({"data": [good]}) == [good]
    assert parsed_date(1792324800000) == date(2026, 10, 18)
    print("Tests Windsor : identité, visibilité, dates, identifiants et format JSON validés.")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    rows = fetch_posts()
    if not rows:
        raise ValueError("Aucune ligne Windsor LinkedIn Pages retournée : vérifier la connexion de la page SERILEC.")
    recognized, rejected, added, total = merge_pending(rows)
    if not recognized:
        raise ValueError("Aucun post du compte SERILEC identifiable dans Windsor (vérifier account_name/account_id).")
    print(
        f"Windsor LinkedIn Pages : {len(rows)} lignes, {recognized} SERILEC, "
        f"{rejected} écartées, {added} nouveautés, {total} en attente de vérification."
    )
    print("Sécurité : aucune nouvelle publication n'a été mise en ligne.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as exc:
        print(f"ERREUR WINDSOR : {exc}", file=sys.stderr)
        raise SystemExit(1)
