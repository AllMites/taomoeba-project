"""Lane B: computed habitat-brief takeaways. Pure: reads public/data JSON, never calls a model.

Each takeaway is a Claim (kind "takeaway") with a stable id by topic: clm:brief:<habitat>:<topic>. Its `excerpt` is
"Computed from PSI run tables: " plus the exact figures used, so a reader can check the sentence. A topic is emitted
only when the data supports it for that habitat; an empty result is skipped, never padded.

Topics: o2-coverage, fuel-gap, pressure-coverage, gravity-limit (moon, rover), saffire-gravity (all habitats).
"""
from __future__ import annotations

import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "public" / "data"
TOPICS = ("o2-coverage", "fuel-gap", "pressure-coverage", "gravity-limit", "saffire-gravity")
HABITATS = ("iss", "moon", "rover")
NOT_COMBUSTION = {"PSI-108", "PSI-181"}
MAX_WORDS = 25
PREFIX = "Computed from PSI run tables: "
KIND_WORDS = {"gas": "gas", "droplet": "liquid-droplet", "solid": "solid", "aerosol": "smoke-particle"}


def load() -> tuple[dict, dict]:
    habs = {h["id"]: h for h in json.loads((DATA / "habitats.json").read_text(encoding="utf-8"))["items"]}
    invs = {i["id"]: i for i in json.loads((DATA / "investigations.json").read_text(encoding="utf-8"))["items"]}
    return habs, invs


def load_run(inv_id: str) -> dict | None:
    p = DATA / "runs" / f"{inv_id}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def fmt(x: float) -> str:
    return str(int(x)) if float(x) == int(x) else str(x)


def short(inv: dict) -> str:
    return inv["title"] if len(inv["title"]) <= 20 else inv["id"]


def sid(inv_id: str) -> str:
    return f"psi:{inv_id}"


def words(s: str) -> int:
    return len(s.split())


def kinds_phrase(kinds: set[str], joiner: str) -> str:
    return joiner.join(KIND_WORDS.get(k, k) for k in sorted(kinds))


def claim(habitat: str, topic: str, inv_id: str, text: str, sources: list[str], excerpt: str) -> dict | None:
    if words(text) > MAX_WORDS:
        return None
    return {"id": f"clm:brief:{habitat}:{topic}", "investigationId": inv_id, "kind": "takeaway", "habitat": habitat,
            "text": text, "sourceIds": [sid(i) for i in dict.fromkeys(sources)][:6], "excerpt": PREFIX + excerpt}


def _covering(invs: list[dict], key: str, value: float) -> list[dict]:
    return [i for i in invs if i.get(key) and i[key][0] <= value <= i[key][1]]


def o2_coverage(h: dict, comb: list[dict]) -> dict | None:
    o2 = h["o2Percent"]
    cov = _covering(comb, "o2Range", o2)
    if not cov:
        return None
    n, total = len(cov), len(comb)
    kinds = {i["fuelKind"] for i in cov}
    for take in (4, 3, 2, 1, 0):
        names = ", ".join(short(i) for i in cov[:take])
        if h["id"] == "iss":
            text = f"{n} of {total} experiments covered {fmt(o2)}% oxygen in their tested range" + (f", for example {names}." if take else ".")
        else:
            text = (f"{n} of {total} experiments covered {fmt(o2)}% oxygen in their tested range"
                    + (f" ({names})" if take else "") + f"; all burned {kinds_phrase(kinds, ' or ')} fuels.")
        if words(text) <= MAX_WORDS:
            break
    figures = "; ".join(f"{i['id']} {short(i)} {fmt(i['o2Range'][0])} to {fmt(i['o2Range'][1])}% O2" for i in cov)
    return claim(h["id"], "o2-coverage", cov[0]["id"], text, [i["id"] for i in cov],
                 f"{figures}; {n} of {total} combustion experiments include {fmt(o2)}% O2.")


def fuel_gap(h: dict, comb: list[dict]) -> dict | None:
    o2 = h["o2Percent"]
    cov = _covering(comb, "o2Range", o2)
    if not cov or any(i["fuelKind"] == "solid" for i in cov):
        return None  # a gap exists only where no solid-fuel experiment covers the habitat's oxygen
    n = len(cov)
    kinds = {i["fuelKind"] for i in cov}
    text = (f"None of the {n} experiments that cover {fmt(o2)}% oxygen burned solid materials; "
            f"they are {kinds_phrase(kinds, ' and ')} flames.")
    solids = [i for i in comb if i["fuelKind"] == "solid" and i.get("o2Range")]
    top = "; ".join(f"{i['id']} {short(i)} {fmt(i['o2Range'][0])} to {fmt(i['o2Range'][1])}% O2" for i in solids)
    figures = "; ".join(f"{i['id']} {short(i)} fuel {i['fuelKind']}" for i in cov)
    return claim(h["id"], "fuel-gap", cov[0]["id"], text, [i["id"] for i in cov] + [i["id"] for i in solids],
                 f"{figures}; solid-fuel experiments with an oxygen range: {top}; none of them include {fmt(o2)}% O2.")


