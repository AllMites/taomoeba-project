"""Lane B: habitat brief takeaways (live mode only; extractive mode emits none).

A takeaway is one sentence per habitat conclusion that combines (a) a verbatim source sentence stating an observed
result and (b) numbers computed here from Lane A's data files (habitats.json, investigations.json).
Every number in a takeaway must come from the excerpt(s), the habitat facts, the named investigation's tested
ranges, or a count computed in `facts()`; `ungrounded()` is the check, and the tests re-run it.
"""
from __future__ import annotations

import json
import re

from rag.common import DATA, load_corpus

HABITATS = ("iss", "moon", "rover")
LIMIT_RE = re.compile(r"partial[- ]gravity|lunar|\bmoon\b|\bmars\b|martian|1/6", re.I)
NAME_NUM = re.compile(r"[A-Za-z]+-\d+")  # FLEX-2, PSI-69: digits that are part of a name
NUM = re.compile(r"\d+(?:\.\d+)?")


def load_data() -> tuple[dict, dict]:
    habs = {h["id"]: h for h in json.loads((DATA / "habitats.json").read_text(encoding="utf-8"))["items"]}
    invs = {i["id"]: i for i in json.loads((DATA / "investigations.json").read_text(encoding="utf-8"))["items"]}
    return habs, invs


def fmt(x: float) -> str:
    return str(int(x)) if float(x) == int(x) else str(x)


def combustion_ids(corpus: dict) -> list[str]:
    ids = [s.split(":", 1)[1] for s in corpus if s.startswith("psi:")]
    return [i for i in ids if i not in ("PSI-108", "PSI-181")]


def facts(habitat: str, habs: dict, invs: dict, corpus: dict) -> tuple[str, set[float]]:
    """Plain-text fact block for the model, plus the set of numbers a takeaway may use from it."""
    h = habs[habitat]
    o2, kpa = h["o2Percent"], h["pressureKPa"]
    comb = combustion_ids(corpus)
    nums: set[float] = {o2, kpa, round(kpa / 101.3, 2), 1.0}
    lines = [f"Habitat {habitat} ({h['label']}): {fmt(o2)}% oxygen at {fmt(kpa)} kPa."]
    with_o2 = [invs[i] for i in comb if i in invs and invs[i].get("o2Range")]
    incl = [i for i in with_o2 if i["o2Range"][0] <= o2 <= i["o2Range"][1]]
    atleast = [i for i in with_o2 if i["o2Range"][1] >= o2]
    kinds = {}
    for i in atleast:
        kinds[i["fuelKind"]] = kinds.get(i["fuelKind"], 0) + 1
    lines.append(f"Counts: {len(comb)} PSI combustion investigations in the dataset; {len(with_o2)} state a tested oxygen "
                 f"range; {len(incl)} of those ranges include {fmt(o2)}% oxygen; {len(atleast)} reach {fmt(o2)}% or more "
                 f"(by fuel: {', '.join(f'{k} {v}' for k, v in sorted(kinds.items()))}).")
    nums |= {float(len(comb)), float(len(with_o2)), float(len(incl)), float(len(atleast)), *map(float, kinds.values())}
    for i in with_o2:
        lo, hi = i["o2Range"]
        line = f"{i['id']} {i['title']}: tested oxygen {fmt(lo)} to {fmt(hi)}%"
        if i.get("pressureRange"):
            line += f", pressure {fmt(i['pressureRange'][0])} to {fmt(i['pressureRange'][1])} kPa"
        lines.append(f"{line}; fuel kind {i['fuelKind']}.")
    cover = [i for i in comb if i in invs and invs[i].get("pressureRange")
             and invs[i]["pressureRange"][0] <= kpa <= invs[i]["pressureRange"][1]]
    lines.append(f"{len(cover)} investigations' tested pressure ranges include {fmt(kpa)} kPa.")
    nums.add(float(len(cover)))
    text = {i: corpus[f"psi:{i}"]["body"] for i in comb}
    hits = sum(1 for i in comb if LIMIT_RE.search(text[i]))
    lines.append(f"Of the {len(comb)} PSI combustion investigations, {len(comb) - hits} have no mention of partial, lunar or "
                 f"Mars gravity in their PSI text; all ran in microgravity or (for modelling studies) simulate it.")
    nums.add(float(len(comb) - hits))
    return "\n".join(lines), nums


def data_numbers(inv: dict) -> set[float]:
    out: set[float] = set()
    for k in ("o2Range", "pressureRange", "airflowRange"):
        for v in inv.get(k) or []:
            out.add(float(v))
    return out


