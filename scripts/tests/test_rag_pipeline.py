"""Lane B: regression checks on pipeline helpers and committed outputs (no network)."""
import json
import re
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rag import fetch, precompute  # noqa: E402
from rag.common import DATA, ROOT  # noqa: E402

CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
CLAIM_ID = re.compile(r"^clm:(PSI-\d+):(summary|finding:\d+|rationale:(iss|moon|rover))$|^clm:(brief):(iss|moon|rover):[a-z0-9-]+$")


def test_fix_splits_fused_sentences_without_losing_text():
    assert fetch.fix("baseline can be evaluated.The smoke detectors") == "baseline can be evaluated. The smoke detectors"


def test_no_control_chars_in_corpus_or_data():
    files = sorted((ROOT / "corpus" / "text").glob("*.md")) + [DATA / f"{n}.json" for n in ("sources", "claims")]
    for f in files:
        assert not CONTROL.search(f.read_text(encoding="utf-8")), f.name
    idx = json.loads((DATA / "index.json").read_text(encoding="utf-8"))
    for c in idx["chunks"]:
        assert not CONTROL.search(c["text"]), c["id"]


def test_dangling_and_clause_cut_patterns_work():
    assert precompute.DANGLING.match("It also presents the results of the first 284 tests performed.")
    assert not precompute.DANGLING.match("This investigation measured smoke.")
    s = ("The research is not being conducted to serve any space applications in the near term at all, "
         "but it is possible that its findings could aid future space-based combustion devices.")
    assert precompute.cut(s, 15) == s  # never drop the contrast clause
    s2 = "Flames in microgravity were weaker and slower than expected in every run; the limit moved lower."
    assert precompute.cut(s2, 15) == "Flames in microgravity were weaker and slower than expected in every run."


def test_no_control_bytes_in_pipeline_source():
    for f in sorted((ROOT / "scripts" / "rag").glob("*.py")):
        assert not CONTROL.search(f.read_text(encoding="utf-8")), f.name


def test_claim_ids_and_extractive_text():
    claims = json.loads((DATA / "claims.json").read_text(encoding="utf-8"))["items"]
    info = json.loads((ROOT / "corpus" / "build-info.json").read_text(encoding="utf-8"))
    for c in claims:
        m = CLAIM_ID.match(c["id"])
        if c["kind"] == "takeaway":  # clm:brief:<habitat>:<topic>; the habitat check lives in test_rag_corpus
            from rag import brief_facts
            assert m and m.group(4) == "brief" and m.group(5) == c["habitat"], c["id"]
            # SI-written takeaways need live mode; computed ones (pure data) exist in both modes
            assert info["mode"] == "live" or c["id"].rsplit(":", 1)[1] in brief_facts.TOPICS, c["id"]
            continue
        assert m and m.group(1) == c["investigationId"], c["id"]
        assert c["id"].split(":")[2] == c["kind"], c["id"]
        if c["kind"] == "rationale":
            assert c["id"].endswith(":" + c["habitat"]), c["id"]
        if info["mode"] == "extractive":  # text may only be the excerpt or a clause-cut prefix of it
            t = c["text"]
            assert t == c["excerpt"] or (t.endswith(".") and c["excerpt"].startswith(t[:-1])), c["id"]


def test_call_model_rejects_truncated_reply(tmp_path, monkeypatch):
    monkeypatch.setattr(precompute, "CACHE", tmp_path / "llm")
    monkeypatch.setattr(precompute, "USAGE", tmp_path / "usage.jsonl")
    reply = SimpleNamespace(stop_reason="max_tokens", content=[SimpleNamespace(type="text", text="PSI investigation FLEX")],
                            usage=SimpleNamespace(input_tokens=10, output_tokens=5))
    client = SimpleNamespace(messages=SimpleNamespace(create=lambda **kw: reply))
    assert precompute.call_model(client, "sys", "user", {"in": 0, "out": 0}) is None
    assert not (tmp_path / "llm").exists() or not list((tmp_path / "llm").iterdir())


def test_list_lead_in_is_merged_and_never_cut():
    from rag.common import units
    us = units("The two main objectives for BASS are to:\n\n1.) Bridge the gap between tests and flight.\n\n2.) Assess an inert agent.")
    assert len(us) == 1 and us[0].startswith("The two main objectives for BASS are to: 1.)") and us[0].endswith("inert agent.")
    long_lead = "The two main objectives for this long running experiment on the station are to: begin to bridge the gap"
    assert not precompute.cut(long_lead, 15).endswith(" to.")


def test_extractive_emits_nothing_it_cannot_support():
    corpus = precompute.load_corpus()
    for inv in ("PSI-26", "PSI-39", "PSI-99"):
        out = precompute.extractive(inv, precompute.build_units(inv, corpus))
        kinds = [c["kind"] for c in out]
        assert kinds.count("summary") == 1 and "rationale" not in kinds
        assert not any(c["text"].rstrip().endswith((" to.", " to:", ":")) for c in out), inv
        for c in out:
            if c["kind"] == "finding":
                assert not precompute.PLANNED.search(c["excerpt"]), c["id"]


def test_live_text_filters():
    assert precompute.check_text("PSI investigation FLEX reports that sentence S5 matters.") == "banned phrase"
    assert precompute.check_text("One thing. Another thing.") == "more than one sentence"
    assert precompute.check_text("word " * 26) and precompute.ABSENCE.search("PSI gives no oxygen level.")
    assert not precompute.ABSENCE.search("PSI holds no partial-gravity data for the rover.")
    assert precompute.check_text("Extinction matters, a point bearing on ISS fire safety.") == "banned phrase"


def test_review_retires_rejected_ids_and_texts_and_applies_edits():
    from rag import brief
    rid, (rtext, _) = next(iter(precompute.REJECTED.items()))
    eid, (old, new, _) = next(iter(precompute.EDITED.items()))
    t_rej, t_old = next(iter(brief.REJECTED)), next(iter(brief.EDITED))
    base = {"investigationId": "PSI-20", "kind": "finding", "sourceIds": ["psi:PSI-20"], "excerpt": "x"}
    tk = {**base, "kind": "takeaway", "habitat": "moon"}
    claims = [
        {**base, "id": rid, "text": "A reworded claim the model wrote for a retired id."},  # retired id, new text
        {**base, "id": "clm:PSI-20:finding:9", "text": rtext},  # rejected text under another id
        {**base, "id": eid, "text": old},
        {**tk, "id": "clm:brief:moon:1", "text": t_rej},
        {**tk, "id": "clm:brief:moon:2", "text": t_old},
    ]
    out = precompute.review(claims)
    assert [c["id"] for c in out] == [eid, "clm:brief:moon:bre-airflow"]  # id by topic, not position
    assert out[0]["text"] == new and out[1]["text"] == brief.EDITED[t_old][0]


def test_reviewed_texts_obey_the_rules_and_committed_claims_are_reviewed():
    from rag import brief
    for _, new, _ in precompute.EDITED.values():
        assert precompute.check_text(new) is None, new
    for new, _ in brief.EDITED.values():
        assert precompute.check_text(new) is None, new
    claims = json.loads((DATA / "claims.json").read_text(encoding="utf-8"))["items"]
    assert precompute.review(claims) == claims  # no retired id, rejected text or unreviewed edit ships
    texts = {c["text"] for c in claims}
    gone = {t for t, _ in precompute.REJECTED.values()} | {o for o, _, _ in precompute.EDITED.values()}
    assert not texts & (gone | set(brief.REJECTED) | set(brief.EDITED))
    assert not {c["id"] for c in claims} & set(precompute.REJECTED)
