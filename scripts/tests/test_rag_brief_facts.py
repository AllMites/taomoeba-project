"""Lane B: computed habitat-brief takeaways. Numbers are re-derived here with independent code straight from the
JSON/CSV files in public/data, never by calling the builder's helpers."""
import csv
import json
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rag import brief_facts, precompute  # noqa: E402
from rag.common import DATA  # noqa: E402

PREFIX = "Computed from PSI run tables: "


def _json(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))["items"]


@pytest.fixture(scope="module")
def world():
    habs = {h["id"]: h for h in _json("habitats.json")}
    comb = [i for i in _json("investigations.json") if i["id"] not in ("PSI-108", "PSI-181")]
    claims = {c["id"]: c for c in _json("claims.json") if c["kind"] == "takeaway"}
    return habs, comb, claims


def test_every_computed_takeaway_is_well_formed(world):
    sources = {s["id"] for s in _json("sources.json")}
    for c in world[2].values():
        topic = c["id"].rsplit(":", 1)[1]
        if topic not in brief_facts.TOPICS:
            continue
        assert c["id"] == f"clm:brief:{c['habitat']}:{topic}" and c["kind"] == "takeaway"
        assert len(c["text"].split()) <= 25 and c["text"].endswith(".") and c["text"].count(". ") == 0
        assert c["excerpt"].startswith(PREFIX) and 1 <= len(c["sourceIds"]) <= 6 and set(c["sourceIds"]) <= sources


def test_o2_coverage_and_fuel_gap_rederived(world):
    habs, comb, claims = world
    for hid, h in habs.items():
        if hid not in ("iss", "moon", "rover"):
            continue
        o2 = h["o2Percent"]
        cov = [i["id"] for i in comb if i["o2Range"] and i["o2Range"][0] <= o2 <= i["o2Range"][1]]
        kinds = {i["fuelKind"] for i in comb if i["id"] in cov}
        c = claims[f"clm:brief:{hid}:o2-coverage"]
        assert c["text"].startswith(f"{len(cov)} of {len(comb)} experiments covered {o2:g}% oxygen"), c["text"]
        assert all(i in c["excerpt"] for i in cov) and f"{len(cov)} of {len(comb)}" in c["excerpt"]
        solids = [i for i in comb if i["id"] in cov and i["fuelKind"] == "solid"]
        gap = claims.get(f"clm:brief:{hid}:fuel-gap")
        if solids:
            assert gap is None  # a gap is claimed only when zero solid-fuel experiments cover the habitat's oxygen
        else:
            assert gap and gap["text"].startswith(f"None of the {len(cov)} experiments that cover {o2:g}% oxygen burned solid")
            assert {"gas", "droplet"} == kinds  # the claim says "gas" and "liquid-droplet"
            assert "gas" in gap["text"] and "liquid-droplet" in gap["text"]
            assert "none of them include" in gap["excerpt"]
        if hid != "iss":
            assert ("gas" in c["text"] and "liquid-droplet" in c["text"]) == (kinds == {"gas", "droplet"})
    # the owner's headline: nothing that reaches 30% oxygen burned a solid
    assert not [i for i in comb if i["fuelKind"] == "solid" and i["o2Range"] and i["o2Range"][1] >= 30]


def test_pressure_coverage_rederived(world):
    habs, comb, claims = world
    with_p = [i for i in comb if i["pressureRange"]]
    for hid in ("iss", "moon", "rover"):
        kpa = habs[hid]["pressureKPa"]
        inc = [i for i in with_p if i["pressureRange"][0] <= kpa <= i["pressureRange"][1]]
        c = claims[f"clm:brief:{hid}:pressure-coverage"]
        n_inc = "all %d" % len(inc) if len(inc) == len(with_p) else "%d of those" % len(inc)
        assert c["text"] == (f"Only {len(with_p)} of {len(comb)} experiments record a tested pressure; {n_inc} include "
                             f"{kpa:g} kPa, and {len(comb) - len(with_p)} list none."), c["text"]


