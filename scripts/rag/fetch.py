"""Lane B: fetch PSI + NTRS records, write corpus/text/*.md and public/data/sources.json.

Run: python scripts/rag/fetch.py   (network on first run; raw responses cached in corpus/raw/)
"""
from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "corpus" / "raw"
TEXT = ROOT / "corpus" / "text"
OUT = ROOT / "public" / "data" / "sources.json"

PSI_SEARCH = "https://psi.nasa.gov/geode-py/ws/repo/search?term=combustion&source=psi&type=investigation&size=50"
PSI_RECORD = "https://psi.nasa.gov/geode-py/ws/repo/search?term={id}&source=psi&type=investigation"
PSI_EXTRA = ["PSI-20", "PSI-22", "PSI-47"]  # ACME BRE, E-FIELD, DAFT: already in search, kept explicit
PSI_LICENSE = "CC0 1.0 (PSI investigation data; public domain dedication stated by NASA PSI)"

# Public NASA / NTRS records that add findings a PSI record lacks. topic: detection | suppression | fire-growth
NTRS = {  # open licences only (NTRS GOV_PUBLIC_USE_PERMITTED); "short quotes only" records were dropped
    "20010074094": "detection",
    "20170007283": "detection",
    "19960008413": "detection",
    "20040053582": "suppression",
}
NTRS_LICENSE = {
    "GOV_PUBLIC_USE_PERMITTED": "Public domain (NTRS: government work, public use permitted)",
    "PUBLIC_USE_PERMITTED": "NTRS: public use permitted (short quotes only)",
    "GOV_PERMITTED": "NTRS: government use permitted (short quotes only)",
    "MAY_INCLUDE_COPYRIGHT_MATERIAL": "NTRS: may include copyrighted material (short quotes only)",
}


def fix(s: str) -> str:
    """Normalize PSI/NTRS text: replacement chars, ligatures, whitespace (kept per paragraph)."""
    s = s.replace("ﬁ", "fi").replace("ﬂ", "fl").replace("ﬀ", "ff")
    s = re.sub("�(?=s\\b)", "'", s).replace("�", "-")
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"([a-z]{3}[.!?])([A-Z])", lambda m: m.group(1) + " " + m.group(2), s)  # fused sentences ("...evaluated.The ...")
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n|\n", s)]
    return "\n\n".join(p for p in paras if p)


def get(url: str, cache: Path) -> dict:
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    req = urllib.request.Request(url, headers={"User-Agent": "flame-in-freefall-corpus/0.1"})
    data = urllib.request.urlopen(req, timeout=60).read()
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(data)
    return json.loads(data.decode("utf-8"))


def write_text(sid: str, meta: dict, body: str) -> None:
    TEXT.mkdir(parents=True, exist_ok=True)
    head = "\n".join(f"{k}: {v}" for k, v in meta.items())
    (TEXT / (sid.replace(":", "_") + ".md")).write_text(f"{head}\n---\n{body}\n", encoding="utf-8", newline="\n")


def first_sentences(text: str, max_chars: int = 320) -> str:
    sents = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9(])", text.replace("\n\n", " "))
    return sents[0] if sents else text[:max_chars]


def main() -> None:
    today = date.today().isoformat()
    sources = []
    hits = get(PSI_SEARCH, RAW / "search.json")["hits"]["hits"]
    for h in sorted(hits, key=lambda h: int(h["_source"]["Accession"].split("-")[1])):
        s = h["_source"]
        pid = s["Accession"]
        sid = f"psi:{pid}"
        title = fix(s["Title"]) + (f" ({fix(s['Acronym'])})" if s.get("Acronym") else "")
        url = PSI_RECORD.format(id=pid)
        sections = []
        for key, label in [("Objectives", "Objectives"), ("Approach", "Approach"), ("Hypothesis", "Hypothesis"),
                           ("Research Impacts/Earth Benefits", "Research impacts and Earth benefits")]:
            if s.get(key):
                sections.append(f"## {label}\n\n{fix(s[key])}")
        hw = s.get("Experiment Hardware")
        if isinstance(hw, dict) and hw.get("Name"):
            sections.append(f"## Experiment hardware\n\n{fix(hw['Name'])}")
        body = "\n\n".join(sections)
        write_text(sid, {"id": sid, "title": title, "url": url, "doi": "none given by PSI", "license": PSI_LICENSE,
                         "retrieved": today, "type": "psi"}, body)
        obj = fix(s.get("Objectives", "")) or fix(s.get("Approach", ""))
        sources.append({"id": sid, "title": title, "url": url, "excerpt": first_sentences(obj), "license": PSI_LICENSE})
    for nid, topic in NTRS.items():
        r = get(f"https://ntrs.nasa.gov/api/citations/{nid}", RAW / "ntrs" / f"{nid}.json")
        sid = f"ntrs:{nid}"
        title = fix(r["title"])
        url = f"https://ntrs.nasa.gov/citations/{nid}"
        lic = NTRS_LICENSE.get(r.get("copyright", {}).get("determinationType"), "NTRS: see record (short quotes only)")
        doi = r.get("doi")
        abstract = fix(r.get("abstract", ""))
        meta = {"id": sid, "title": title, "url": url, "doi": doi or "none given by NTRS", "license": lic,
                "retrieved": today, "type": "ntrs", "topic": topic}
        write_text(sid, meta, f"## Abstract\n\n{abstract}")
        src = {"id": sid, "title": title, "url": url, "excerpt": first_sentences(abstract), "license": lic}
        if doi:
            src["doi"] = doi
        sources.append(src)
    OUT.write_text(json.dumps({"items": sources}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(sources)} sources")


if __name__ == "__main__":
    main()