def ungrounded(text: str, excerpts: list[str], allowed: set[float], named: set[str], invs: dict) -> str | None:
    """Return a problem if a number in `text` is not in an excerpt, the allowed facts, or a named investigation's data."""
    ok = set(allowed)
    for n in named:
        ok |= data_numbers(invs.get(n, {}))
    for e in excerpts:
        ok |= {float(x) for x in NUM.findall(NAME_NUM.sub("", e))}
    bad = [n for n in NUM.findall(NAME_NUM.sub("", text)) if float(n) not in ok]
    return f"numbers not in the sentences or data: {', '.join(bad)}" if bad else None


SYSTEM = (
    "You write the habitat brief for a web dashboard that shows NASA microgravity combustion experiments to students "
    "and engineers. For one habitat you write up to 3 takeaways: each a conclusion across the evidence for that "
    "habitat, one sentence, at most 25 words, plain words, jargon glossed in parentheses, active voice. Say 'SI', never "
    "'AI'. Never write 'according to NASA'.\n\n"
    "You get (1) numbered source sentences [S1].., each from one investigation, and (2) a FACTS block of numbers "
    "computed from the dataset. A takeaway may combine what a numbered sentence states as an observed result with "
    "facts from the FACTS block (the habitat's oxygen and pressure, an investigation's tested oxygen or pressure "
    "range, the counts). Nothing else: no outside knowledge, no number that is in neither. When you use a FACTS "
    "number, name the investigation in the text (for example 'FLEX tested 12 to 34% oxygen') so a reader can check it. "
    "Use the acronym from the title; write 'ACME CFI-G' style names as given.\n"
    "Do not claim a result at the habitat's conditions unless a sentence states it. Observed results only, not goals "
    "or plans. If a FACTS count says none of the investigations mention partial gravity, you may include one honest-limit "
    "takeaway for moon and rover, worded like 'none of the 24 PSI combustion investigations here tested partial gravity' "
    "(use the real count), tied to a sentence about low gravity versus 1-g behaviour if one is listed. For iss, include "
    "a real limit only if the sentences and facts show one. Fewer than 3 takeaways is fine; a doubtful one is not.\n"
    "Every takeaway must tie to the habitat: compare its oxygen or pressure with a named investigation's tested range, or "
    "state the honest limit. A takeaway that would read the same for any habitat is not allowed: use null.\n"
    "The FIRST sentence in 's' must state the result you report; take results only from it. 'At some conditions' is not "
    "'at every level'. A sentence whose source id starts with ntrs: comes from a related NASA paper (its title is "
    "shown), not from the investigation: do not say the investigation did or found it.\n"
    "No filler, no generic statements that combustion research matters.\n\n"
    "Reply with JSON only, no prose, no code fence:\n"
    '{"takeaways": [{"s": [3, 5], "inv": "PSI-69", "data_inv": ["PSI-69"], "text": "..."}]}\n'
    '"s": 1 to 3 sentence numbers (the first is the excerpt), "inv": the main investigation id, "data_inv": ids whose '
    "FACTS numbers you used (may be empty)."
)


def pool(claims: list[dict], corpus: dict) -> list[dict]:
    """Numbered vetted sentences: every distinct excerpt already used by a summary, finding or rationale claim."""
    seen, out = set(), []
    for c in claims:
        if c["kind"] == "takeaway" or c["excerpt"] in seen:
            continue
        seen.add(c["excerpt"])
        sid = c["sourceIds"][0]
        title = corpus[sid]["meta"]["title"] if sid.startswith("ntrs:") else ""
        out.append({"n": len(out) + 1, "inv": c["investigationId"], "sid": sid, "s": c["excerpt"], "title": title})
    return out


