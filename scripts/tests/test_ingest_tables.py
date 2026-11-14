"""Parser checks (review of lane A). Offline; expected values are read off the PSI tables by hand."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ingest import build, tables  # noqa: E402

DATA = Path(__file__).resolve().parents[2] / "public" / "data"
AIR = "Air Rate (cm/s)"


def test_numbers_keep_sign_and_skip_formula_digits():
    assert tables.numbers("-0.28") == [-0.28]
    assert tables.numbers("LOW O2") == []  # the 2 of "O2" is not a value
    assert tables.numbers("0.1 - 5") == [0.1, 5.0]
    assert tables.numbers("21.5 - 21.7") == [21.5, 21.7]
    assert tables.numbers("10-20") == [10.0, 20.0]


def test_airflow_drops_negative_readings():
    # SPICE (PSI-107) logs -5.92 and -0.28 cm/s; dropping the sign used to turn them into 5.92 and 0.28
    rows = [{AIR: v} for v in ("-5.92", "-0.28", "0.66", "85.28", "0")]
    assert tables.airflow_values([AIR], rows) == [0.66, 85.28, 0.0]


def test_committed_spice_airflow_matches_table():
    # PSI-107_Experimental table_Spice.csv, "Air Rate (cm/s)": smallest non-negative 0.66, largest 85.28
    inv = {i["id"]: i for i in json.loads((DATA / "investigations.json").read_text(encoding="utf-8"))["items"]}
    assert inv["PSI-107"]["airflowRange"] == [0.66, 85.28]


def test_measurements_skip_computed_and_condition_columns():
    assert tables.measurements(["Tad (K)"]) == []  # adiabatic flame temperature is computed
    assert tables.measurements(["CO initial ambient composition; mole fraction"]) == []  # a test condition
    assert tables.measurements(["Initial CO (ppm)"]) == ["CO and CO2 levels"]


def test_sensors_ignore_representative_photo(monkeypatch):
    photo = {"key": "psi-data/PSI-47/Representative Image(s)/PSI-47_Representative Image(s)_DAFT on ISS.jpg",
             "sortingCategory": "Representative Image(s)"}
    monkeypatch.setattr(build.psi, "file_tree", lambda _i: {"tree": {"files": [photo]}})
    src = {"Experiment Hardware": {"Name": "TSI P-Trak"}, "Approach": ""}
    assert build.sensors("PSI-47", src) == ["particle counter"]