def pressure_coverage(h: dict, comb: list[dict]) -> dict | None:
    kpa = h["pressureKPa"]
    with_p = [i for i in comb if i.get("pressureRange")]
    inc = _covering(comb, "pressureRange", kpa)
    if not inc:
        return None
    some = "all " + str(len(inc)) if len(inc) == len(with_p) else str(len(inc)) + " of those"
    text = (f"Only {len(with_p)} of {len(comb)} experiments record a tested pressure; {some} include "
            f"{fmt(kpa)} kPa, and {len(comb) - len(with_p)} list none.")
    figures = "; ".join(f"{i['id']} {short(i)} {fmt(i['pressureRange'][0])} to {fmt(i['pressureRange'][1])} kPa" for i in with_p)
    return claim(h["id"], "pressure-coverage", inc[0]["id"], text, [i["id"] for i in inc],
                 f"{figures}; {len(inc)} of {len(with_p)} include {fmt(kpa)} kPa; {len(comb) - len(with_p)} of {len(comb)} have no pressure on record.")


def gravity_limit(h: dict, comb: list[dict]) -> dict | None:
    if h["id"] == "iss" or any(i.get("evidence") not in ("flight", "ground") for i in comb):
        return None
    flight = [i for i in comb if i["evidence"] == "flight"]
    ground = [i for i in comb if i["evidence"] == "ground"]
    if not flight and not ground:
        return None
    text = (f"None of the {len(comb)} PSI combustion experiments ran in partial gravity such as the Moon's: "
            f"{len(flight)} flew in microgravity, {len(ground)} were ground studies.")
    return claim(h["id"], "gravity-limit", (ground or flight)[0]["id"], text, [i["id"] for i in ground] + [flight[0]["id"] if flight else ""],
                 f"evidence flag per experiment: flight {', '.join(i['id'] for i in flight)}; ground {', '.join(i['id'] for i in ground)}.")


def _is_zero(v) -> bool:
    return isinstance(v, str) and v.replace("~", "").strip() in ("0", "0 cm")


def saffire_gravity(h: dict, invs: dict, run) -> dict | None:
    t = run("PSI-99")
    if not t or "PSI-99" not in invs:
        return None
    orig = {c["name"]: c["original"] for c in t["columns"]}
    micro_col = next((k for k, v in orig.items() if v.endswith("-g Burn Length") and not v.startswith("1-")), None)
    one_col = next((k for k, v in orig.items() if v == "1-g Burn Length"), None)
    if not micro_col or not one_col:
        return None
    rows = [r for r in t["rows"] if r.get("material") == "Silicone" and r.get(micro_col) and r.get(one_col)]
    if not rows or not all(_is_zero(r[micro_col]) for r in rows):
        return None
    burned = [r for r in rows if not _is_zero(r[one_col])]
    if not burned:
        return None
    nums = [r for r in burned if r[one_col] != "Complete"]
    detail = f" (sample {nums[0]['sample_number']}: {nums[0][one_col]})" if len(nums) == 1 else ""
    name = invs["PSI-99"]["title"]
    text = (f"{name} silicone burned about 0 cm in microgravity in all {len(rows)} samples; in normal gravity "
            f"{len(burned)} of {len(rows)} burned{detail}.")
    figures = "; ".join(f"sample {r['sample_number']} {r['samle_thickness']}: {orig[micro_col]} {r[micro_col]}, {orig[one_col]} {r[one_col]}"
                        for r in rows)
    return claim(h["id"], "saffire-gravity", "PSI-99", text, ["PSI-99"],
                 f"PSI-99 Silicone rows, {figures}. ('?-g' is the table's microgravity column; its mu sign was lost.)")


def build(habs: dict | None = None, invs: dict | None = None, run=load_run, habitats=HABITATS) -> list[dict]:
    if habs is None or invs is None:
        habs, invs = load()
    comb = [i for k, i in sorted(invs.items(), key=lambda kv: int(kv[0].split("-")[1])) if k not in NOT_COMBUSTION]
    out = []
    for hid in habitats:
        h = habs[hid]
        for c in (o2_coverage(h, comb), fuel_gap(h, comb), pressure_coverage(h, comb), gravity_limit(h, comb),
                  saffire_gravity(h, invs, run)):
            if c:
                out.append(c)
    return out
