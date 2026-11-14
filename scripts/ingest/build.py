"""Regenerate public/data/{investigations,habitats,overlap}.json from the PSI repository.

Run from scripts/:  uv run python -m ingest.build
Warm cache in data/raw/ means no network. See docs/lane-reports/a.md.
"""
import json
import re
from pathlib import Path

from . import psi, runs, tables
from .tables import UNIT_KPA
from .overlap import HABITATS, overlap_rows

RUNS_MAX = 5 * 1024 * 1024
OUT = Path(__file__).resolve().parents[2] / "public" / "data"
HAB_IDS = ("id", "label", "o2Percent", "pressureKPa", "note")

# --- editorial tables (one line per investigation; reasons are plain words for the UI) -------------
# pds, pdsBasis. "indirect: " when the link to fire safety needs a step of reasoning.
PDS = {
    "PSI-10": ("Prevention", "indirect: shows how fuel mix and oxygen level change how hot and sooty a flame gets"),
    "PSI-20": ("Prevention", "Finds the oxygen level where a burning flame can no longer survive (a flammability limit)."),
    "PSI-21": ("Prevention", "indirect: shows how fuel dilution changes the shape and soot of a gas flame, as in a leak fire"),
    "PSI-22": ("Suppression", "indirect: electric fields can steady or blow out a flame, a possible way to control one"),
    "PSI-23": ("Suppression", "indirect: finds how close a flame is to going out as oxygen and fuel dilution change"),
    "PSI-25": ("Prevention", "Maps which solid materials burn in slow air flow and how much oxygen they need."),
    "PSI-26": ("Prevention", "Tests whether solid materials burn or go out in slow air flow, the basis of material screening."),
    "PSI-39": ("Prevention", "indirect: cool flames can burn where normal flames would not, so screening limits must allow for them"),
    "PSI-47": ("Detection", "Tests particle counters for smoke detection in weightlessness."),
    "PSI-60": ("Detection", "indirect: computer study of the soot data from SPICE, soot being what smoke detectors sense"),
    "PSI-62": ("Prevention", "indirect: computer model of how fast a flame spreads along a material"),
    "PSI-68": ("Suppression", "Finds when droplet flames go out as oxygen, pressure and diluent gas change."),
    "PSI-69": ("Suppression", "Finds when droplet flames go out with CO2 or helium added to the air."),
    "PSI-98": ("Prevention", "Large-scale test of how fast a fire spreads over spacecraft fabric."),
    "PSI-99": ("Prevention", "Large-scale test of how fast a fire spreads over spacecraft materials."),
    "PSI-100": ("Prevention", "Large-scale test of how fire spreads with and against the air flow."),
    "PSI-101": ("Detection", "Measures how smoke particles grow and age, which sets how a detector sees them."),
    "PSI-102": ("Detection", "Measures smoke particle size and amount from heated materials, to design detectors."),
    "PSI-106": ("Suppression", "indirect: shows when a flame lifts off its burner and blows out as the flow rises"),
    "PSI-107": ("Detection", "indirect: the smoke point shows how much soot a flame makes, which is what smoke detectors sense"),
    "PSI-108": ("Other", "Not a combustion study: it examines liquid flow driven by surface tension."),
    "PSI-115": ("Detection", "indirect: computer study of how smoke particles grow in weightlessness"),
    "PSI-117": ("Suppression", "indirect: computer study of what pushes a cool flame out or keeps it alive"),
    "PSI-142": ("Suppression", "indirect: computer and lab study of where cool flames go out"),
    "PSI-159": ("Prevention", "indirect: cool flames burn at low temperature and can survive where ordinary flames go out"),
    "PSI-181": ("Other", "Not a combustion study: it looks at how solder joints form."),
}
# hardwareGroup (CIR = Combustion Integrated Rack, MDCA = droplet apparatus, MSG = glovebox)
GROUP = {**{k: "ACME (CIR)" for k in ("PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-159")},
         **{k: "MDCA (CIR)" for k in ("PSI-39", "PSI-68", "PSI-69")},
         **{k: "MSG flow duct" for k in ("PSI-25", "PSI-26", "PSI-106", "PSI-107")},
         "PSI-98": "Cygnus free-flyer", "PSI-99": "Cygnus free-flyer", "PSI-100": "Cygnus free-flyer",
         "PSI-101": "Smoke diagnostics", "PSI-102": "Smoke diagnostics", "PSI-47": "Particle counter",
         "PSI-108": "STDCE", "PSI-142": "PI laboratory",
         **{k: "Ground study" for k in ("PSI-60", "PSI-62", "PSI-115", "PSI-117", "PSI-181")}}