def test_gravity_limit_rederived_and_worded_safely(world):
    habs, comb, claims = world
    flight = sum(1 for i in comb if i["evidence"] == "flight")
    ground = sum(1 for i in comb if i["evidence"] == "ground")
    assert flight + ground == len(comb)
    assert "clm:brief:iss:gravity-limit" not in claims
    for hid in ("moon", "rover"):
        c = claims[f"clm:brief:{hid}:gravity-limit"]
        assert f"None of the {len(comb)} PSI combustion experiments ran in partial gravity" in c["text"]
        assert f"{flight} flew in microgravity, {ground} were ground studies" in c["text"]
        assert not re.search(r"tested|studied|E-FIELD|PSI-22", c["text"])
        assert "PSI-22" in c["excerpt"]  # listed in the evidence flags, but never named as a gravity result


def test_saffire_gravity_rederived_from_the_csv(world):
    rows = list(csv.DictReader((DATA / "runs" / "PSI-99.csv").open(encoding="utf-8")))
    sil = [r for r in rows if r["material"] == "Silicone"]
    assert len(sil) == 4
    micro, one = "g_burn_length", "1_g_burn_length"  # the CSV header names for "?-g Burn Length" and "1-g Burn Length"
    assert [r[micro] for r in sil] == ["~ 0"] * 4
    burned = [r for r in sil if r[one] != "~ 0"]
    numeric = [r for r in burned if r[one] != "Complete"]
    assert (len(burned), numeric[0]["sample_number"], numeric[0][one]) == (3, "2-2", "7.6 cm")
    for hid in ("iss", "moon", "rover"):
        c = world[2][f"clm:brief:{hid}:saffire-gravity"]
        assert c["text"] == ("SAFFIRE-II silicone burned about 0 cm in microgravity in all 4 samples; in normal gravity "
                             "3 of 4 burned (sample 2-2: 7.6 cm)."), c["text"]
        assert c["investigationId"] == "PSI-99" and c["sourceIds"] == ["psi:PSI-99"]
        for r in sil:  # every raw value used is in the excerpt
            assert f"sample {r['sample_number']}" in c["excerpt"] and r[one] in c["excerpt"]
    texts = {world[2][f"clm:brief:{h}:saffire-gravity"]["text"] for h in ("iss", "moon", "rover")}
    assert len(texts) == 1  # same text for all three habitats


def test_ids_are_stable_and_only_supported_topics_appear():
    a, b = brief_facts.build(), brief_facts.build()
    assert a == b and len({c["id"] for c in a}) == len(a)
    assert all(re.match(r"^clm:brief:(iss|moon|rover):(o2-coverage|fuel-gap|pressure-coverage|gravity-limit|saffire-gravity)$", c["id"]) for c in a)
    committed = {c["id"] for c in _json("claims.json") if c["kind"] == "takeaway" and c["id"].rsplit(":", 1)[1] in brief_facts.TOPICS}
    assert committed == {c["id"] for c in a}


def test_habitat_without_supporting_data_gets_no_takeaway():
    habs, invs = brief_facts.load()
    nowhere = {"id": "iss", "label": "Nowhere", "o2Percent": 99.0, "pressureKPa": 9999.0}
    out = brief_facts.build({**habs, "iss": nowhere}, invs, habitats=("iss",))
    assert {c["id"] for c in out} == {"clm:brief:iss:saffire-gravity"}  # no oxygen, fuel or pressure data cover 99% / 9999 kPa
    no_run = brief_facts.build(habs, invs, run=lambda _id: None, habitats=("iss", "moon"))
    assert not [c for c in no_run if c["id"].endswith("saffire-gravity")]


def test_no_key_never_downgrades_live_claims_by_accident(tmp_path, monkeypatch):
    info = tmp_path / "build-info.json"
    monkeypatch.setattr(precompute, "INFO", info)
    info.write_text(json.dumps({"mode": "live"}), encoding="utf-8")
    with pytest.raises(SystemExit) as e:
        precompute.guard(False, [])
    assert e.value.code != 0 and "--extractive" in str(e.value.code)
    precompute.guard(False, ["--extractive"])  # explicit: allowed
    precompute.guard(False, ["--brief"])  # computed takeaways only: allowed
    precompute.guard(True, [])  # key present: allowed
    info.write_text(json.dumps({"mode": "extractive"}), encoding="utf-8")
    precompute.guard(False, [])  # nothing live to lose
