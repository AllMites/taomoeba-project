"""Download the sources listed in scripts/rag/more_sources.json into library/raw/ (not committed).

Run from the project folder:  python scripts/rag/download_more.py
Standard library only. Already-downloaded files are skipped, so it is safe to run again.
For NTRS items it also saves NASA's citation record (<id>.citation.json), which states the licence.
"""
from __future__ import annotations

import json
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "library" / "raw"
MANIFEST = Path(__file__).with_name("more_sources.json")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) flame-in-freefall-corpus/0.2"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    items = json.loads(MANIFEST.read_text(encoding="utf-8"))["items"]
    ok = failed = 0
    for it in items:
        stem = it["id"].replace(":", "_")
        url = it["download"]
        ext = ".pdf" if url.lower().endswith(".pdf") else ".txt" if url.lower().endswith(".txt") else ".html"
        out = RAW / (stem + ext)
        try:
            if not out.exists():
                out.write_bytes(fetch(url))
                time.sleep(1)
            if it["id"].startswith("ntrs:"):
                cit = RAW / (stem + ".citation.json")
                if not cit.exists():
                    cit.write_bytes(fetch(f"https://ntrs.nasa.gov/api/citations/{it['id'].split(':')[1]}"))
            print(f"ok      {it['id']}  ({out.stat().st_size // 1024} KB)")
            ok += 1
        except Exception as e:  # keep going; a failed item is listed at the end
            print(f"FAILED  {it['id']}  {e}")
            failed += 1
    print(f"\n{ok} downloaded, {failed} failed -> {RAW}")


if __name__ == "__main__":
    main()