# fuelKind: judged from the investigation text (the enum has no "liquid"; PSI-108 is the nearest fit)
KIND = {**{k: "gas" for k in ("PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-106", "PSI-107", "PSI-159", "PSI-142", "PSI-60")},
        **{k: "solid" for k in ("PSI-25", "PSI-26", "PSI-98", "PSI-99", "PSI-100", "PSI-101", "PSI-102", "PSI-62", "PSI-181")},
        **{k: "droplet" for k in ("PSI-39", "PSI-68", "PSI-69", "PSI-117", "PSI-108")},
        "PSI-47": "aerosol", "PSI-115": "aerosol"}

SENSORS = [  # label, regex over file names + hardware text + approach text
    ("camera", r"camera|video|\.(tif|tiff|jpg|png|nef|avi|mp4)\b|imaging"),
    ("radiometer", r"radiometer"), ("thermocouple", r"thermocouple"), ("pyrometer", r"pyromet"),
    ("particle counter", r"p-?trak|dusttrak|particle counter|condensate nuclei"),
    ("PLIF laser imaging", r"\bplif\b"), ("schlieren optics", r"schlieren"),
    ("infrared camera", r"infrared|\bir camera"),
]
SHAPES = [  # label, regex
    ("droplet", r"\bdroplets?\b"), ("sphere", r"\bspher(e|ical)\b"),
    ("flat sheet", r"\b(sheet|film|fabric|slab)s?\b"), ("cylinder", r"\b(cylinders?|rods?|wires?)\b"),
    ("burner jet", r"\b(burner|nozzle)s?\b"),
]


def clean(text):
    text = (text or "").replace("\r", "")
    text = re.sub(r"�(?=s\b)", "'", text).replace("�", "")
    return re.sub(r"\s+", " ", text).strip()


def objectives(src):
    """First two sentences of Objectives (else Approach), original wording, long ones cut at a space."""
    text = clean(src.get("Objectives")) or clean(src.get("Approach"))
    text = re.sub(r"^Objectives?:\s*", "", text)
    parts = re.split(r"(?<=[^\d.][.!?])\s+(?=[A-Z])", text)
    out = " ".join(parts[:2])
    if len(out) > 420:
        out = out[:420].rsplit(" ", 1)[0].rstrip(",;:") + "..."
    return out


def hardware(src):
    name = clean((src.get("Experiment Hardware") or {}).get("Name"))
    parts = [p.strip() for p in re.split(r"\s{2,}", (src.get("Experiment Hardware") or {}).get("Name", "")) if p.strip()]
    return " + ".join(clean(p) for p in parts[:2]) or (name or "Not stated")


def sensors(psi_id, src):
    # a representative photo of the hardware is not evidence of an on-board camera
    names = " ".join(f["key"].lower() for f in psi.walk(psi.file_tree(psi_id)["tree"])
                     if f.get("sortingCategory") != "Representative Image(s)")
    text = " ".join([names, clean((src.get("Experiment Hardware") or {}).get("Name")).lower(),
                     clean(src.get("Approach")).lower()])
    found = [lab for lab, rx in SENSORS if re.search(rx, text)]
    raw_images = re.search(r"raw data/.*\.(tif|tiff|jpg|nef|avi|mp4|bmp)\b", names)  # image files in the repository
    if "camera" not in found and raw_images and GROUP.get(psi_id) != "Ground study":
        found.insert(0, "camera")
    return found


def shape(cells, kind, has_fuel_cells):
    """Shape words found in the fuel / sample cells; else the usual shape for the fuel kind."""
    found = [lab for lab, rx in SHAPES if re.search(rx, " ".join(cells).lower())]
    if not found and has_fuel_cells:
        found = {"gas": ["burner jet"], "droplet": ["droplet"]}.get(kind, [])
    return " / ".join(found[:3]) or "Not stated"


def fuel_text(names):
    if not names:
        return "Not stated"
    return ", ".join(names[:4]) + (f" and {len(names) - 4} more" if len(names) > 4 else "")


