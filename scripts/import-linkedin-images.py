#!/usr/bin/env python3
from __future__ import annotations

import json
import mimetypes
import struct
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "linkedin-image-import.json"
USER_AGENT = "Mozilla/5.0 (compatible; SERILEC-Site-Importer/1.0)"


MIN_PNG_WIDTH = 1400


def png_dimensions(path: Path) -> tuple[int, int] | None:
    try:
        header = path.read_bytes()[:24]
        if len(header) >= 24 and header.startswith(b"\x89PNG\r\n\x1a\n"):
            width, height = struct.unpack(">II", header[16:24])
            return width, height
    except OSError:
        pass
    return None


def existing_target_is_good(target: Path) -> bool:
    if not target.exists() or target.stat().st_size < 10_000:
        return False
    if target.suffix.lower() == ".png":
        dims = png_dimensions(target)
        if dims and dims[0] < MIN_PNG_WIDTH:
            print(f"Régénération HD requise pour {target.name}: {dims[0]}x{dims[1]}")
            return False
    return True


def download(url: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/pdf,image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Referer": "https://www.linkedin.com/",
        },
    )
    last_error = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = response.read()
                content_type = response.headers.get_content_type()
            if len(payload) < 10_000:
                raise RuntimeError(f"Fichier trop petit ({len(payload)} octets)")

            is_pdf = content_type == "application/pdf" or payload.startswith(b"%PDF-")
            if is_pdf:
                with tempfile.TemporaryDirectory(prefix="linkedin-pdf-") as tmpdir:
                    pdf_path = Path(tmpdir) / "source.pdf"
                    out_prefix = Path(tmpdir) / "page"
                    pdf_path.write_bytes(payload)
                    subprocess.run(
                        ["pdftoppm", "-f", "1", "-singlefile", "-png", "-scale-to-x", "1800", "-scale-to-y", "-1", str(pdf_path), str(out_prefix)],
                        check=True,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.PIPE,
                    )
                    rendered = out_prefix.with_suffix(".png")
                    if not rendered.exists() or rendered.stat().st_size < 10_000:
                        raise RuntimeError("Conversion de la première page PDF en PNG échouée")
                    dims = png_dimensions(rendered)
                    if not dims or dims[0] < MIN_PNG_WIDTH:
                        raise RuntimeError(f"PNG LinkedIn encore trop petit après conversion: {dims}")
                    target.write_bytes(rendered.read_bytes())
                return

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
        if existing_target_is_good(target):
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
