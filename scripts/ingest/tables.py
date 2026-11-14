"""Read PSI experimental-table CSVs and compute test conditions. Pure functions over rows.

Everything here is computed from the table; a column that is absent gives None, never a guess.
Units: O2 in percent (by volume), pressure in kPa, airflow in cm/s.
"""
import csv
import io
import re

NUM = re.compile(r"\d+(?:\.\d+)?|\.\d+")
UNIT_KPA = {"atm": 101.325, "bar": 100.0, "mmhg": 0.133322, "torr": 0.133322, "kpa": 1.0, "psi": 6.894757}
# varies:true needs a spread bigger than this (noise floor): 1 point O2, 5 kPa, 1 cm/s.
TOL = {"oxygen": 1.0, "pressure": 5.0, "airflow": 1.0}

RE_O2 = re.compile(r"(^|[\s(])(x?o2|oxygen|percent o2|o initial|atmosphere)|\bo2\b.*vol", re.I)
RE_O2_NO = re.compile(r"flow|\(mg/s\)|final|after|\bmo2\b|nitrogen|helium", re.I)
RE_P = re.compile(r"pressure|^p(init|mean)?\s*\(|approx p\b", re.I)
RE_P_NO = re.compile(r"final|after|^peak", re.I)
RE_AIR = re.compile(r"air flow|air rate|inlet velocity|flow velocity", re.I)
RE_FUEL = re.compile(r"^(fuel|fuel type|fuel bottle|sample \(fuel type\)|composition|(fuel )?sample material|material|sample type)\s*\*?$", re.I)
RE_SAMPLE = re.compile(r"thickness|sample (length|width)|nozzle|burner size|droplet.*diameter", re.I)
RE_DILUENT = re.compile(r"nitrogen|helium|^n2|^he\b|diluent|ambient gas", re.I)

MEASURE = [  # (label, header regex)
    ("burn time", r"burn time"), ("burning rate", r"burn(ing)? ?rate"),
    ("droplet diameter", r"droplet.*diameter"), ("extinction diameter", r"extinction diameter"),
    ("flame temperature", r"tad|flame temp"), ("burner temperature", r"burner t|peak burner"),
    ("weight loss rate", r"weight loss"), ("CO and CO2 levels", r"\bco\b|co2 %|\(ppm\)|initial co|final co"),
    ("ignition power and time", r"ignition (power|time)"), ("flame spread", r"spread"),
    ("smoke aging time", r"aging"), ("soot ratio", r"rt/r0"),
    ("fuel flow rate", r"fuel (rate|mfc)|mfuel|mtot|hc burnrate|mhc"),
]


def read_rows(path):
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252", errors="replace")
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return [], []
    head = [h.strip() for h in rows[0]]
    return head, [dict(zip(head, r)) for r in rows[1:] if any(c.strip() for c in r)]


def numbers(cell):
    """Numbers in a cell. If the cell has '%', only numbers directly followed by '%' count."""
    if "%" in cell:
        return [float(n) for n in re.findall(r"(\d+(?:\.\d+)?|\.\d+)\s*%", cell)]
    return [float(n) for n in NUM.findall(cell)]


def _unit_kpa(text):
    m = re.search(r"\b(atm|bar|mmhg|torr|kpa|psi)\b", text.lower())
    return UNIT_KPA[m.group(1)] if m else None


def _col_values(head, rows, regex, no_regex=None):
    return [(h, [r.get(h, "") for r in rows]) for h in head
            if regex.search(h) and not (no_regex and no_regex.search(h))]