T_KPA = {**UNIT_KPA, "psia": UNIT_KPA["psi"]}
RECORD_FIELDS = ("Objectives", "Approach", "Hypothesis")
RE_REC_O2 = re.compile(r"(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:of\s+)?(?:oxygen|O2)\b", re.I)
RE_REC_P = re.compile(r"(\d+(?:\.\d+)?)\s*(psia|psi|atm|kpa|mmhg|bar)\b", re.I)
# Two conversions only, both applied only when the sentence itself says it:
#   "cabin air" / "ambient air" / "air environment"  -> 21 % oxygen
#   "ambient pressure"                                -> 101.3 kPa (1 atm)
RE_REC_AIR = re.compile(r"\b(cabin air|ambient air|air environment|1 atm air)\b", re.I)
RE_REC_AMB_P = re.compile(r"\bambient pressure\b", re.I)
# Sentences that cannot state the test atmosphere: a gas stream fed to the burner or sample
# (co-flow, airflow) rather than the surrounding atmosphere, and plans, proposals, design
# capabilities ("will be examined", "considered", "up to") rather than conditions that were run.
RE_REC_SKIP = re.compile(r"co-?flow|air ?flow|flow velocit|\b(will|would|shall|should|could|can|may|propos\w*|plann?\w*|"
                         r"desired|consider\w*|capab\w*|design\w*|requirements?|up to)\b", re.I)
RE_SPLIT = r"(?<=[^\d.][.!?])\s+(?=[A-Z])"


def record_sentences(src):
    text = " ".join(clean(src.get(f)) for f in RECORD_FIELDS)
    return [x.strip() for x in re.split(RE_SPLIT, text) if x.strip()]


def record_conditions(src, need_o2, need_p):
    """Test atmosphere stated in the PSI record text. Returns (o2Range, pressureRange, excerpt)."""
    o2, p, used = [], [], []
    for sent in record_sentences(src):
        if RE_REC_SKIP.search(sent):
            continue
        so = [float(v) for v in RE_REC_O2.findall(sent)] + ([21.0] if RE_REC_AIR.search(sent) else [])
        sp = [float(n) * T_KPA[u.lower()] for n, u in RE_REC_P.findall(sent)] + ([101.325] if RE_REC_AMB_P.search(sent) else [])
        so = [v for v in so if 0 < v <= 100]
        if (need_o2 and so) or (need_p and sp):
            used.append(sent)
            o2 += so if need_o2 else []
            p += sp if need_p else []
    return tables.rng(o2, 2), tables.rng(p, 1), " ".join(used)


def evidence(src):
    plat = clean(src.get("Flight Platform"))
    return "flight" if re.search(r"ISS|Space Station|Shuttle|Cygnus|spacecraft", plat, re.I) else "ground"


# explicit names of other investigations (case-sensitive acronyms, longest first)
MENTION = [("BASS-II", "PSI-25"), ("BASS", "PSI-26"), ("FLEX-2", "PSI-68"), ("FLEX", "PSI-69"), ("SAME-R", "PSI-101"),
           ("SAME", "PSI-102"), ("SPICE", "PSI-107"), ("SLICE", "PSI-106"), ("DAFT", "PSI-47"),
           ("SAFFIRE-III", "PSI-100"), ("SAFFIRE-II", "PSI-99"), ("SAFFIRE-I", "PSI-98"),
           ("Smoke Aerosol Measurement Experiment", "PSI-102"), ("Smoke Point in Coflow Experiment", "PSI-107")]
NO_GROUP = {"Ground study", "PI laboratory", "Not stated"}


def record_text_dashes(src):
    """Record text with Unicode hyphens and dashes as '-', so 'BASS–II' is read as BASS-II, not BASS."""
    return re.sub("[‐-―−]", "-", " ".join(clean(src.get(f)) for f in RECORD_FIELDS))


def related(inv, srcs, invs):
    me, text = inv["id"], record_text_dashes(srcs[inv["id"]])
    out = {}
    for key, oid in MENTION:
        if oid != me and re.search(rf"(?<![\w-]){re.escape(key)}(?![\w-])", text, re.I if " " in key else 0):
            out.setdefault(oid, f"Its PSI record names {key}")
    for oid in re.findall(r"PSI-\d+", clean(srcs[me].get("Related Investigations"))):
        if oid != me and oid in srcs:
            out.setdefault(oid, "Listed as related in its PSI record")
    mine = {n for n in inv["fuel"].split(", ") if n != "Not stated" and not n.startswith("and ")}
    for o in invs:
        if o["id"] != me and inv["hardwareGroup"] == o["hardwareGroup"] and inv["hardwareGroup"] not in NO_GROUP:
            out.setdefault(o["id"], f"Same hardware: {inv['hardwareGroup']}")
    for o in invs:
        shared = sorted(mine & {n for n in o["fuel"].split(", ")})
        if o["id"] != me and shared:
            out.setdefault(o["id"], f"Same fuel: {shared[0]}")
    return [{"id": k, "reason": v} for k, v in list(out.items())[:4]]


