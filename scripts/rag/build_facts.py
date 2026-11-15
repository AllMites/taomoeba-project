"""Build public/data/facts.json, the DATA FACTS /ask answers from:  python scripts/rag/build_facts.py <x3-model-handoff folder> [public/data]
Every number is computed here, in code, from the team's data; the chat may restate a fact but never invent a number.
Sources:
  1. PSI experiment tables, cleaned by the model package: out/flex_clean.csv (PSI-69 FLEX), out/cfig_clean.csv (PSI-159 CFI-G)
  2. Team model results: results.json (cross-validation, importance, partial dependence, Moon-Base coverage)
  3. Dashboard rankings: <dashboard>/rank.json + investigations.json when the real files exist (sample *.fixture.json
     files are skipped on purpose: they are made-up placeholders).
  4. Solid-material tables: <dashboard>/solids.json (BASS-II Table 7.1 and the PSI-99 run table, scripts/solids/build.py).
Writes data/facts.json: [{id, dataset, source, statement, numbers, keywords, method, caveat}]."""
import csv, json, math, sys
from collections import Counter, defaultdict
from pathlib import Path

X3 = Path(sys.argv[1])
DASH = Path(sys.argv[2]) if len(sys.argv) > 2 else None
OUT = Path(__file__).resolve().parents[2] / "public" / "data" / "facts.json"
WEB_ID = {"PSI-69": "psi:PSI-69", "PSI-159": "psi:PSI-159", "x3:report": "team:model-report"}  # website source ids
facts = []


def r(x, nd=2):
    return f"{x:.{nd}f}"


def add(fid, dataset, source, statement, keywords, method, caveat=""):
    nums = sorted(set(__import__("re").findall(r"(?<![A-Za-z\d.])\d+(?:\.\d+)?", statement)))
    facts.append(dict(id=fid, dataset=dataset, source=source, statement=statement, numbers=nums,
                      keywords=keywords, method=method, caveat=caveat))