# Takeaways a human reviewer read against the excerpt and rejected as overreach; never shipped, whatever the model says.
REJECTED = {
    "FLEX tested 12 to 34% oxygen, covering ISS's 21%; extinction (flame-out) droplet sizes at every level were too small to observe.":
        "excerpt says 'at some ambient conditions'; 'at every level' generalises it",
    "At some oxygen levels, PSI-69 FLEX extinction droplets were too small to observe; its 12 to 34% oxygen range covers rover's 30%.":
        "the excerpt's condition is ambient (pressure) conditions, not oxygen levels",
    "PSI-69 FLEX's 70.2 to 309.3 kPa range includes moon's 70.3 kPa; some tested conditions had extinction (flame-out) droplets too small to measure.":
        "two glued facts: the excerpt does not tie the small droplets to Moon pressure",
    "None of the 24 PSI combustion investigations tested partial gravity; PSI-25 BASS-II reports fuels burn as oval balls in space, not Earth's cone flames.":
        "glued: the excerpt is outreach copy and does not support the partial-gravity count",
    "None of the 24 PSI combustion investigations tested partial gravity; PSI-25 contrasted outer-space oval flames with Earth's cone flames.":
        "glued: the excerpt is outreach copy and does not support the partial-gravity count",
}
# Takeaways a human reviewer narrowed to their evidence: model text -> (shipped text, reason).
EDITED = {
    "Without airflow, flames at 21% oxygen went out quickly, unlike elevated-oxygen flames; ACME BRE tested 21 to 40% oxygen.":
        ("Without airflow, PSI-20 ACME BRE gas-burner flames at 21% oxygen went out quickly, unlike elevated-oxygen flames; it tested 21 to 40% oxygen.",
         "generalised a gas-burner result to all flames"),
    "PSI-20 ACME BRE saw flames keep burning without airflow in elevated oxygen; moon's 30% lies inside its tested 21 to 40% range.":
        ("PSI-20 ACME BRE gas-burner flames kept burning without airflow in elevated oxygen in microgravity; Moon's 30% lies inside its tested 21 to 40% range.",
         "hid that the result is a microgravity gas-burner flame, not a Moon-gravity fire"),
    "PSI-20 ACME BRE flames kept burning without airflow at elevated oxygen; rover's 30% sits in its tested 21 to 40% range.":
        ("PSI-20 ACME BRE gas-burner flames kept burning without airflow at elevated oxygen in microgravity; rover's 30% sits in its tested 21 to 40% range.",
         "hid that the result is a microgravity gas-burner flame, not a partial-gravity fire"),
}


def generate(habitat: str, claims: list[dict], corpus: dict, ask, check_text, tok: dict) -> list[dict]:
    habs, invs = load_data()
    fact_text, allowed = facts(habitat, habs, invs, corpus)
    sents = pool(claims, corpus)
    by_n = {s["n"]: s for s in sents}
    listing = "\n".join(f"[S{s['n']}] ({s['inv']}, {s['sid']}{', paper: ' + s['title'] if s['title'] else ''}) {s['s']}" for s in sents)
    user = f"Habitat: {habitat}\n\nFACTS (computed from the dataset):\n{fact_text}\n\nSource sentences:\n{listing}"
    errs: list[str] = []
    best: list[dict] = []
    for _ in (0, 1):
        reply = ask(SYSTEM, user if not errs else user + "\n\nFix these problems: " + "; ".join(errs), tok)
        if reply is None:
            errs = ["reply was cut off; answer shorter"]
            continue
        best, errs = [], []
        try:
            items = json.loads(reply[reply.index("{"): reply.rindex("}") + 1]).get("takeaways") or []
        except ValueError:
            errs = ["reply is not valid JSON"]
            continue
        for k, t in enumerate(items[:3], 1):
            where = f"takeaway {k}"
            ns = t.get("s") if isinstance(t.get("s"), list) else []
            if not 1 <= len(ns) <= 3 or any(n not in by_n for n in ns):
                errs.append(f"{where}: bad sentence numbers")
                continue
            inv = t.get("inv")
            data_inv = [d for d in (t.get("data_inv") or []) if d in invs]
            text = re.sub(r"\s+", " ", str(t.get("text") or "")).strip()
            problem = check_text(text)
            if not problem and text in REJECTED:
                continue  # reviewed by hand and dropped: not an error, so no retry
            if not problem and inv not in invs:
                problem = "unknown inv"
            sids = list(dict.fromkeys([by_n[n]["sid"] for n in ns] + [f"psi:{d}" for d in data_inv]))
            if not problem and len(sids) > 3:
                problem = "more than 3 sources"
            named = set(data_inv) | {inv}
            if not problem:
                problem = ungrounded(text, [by_n[n]["s"] for n in ns], allowed, named, invs)
            if problem:
                errs.append(f"{where}: {problem}")
                continue
            best.append({"id": "", "investigationId": inv, "kind": "takeaway", "habitat": habitat, "text": text,
                         "sourceIds": sids, "excerpt": by_n[ns[0]]["s"]})
        if not errs:
            break
    for k, c in enumerate(best, 1):
        c["id"] = f"clm:brief:{habitat}:{k}"
    return best
