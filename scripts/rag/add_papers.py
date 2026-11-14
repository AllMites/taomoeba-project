"""Lane B: add the downloaded NASA papers (x5 experiment folder) to the library, split by licence.

Usage:  python scripts/rag/add_papers.py <x5-rag-experiment folder> [--more library/raw]
        python scripts/rag/retrieve.py            (then rebuild public/data/index.json)

--more adds the sources in scripts/rag/more_sources.json (challenge resources, Apollo 1/13, Mir), downloaded
by scripts/rag/download_more.py. NASA web pages and NASA documents are public domain; NTRS items follow the
licence in their saved citation record. Reading PDFs needs pypdf (pip install pypdf).

Open papers (NTRS "government work, public use permitted" = public domain):
    full text -> corpus/text/ntrs_<id>.md (committed, public), listed in public/data/sources.json.
Restricted papers (NTRS "public use permitted", "government use permitted", "may include copyrighted
material" = short quotes only):
    text -> library/restricted-index.json, which is NOT committed (see .gitignore) and is uploaded to the
    Worker's private KV store (binding LIBRARY, key "restricted-index"). It is never a public file.
    Only metadata (id, title, url, licence, no text) goes to public/data/library.json.
    The Worker quotes these at most 15 words at a time and paraphrases the rest (server/ask.ts).
Journal articles (publisher copyright) and the team's own report are skipped.
"""
from __future__ import annotations

import csv
import json
import re
import sys
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rag.common import DATA, ROOT, TEXT, sentences, words  # noqa: E402
from rag.retrieve import chunk_text  # noqa: E402

OPEN_LICENSE = "Public domain (NTRS: government work, public use permitted)"
RESTRICTED_LICENSE = {
    "PUBLIC_USE_PERMITTED": "NTRS: public use permitted (short quotes only)",
    "GOV_PERMITTED": "NTRS: government use permitted (short quotes only)",
    "MAY_INCLUDE_COPYRIGHT_MATERIAL": "NTRS: may include copyrighted material (short quotes only)",
}
TOPIC = {"Detection": "detection", "Suppression": "suppression", "Prevention": "fire-growth"}
# Text files that hold a paper whose PDF text was not in corpus/text (too big or scanned).
EXTRA_TEXT = {
    "ntrs:20150023456": "incoming/flex_tp.txt",  # FLEX Detailed Results (TP-2015-216046)
    "ntrs:20210011385": "incoming/bass2.txt",  # BASS-II Summary Report
    "ntrs:20240002981": "incoming/saffire6.txt",  # Saffire VI preliminary results
    "ntrs:20220015583": "incoming/acme2023_ocr.txt",  # ACME overview (scanned slides, OCR)
}
LIBRARY_DIR = ROOT / "library"
RESTRICTED_OUT = LIBRARY_DIR / "restricted-index.json"
LIBRARY_META = DATA / "library.json"
SOURCES = DATA / "sources.json"

_HEADING = re.compile(r"^\s*(references|bibliography|acknowledge?ments?)\s*:?\s*$", re.I)
_REF_START = re.compile(r"^\s*(references|REFERENCES)\s*:", re.I)
_SECTION = re.compile(r"^\s*(\d+(\.\d+)*\.?\s+[A-Z][A-Za-z].{2,80}|[A-Z][A-Z \-]{4,60}|Chapter \d+.*)\s*$")


