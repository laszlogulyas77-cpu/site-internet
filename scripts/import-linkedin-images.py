#!/usr/bin/env python3
from __future__ import annotations

import json
import mimetypes
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "linkedin-image-import.json"
USER_AGENT = "Mozilla/5.0 (compatible; SERILEC-Site-Importer/1.0)"


def download(url: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"})
    last_error = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = response.read()
                content_type = response.headers.get_content_type()
            if len(payload) < 10_000:
                raise RuntimeError(f"Image trop petite ({len(payload)} octets)")
            if content_type and not content_type.startswith("image/"):
                raise RuntimeError(f"Type MIME inattendu: {content_type}")
            target.write_bytes(payload)
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Impossible de télécharger {url}: {last_error}")


def main() -> int:
    if not MANIFEST.exists():
        print("Aucun manifeste LinkedIn à importer.")
        return 0

    entries = json.loads(MANIFEST.read_text(encoding="utf-8"))
    imported = 0
    skipped = 0
    failed = []

    for entry in entries:
        target = ROOT / entry["target"]
        if target.exists() and target.stat().st_size >= 10_000:
            skipped += 1
            continue
        try:
            print(f"Téléchargement {entry.get('activity', '')}: {entry.get('title', target.name)}")
            download(entry["source_url"], target)
            imported += 1
        except Exception as exc:  # noqa: BLE001
            failed.append((entry.get("activity", "?"), str(exc)))

    print(f"Visuels LinkedIn: {imported} importés, {skipped} déjà présents.")
    if failed:
        print("Échecs d'import:", file=sys.stderr)
        for activity, error in failed:
            print(f"- {activity}: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
