"""Lane A round 2: condition basis, evidence, run exports, related. Offline except where the cache is used."""
import csv
import json
import re
import sys
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ingest import tables  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "public" / "data"
RAW = ROOT / "data" / "raw"
INV = {i["id"]: i for i in json.loads((DATA / "investigations.json").read_text(encoding="utf-8"))["items"]}


def norm(t):
    return re.sub(r"\s+", " ", t.replace("�", "")).strip()


def run_json(i):
    return json.loads((DATA / "runs" / f"{i}.json").read_text(encoding="utf-8"))


def test_schema_still_valid():
    v = Draft202012Validator(json.loads((ROOT / "src/contracts/schema/Investigation.json").read_text(encoding="utf-8")))
    for i in INV.values():
        v.validate(i)


def test_basis_matches_ranges():
    for i in INV.values():
        b = i["conditionBasis"]
        assert (i["o2Range"] is None) == (b["o2"] is None), i["id"]
        assert (i["pressureRange"] is None) == (b["pressure"] is None), i["id"]
        assert ("record" in (b["o2"], b["pressure"])) == bool(b.get("excerpt")), i["id"]


def test_overlap_uses_current_ranges():
    for r in json.loads((DATA / "overlap.json").read_text(encoding="utf-8"))["items"]:
        i = INV[r["investigationId"]]
        assert r["o2Tested"] == i["o2Range"] and r["pressureTestedKPa"] == i["pressureRange"]


@pytest.mark.skipif(not (RAW / "search.json").exists(), reason="PSI cache not present")
def test_record_excerpts_are_verbatim():
    hits = json.loads((RAW / "search.json").read_text(encoding="utf-8"))["hits"]["hits"]
    rec = {h["_source"]["Accession"]: norm(" ".join(h["_source"].get(f) or "" for f in ("Objectives", "Approach", "Hypothesis")))
           for h in hits}
    n = 0
    for i in INV.values():
        if "record" in (i["conditionBasis"]["o2"], i["conditionBasis"]["pressure"]):
            n += 1
            assert norm(i["conditionBasis"]["excerpt"]) in rec[i["id"]], i["id"]
    assert n >= 1


def test_evidence():
    assert all(i["evidence"] in ("flight", "ground") for i in INV.values())
    assert {i for i, v in INV.items() if v["evidence"] == "ground"} == {"PSI-60", "PSI-62", "PSI-115", "PSI-117", "PSI-142"}
    assert all(INV[i]["conditionBasis"]["excerpt"] if "excerpt" in INV[i]["conditionBasis"] else True
               for i in INV if INV[i]["evidence"] == "ground") and all(
        INV[i]["conditionBasis"]["o2"] != "record" for i in INV if INV[i]["evidence"] == "ground")


def test_runs_json_csv_agree_and_sizes():
    total = 0
    for i, inv in INV.items():
        if inv["runs"] is None:
            assert not (DATA / "runs" / f"{i}.json").exists()
            continue
        j = run_json(i)
        assert j["source"] == f"psi:{i}"
        names = [c["name"] for c in j["columns"]]
        assert names == inv["runs"]["columns"] and len(j["rows"]) == inv["runs"]["rows"]
        assert len(set(names)) == len(names) and all(c["original"] for c in j["columns"])
        with open(DATA / "runs" / f"{i}.csv", encoding="utf-8", newline="") as f:
            rows = list(csv.reader(f))
        assert rows[0] == names and len(rows) - 1 == len(j["rows"])
        for jr, cr in zip(j["rows"], rows[1:]):
            assert ["" if jr[n] is None else str(jr[n]) for n in names] == cr
    total = sum(p.stat().st_size for p in (DATA / "runs").glob("*"))
    assert total < 5 * 1024 * 1024


def test_flex_row_count():
    assert 270 <= INV["PSI-69"]["runs"]["rows"] <= 280


@pytest.mark.skipif(not RAW.exists(), reason="PSI cache not present")
@pytest.mark.parametrize("i", ["PSI-69", "PSI-25", "PSI-107"])
def test_run_rows_match_source_lines(i):
    src = sum(len(tables.read_rows(p)[1]) for p in (RAW / i / "tables").glob("*.csv"))
    assert INV[i]["runs"]["rows"] == src


def cell_numbers(v):
    return [] if v is None else tables.numbers(str(v))


def test_run_minmax_equals_ranges():
    for i, inv in INV.items():
        if inv["runs"] is None:
            continue
        j = run_json(i)
        for prefix, key, nd in (("o2_percent", "o2Range", 2), ("pressure_kpa", "pressureRange", 1), ("airflow_cm_s", "airflowRange", 2)):
            cols = [c["name"] for c in j["columns"] if c["name"].startswith(prefix)]
            vals = [x for r in j["rows"] for c in cols for x in cell_numbers(r[c])]
            if inv["conditionBasis"]["o2" if key == "o2Range" else "pressure"] == "record" or (key != "airflowRange" and not cols):
                continue
            if key == "pressureRange" and not cols:
                continue
            expect = inv[key]
            got = [round(min(vals), nd), round(max(vals), nd)] if vals else None
            assert got == expect, (i, key, got, expect)


def test_related():
    for i, inv in INV.items():
        rel = inv["related"]
        assert len(rel) <= 4 and len({r["id"] for r in rel}) == len(rel)
        for r in rel:
            assert r["id"] in INV and r["id"] != i
            assert re.match(r"(Same hardware: |Same fuel: |Its PSI record names |Listed as related in its PSI record)", r["reason"])
