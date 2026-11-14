"""Lane B: offline checks on committed corpus, sources.json, claims.json."""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rag.common import DATA, ROOT, load_corpus, norm, words  # noqa: E402

SCHEMAS = ROOT / "src" / "contracts" / "schema"
NOT_COMBUSTION = {"PSI-108", "PSI-181"}


def _load(name):
    doc = json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))
    assert "fixture" not in doc
    return doc["items"]


@pytest.fixture(scope="module")
def corpus():
    return load_corpus()


@pytest.fixture(scope="module")
def sources():
    return _load("sources")


@pytest.fixture(scope="module")
def claims():
    return _load("claims")


def _validator(name):
    return Draft202012Validator(json.loads((SCHEMAS / f"{name}.json").read_text(encoding="utf-8")))


def test_sources_schema_and_count(sources, corpus):
    v = _validator("Source")
    for s in sources:
        v.validate(s)
        assert s["id"] in corpus, f"no corpus text for {s['id']}"
    assert 20 <= len(sources) <= 40
    assert len({s["id"] for s in sources}) == len(sources)


def test_source_excerpts_in_text(sources, corpus):
    for s in sources:
        assert norm(s["excerpt"]) in norm(corpus[s["id"]]["body"]), s["id"]


def test_topics_detection_and_suppression(sources, corpus):
    def topic(sid):
        m = corpus[sid]["meta"]
        return m.get("topic", "") + " " + m["title"].lower()

    det = [s["id"] for s in sources if "detect" in topic(s["id"]) or "smoke" in topic(s["id"])]
    sup = [s["id"] for s in sources if "suppress" in topic(s["id"]) or "extinguish" in topic(s["id"])]
    assert len(det) >= 3 and len(sup) >= 3, (det, sup)


def test_claims_schema_and_refs(claims, sources, corpus):
    v = _validator("Claim")
    ids = {s["id"] for s in sources}
    assert len({c["id"] for c in claims}) == len(claims)
    for c in claims:
        v.validate(c)
        assert c["sourceIds"] and set(c["sourceIds"]) <= ids, c["id"]
        if not c["excerpt"].startswith("Computed from PSI run tables: "):  # computed takeaways: see test_rag_brief_facts
            assert any(norm(c["excerpt"]) in norm(corpus[sid]["body"]) for sid in c["sourceIds"]), c["id"]
        assert c["text"].strip()


def test_claim_coverage(claims, sources):
    invs = {s["id"].split(":", 1)[1] for s in sources if s["id"].startswith("psi:")} - NOT_COMBUSTION
    assert len(invs) == 24
    by = defaultdict(Counter)
    habs = defaultdict(list)
    for c in claims:
        by[c["investigationId"]][c["kind"]] += 1
        if c["kind"] == "rationale":
            assert c["habitat"] in ("iss", "moon", "rover"), c["id"]
            habs[c["investigationId"]].append(c["habitat"])
        elif c["kind"] == "takeaway":
            assert c["habitat"] in ("iss", "moon", "rover"), c["id"]
        else:
            assert "habitat" not in c, c["id"]
    assert set(by) == invs
    for i in invs:
        assert by[i]["summary"] == 1, i
        assert by[i]["finding"] <= 2, i
        assert len(habs[i]) == len(set(habs[i])), i  # at most one rationale per habitat


# investigations whose claim text may be identical because the source text really is shared (id -> reason)
SHARED_TEXT_OK: dict[str, str] = {}


def test_no_duplicate_claim_text_across_investigations(claims):
    seen = {}
    for c in claims:
        k = c["text"].strip().lower()
        if k in seen and seen[k] != c["investigationId"]:
            assert c["id"] in SHARED_TEXT_OK, f"{c['id']} repeats text of {seen[k]}"
        seen.setdefault(k, c["investigationId"])


def _open(lic):
    return lic.startswith(("CC0", "Public domain"))


def test_non_open_sources_have_no_text_index_or_long_excerpt(sources):
    idx = json.loads((DATA / "index.json").read_text(encoding="utf-8"))
    chunked = {c["sourceId"] for c in idx["chunks"]}
    for s in sources:
        if _open(s["license"]):
            continue
        assert not (ROOT / "corpus" / "text" / (s["id"].replace(":", "_") + ".md")).exists(), s["id"]
        assert s["id"] not in chunked, s["id"]
        assert words(s["excerpt"]) <= 15, s["id"]
    # and no corpus text exists for any source that is not listed (dropped sources must stay dropped)
    listed = {s["id"].replace(":", "_") for s in sources}
    assert {p.stem for p in (ROOT / "corpus" / "text").glob("*.md")} <= listed


def test_word_limit(claims):
    info = json.loads((ROOT / "corpus" / "build-info.json").read_text(encoding="utf-8"))
    over = [c["id"] for c in claims if words(c["text"]) > 25]
    assert info["over25"] == len(over)  # build-info stays honest
    if info["mode"] == "live":
        assert not over, over


def test_takeaways_are_grounded(claims, sources, corpus):
    """Every takeaway: habitat, real sources, verbatim excerpt, <=25 words, and no invented number."""
    from rag import brief, brief_facts

    habs, invs = brief.load_data()
    ids = {s["id"] for s in sources}
    info = json.loads((ROOT / "corpus" / "build-info.json").read_text(encoding="utf-8"))
    tk = [c for c in claims if c["kind"] == "takeaway" and c["id"].rsplit(":", 1)[1] not in brief_facts.TOPICS]
    if info["mode"] == "live":
        assert tk, "live mode must ship a habitat brief"
    for c in tk:
        assert c["habitat"] in ("iss", "moon", "rover") and re.match(rf"^clm:brief:{c['habitat']}:[a-z0-9-]+$", c["id"]), c["id"]
        assert 1 <= len(c["sourceIds"]) <= 3 and set(c["sourceIds"]) <= ids, c["id"]
        assert norm(c["excerpt"]) in norm(corpus[c["sourceIds"][0]]["body"]), c["id"]
        assert c["investigationId"] in invs and words(c["text"]) <= 25, c["id"]
        assert c["text"] not in brief.REJECTED, c["id"]
        named = {c["investigationId"]} | {i for i in invs if i in c["text"] or (len(invs[i]["title"]) <= 25 and invs[i]["title"].lower() in c["text"].lower())}
        named |= {sid.split(":", 1)[1] for sid in c["sourceIds"] if sid.startswith("psi:")}
        _, allowed = brief.facts(c["habitat"], habs, invs, corpus)
        assert brief.ungrounded(c["text"], [c["excerpt"]], allowed, named, invs) is None, (c["id"], c["text"])


def test_ungrounded_catches_invented_number():
    from rag import brief

    habs, invs = brief.load_data()
    corpus = load_corpus()
    _, allowed = brief.facts("moon", habs, invs, corpus)
    assert brief.ungrounded("FLEX tested 12 to 34% oxygen.", [], allowed, {"PSI-69"}, invs) is None
    assert "99" in brief.ungrounded("FLEX tested 12 to 99% oxygen.", [], allowed, {"PSI-69"}, invs)
    assert brief.ungrounded("FLEX-2 tested 12 to 34% oxygen.", [], allowed, {"PSI-69"}, invs) is None  # '2' is part of a name
