"""Shared text helpers for Lane B: corpus loading, sentence split, tokenizer (BM25), lenient matching."""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEXT = ROOT / "corpus" / "text"
DATA = ROOT / "public" / "data"

STOPWORDS = sorted(
    "a an and are as at be been but by can for from has have in is it its of on or that the their this to was were "
    "which with will would not these those than then there into also such both each other more most may could "
    "should being does did do how what when where who whom why".split()
)
_STOP = set(STOPWORDS)


def tokenize(text: str) -> list[str]:
    """lowercase, [a-z0-9]+ runs, length >= 2, stopwords dropped, trailing plural 's' stripped (len > 3)."""
    out = []
    for t in re.findall(r"[a-z0-9]+", text.lower()):
        if len(t) < 2 or t in _STOP:
            continue
        if len(t) > 3 and t.endswith("s") and not t.endswith("ss"):
            t = t[:-1]
        out.append(t)
    return out


def norm(s: str) -> str:
    """Lenient form for excerpt matching: unfold ligatures/compat, rejoin hyphen-split words, drop spacing/quotes."""
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("­", "")
    s = re.sub(r"-\s*\n\s*", "", s)
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", s).strip().lower()


def sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9(\"'])", text)
    return [p.strip() for p in parts if p.strip()]


def load_source_text(path: Path) -> tuple[dict, str]:
    raw = path.read_text(encoding="utf-8")
    head, _, body = raw.partition("\n---\n")
    meta = dict(line.split(": ", 1) for line in head.splitlines() if ": " in line)
    return meta, body


def load_corpus() -> dict[str, dict]:
    """sourceId -> {meta, body, sections: {name: text}}"""
    out = {}
    for p in sorted(TEXT.glob("*.md")):
        meta, body = load_source_text(p)
        sections: dict[str, str] = {}
        for chunk in re.split(r"^## ", body, flags=re.M):
            if not chunk.strip():
                continue
            name, _, rest = chunk.partition("\n")
            sections[name.strip()] = rest.strip()
        out[meta["id"]] = {"meta": meta, "body": body, "sections": sections}
    return out


def words(s: str) -> int:
    return len(s.split())


_LIST_ITEM = re.compile(r"^(\d+\s*[.)]+|\(\d+\)|[-*])\s")


def units(text: str) -> list[str]:
    """Claim-eligible sentences. A list lead-in ("...are to:") is merged with its numbered items so it is never
    cut off; orphan list items are skipped."""
    paras = [p for p in text.split("\n\n") if p.strip()]
    out, i = [], 0
    while i < len(paras):
        p = paras[i]
        if p.rstrip().endswith(":"):
            j, items = i + 1, []
            while j < len(paras) and _LIST_ITEM.match(paras[j]):
                items.append(paras[j])
                j += 1
            if items:
                out.append(" ".join([p] + items))
                i = j
                continue
        if _LIST_ITEM.match(p):
            i += 1
            continue
        out.extend(sentences(p))
        i += 1
    return out
