"""Lane A checks. Offline: read the committed JSON and exercise the pure overlap functions."""
import json
import sys
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ingest.overlap import dim_score, overlap  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "public" / "data"
SCHEMAS = ROOT / "src" / "contracts" / "schema"


def load(name):
    doc = json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))
    assert "fixture" not in doc
    return doc["items"]


@pytest.mark.parametrize("name,schema", [("investigations", "Investigation"), ("habitats", "HabitatPreset")])
def test_validates_against_schema(name, schema):
    v = Draft202012Validator(json.loads((SCHEMAS / f"{schema}.json").read_text(encoding="utf-8")))
    items = load(name)
    assert items
    for item in items:
        v.validate(item)


def test_investigation_counts_and_required_ids():
    items = load("investigations")
    ids = {i["id"] for i in items}
    assert len(items) == 26
    assert sum(i["pds"] != "Other" for i in items) == 24
    assert {"PSI-20", "PSI-22", "PSI-47"} <= ids
    assert {i["id"] for i in items if i["pds"] == "Other"} == {"PSI-108", "PSI-181"}
    assert all(i["sourceIds"] == [f"psi:{i['id']}"] for i in items)


def test_habitats():
    hab = {h["id"]: h for h in load("habitats")}
    assert (hab["iss"]["o2Percent"], hab["iss"]["pressureKPa"]) == (21, 101.3)
    assert (hab["moon"]["o2Percent"], hab["moon"]["pressureKPa"]) == (30, 70.3)
    assert (hab["rover"]["o2Percent"], hab["rover"]["pressureKPa"]) == (30, 70.3)
    assert (hab["suit-ref"]["o2Percent"], hab["suit-ref"]["pressureKPa"]) == (100, 29.6)
    assert "mars" not in hab


def test_overlap_rows_complete_and_null_iff_no_dims():
    rows = load("overlap")
    invs, habs = load("investigations"), load("habitats")
    assert len(rows) == len(invs) * len(habs)
    assert {(r["investigationId"], r["habitat"]) for r in rows} == {(i["id"], h["id"]) for i in invs for h in habs}
    for r in rows:
        assert (r["overlap"] is None) == (r["dimsUsed"] == 0)
        assert r["dimsUsed"] == sum(x is not None for x in (r["o2Tested"], r["pressureTestedKPa"]))
        assert r["overlap"] is None or 0 <= r["overlap"] <= 1


def test_overlap_hand_example():
    # Habitat 30 % O2 / 70.3 kPa vs tested O2 [18, 28], pressure [50, 60]:
    #   O2: d = 2, span 10        -> 1 - 2/10   = 0.8
    #   pressure: d = 10.3, span 10 -> 1 - 10.3/10 < 0 -> 0
    #   mean of 2 dims = 0.4
    moon = {"o2Percent": 30, "pressureKPa": 70.3}
    assert overlap(moon, [18, 28], [50, 60]) == (0.4, 2)
    assert overlap(moon, [21, 40], None) == (1.0, 1)  # inside range, one dimension
    assert overlap(moon, None, None) == (None, 0)
    assert dim_score(30, [21, 21], 5.0) == 0.0  # single value, 9 points away, floor 5


def test_overlap_matches_committed_row():
    # PSI-23 tested O2 [21, 30] and exactly 101.3 kPa; Moon Base 30 % / 70.3 kPa -> (1.0 + 0.0) / 2
    row = next(r for r in load("overlap") if r["investigationId"] == "PSI-23" and r["habitat"] == "moon")
    assert (row["overlap"], row["dimsUsed"]) == (0.5, 2)