def o2_values(head, rows):
    out = []
    for h, cells in _col_values(head, rows, RE_O2, RE_O2_NO):
        pct_header = bool(re.search(r"percent|%|vol", h, re.I))
        vals = [v for c in cells for v in numbers(c)]
        # fractions (0.21) vs percent (21): decide per column by its median, so a stray value cannot flip it
        frac = vals and sorted(vals)[len(vals) // 2] <= 1.0 and not pct_header and not any("%" in c for c in cells)
        out += [v * 100.0 if frac else v for v in vals]
    return [v for v in out if 0 < v <= 100]  # drops spreadsheet artefacts such as 3400


def pressure_values(head, rows):
    out = []
    for h, cells in _col_values(head, rows, RE_P, RE_P_NO):
        for c in cells:
            unit = _unit_kpa(c) or _unit_kpa(h)
            if unit:
                out += [v * unit for v in numbers(c)]
    if not out:  # fall back to explicit "~1 atm" statements in notes columns
        for h, cells in _col_values(head, rows, re.compile(r"^notes?$", re.I)):
            for c in cells:
                out += [float(m) * UNIT_KPA["atm"] for m in re.findall(r"(\d+(?:\.\d+)?)\s*atm\b", c)]
    return [v for v in out if 0 < v < 1e4]


def airflow_values(head, rows):
    out = []
    for h, cells in _col_values(head, rows, RE_AIR):
        for c in cells:
            if "cm/s" in c.lower() or "cm/s" in h.lower():
                out += numbers(c)
    return out


def text_values(head, rows, regex):
    return sorted({c.strip() for h, cells in _col_values(head, rows, regex) for c in cells if c.strip()})


def rng(vals, nd):
    return [round(min(vals), nd), round(max(vals), nd)] if vals else None


def conditions(tables):
    """tables: list of (head, rows). Returns ranges plus the variables list and descriptive text."""
    o2, p, air, fuels, samples, diluents, headers = [], [], [], set(), set(), set(), []
    for head, rows in tables:
        headers += head
        o2 += o2_values(head, rows)
        p += pressure_values(head, rows)
        air += airflow_values(head, rows)
        fuels |= set(text_values(head, rows, RE_FUEL))
        samples |= set(text_values(head, rows, RE_SAMPLE))
        for h in head:
            if RE_DILUENT.search(h):
                diluents.add(tuple(sorted({r.get(h, "").strip() for r in rows if r.get(h, "").strip()})))
    variables = []
    for name, vals in (("oxygen", o2), ("pressure", p), ("airflow", air)):
        if vals:
            variables.append({"name": name, "varies": max(vals) - min(vals) > TOL[name]})
    if fuels:
        variables.append({"name": "fuel", "varies": len(fuels) > 1})
    if diluents:
        variables.append({"name": "diluent", "varies": any(len(d) > 1 for d in diluents)})
    return {"o2Range": rng(o2, 2), "pressureRange": rng(p, 1), "airflowRange": rng(air, 2),
            "variables": variables, "fuels": sorted(fuels), "samples": sorted(samples), "headers": headers}


def measurements(headers):
    low = [h.lower() for h in headers]
    return [label for label, rx in MEASURE if any(re.search(rx, h) for h in low)]


def fuel_names(raw):
    """Clean fuel cells: drop '40%' prefixes, diluent tails, '(pure)'; drop impossible formulas.

    Spreadsheet auto-increment turned some labels into C2H10, CH5, C2H5 ...: a stable hydrocarbon
    CcHh has even h and h <= 2c + 2, so labels that break that are dropped rather than shown.
    """
    seen = {}
    for cell in raw:
        t = re.split(r" in combination| to create|:", cell)[0]
        t = re.sub(r"\(\s*\d+(?:\.\d+)?\s*%\s*\)", "  ", t)
        t = re.sub(r"\d+(?:\.\d+)?\s*%\s*", "", t)
        t = re.sub(r"\(\s*(pure|mixture|balance[^)]*)\)|,?\s*with\s+\w+|balance\s+\w+", "", t, flags=re.I).strip(" ,;")
        t = re.sub(r"\s{2,}", " / ", t)
        if re.search(r"pre-test|same cond|calibration|including|visuali", t, re.I) or len(t) > 60:
            continue  # notes that landed in a material column
        parts = [x.strip() for x in t.split(",")]
        for name in (parts if all(re.fullmatch(r"[A-Z][A-Za-z0-9]*", x) for x in parts) else [t]):
            m = re.fullmatch(r"C(\d*)H(\d+)", name)
            # a stable hydrocarbon has an even H count, at most 2c + 2
            if name and not (m and (int(m.group(2)) % 2 or int(m.group(2)) > 2 * int(m.group(1) or 1) + 2)):
                seen.setdefault(name.lower(), name)
    return sorted(seen.values())