def investigation(src):
    i = src["Accession"]
    tabs = [tables.read_rows(psi.download_table(i, n, v)) for n, v, _ in psi.tables_of(i)]
    c = tables.conditions(tabs)
    pds, basis = PDS[i]
    other = pds == "Other"
    # table-derived ranges win; the record text only fills a dimension the table left null
    # ground and modeling records state simulated or planned-lab conditions, not a test atmosphere: flight only
    flight = evidence(src) == "flight"
    r_o2, r_p, excerpt = record_conditions(src, flight and c["o2Range"] is None, flight and c["pressureRange"] is None)
    o2_range, p_range = c["o2Range"] or r_o2, c["pressureRange"] or r_p
    basis_ = {"o2": "table" if c["o2Range"] else "record" if r_o2 else None,
              "pressure": "table" if c["pressureRange"] else "record" if r_p else None}
    if excerpt and "record" in basis_.values():
        basis_["excerpt"] = excerpt
    usable = not other and i not in runs.SKIP and any(rows for _, rows in tabs)
    run_cols, run_rows, run_notes = runs.build_table(tabs) if usable else ([], [], [])
    return {
        "id": i,
        "title": clean(src.get("Acronym")) or clean(src["Title"]),
        "hardware": hardware(src),
        "hardwareGroup": GROUP.get(i, "Not stated"),
        "pds": pds,
        "pdsBasis": basis,
        "sensors": sensors(i, src),
        "objectives": objectives(src),
        "fuelKind": KIND[i],
        "fuel": "Not stated" if other else fuel_text(tables.fuel_names(c["fuels"])),
        "sampleShape": "Not stated" if other else shape(c["fuels"] + c["samples"], KIND[i], bool(c["fuels"])),
        "o2Range": o2_range,
        "pressureRange": p_range,
        "airflowRange": c["airflowRange"],
        "measurements": tables.measurements(c["headers"]),
        "variables": c["variables"],
        "sourceIds": [f"psi:{i}"],
        "conditionBasis": basis_,
        "evidence": evidence(src),
        "runs": {"path": f"runs/{i}.json", "rows": len(run_rows), "columns": [x["name"] for x in run_cols]} if usable else None,
        "_runs": (run_cols, run_rows, run_notes),
    }


def write(name, items):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps({"items": items}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_runs(invs):
    """Write public/data/runs/<id>.json and .csv; pops the private _runs key from each investigation."""
    d = OUT / "runs"
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob("*"):
        old.unlink()
    total = 0
    for inv in invs:
        cols, rows, notes = inv.pop("_runs")
        if inv["runs"] is None:
            continue
        i = inv["id"]
        (d / f"{i}.json").write_text(json.dumps({"source": f"psi:{i}", "columns": cols, "notes": notes, "rows": rows},
                                                ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        (d / f"{i}.csv").write_text(runs.to_csv(cols, rows), encoding="utf-8", newline="")
    total = sum(f.stat().st_size for f in d.glob("*"))
    assert total < RUNS_MAX, f"runs/ is {total} bytes"
    print(f"runs/: {len(list(d.glob('*.json')))} files x2, {total} bytes")


def main():
    srcs = {s["Accession"]: s for s in psi.search()}
    for i in psi.EXTRA_IDS:
        if i not in srcs and (s := psi.search_by_id(i)):
            srcs[i] = s
    invs = [investigation(srcs[i]) for i in sorted(srcs, key=lambda k: int(k.split("-")[1]))]
    write_runs(invs)
    for inv in invs:
        inv["related"] = related(inv, srcs, invs)
    habs = [dict(zip(HAB_IDS, h)) for h in HABITATS]
    write("investigations.json", invs)
    write("habitats.json", habs)
    write("overlap.json", overlap_rows(invs, habs))
    print(f"{len(invs)} investigations, {len(habs)} habitats, {len(invs) * len(habs)} overlap rows")


if __name__ == "__main__":
    main()