def clean(raw: str) -> str:
    """PDF text -> paragraphs: drop reference lists and acknowledgments, page numbers, rejoin wrapped lines."""
    raw = raw.replace("\r", "").replace("\f", "\n\n")
    raw = raw.replace("ﬁ", "fi").replace("ﬂ", "fl").replace("ﬀ", "ff").replace("’", "'").replace("‘", "'")
    raw = raw.replace("“", '"').replace("”", '"').replace("­", "")
    raw = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", raw)
    out, skipping = [], False
    for line in raw.split("\n"):
        s = line.strip()
        if re.search(r"\.{6,}", s):
            continue  # table of contents
        if re.match(r"^Appendix( [A-Z])?\.?\s*[\u2014-]", s):
            break  # appendices: per-test tables and reprints, not prose
        if _HEADING.match(s) or _REF_START.match(s):
            skipping = True
            continue
        if skipping:
            # a reference list runs until the next section heading of the report
            if _SECTION.match(s) and not re.match(r"^\s*\[?\d+\]?\s+[A-Z][a-z]+,", s):
                skipping = False
            else:
                continue
        if re.fullmatch(r"\d{1,4}|Page \d+.*|NASA/T[MP].*", s):
            continue
        out.append(s)
    text = "\n".join(out)
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # flam-\nmability
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", text)]
    # reference entries that slipped through (no heading line): sentences thick with citation marks
    paras = [" ".join(x for x in sentences(p) if not _citation(x)) for p in paras]
    return "\n\n".join(p for p in paras if words(p) >= 4)


_CITE = re.compile(r"\bvol\.|\bpp\.|\bno\. \d|Proc(eedings|\.)|Combust\.|Symposium|\bJ\. [A-Z]|et al\.,? \(?(19|20)\d\d|\bdoi\b|AIAA[- ]\d")


def _citation(sentence: str) -> bool:
    return len(_CITE.findall(sentence)) >= 2 and words(sentence) < 80


def _noisy(text: str) -> bool:
    """A paragraph of scan garbage (OCR of 1960s typescript): stray symbols and vowel-less letter runs."""
    toks = text.split()
    junk = sum(1 for t in toks if re.search(r"[~^_|\\{}<>]|[A-Za-z][0-9][A-Za-z]", t)
               or (len(t) > 2 and t.isalpha() and not re.search(r"[aeiouyAEIOUY]", t)))
    return junk > 0.08 * max(len(toks), 1)


_COMMON = {"the", "and", "of", "to", "in", "a", "is", "was", "for", "with", "on", "that", "by", "as", "are", "at",
           "be", "this", "from", "were", "it", "an", "or", "which", "not", "has", "have"}


def _gibberish(text: str) -> bool:
    """Font-encoded PDF text ("1EVO ,MGOQER ...") has none of the common English words real prose is full of."""
    toks = re.findall(r"[a-z]+", text.lower())
    return len(toks) >= 30 and sum(t in _COMMON for t in toks) < 0.08 * len(toks)


def _bad(text: str) -> bool:
    return _table(text) or _noisy(text) or _gibberish(text)


def isopen(lic: str) -> bool:
    return lic.startswith(("CC0", "Public domain"))


def _table(text: str) -> bool:
    """A chunk that is mostly numbers is a table copied out of a PDF, not prose anyone can quote."""
    toks = text.split()
    return sum(bool(re.fullmatch(r"[-+(]?[\d.,%]+[)]?|Yes|No|-", t)) for t in toks) > 0.3 * max(len(toks), 1)


def first_sentence(text: str) -> str:
    for s in sentences(text.replace("\n\n", " ")):
        if 8 <= words(s) <= 40 and not re.search(r"@|\(\d\)|Cleveland|University|Center,", s):
            return s
    return sentences(text)[0]


NASA_LICENSE = "Public domain (NASA work, U.S. government; nasa.gov)"
MANIFEST = Path(__file__).with_name("more_sources.json")
_BOILER = re.compile(r"^(Suggested Searches|Share|Details|Last Updated|Related Terms|Keep Exploring|Discover More|"
                     r"Image credit|Credits?:|NASA$|Contact|Editor|Explore|Read More|Source: |The Report of Apollo 204 Review Board \(PDFs\))", re.I)