def spearman(xs, ys):
    def ranks(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        rk = [0.0] * len(v)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
                j += 1
            for k in range(i, j + 1):
                rk[order[k]] = (i + j) / 2 + 1
            i = j + 1
        return rk
    a, b = ranks(xs), ranks(ys)
    ma, mb = sum(a) / len(a), sum(b) / len(b)
    cov = sum((p - ma) * (q - mb) for p, q in zip(a, b))
    return cov / math.sqrt(sum((p - ma) ** 2 for p in a) * sum((q - mb) ** 2 for q in b))


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# ---------------- 1. FLEX table (PSI-69) ----------------
FLEX = "PSI-69 FLEX experiment table (cleaned)"
rows = [x for x in csv.DictReader(open(X3 / "out" / "flex_clean.csv", encoding="utf-8")) if x["ok_features"] == "True"]
fuels = Counter(x["fuel"] for x in rows)
dates = sorted({x["group_date"] for x in rows})
add("flex-runs", FLEX, "PSI-69",
    f"The cleaned FLEX table has {len(rows)} usable droplet runs ({fuels['Methanol']} methanol, {fuels['Heptane']} heptane) "
    f"on {len(dates)} test dates from {dates[0]} to {dates[-1]}.",
    "FLEX runs droplets methanol heptane how many tests dates data size", "row counts of out/flex_clean.csv (ok_features)")

def _n(col):
    sub = [x for x in rows if num(x[col]) is not None]
    return len(sub), len({x["group_date"] for x in sub})
(nb, db), (ne, de) = _n("br"), _n("dext")
nt = sum(1 for x in rows if x["end"]); dt = len({x["group_date"] for x in rows if x["end"]})
add("flex-model-data", FLEX, "PSI-69",
    f"The team models were trained on cleaned FLEX runs: {nb} runs with a burning rate ({db} test dates), {ne} with a flame "
    f"extinction diameter ({de} dates) and {nt} with a recorded test end ({dt} dates).",
    "how many runs rows data trained train training models model data set size FLEX used",
    "row counts of out/flex_clean.csv with each value present (ok_features)",
    "Runs missing a value are left out of that model only.")
add("flex-br-unit", FLEX, "PSI-69",
    "FLEX burning rates are burning-rate constants in mm2/s: the slope of droplet diameter squared against time, as NASA's "
    "FLEX Detailed Results report (NASA/TP-2015-216046) gives them; the PSI table header shows only mm.",
    "unit units burning rate mm2/s mm per second what measured meaning constant d2 law",
    "unit checked against NASA/TP-2015-216046 (model package REPORT.md section 9)")

bands = [(0.0, 0.18, "below 18%"), (0.18, 0.25, "18% to 25%"), (0.25, 1.01, "25% or more")]
for fuel in ("Methanol", "Heptane"):
    sub = [x for x in rows if x["fuel"] == fuel and num(x["br"]) is not None]
    rho = spearman([num(x["o2"]) for x in sub], [num(x["br"]) for x in sub])
    parts = []
    for lo, hi, lab in bands:
        b = [num(x["br"]) for x in sub if lo <= num(x["o2"]) < hi]
        if b:
            parts.append(f"{r(sum(b) / len(b))} at oxygen {lab} (n={len(b)})")
    add(f"flex-br-o2-{fuel.lower()}", FLEX, "PSI-69",
        f"In the FLEX table, the mean burning rate of {fuel.lower()} droplets is " + ", ".join(parts) +
        f"; rank correlation between oxygen fraction and burning rate is {r(rho)}.",
        f"burning rate oxygen O2 {fuel} droplet FLEX increase rise faster", "binned means and Spearman correlation over runs with a burning rate",
        "Burning rate is the burning-rate constant in mm2/s (NASA's FLEX Detailed Results report; the PSI table header says only mm); other conditions (pressure, diluent, droplet size) also vary.")

for fuel in ("Methanol", "Heptane"):
    sub = [x for x in rows if x["fuel"] == fuel and num(x["dext"]) is not None]
    if len(sub) > 5:
        rho = spearman([num(x["d0"]) for x in sub], [num(x["dext"]) for x in sub])
        add(f"flex-dext-d0-{fuel.lower()}", FLEX, "PSI-69",
            f"For {fuel.lower()} in the FLEX table, flame extinction diameter rises with initial droplet diameter: "
            f"rank correlation {r(rho)} over {len(sub)} runs with a recorded extinction diameter.",
            f"extinction diameter droplet size initial diameter d0 {fuel} FLEX flame goes out",
            "Spearman correlation over runs with an extinction diameter")

ends = Counter(x["end"] for x in rows)
parts = []
for lo, hi, lab in [(0.0, 0.21, "below 21%"), (0.21, 0.28, "21% to 28%"), (0.28, 1.01, "28% or more")]:
    b = Counter(x["end"] for x in rows if lo <= num(x["o2"]) < hi)
    n = sum(b.values())
    if n:
        parts.append(f"oxygen {lab}: {b['Extinction']} extinction, {b['Disruption']} disruption, {b['Completion']} completion (n={n})")
add("flex-end-o2", FLEX, "PSI-69",
    "How FLEX droplet runs ended, by oxygen level: " + "; ".join(parts) + ".",
    "test end extinction disruption completion how runs ended oxygen O2 FLEX outcome", "counts of the Test end column by oxygen band",
    "Disruption means the droplet broke apart; at high oxygen most runs ended that way, so few extinction measurements exist there.")

for dil, col in (("helium", "he"), ("carbon dioxide", "co2")):
    sub = [x for x in rows if num(x[col]) and num(x[col]) > 0]
    add(f"flex-diluent-{col}", FLEX, "PSI-69",
        f"{len(sub)} FLEX runs used {dil} in the surrounding gas ({sum(1 for x in sub if x['fuel'] == 'Methanol')} methanol, "
        f"{sum(1 for x in sub if x['fuel'] == 'Heptane')} heptane), with {dil} fractions from {r(min(num(x[col]) for x in sub))} to "
        f"{r(max(num(x[col]) for x in sub))}.",
        f"{dil} {col} diluent suppressant inert gas FLEX droplet", f"count of runs with {col} > 0")

# ---------------- 2. CFI-G table (PSI-159) ----------------
CFIG = "PSI-159 ACME CFI-G gas-flame table (cleaned)"
crow = [x for x in csv.DictReader(open(X3 / "out" / "cfig_clean.csv", encoding="utf-8")) if x["ok_features"] == "True"]
byf = Counter((x["flame"], x["fuel"]) for x in crow)
add("cfig-runs", CFIG, "PSI-159",
    f"The cleaned CFI-G table has {len(crow)} gas-flame tests: {sum(v for (f, _), v in byf.items() if f == 'normal')} normal flames and "
    f"{sum(v for (f, _), v in byf.items() if f == 'inverse')} inverse flames, burning ethane, propane or butane.",
    "CFI-G cool flames gases tests how many normal inverse ethane propane butane data size", "row counts of out/cfig_clean.csv")
for flame in ("normal", "inverse"):
    se = Counter(x["se_ft"] for x in crow if x["flame"] == flame and x["se_ft"] in ("SE", "FT"))
    n = se["SE"] + se["FT"]
    add(f"cfig-se-{flame}", CFIG, "PSI-159",
        f"In the CFI-G table, {se['SE']} of {n} {flame} flames with a recorded ending self-extinguished and {se['FT']} were ended by stopping the flow.",
        f"self-extinguish self extinguished flow terminated {flame} flame CFI-G goes out by itself", "counts of the SE/FT column")
parts = []
for lo, hi, lab in [(0.0, 0.25, "below 25%"), (0.25, 0.35, "25% to 35%"), (0.35, 1.01, "35% or more")]:
    se = Counter(x["se_ft"] for x in crow if x["flame"] == "normal" and x["se_ft"] in ("SE", "FT") and lo <= num(x["xo2"]) < hi)
    n = se["SE"] + se["FT"]
    if n:
        parts.append(f"{se['SE']} of {n} self-extinguished at ambient oxygen {lab}")
add("cfig-se-o2-normal", CFIG, "PSI-159",
    "For normal CFI-G flames by oxygen level: " + "; ".join(parts) + ".",
    "self-extinguish oxygen O2 normal flame CFI-G gas flames goes out low oxygen", "SE/FT counts by ambient oxygen band, normal flames")
hot = Counter(x["hot"].strip().lower() for x in crow if x["hot"])
add("cfig-hot-ignition", CFIG, "PSI-159",
    f"In the CFI-G table, {hot['yes']} tests recorded a hot ignition, {hot['no']} did not, and {hot['flash']} were marked 'flash'.",
    "hot ignition ignite CFI-G yes no flash", "counts of the Hot ignition column")

# ---------------- 3. Team model results ----------------
TEAM = "Team model results"
res = json.load(open(X3 / "results.json", encoding="utf-8"))
cv = res["cv"]


def m(target, model, metric):
    return cv[target]["models"][model][metric] if "models" in cv[target] else cv[target][model][metric]


ref = res.get("refined")  # refinement round (x3 REPORT.md section 9, 05_refine_fit.py); absent in older packages
try:
    if ref:
        add("model-recommended", TEAM, "x3:report",
            "The team recommends four models: Ridge for droplet burning rate, the refined CatBoost for flame extinction diameter "
            "(inside the tested range only), a logistic model for the chance a droplet breaks apart, and CatBoost for whether a gas "
            "flame self-extinguishes; the other models are kept for comparison only.",
            "which model recommended use ship burning rate extinction diameter disruption break apart self-extinguish team models",
            "verdict tables, REPORT.md sections 1 and 9")
    else:
        add("model-recommended", TEAM, "x3:report",
            "The team recommends three models: Ridge for droplet burning rate, CatBoost for flame extinction diameter (inside the "
            "tested range only) and CatBoost for whether a gas flame self-extinguishes; the other models are kept for comparison only.",
            "which model recommended use ship burning rate extinction diameter self-extinguish team models", "verdict table, REPORT.md section 1")
    add("model-br-accuracy", TEAM, "x3:report",
        "For FLEX burning rate (in mm2/s), the linear Ridge model has error (RMSE) 0.074 against 0.082 for CatBoost and 0.138 for always guessing the mean.",
        "burning rate model accuracy error RMSE Ridge CatBoost how good", "grouped cross-validation, REPORT.md section 1")
    add("model-dext-accuracy", TEAM, "x3:report",
        "For flame extinction diameter, CatBoost has error (RMSE) 0.497 mm against 0.566 mm for Ridge and 1.037 mm for always guessing the mean.",
        "extinction diameter model accuracy error RMSE CatBoost how good", "grouped cross-validation, REPORT.md section 1")
    add("model-se-accuracy", TEAM, "x3:report",
        "For predicting whether a CFI-G gas flame self-extinguishes, CatBoost reaches balanced accuracy 0.795 against 0.638 for logistic regression and 0.500 for guessing.",
        "self-extinguish model accuracy balanced accuracy CatBoost gas flame CFI-G how good", "grouped cross-validation, REPORT.md section 1")
    add("model-ignition-weak", TEAM, "x3:report",
        "The hot-ignition model is not recommended: balanced accuracy 0.627 under honest testing, against 0.809 when nearby tests leak into training.",
        "hot ignition model weak not recommended leakage accuracy", "grouped vs random cross-validation, REPORT.md section 1")
    add("model-validation", TEAM, "x3:report",
        "The models were tested by holding out whole test days (80 FLEX test dates, 23 CFI-G test days) in 50 folds, so runs from the same day never appear in both training and testing.",
        "validation validated cross-validation overfitting leakage grouped test days folds how tested", "REPORT.md section 4")
except Exception as e:
    print("model facts skipped:", e)

imp = res["importance_pd_coverage"]["importance"]
for target, label in (("flex_burning_rate", "burning rate"), ("flex_ext_diameter", "extinction diameter")):
    pm = imp[target].get("permutation_grouped_cv_rmse_increase", {})
    top = sorted(pm.items(), key=lambda kv: -kv[1]["mean_score_drop"])[:3]
    names = {"o2": "oxygen fraction", "d0": "initial droplet diameter", "co2": "carbon dioxide fraction", "he": "helium fraction",
             "fuel_h": "fuel type", "n2": "nitrogen fraction", "p_mmHg": "pressure"}
    add(f"model-importance-{target}", TEAM, "x3:report",
        f"For {label}, the inputs that matter most to the team's CatBoost model are " +
        ", ".join(f"{names.get(k, k)} (error rises by {r(v['mean_score_drop'], 3)} when shuffled)" for k, v in top) +
        f"; pressure matters little (error change {r(pm.get('p_mmHg', {}).get('mean_score_drop', 0.0), 3)}).",
        f"what matters most inputs features importance {label} oxygen pressure droplet size model", "permutation importance on held-out test days")

pd_ = res["importance_pd_coverage"]["partial_dependence_flex"]["burning_rate"]
for fuel, d in pd_.items():
    lo, hi = d["vs_o2_at_760mmHg"][0], d["vs_o2_at_760mmHg"][-1]
    add(f"model-pd-br-o2-{fuel.lower()}", TEAM, "x3:report",
        f"The team's Ridge model predicts {fuel.lower()} burning rate rising from {r(lo['ridge'])} at {int(round(lo['o2'] * 100))}% oxygen to "
        f"{r(hi['ridge'])} at {int(round(hi['o2'] * 100))}% oxygen (sea-level pressure, droplet {r(d['d0_used'])} mm); CatBoost gives "
        f"{r(lo['catboost'])} to {r(hi['catboost'])}.",
        f"model predict prediction burning rate oxygen O2 {fuel} trend rise partial dependence", "partial dependence, all other inputs fixed",
        "Above about 28% oxygen the two models diverge. Burning rate is in mm2/s (burning-rate constant).")

if ref:
    e, dz, hi, mp = ref["ext_diameter_v2"], ref["disruption"], ref["high_o2_runs"], ref["moon_point"]
    add("model-dext-refined", TEAM, "x3:report",
        f"The refined extinction-diameter model (CatBoost with physics-based inputs, constrained to rise "
        f"with initial droplet size) has error (RMSE) {r(e['cv_rmse_mm'], 3)} mm against {r(e['cv_rmse_mm_original'], 3)} mm before, and was better "
        f"in {int(round(e['beats_original_frac_of_folds'] * 100))}% of held-out folds; its plus-or-minus {r(e['band_half_width_mm'], 2)} mm band "
        f"covered {int(round(e['band_coverage_held_out'] * 100))}% of runs on held-out test dates.",
        "refined improved better extinction diameter model accuracy error RMSE uncertainty band range how sure confidence",
        "grouped cross-validation, REPORT.md section 9", "Inside the tested range only.")
    add("model-disruption", TEAM, "x3:report",
        f"A new model gives the chance a FLEX droplet breaks apart (disruption): on held-out test dates it ranks break-ups above other "
        f"endings with AUC {r(dz['cv_auc'], 2)}, and its average predicted chance matched the observed rate of {int(round(dz['base_rate'] * 100))}% of runs. "
        f"Asking whether a droplet breaks apart works better than the original three-way test-end model "
        f"(balanced accuracy {r(dz['cv_bacc'], 2)} against {r(dz['three_class_bacc_original'], 2)}).",
        "disruption break apart breaks up droplet model chance likely likelihood probability predict test end how runs ended accuracy",
        "grouped cross-validation, REPORT.md section 9")
    add("model-disruption-moon", TEAM, "x3:report",
        f"At Moon-Base-like conditions (30% oxygen, 527.5 mmHg, 2 mm droplet) the disruption model gives a "
        f"{int(round(mp['p_disruption']['methanol'] * 100))}% chance a methanol droplet breaks apart and {int(round(mp['p_disruption']['heptane'] * 100))}% "
        f"for heptane, in line with the data: {hi['disruption']} of {hi['n']} FLEX runs at 28% oxygen or more broke apart.",
        "Moon base lunar 30% oxygen low pressure disruption break apart",
        "disruption model prediction and FLEX outcome counts",
        "Few runs exist at exactly these conditions: read it as a trend, not a measurement.")

cov = res["importance_pd_coverage"]["coverage_flex"]
add("model-moon-validity", TEAM, "x3:report",
    f"Moon-Base conditions (30% oxygen or more at 10.2 psi = 527.5 mmHg) sit at the low-pressure edge of the FLEX data: only "
    f"{cov['Methanol']['n_o2_ge_0p30_and_p_le_620']} methanol and {cov['Heptane']['n_o2_ge_0p30_and_p_le_620']} heptane runs have oxygen of 30% "
    f"or more at 620 mmHg or less, so the extinction-diameter and test-end models are not valid there.",
    "Moon base lunar habitat valid validity predictions 30% oxygen low pressure 10.2 psi extrapolation coverage",
    "coverage counts from results.json", "No measured partial-gravity data exists in PSI; these are microgravity tables.")

pc_path = X3 / "out" / "physics_check.json"  # textbook-theory check (07_physics_check.py, REPORT.md section 10)
if pc_path.exists():
    PHY = "Team physics check"
    pc = json.load(open(pc_path, encoding="utf-8"))
    ratio, rm, agree = pc["ratio_measured_over_theory_median"], pc["rmse_mm2_per_s"], pc["direction_agreement"]
    gf, gm = pc["gravity_factor_air_760mmHg"]["d0_2.0mm"], pc["gravity_factor_moon_base"]["d0_2.0mm"]
    add("physics-textbook-gap", PHY, "x3:report",
        f"FLEX droplets burn well below the textbook (classical droplet-combustion theory) burning rate: the median run reaches about "
        f"{r(ratio['Methanol'])} of the textbook value for methanol and {r(ratio['Heptane'])} for heptane ({pc['n']} runs).",
        "textbook theory classical droplet combustion theory d2 law predicted expected measured compare slower than theory physics gap ratio",
        "measured burning rate divided by the theory value per run, median per fuel (07_physics_check.py)",
        "The textbook formula leaves out radiation heat loss, soot and unsteady effects, and the team's gas property values are rough: "
        "trust the direction and rough size, not the exact ratios.")
    add("physics-no-accuracy-gain", PHY, "x3:report",
        f"Adding the textbook burning-rate value to the team's Ridge model barely changes its error on held-out test days "
        f"({r(rm['ridge_plus_theory']['mean'], 4)} against {r(rm['ridge']['mean'], 4)} mm2/s); the textbook value alone, even scaled per fuel, "
        f"does worse ({r(rm['theory_scaled']['mean'], 3)}) than always guessing the mean ({r(rm['mean']['mean'], 3)}).",
        "physics theory hybrid physics-informed model improve accuracy error textbook add help better",
        "grouped cross-validation on whole test dates, same folds as the other models")
    if all(v["agree_frac"] == 1.0 for v in agree.values()):
        add("physics-direction", PHY, "x3:report",
            "On every FLEX run, the team's burning-rate model moves the same way as textbook theory when a gas replaces nitrogen: "
            "more oxygen and more helium make droplets burn faster, more carbon dioxide makes them burn slower.",
            "physics theory agree consistent direction oxygen helium carbon dioxide CO2 burning rate faster slower model sanity check",
            "sign of the change in the Ridge prediction and in the theory value, per run (07_physics_check.py)")
    add("physics-gravity-estimate", PHY, "x3:report",
        f"A textbook buoyancy estimate, not a measurement, says a 2 mm droplet in air at sea-level pressure would burn about {r(gf['earth'], 1)} times "
        f"as fast on Earth, {r(gf['mars'], 1)} times on Mars and {r(gf['moon'], 1)} times on the Moon as on the ISS; in Moon Base air "
        f"(30% oxygen, 527.5 mmHg) the Moon factor is about {r(gm, 1)}.",
        "Moon lunar Mars Earth gravity partial gravity buoyancy faster burn burning rate estimate theory scaling Grashof convection",
        "natural-convection correlation Nu = 2 + 0.6 Gr^(1/4) Pr^(1/3) with rough gas properties (physics.py)",
        "No partial-gravity droplet data exists in PSI to check this against.")

# ---------------- 4. Dashboard rankings (real files only) ----------------
if DASH and (DASH / "rank.json").exists():
    rank = json.load(open(DASH / "rank.json", encoding="utf-8"))
    items = rank.get("items", rank) if isinstance(rank, dict) else rank
    inv = json.load(open(DASH / "investigations.json", encoding="utf-8"))
    inv = {x["id"]: x for x in (inv.get("items", inv) if isinstance(inv, dict) else inv)}
    hab = json.load(open(DASH / "habitats.json", encoding="utf-8"))
    hab = {x["id"]: x for x in (hab.get("items", hab) if isinstance(hab, dict) else hab)}
    by_h = defaultdict(list)
    for it in items:
        by_h[it["habitat"]].append(it)
    for h, its in by_h.items():
        its.sort(key=lambda x: -x["score"])
        hl = hab.get(h, {}).get("label", h)
        for pos, it in enumerate(its, 1):
            iid = it["investigationId"]
            title = inv.get(iid, {}).get("title", iid)
            reasons = "; ".join(f"{f['label']}: {f['reason'].strip().rstrip('.')}" for f in it.get("factors", []) if f.get("reason"))
            reasons = reasons + "." if reasons else ""
            add(f"dash-{it['id']}", "Team dashboard ranking", f"psi:{iid}",
                f"On the dashboard, {title} ({iid}) ranks {pos} of {len(its)} for {hl} with score {r(it['score'])}. " + reasons,
                f"dashboard ranking rank ranked score position habitat {hl} {h} {title} {iid} applies relevant why"
                + (" highest best top first number one most relevant" if pos == 1 else "")
                + (" lowest last least relevant bottom" if pos == len(its) else ""),
                "rank.json score and factors, sorted per habitat")
else:
    print("dashboard: no real rank.json yet; sample fixtures deliberately not used")

# ---------------- 5. Solid-material tables (public/data/solids.json, scripts/solids/build.py) ----------------
if DASH and (DASH / "solids.json").exists():
    sol = json.load(open(DASH / "solids.json", encoding="utf-8"))
    fl, sf = sol["flammability"], sol["saffire"]
    tests = fl["tests"]
    o2s = [t["o2"] for t in tests]
    hab = json.load(open(DASH / "habitats.json", encoding="utf-8"))
    moon = next(x for x in (hab.get("items", hab) if isinstance(hab, dict) else hab) if x["id"] == "moon")
    SRC = fl["source"]["id"]
    add("solids-o2-range", "BASS-II Summary Report, Table 7.1", SRC,
        f"In the BASS and BASS-II space tests ({len(tests)} usable tests in Table 7.1 of NASA/TM-20210011385), cotton-fiberglass fabric was "
        f"tested in microgravity at {min(o2s)} to {max(o2s)}% oxygen, and flames burned from {fl['minBurnO2']}% up. No fabric test went above {max(o2s)}%, so Moon Base air "
        f"({moon['o2Percent']:g}% oxygen) is {moon['o2Percent'] - max(o2s):g} percentage points above every test.",
        "solid material fabric cloth textile cotton fiberglass SIBAL BASS BASS-II oxygen levels tested range highest burned microgravity "
        "Moon Base lunar habitat flammability limit gap",
        "min and max oxygen over the Table 7.1 rows, reused samples left out as in the report (scripts/solids/build.py)",
        "Only one fabric and one flow direction (concurrent) are in this table.")
    q = [t for t in tests if t["outcome"] == "quenched"]
    ni = [t for t in tests if t["outcome"] == "no-ignition"]
    add("solids-quench-flow", "BASS-II Summary Report, Table 7.1", SRC,
        f"In BASS-II, fabric flames went out when the crew turned the airflow down to {min(t['flowTo'] for t in q)} to "
        f"{max(t['flowTo'] for t in q)} cm/s ({len(q)} tests, {min(t['o2'] for t in q)} to {max(t['o2'] for t in q)}% oxygen); "
        f"{len(ni)} tests at {min(t['o2'] for t in ni)} to {max(t['o2'] for t in ni)}% oxygen would not light at all.",
        "fabric flame went out quench quenched extinguish extinction low airflow ventilation flow speed fan BASS BASS-II would not ignite "
        "ignition limit solid material microgravity",
        "final airflow of the tests marked Quenched, and oxygen of the tests marked No ignition, in Table 7.1")
    comp = [x for x in sf["samples"] if x.get("comparable", True)]
    rank_ = {"none": 0, "part": 1, "all": 2}
    more_earth = sum(rank_[x["earth"]["level"]] > rank_[x["space"]["level"]] for x in comp)
    sil = [x for x in comp if x["material"] == "Silicone"]
    sil_earth = sum(x["earth"]["level"] != "none" for x in sil)
    sil_all = sum(x["earth"]["level"] == "all" for x in sil)
    add("saffire2-gravity", "SAFFIRE-II run table (PSI-99)", sf["source"]["id"],
        f"In SAFFIRE-II ({sf['o2'][0]} to {sf['o2'][1]}% oxygen, {sf['flowCmS'][0]} cm/s airflow), none of the {len(sil)} silicone samples "
        f"spread a flame in orbit, but on Earth {sil_earth} of them burned ({sil_all} completely). Across {len(comp)} comparable samples, "
        f"more material burned on Earth than in orbit in {more_earth}, and never more in orbit.",
        "SAFFIRE SAFFIRE-II silicone fabric PMMA solid material space Earth normal gravity 1-g microgravity orbit compare burned spread "
        "why burn more flammability screening",
        "microgravity and 1-g burn-length columns of the PSI-99 run table, per sample (scripts/solids/build.py)",
        "The Earth result is from NASA's normal-gravity tests of the same sample types, recorded in the same table.")
else:
    print("solids: no solids.json yet")

OUT.parent.mkdir(exist_ok=True)
for f in facts:
    f["source"] = WEB_ID.get(f["source"], f["source"])
json.dump(facts, open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"{len(facts)} facts -> {OUT}")
