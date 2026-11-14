"""Lane A round 2: condition basis, evidence, run exports, related. Offline except where the cache is used."""
import csv
import json
import re
import sys
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ingest import build, psi, runs, tables  # noqa: E402

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
    for i in INV.values():
        if "record" in (i["conditionBasis"]["o2"], i["conditionBasis"]["pressure"]):
            assert norm(i["conditionBasis"]["excerpt"]) in rec[i["id"]], i["id"]


def rec_src(text):
    return {"Objectives": text, "Approach": "", "Hypothesis": ""}


@pytest.mark.parametrize("text, o2, p", [
    # PSI-20: a planned test list ("will be examined"), and the table shows 25 % and 40 % runs it does not list
    ("NASA - considered atmosphere for human space missions will be examined: 14.7 psia, 21 % oxygen: "
     "10.2 psia, 26.5 %; and 8.2 psia, 34 % oxygen.", None, None),
    # PSI-106 / PSI-107: co-flow air is the stream fed around the burner, not the surrounding atmosphere
    ("Flames were then manually ignited and observed under controlled coflow air conditions.", None, None),
    ("Each flame was ignited in a controlled co-flow air environment, with burner diameters of 0.41 mm.", None, None),
    ("The chamber can be filled with up to 40 % oxygen at 2 atm.", None, None),
])
def test_record_rejects_plans_and_burner_streams(text, o2, p):
    assert build.record_conditions(rec_src(text), True, True)[:2] == (o2, p)


def test_record_accepts_a_stated_atmosphere():
    s = "Samples were burned in cabin air at ambient pressure."
    assert build.record_conditions(rec_src(s), True, True) == ([21.0, 21.0], [101.3, 101.3], s)
    s = "Tests were run in 30 % oxygen at 10.2 psia."
    assert build.record_conditions(rec_src(s), True, True) == ([30.0, 30.0], [70.3, 70.3], s)


def test_evidence():
    assert all(i["evidence"] in ("flight", "ground") for i in INV.values())
    assert {i for i, v in INV.items() if v["evidence"] == "ground"} == {"PSI-60", "PSI-62", "PSI-115", "PSI-117", "PSI-142"}
    assert all("record" not in (INV[i]["conditionBasis"]["o2"], INV[i]["conditionBasis"]["pressure"])
               for i in INV if INV[i]["evidence"] == "ground")


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
    assert INV[i]["runs"]["rows"] + len(run_json(i)["notes"]) == src


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


def test_run_numbers_keep_psi_precision():
    cols, rows, notes = runs.build_table([(["Tad (K)", "Note"], [{"Tad (K)": "2595.073097", "Note": "-"}])])
    assert rows == [{"tad_k": 2595.073097, "note": "-"}]


@pytest.mark.skipif(not RAW.exists(), reason="PSI cache not present")
@pytest.mark.parametrize("i", ["PSI-10", "PSI-69", "PSI-107", "PSI-159"])
def test_run_plain_numbers_equal_source_cells(i):
    j = run_json(i)
    cond = ("o2_percent", "pressure_kpa", "airflow_cm_s")
    by_orig = {}
    for c in j["columns"]:
        by_orig.setdefault(c["original"], c["name"])
    k = 0
    for p in sorted((RAW / i / "tables").glob("*.csv")):
        head, rows = tables.read_rows(p)
        for r in rows:
            out = j["rows"][k]
            k += 1
            for h in head:
                name, cell = by_orig[h], r.get(h, "").strip()
                if name.startswith(cond) or not re.fullmatch(r"-?\d+(\.\d+)?", cell) or re.fullmatch(r"-?0\d+", cell):
                    continue
                assert out[name] == float(cell), (i, k, h, cell, out[name])
    assert k == len(j["rows"])