class _Html(HTMLParser):
    """Paragraph text from a NASA page: p, li, h1-h4, blockquote and td, inside <main>/<article> when present."""

    BLOCK = {"p", "li", "h1", "h2", "h3", "h4", "blockquote", "td", "pre"}
    SKIP = {"script", "style", "nav", "header", "footer", "noscript", "svg", "form", "figcaption"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.paras: list[tuple[bool, str]] = []  # (inside main/article, text)
        self.cur: list[str] | None = None
        self.skip = 0
        self.main = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        if tag in ("main", "article"):
            self.main += 1
        if tag in self.BLOCK and not self.skip:
            self._flush()
            self.cur = []
        if tag == "br" and self.cur is not None:
            self.cur.append(" ")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip:
            self.skip -= 1
        if tag in self.BLOCK:
            self._flush()
        if tag in ("main", "article") and self.main:
            self.main -= 1

    def handle_data(self, data):
        if self.cur is not None and not self.skip:
            self.cur.append(data)

    def _flush(self):
        if self.cur is not None:
            t = re.sub(r"\s+", " ", "".join(self.cur)).strip()
            if t:
                self.paras.append((self.main > 0, t))
        self.cur = None


def html_text(raw: str) -> str:
    h = _Html()
    h.feed(raw)
    h._flush()
    inside = [t for m, t in h.paras if m]
    paras = inside if words(" ".join(inside)) > 100 else [t for _, t in h.paras]
    seen, out = set(), []
    for t in paras:
        if words(t) < 6 or _BOILER.match(t) or t in seen:
            continue
        if words(t) < 30 and not re.search(r"[.!?:;)\"']$", t):
            continue  # a heading or a contents-list entry, not a sentence
        seen.add(t)
        out.append(t)
    return "\n\n".join(out)


def pdf_text(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        sys.exit("Reading PDFs needs pypdf:  pip install pypdf")
    return "\n\n".join((pg.extract_text() or "") for pg in PdfReader(str(path)).pages)


def more_items(raw_dir: Path):
    """(manifest item, cleaned text, licence or None) for each downloaded source in more_sources.json."""
    for it in json.loads(MANIFEST.read_text(encoding="utf-8"))["items"]:
        stem = it["id"].replace(":", "_")
        files = [p for p in raw_dir.glob(stem + ".*") if not p.name.endswith(".citation.json")]
        if not files:
            print("not downloaded, skipped:", it["id"])
            continue
        f = files[0]
        raw = f.read_text(encoding="utf-8", errors="replace") if f.suffix != ".pdf" else ""
        text = pdf_text(f) if f.suffix == ".pdf" else html_text(raw) if f.suffix == ".html" else raw
        lic = NASA_LICENSE
        if it["id"].startswith("ntrs:"):
            cit = raw_dir / (stem + ".citation.json")
            det = json.loads(cit.read_text(encoding="utf-8")).get("copyright", {}).get("determinationType") if cit.exists() else None
            lic = OPEN_LICENSE if det == "GOV_PUBLIC_USE_PERMITTED" else RESTRICTED_LICENSE.get(det or "")
        yield it, text, lic


def main(x5: Path, more: Path | None = None) -> None:
    rows = list(csv.DictReader(open(x5 / "corpus" / "sources.csv", encoding="utf-8")))
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))
    have = {s["id"] for s in sources["items"]}
    restricted_meta, restricted_chunks, added_open = [], [], []
    today = date.today().isoformat()
    for r in rows:
        sid = r["source_id"]
        if r["kind"] != "ntrs_paper":
            continue  # PSI records are already in; journal articles and the team report are not ours to publish
        nid = sid.split(":", 1)[1]
        path = x5 / EXTRA_TEXT[sid] if sid in EXTRA_TEXT else x5 / "corpus" / "text" / f"{nid}.txt"
        if not path.exists():
            print("no text, skipped:", sid)
            continue
        body = clean(path.read_text(encoding="utf-8", errors="replace"))
        body = "\n\n".join(p for p in body.split("\n\n") if not _bad(p))
        if words(body) < 150:
            print("too little text, skipped:", sid)
            continue
        det = re.search(r"determinationType=(\w+)", r["license_note"])
        det = det.group(1) if det else ""
        title = re.sub(r"\s+", " ", r["title"]).strip()
        url = r["url"]
        invs = [p for p in r["psi_ids"].split(";") if p]
        if det == "GOV_PUBLIC_USE_PERMITTED":
            # Public domain: full text into the public corpus. An existing abstract file keeps its abstract.
            out = TEXT / f"ntrs_{nid}.md"
            abstract = ""
            if out.exists():
                old = out.read_text(encoding="utf-8").partition("\n---\n")[2]
                abstract = old.split("## Full text")[0].strip()
            meta = {"id": sid, "title": title, "url": url, "doi": "none given by NTRS", "license": OPEN_LICENSE,
                    "retrieved": today, "type": "ntrs", "topic": TOPIC.get(r["pillar"], "other")}
            head = "\n".join(f"{k}: {v}" for k, v in meta.items())
            parts = ([abstract] if abstract else []) + [f"## Full text\n\n{body}"]
            out.write_text(f"{head}\n---\n" + "\n\n".join(parts) + "\n", encoding="utf-8", newline="\n")
            if sid not in have:
                sources["items"].append({"id": sid, "title": title, "url": url, "excerpt": first_sentence(body),
                                         "license": OPEN_LICENSE})
                have.add(sid)
            added_open.append(sid)
        elif det in RESTRICTED_LICENSE:
            lic = RESTRICTED_LICENSE[det]
            restricted_meta.append({"id": sid, "title": title, "url": url, "license": lic, "year": r["year"],
                                    "investigationIds": invs})
            for i, text in enumerate(t for t in chunk_text(body) if not _bad(t)):
                restricted_chunks.append({"id": f"{sid}#{i}", "sourceId": sid,
                                          "investigationId": invs[0] if invs else None, "title": title, "text": text})
        else:
            print("unknown licence, skipped:", sid, det)
    for it, text, lic in more_items(more) if more else []:
        sid, title, url = it["id"], it["title"], it["url"]
        body = "\n\n".join(p for p in clean(text).split("\n\n") if not _bad(p))
        if words(body) < 80:
            print("too little text, skipped:", sid)
            continue
        if lic is None:
            print("licence unknown, skipped:", sid)
            continue
        if isopen(lic):
            meta = {"id": sid, "title": title, "url": url, "doi": "none given", "license": lic, "retrieved": today,
                    "type": sid.split(":")[0], "topic": it.get("topic", "other")}
            head = "\n".join(f"{k}: {v}" for k, v in meta.items())
            (TEXT / (sid.replace(":", "_") + ".md")).write_text(f"{head}\n---\n## Full text\n\n{body}\n",
                                                               encoding="utf-8", newline="\n")
            if sid not in have:
                sources["items"].append({"id": sid, "title": title, "url": url, "excerpt": first_sentence(body),
                                         "license": lic})
                have.add(sid)
            added_open.append(sid)
        else:
            invs = it.get("investigations", [])
            restricted_meta.append({"id": sid, "title": title, "url": url, "license": lic, "year": "",
                                    "investigationIds": invs})
            for i, chunk in enumerate(t for t in chunk_text(body) if not _bad(t)):
                restricted_chunks.append({"id": f"{sid}#{i}", "sourceId": sid,
                                          "investigationId": invs[0] if invs else None, "title": title, "text": chunk})
    SOURCES.write_text(json.dumps(sources, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    LIBRARY_DIR.mkdir(exist_ok=True)
    RESTRICTED_OUT.write_text(json.dumps({"chunks": restricted_chunks}, ensure_ascii=False, separators=(",", ":")),
                              encoding="utf-8", newline="\n")
    LIBRARY_META.write_text(json.dumps({"items": restricted_meta}, indent=1, ensure_ascii=False) + "\n",
                            encoding="utf-8", newline="\n")
    print(f"open full text: {len(added_open)} papers -> corpus/text (run scripts/rag/retrieve.py next)")
    print(f"restricted: {len(restricted_meta)} papers, {len(restricted_chunks)} chunks -> {RESTRICTED_OUT} "
          f"({RESTRICTED_OUT.stat().st_size // 1024} KB, private: upload to KV, never commit)")


if __name__ == "__main__":
    args = sys.argv[1:]
    more_dir = None
    if "--more" in args:
        i = args.index("--more")
        more_dir = Path(args[i + 1])
        args = args[:i] + args[i + 2:]
    if len(args) != 1:
        sys.exit(__doc__)
    main(Path(args[0]), more_dir)
