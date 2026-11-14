"""Lane B: BM25 index and retrieve()."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rag.common import DATA  # noqa: E402
from rag.retrieve import retrieve  # noqa: E402


def test_index_shape_and_retrieval():
    idx = json.loads((DATA / "index.json").read_text(encoding="utf-8"))
    sids = {s["id"] for s in json.loads((DATA / "sources.json").read_text(encoding="utf-8"))["items"]}
    assert idx["chunks"] and idx["idf"] and idx["avgLen"] > 0
    assert all(c["sourceId"] in sids for c in idx["chunks"])
    top = retrieve("smoke particles detector spacecraft", k=3, index=idx)
    assert top and top[0]["score"] >= top[-1]["score"] > 0
    assert any("smoke" in r["chunk"]["text"].lower() for r in top)
    scoped = retrieve("flame", k=5, index=idx, investigation_id="psi:PSI-99".split(":")[1])
    assert scoped and all(r["chunk"]["investigationId"] == "PSI-99" for r in scoped)
