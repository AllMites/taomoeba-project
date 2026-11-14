"""BM25 over ~300-word chunks. Stdlib only; the same math runs in the Worker.

Build:    python scripts/rag/retrieve.py          (writes public/data/index.json)
Retrieve: from rag.retrieve import retrieve; retrieve("smoke detector", k=5)

Worker contract (public/data/index.json):
  chunks[i] = {id, sourceId, investigationId|null, title, text, len}
  scored text of a chunk = title + " " + text, tokenized with `tokenizer` (see common.tokenize):
    lowercase, runs of [a-z0-9], drop len<2 and stopwords, strip one trailing "s" when len>3 and not "ss".
  idf[term] = ln(1 + (N - n + 0.5) / (n + 0.5)); score = sum idf*tf*(k1+1) / (tf + k1*(1-b+b*len/avgLen)).
"""
from __future__ import annotations

import json
import math
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rag.common import DATA, STOPWORDS, load_corpus, sentences, tokenize  # noqa: E402

K1, B = 1.5, 0.75
CHUNK_WORDS = 300
INDEX_PATH = DATA / "index.json"


# Query-side synonyms. The corpus writes "CO2", "O2" and "extinguish..." where people ask "carbon dioxide",
# "oxygen" and "put out". Applied to the QUERY only (the index is unchanged): when a left-hand phrase is in the
# query, its right-hand terms are appended. Lane E: mirror this list in server/bm25.ts before tokenizing the question.
SYNONYMS = [
    (r"\bcarbon dioxide\b", "co2"), (r"\bco2\b", "carbon dioxide"),
    (r"\boxygen\b", "o2"), (r"\bo2\b", "oxygen"),
    (r"\bnitrogen\b", "n2"), (r"\bn2\b", "nitrogen"),
    (r"\bhelium\b", "he"), (r"\bhe\b", "helium"),
    (r"\b(put|puts|putting) out\b", "extinguish extinguishment extinction"),
]


def expand_query(query: str) -> str:
    low = query.lower()
    extra = [add for pat, add in SYNONYMS if re.search(pat, low)]
    return " ".join([query] + extra)


def chunk_text(body: str, target: int = CHUNK_WORDS) -> list[str]:
    """Pack whole sentences into chunks of about `target` words (never splits a sentence)."""
    out, cur, n = [], [], 0
    for sent in sentences(body.replace("\n\n", " ").replace("## ", "")):
        w = len(sent.split())
        if cur and n + w > target:
            out.append(" ".join(cur))
            cur, n = [], 0
        cur.append(sent)
        n += w
    if cur:
        out.append(" ".join(cur))
    return out


def build_index() -> dict:
    chunks = []
    for sid, src in load_corpus().items():
        inv = sid.split(":", 1)[1] if sid.startswith("psi:") else None
        body = "\n\n".join(f"{v}" for v in src["sections"].values())
        for i, text in enumerate(chunk_text(body)):
            title = src["meta"]["title"]
            n = len(tokenize(title + " " + text))
            chunks.append({"id": f"{sid}#{i}", "sourceId": sid, "investigationId": inv, "title": title,
                           "text": text, "len": n})
    df: Counter = Counter()
    for c in chunks:
        df.update(set(tokenize(c["title"] + " " + c["text"])))
    N = len(chunks)
    idf = {t: round(math.log(1 + (N - n + 0.5) / (n + 0.5)), 4) for t, n in sorted(df.items())}
    avg = sum(c["len"] for c in chunks) / N
    return {"k1": K1, "b": B, "avgLen": round(avg, 2),
            "tokenizer": {"lowercase": True, "pattern": "[a-z0-9]+", "minLen": 2, "stripPluralS": True,
                          "stopwords": STOPWORDS},
            "chunks": chunks, "idf": idf}


_cache: dict | None = None


def load_index(path: Path = INDEX_PATH) -> dict:
    global _cache
    if _cache is None or path != INDEX_PATH:
        data = json.loads(path.read_text(encoding="utf-8"))
        if path != INDEX_PATH:
            return data
        _cache = data
    return _cache


def retrieve(query: str, k: int = 5, index: dict | None = None, investigation_id: str | None = None) -> list[dict]:
    """Top-k chunks by BM25: [{chunk, score}], best first; zero-score chunks are dropped."""
    idx = index or load_index()
    q = tokenize(expand_query(query))
    idf, avg, k1, b = idx["idf"], idx["avgLen"], idx["k1"], idx["b"]
    scored = []
    for c in idx["chunks"]:
        if investigation_id and c["investigationId"] != investigation_id:
            continue
        tf = Counter(tokenize(c["title"] + " " + c["text"]))
        s = 0.0
        for t in q:
            f = tf.get(t, 0)
            if f:
                s += idf.get(t, 0.0) * f * (k1 + 1) / (f + k1 * (1 - b + b * c["len"] / avg))
        if s > 0:
            scored.append({"chunk": c, "score": round(s, 4)})
    scored.sort(key=lambda r: -r["score"])
    return scored[:k]


def main() -> None:
    idx = build_index()
    INDEX_PATH.write_text(json.dumps(idx, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(idx['chunks'])} chunks, {len(idx['idf'])} terms, avgLen {idx['avgLen']}, "
          f"{INDEX_PATH.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