def test_related_reads_unicode_dash_as_hyphen():
    srcs = {"PSI-25": {"Objectives": "BASS–II tests the hypothesis.", "Related Investigations": ""},
            "PSI-26": {"Objectives": "", "Related Investigations": ""}}
    invs = [{"id": "PSI-25", "fuel": "Not stated", "hardwareGroup": "Ground study"},
            {"id": "PSI-26", "fuel": "Not stated", "hardwareGroup": "Ground study"}]
    assert build.related(invs[0], srcs, invs) == []


@pytest.mark.skipif(not (RAW / "search.json").exists(), reason="PSI cache not present")
def test_related_reasons_are_grounded():
    hits = {h["_source"]["Accession"]: h["_source"]
            for h in json.loads((RAW / "search.json").read_text(encoding="utf-8"))["hits"]["hits"]}
    for i, inv in INV.items():
        src = hits[i]
        text = re.sub("[‐-―]", "-", " ".join(src.get(f) or "" for f in ("Objectives", "Approach", "Hypothesis")))
        for r in inv["related"]:
            o, why = INV[r["id"]], r["reason"]
            if why.startswith("Same hardware: "):
                assert inv["hardwareGroup"] == o["hardwareGroup"] == why.split(": ", 1)[1], (i, r)
            elif why.startswith("Same fuel: "):
                f = why.split(": ", 1)[1]
                assert f in inv["fuel"].split(", ") and f in o["fuel"].split(", "), (i, r)
            elif why.startswith("Its PSI record names "):
                key = why[len("Its PSI record names "):]
                assert re.search(rf"(?<![\w-]){re.escape(key)}(?![\w-])", text, re.I if " " in key else 0), (i, r)
            else:
                assert r["id"] in re.findall(r"PSI-\d+", src.get("Related Investigations") or ""), (i, r)


def test_test_matrix_files_are_never_listed(monkeypatch):
    tree = {"files": [
        {"key": "psi-data/PSI-26/Experimental table/PSI-26_Experimental table_BASS.csv",
         "sortingCategory": "Experimental table", "bytes_size": "100", "version": 1},
        {"key": "psi-data/PSI-26/Experimental table/PSI-26_Science Documents_As Run_Test Matrix.xlsx",
         "sortingCategory": "Experimental table", "bytes_size": "100", "version": 1},
        {"key": "psi-data/PSI-26/Science Documents/PSI-26_Science Documents_Planned_Test Matrix.xlsx",
         "sortingCategory": "Science Documents", "bytes_size": "100", "version": 1}]}
    monkeypatch.setattr(psi, "file_tree", lambda _i: {"version": 1, "tree": tree})
    assert [n for n, _, _ in psi.tables_of("PSI-26")] == ["Experimental table/PSI-26_Experimental table_BASS.csv"]


def test_no_footnote_rows_and_notes():
    for i, inv in INV.items():
        if inv["runs"] is None:
            continue
        j = run_json(i)
        width = len(j["columns"])
        for r in j["rows"]:
            # >= 3 non-empty cells (tables narrower than 3 columns need every column)
            assert sum(v not in (None, "") for v in r.values()) >= min(3, width), (i, r)
        assert inv["runs"]["rows"] == len(j["rows"])
    j = run_json("PSI-99")
    assert len(j["rows"]) == 9 and any(n.startswith("Note 1") for n in j["notes"])
    assert len(run_json("PSI-69")["rows"]) == 274 and run_json("PSI-69")["notes"] == []


def test_column_names_and_micro_sign():
    from ingest.runs import snake
    assert snake("µ-g Burn Length") == snake("μ-g Burn Length") == snake("?-g Burn Length") == "microgravity_burn_length"
    assert snake("1-g Spread Rate") == "normal_gravity_spread_rate"
    for i, inv in INV.items():
        if inv["runs"]:
            assert not any(re.match(r"g_", n) for n in inv["runs"]["columns"]), i
    originals = {c["original"] for c in run_json("PSI-99")["columns"]}
    assert "?-g Burn Length" in originals  # PSI's own file holds a literal "?" here; kept exactly


def test_files_are_utf8():
    for p in (DATA / "runs").glob("*"):
        p.read_bytes().decode("utf-8")
