"""Run-level export: one cleaned row per test run, per investigation.

PSI's values are kept as given. Only the three condition columns are converted, with the same
rules as the ranges (so min/max of o2_percent equals o2Range): O2 to percent, pressure to kPa,
airflow to cm/s. A cell with several values ("21; 26.5; 40") stays text with the converted values.
"""
import csv
import io
import re

from . import tables as T

SKIP = {"PSI-142": "its table lists figure references, not test runs"}  # Other-pds rows are skipped by the caller
UNITS = r"mg/s|g/s|sccm|slpm|atm|bar|mmhg|kpa|psi|k|c|mm|cm|cm/s|m/s|s|sec|min|minutes|w|ppm|%|mole fraction|um|micron"


MIN_CELLS = 3  # a row is a test run only with a value in at least this many columns (fewer if the table is narrower)


def snake(text):
    # "µ-g ..." (micro sign U+00B5 / U+03BC; PSI's own files often hold a literal "?" there) means microgravity
    text = re.sub(r"^\s*[µμ?]-g\b", "microgravity", text)
    text = re.sub(r"^\s*1-g\b", "normal gravity", text)
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def split_unit(header):
    """('burn time', 's') from 'Burn time; s' or 'mfuel (mg/s)'; unit None when the header has none."""
    m = re.search(rf"\(\s*({UNITS})\s*\)\s*$", header, re.I) or re.search(rf"[;,]\s*({UNITS})\s*$", header, re.I)
    if not m:
        return header, None
    return header[:m.start()].strip(), m.group(1)


def _fmt(v):
    return int(v) if float(v).is_integer() else round(v, 4)


def _convert(kind, header, cell):
    """Condition cell -> number, 'a; b' text, or None. Mirrors the range code in tables.py."""
    if not cell.strip():
        return None
    if kind == "o2_percent":
        vals = T.numbers(cell)
        return vals  # scaling decided per column by the caller
    if kind == "pressure_kpa":
        unit = T._unit_kpa(cell) or T._unit_kpa(header)
        return [v * unit for v in T.numbers(cell)] if unit else []
    if kind == "airflow_cm_s":
        return T.numbers(cell) if ("cm/s" in cell.lower() or "cm/s" in header.lower()) else []


def _cond_cols(head, rows):
    """{header: kind} for the columns the range code reads."""
    cols = {}
    for h, _ in T._col_values(head, rows, T.RE_O2, T.RE_O2_NO):
        cols[h] = "o2_percent"
    for h, _ in T._col_values(head, rows, T.RE_P, T.RE_P_NO):
        cols[h] = "pressure_kpa"
    for h, _ in T._col_values(head, rows, T.RE_AIR):
        cols[h] = "airflow_cm_s"
    return cols


def _cell(kind, header, cell, scale):
    vals = _convert(kind, header, cell)
    if not vals:
        return None
    if kind == "o2_percent":
        vals = [v * scale for v in vals if 0 < v * scale <= 100]
    elif kind == "pressure_kpa":
        vals = [v for v in vals if 0 < v < 1e4]
    else:
        vals = [v for v in vals if v >= 0]
    vals = [round(v, 2 if kind != "pressure_kpa" else 1) for v in vals]
    if not vals:
        return None
    return _fmt(vals[0]) if len(vals) == 1 else "; ".join(str(_fmt(v)) for v in vals)


def _plain(cell):
    """Non-condition cell: a plain number becomes a number at PSI's full precision, anything else stays text."""
    c = cell.strip()
    if not c:
        return None
    if not re.fullmatch(r"-?\d+(\.\d+)?", c) or re.fullmatch(r"-?0\d+", c):
        return c
    v = float(c)
    return int(v) if v.is_integer() else v


def build_table(tabs):
    """tabs: [(head, rows)] -> (columns, rows, notes). Columns: [{name, unit, original}].

    Rows with fewer than MIN_CELLS non-empty cells (captions, footnotes, "same conditions as 1-4"
    stubs) are not runs: their text goes to notes, in order.
    """
    columns, out, notes = [], [], []
    names = {}  # (original, name) registry; columns shared between tables keep one entry

    def col(name, unit, original):
        key = (name, original)
        if key not in names:
            base, n = name, 2
            while any(c["name"] == name for c in columns):
                name, n = f"{base}_{n}", n + 1
            names[key] = name
            columns.append({"name": name, "unit": unit, "original": original})
        return names[key]

    for head, rows in tabs:
        cond = _cond_cols(head, rows)
        per_kind = {}
        for h, k in cond.items():
            per_kind.setdefault(k, []).append(h)
        scale = {}
        for h, k in cond.items():
            if k == "o2_percent":
                vals = [v for r in rows for v in T.numbers(r.get(h, ""))]
                pct = bool(re.search(r"percent|%|vol", h, re.I)) or any("%" in r.get(h, "") for r in rows)
                scale[h] = 100.0 if vals and not pct and sorted(vals)[len(vals) // 2] <= 1.0 else 1.0
        naming = {}
        for h in head:
            if h in cond:
                k = cond[h]
                unit = {"o2_percent": "%", "pressure_kpa": "kPa", "airflow_cm_s": "cm/s"}[k]
                nm = k if len(per_kind[k]) == 1 else f"{k}_{snake(split_unit(h)[0])}"
            else:
                base, unit = split_unit(h)
                nm = snake(base) + (f"_{snake(unit)}" if unit else "") or "column"
            naming[h] = (col(nm, unit, h), cond.get(h))
        for r in rows:
            filled = [v.strip() for v in r.values() if v and v.strip()]
            if len(filled) < min(MIN_CELLS, len(head)):
                notes.append(" ".join(filled))
                continue
            row = {}
            for h in head:
                name, kind = naming[h]
                row[name] = _cell(kind, h, r.get(h, ""), scale.get(h, 1.0)) if kind else _plain(r.get(h, ""))
            out.append(row)
    names_all = [c["name"] for c in columns]
    return columns, [{n: r.get(n) for n in names_all} for r in out], notes


def to_csv(columns, rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow([c["name"] for c in columns])
    for r in rows:
        w.writerow(["" if r[c["name"]] is None else r[c["name"]] for c in columns])
    return buf.getvalue()
