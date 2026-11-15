"""The solid-materials file is rebuilt from the typed BASS-II table and the PSI-99 run table, and nothing else."""
import csv, json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "data" / "solids.json"


def test_rebuild_is_identical():
    before = OUT.read_bytes()
    subprocess.run([sys.executable, str(ROOT / "scripts" / "solids" / "build.py")], check=True, capture_output=True)
    assert OUT.read_bytes() == before


def test_typed_table_matches_report_shape():
    rows = list(csv.DictReader(open(ROOT / "scripts" / "solids" / "bass_table_7_1.csv", encoding="utf-8")))
    assert len(rows) == 31  # 27 BASS-II rows (T28 is listed as a and b) + 4 BASS
    assert sum(r["series"] == "BASS" for r in rows) == 4
    assert all(r["o2_percent"] == "21" for r in rows if r["series"] == "BASS")
    assert sum(r["comment"] == "Quenched" for r in rows) == 6  # "six quenching tests" (Section 7.1.4)
    assert sum(r["comment"] == "No ignition" for r in rows) == 3  # "three nonignited tests"
    assert sum(r["comment"] == "Blow-off" for r in rows) == 1  # "one blowoff test"


def test_saffire_rows_come_from_psi():
    doc = json.loads(OUT.read_text(encoding="utf-8"))
    runs = json.loads((ROOT / "public" / "data" / "runs" / "PSI-99.json").read_text(encoding="utf-8"))
    ids = {r["sample_number"] for r in runs["rows"]}
    shown = [s["sample"] for s in doc["saffire"]["samples"]]
    assert set(shown) | set(doc["saffire"]["skipped"]) == ids
