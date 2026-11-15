"""Build public/data/solids.json, the "Solid materials" section:  python scripts/solids/build.py
Two real NASA tables, nothing modelled or invented:
  1. Flammability map: BASS-II Summary Report (NASA/TM-20210011385), Table 7.1, p. 96, typed into
     scripts/solids/bass_table_7_1.csv row by row. Reused samples are left out, as the report itself does.
  2. Space vs Earth: the SAFFIRE-II run table from PSI (public/data/runs/PSI-99.json), read as it is.
Stdlib only; the output is deterministic, so a rebuild must give the same file."""
import csv, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "public" / "data"
OUT = DATA / "solids.json"

# ---------------- 1. BASS / BASS-II fabric tests ----------------
OUTCOME = {  # table comment -> outcome id
    "": "burned",
    "Quenched": "quenched",
    "Blow-off": "blowoff",
    "No blowoff": "no-blowoff",
    "No ignition": "no-ignition",
}


def num(s):
    return float(s) if "." in s else int(s)


tests, excluded = [], []
for row in csv.DictReader(open(Path(__file__).with_name("bass_table_7_1.csv"), encoding="utf-8")):
    if row["comment"].startswith("Reused"):
        excluded.append(row["test"])
        continue
    t = dict(
        test=row["test"],
        series=row["series"],
        widthCm=num(row["width_cm"]),
        flowFrom=num(row["flow_from_cm_s"]),
        flowTo=num(row["flow_to_cm_s"]),
        o2=num(row["o2_percent"]),
        outcome=OUTCOME[row["comment"]],
    )
    if row["o2_note"]:
        t["o2Uncertain"] = True
    tests.append(t)

flamm = dict(
    source=dict(
        id="ntrs:20210011385",
        title="Burning and Suppression of Solids-II (BASS-II) Summary Report",
        url="https://ntrs.nasa.gov/citations/20210011385",
        where="NASA/TM-20210011385, Table 7.1 (p. 96) and Section 7.1.4",
    ),
    material="SIBAL cotton-fiberglass fabric, 2.2 cm or 1.2 cm wide",
    flow="Concurrent (air moving the same way as the flame)",
    # Paraphrased from Section 7.1.4-7.1.5 of the report; numbers as the report gives them.
    findings=[
        "When the crew turned the airflow down, flames on the 2.2 cm fabric went out at flows between about 1 and 5 cm/s.",
        "With less oxygen, the flame needed more airflow to stay alight.",
        "The narrower 1.2 cm fabric had a smaller range of conditions where it could burn.",
        "The lowest oxygen that can still support a flame could not be pinned down this way; the report says a test that slowly lowers oxygen is needed.",
    ],
    tests=tests,
    excluded=excluded,
    excludedWhy="Re-ignited, partly burned samples; the report leaves them out because they give little usable data.",
    maxO2=max(t["o2"] for t in tests),
    minBurnO2=min(t["o2"] for t in tests if t["outcome"] in ("burned", "quenched", "blowoff", "no-blowoff")),
    counts={k: sum(t["outcome"] == k for t in tests) for k in OUTCOME.values()},
)

# ---------------- 2. SAFFIRE-II, space vs Earth ----------------
runs = json.load(open(DATA / "runs" / "PSI-99.json", encoding="utf-8"))
NOTES = {m.group(1): m.group(2) for n in runs["notes"] if (m := re.match(r"Note (\d) (.*)", n))}


def thickness(s):
    if s.startswith("See"):
        return "thickness varies (see the PSI table)"
    return re.sub(r"^0(\d\d) mm$", r"0.\1 mm", s)  # the PSI table writes 0.37 mm as "037 mm"


def level(burn, sample_len):
    """How much of the sample burned: none / part / all."""
    if burn.startswith("~ 0"):
        return "none"
    if burn == "Complete" or burn == sample_len:
        return "all"
    return "part"


def space_text(r):
    b, sp = r["microgravity_burn_length"], r["microgravity_spread_length"]
    if b.startswith("~ 0"):
        return "About 0 cm burned"
    if b == r["sample_length"]:
        return f"Burned the whole {b} at {sp}"
    if "Note 4" in sp:
        return "Flame stayed anchored at the base, which wore away at only 0.01 to 0.04 mm/s; about 10 cm visibly damaged"
    return b


def earth_text(r):
    b, rate = r["normal_gravity_burn_length"], r["normal_gravity_spread_rate"]
    if b.startswith("~ 0"):
        return "About 0 cm burned"
    if b == "Complete":
        return "Burned completely, speeding up" if rate == "Acceleratory" else f"Burned completely at {rate}"
    return f"Burned {b} at {rate}"


samples, skipped = [], []
for r in runs["rows"]:
    if not r["material"]:
        skipped.append(r["sample_number"])  # material cell blank in the PSI table
        continue
    if "Nomex" in r["material"]:  # one mixed sample: PMMA strip then Nomex fabric (Note 2)
        samples.append(dict(sample=r["sample_number"], material="PMMA strip, then Nomex fabric", thickness=r["samle_thickness"],
                            flowDirection=r["flow_direction"].lower(), o2=r["o2_percent"],
                            space=dict(level="part", text="The PMMA strip burned up; the Nomex fabric never caught fire"),
                            earth=dict(level="none", text="Nomex: about 0 cm burned"),
                            comparable=False, note="The 1-g column only reports the Nomex part, so this pair is not a like-for-like comparison."))
        continue
    samples.append(dict(
        sample=r["sample_number"], material=r["material"].replace("Cotton-Fiberglass (SIBAL)", "Cotton-fiberglass fabric (SIBAL)"),
        thickness=thickness(r["samle_thickness"]), flowDirection=r["flow_direction"].lower(), o2=r["o2_percent"],
        space=dict(level=level(r["microgravity_burn_length"], r["sample_length"]), text=space_text(r)),
        earth=dict(level=level(r["normal_gravity_burn_length"], r["sample_length"]), text=earth_text(r)),
    ))

o2s = [float(x) for r in runs["rows"] for x in str(r["o2_percent"]).split(";")]
saffire = dict(
    source=dict(id="psi:PSI-99", title="Spacecraft Fire Experiment-II (SAFFIRE-II), run table",
                url="https://psi.nasa.gov/geode-py/ws/repo/search?term=PSI-99&source=psi&type=investigation",
                where="PSI-99 run table: microgravity burn columns and 1-g (normal gravity) columns"),
    o2=[min(o2s), max(o2s)],
    flowCmS=sorted({r["airflow_cm_s"] for r in runs["rows"]}),
    sampleLengthCm=29,
    samples=samples,
    skipped=skipped,
    skippedWhy="The material cell is blank in the PSI table.",
)

doc = dict(
    about="Real NASA test tables on solid materials (fabrics, plastics, silicone) in microgravity. Built by scripts/solids/build.py.",
    flammability=flamm,
    saffire=saffire,
)
OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"{len(tests)} fabric tests ({len(excluded)} reused left out), {len(samples)} SAFFIRE-II samples -> {OUT}")
