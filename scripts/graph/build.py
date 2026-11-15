"""Research graph: experiments, reports and NASA pages, joined by research links. Writes public/data/graph.json.

    python scripts/graph/build.py

Nodes
  experiment   the 26 PSI investigations (public/data/investigations.json)
  report       NASA technical reports (NTRS), open or short-quotes-only (sources.json, library.json)
  page         NASA web pages: experiment overviews, incident reviews (Apollo, Mir), Spinoff and fact sheets
Links (every one says why it exists)
  reports_on   the report or page is about that experiment: the PSI/NTRS record lists it (scripts/graph/paper_links.json),
               the team's library entry lists it (library.json, more_sources.json)
  mentions     the source's text names the experiment at least MIN_MENTIONS times (counted here, case-sensitive acronyms)
  follow_up    the next flight of the same experiment series (FLEX -> FLEX-2, BASS -> BASS-II, SAME -> SAME-R, Saffire I -> II -> III)
  builds_on    a ground study whose title names the flight experiment whose data it analyses
  same_hardware / psi_related   from each investigation's "related" list (same rack or duct; listed in its PSI record)
  same_event   NASA pages about the same incident (the Apollo 1 fire, the Apollo 13 explosion)
  area         to a hub for the fire-safety area (prevention, detection, suppression) or "On Earth", from the PSI record,
               the NTRS pillar or the library topic
Years: a report keeps the publication year its NTRS record or the library list gives; others have none (never guessed).
Layout: a deterministic force layout (fixed seed), so the page only draws; it computes nothing.
Text of short-quotes-only reports is read only to count mentions (library/restricted-index.json, if present); no text
goes into graph.json.
"""
from __future__ import annotations

import json
import math
import random
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "public" / "data"
MIN_MENTIONS = 3

# How each experiment is named in text (case-sensitive; series members must not match each other).
NAMES: dict[str, str] = {
    "PSI-10": r"Flame Design",
    "PSI-20": r"\bBRE\b|Burning Rate Emulator",
    "PSI-21": r"\bCLD\b|Coflow Laminar Diffusion",
    "PSI-22": r"E-FIELD|Electric-Field Effects|Electric Field Effects",
    "PSI-23": r"\bs-Flame\b",
    "PSI-25": r"BASS[- ]?II\b|BASS-2\b",
    "PSI-26": r"\bBASS\b(?![- ]?(II|2)\b)",
    "PSI-39": r"\bCFI\b(?!-G)",
    "PSI-47": r"\bDAFT",
    "PSI-68": r"FLEX[- ]2\b",
    "PSI-69": r"\bFLEX\b(?![- ]2\b)",
    "PSI-98": r"(?i:saffire)[- ]I\b(?!I)",
    "PSI-99": r"(?i:saffire)[- ]II\b(?!I)",
    "PSI-100": r"(?i:saffire)[- ]III\b",
    "PSI-101": r"SAME-R\b",
    "PSI-102": r"\bSAME\b(?!-R)",
    "PSI-106": r"\bSLICE\b",
    "PSI-107": r"\bSPICE\b",
    "PSI-108": r"\bSTDCE",
    "PSI-159": r"CFI-G\b",
}
FOLLOW_UP = [("PSI-69", "PSI-68"), ("PSI-26", "PSI-25"), ("PSI-102", "PSI-101"), ("PSI-98", "PSI-99"), ("PSI-99", "PSI-100")]
BUILDS_ON = {"PSI-60": ["PSI-107"], "PSI-62": ["PSI-25", "PSI-26"], "PSI-115": ["PSI-102"]}  # named in their titles
INCIDENT = re.compile(r"^nasa:(apollo|mir)")
EVENTS = [r"^nasa:apollo204-", r"^nasa:apollo13-"]
HUBS = {"Prevention": "Prevention", "Detection": "Detection", "Suppression": "Suppression", "Earth": "On Earth"}
TOPIC_AREA = {"fire-growth": "Prevention", "detection": "Detection", "suppression": "Suppression"}
SPINOFF = re.compile(r"^nasa:(spinoff|same-factsheet)")


def load(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def items(x):
    return x["items"] if isinstance(x, dict) else x


def page_kind(sid: str) -> str:
    if INCIDENT.match(sid):
        return "incident"
    if SPINOFF.match(sid):
        return "spinoff"
    return "overview"


def layout(ids: list[str], edges: list[tuple[str, str, float]], seed: int = 7, steps: int = 600) -> dict[str, tuple[float, float]]:
    """Fruchterman-Reingold with gravity toward the centre; deterministic for a fixed seed."""
    rnd = random.Random(seed)
    n = len(ids)
    k = math.sqrt(1.0 / n)
    pos = {i: [rnd.uniform(-1, 1), rnd.uniform(-1, 1)] for i in ids}
    adj = [(a, b, w) for a, b, w in edges if a in pos and b in pos]
    t = 0.12
    for step in range(steps):
        disp = {i: [0.0, 0.0] for i in ids}
        for ai in range(n):
            a = ids[ai]
            pa = pos[a]
            for bi in range(ai + 1, n):
                b = ids[bi]
                dx, dy = pa[0] - pos[b][0], pa[1] - pos[b][1]
                d2 = dx * dx + dy * dy or 1e-9
                f = k * k / d2
                disp[a][0] += dx * f
                disp[a][1] += dy * f
                disp[b][0] -= dx * f
                disp[b][1] -= dy * f
        for a, b, w in adj:
            dx, dy = pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]
            d = math.sqrt(dx * dx + dy * dy) or 1e-9
            f = d * d / k * w / d
            disp[a][0] -= dx * f
            disp[a][1] -= dy * f
            disp[b][0] += dx * f
            disp[b][1] += dy * f
        for i in ids:
            disp[i][0] -= pos[i][0] * 0.6
            disp[i][1] -= pos[i][1] * 0.6
            dx, dy = disp[i]
            d = math.sqrt(dx * dx + dy * dy) or 1e-9
            pos[i][0] += dx / d * min(d, t)
            pos[i][1] += dy / d * min(d, t)
        t = max(0.004, t * 0.993)
    return {i: (p[0], p[1]) for i, p in pos.items()}


def fit_unit(pos: dict[str, tuple[float, float]]) -> dict[str, tuple[float, float]]:
    """Scale to about -1..1 so spacing in spread() means the same for any graph size."""
    xs = [p[0] for p in pos.values()]
    ys = [p[1] for p in pos.values()]
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    s = max(max(xs) - min(xs), max(ys) - min(ys)) / 2 or 1
    return {i: ((p[0] - cx) / s, (p[1] - cy) / s) for i, p in pos.items()}


def spread(pos: dict[str, tuple[float, float]], kinds: dict[str, str], steps: int = 400) -> dict[str, tuple[float, float]]:
    """Push dots apart until labelled ones keep room for their names (experiments and hubs need the most)."""
    room = {"experiment": 0.085, "area": 0.07, "report": 0.03, "page": 0.03}
    p = {i: list(xy) for i, xy in pos.items()}
    ids = sorted(p)
    for _ in range(steps):
        moved = False
        for a_i in range(len(ids)):
            a = ids[a_i]
            for b in ids[a_i + 1:]:
                dx, dy = p[a][0] - p[b][0], p[a][1] - p[b][1]
                d = math.sqrt(dx * dx + dy * dy) or 1e-9
                need = room[kinds[a]] + room[kinds[b]]
                if d < need:
                    push = (need - d) / 2
                    p[a][0] += dx / d * push
                    p[a][1] += dy / d * push
                    p[b][0] -= dx / d * push
                    p[b][1] -= dy / d * push
                    moved = True
        if not moved:
            break
    return {i: (xy[0], xy[1]) for i, xy in p.items()}


def fit(pos: dict[str, tuple[float, float]]) -> dict[str, tuple[float, float]]:
    xs = [p[0] for p in pos.values()]
    ys = [p[1] for p in pos.values()]
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    s = max(max(xs) - min(xs), max(ys) - min(ys)) / 2 or 1
    return {i: (round((p[0] - cx) / s * 480, 1), round((p[1] - cy) / s * 480, 1)) for i, p in pos.items()}


def main() -> None:
    invs = items(load(DATA / "investigations.json"))
    sources = items(load(DATA / "sources.json"))
    library = items(load(DATA / "library.json"))
    more = {x["id"]: x for x in items(load(ROOT / "scripts" / "rag" / "more_sources.json"))}
    links = load(ROOT / "scripts" / "graph" / "paper_links.json")["items"]
    inv_ids = {i["id"] for i in invs}

    nodes: dict[str, dict] = {}
    for i in invs:
        nodes[i["id"]] = {"id": i["id"], "kind": "experiment", "label": i["title"] if len(i["title"]) <= 24 else i["id"],
                          "title": i["title"], "area": i["pds"], "hardware": i["hardwareGroup"], "url": f"https://psi.nasa.gov/physci/repo/data/investigations/{i['id']}"}
    for s in sources:
        sid = s["id"]
        if sid.startswith("psi:"):
            continue  # the experiment's own PSI record is the experiment node
        kind = "report" if sid.startswith(("ntrs:", "doi:")) else "page"
        nodes[sid] = {"id": sid, "kind": kind, "title": s["title"], "url": s.get("url"), "restricted": False}
        if kind == "page":
            nodes[sid]["page"] = page_kind(sid)
    for s in library:
        nodes[s["id"]] = {"id": s["id"], "kind": "report", "title": s["title"], "url": s.get("url"), "restricted": True}
    # publication year, where a record gives one (NTRS records via paper_links.json, the library list); none is guessed
    for s in library:
        if str(s.get("year", "")).isdigit():
            nodes[s["id"]]["year"] = int(s["year"])
    for sid, l in links.items():
        if sid in nodes and str(l.get("year", "")).isdigit():
            nodes[sid].setdefault("year", int(l["year"]))

    edges: dict[tuple[str, str, str], dict] = {}

    def add(a: str, b: str, typ: str, why: str, weight: float = 1.0) -> None:
        if a not in nodes or b not in nodes or a == b:
            return
        key = (a, b, typ) if typ != "same_hardware" else (min(a, b), max(a, b), typ)
        edges.setdefault(key, {"s": key[0], "t": key[1], "type": typ, "why": why, "w": weight})

    # reports_on: listed in the records
    for sid, l in links.items():
        for e in l["psi"]:
            add(sid, e, "reports_on", "Listed for this experiment in the NTRS/PSI records", 1.0)
    for s in library:
        for e in s.get("investigationIds", []):
            add(s["id"], e, "reports_on", "Listed for this experiment in the team's library", 1.0)
    for sid, m in more.items():
        for e in m.get("investigations", []):
            add(sid, e, "reports_on", "Listed for this experiment in the team's library", 1.0)

    # mentions: counted in the source text
    text: dict[str, list[str]] = defaultdict(list)
    for c in load(DATA / "index.json")["chunks"]:
        text[c["sourceId"]].append(c["text"])
    restricted = ROOT / "library" / "restricted-index.json"
    used_restricted = restricted.exists()
    if used_restricted:
        for c in load(restricted)["chunks"]:
            text[c["sourceId"]].append(c["text"])
    for sid, parts in text.items():
        if sid not in nodes or nodes[sid]["kind"] == "experiment":
            continue
        body = " ".join(parts)
        for e, pat in NAMES.items():
            n = len(re.findall(pat, body))
            if n >= MIN_MENTIONS and (sid, e, "reports_on") not in edges:
                add(sid, e, "mentions", f"Its text names this experiment {n} times", min(1.0, 0.3 + n / 40))

    # experiment to experiment
    for a, b in FOLLOW_UP:
        add(a, b, "follow_up", "The next flight of the same experiment series", 1.2)
    for g, fl in BUILDS_ON.items():
        for f in fl:
            add(g, f, "builds_on", "A ground study of this flight experiment's data (named in its title)", 1.2)
    for i in invs:
        for r in i.get("related", []):
            if r["id"] not in inv_ids:
                continue
            if r["reason"].startswith("Same hardware"):
                add(i["id"], r["id"], "same_hardware", r["reason"], 0.5)
            else:
                add(i["id"], r["id"], "psi_related", r["reason"], 0.8)

    # same incident
    for pat in EVENTS:
        same = sorted(n for n in nodes if re.match(pat, n))
        for a in same:
            for b in same:
                if a < b:
                    add(a, b, "same_event", "About the same incident", 0.8)

    # fire-safety area hubs
    for key, label in HUBS.items():
        nodes[f"area:{key}"] = {"id": f"area:{key}", "kind": "area", "label": label, "title": label}
    for i in invs:
        if i["pds"] in HUBS:
            add(i["id"], f"area:{i['pds']}", "area", f"PSI lists it under {i['pds'].lower()}", 0.12)
    for sid, l in links.items():
        if l["pillar"] in HUBS:
            add(sid, f"area:{l['pillar']}", "area", f"NTRS pillar: {l['pillar'].lower()}", 0.12)
    for sid, m in more.items():
        if sid.startswith("nasa:spinoff") or sid == "nasa:studying-combustion":
            add(sid, "area:Earth", "area", "Describes a benefit on Earth", 0.12)
        if m.get("topic") in TOPIC_AREA and not m.get("investigations"):
            add(sid, f"area:{TOPIC_AREA[m['topic']]}", "area", f"Library topic: {TOPIC_AREA[m['topic']].lower()}", 0.12)

    # keep only connected nodes, plus every experiment
    deg = Counter()
    for e in edges.values():
        deg[e["s"]] += 1
        deg[e["t"]] += 1
    keep = [n for n in nodes if deg[n] or nodes[n]["kind"] == "experiment"]
    raw = layout(sorted(keep), [(e["s"], e["t"], e["w"]) for e in edges.values()])
    pos = fit(spread(fit_unit(raw), {n: nodes[n]["kind"] for n in keep}))
    out_nodes = []
    for n in sorted(keep):
        d = dict(nodes[n])
        d["x"], d["y"] = pos[n]
        d["degree"] = deg[n]
        out_nodes.append(d)
    out = {
        "made": date.today().isoformat(),
        "about": "Experiments, NASA reports and NASA pages, joined by research links. Each link says why it exists.",
        "restricted_text_counted": used_restricted,
        "min_mentions": MIN_MENTIONS,
        "nodes": out_nodes,
        "edges": sorted((e for e in edges.values() if e["s"] in pos and e["t"] in pos), key=lambda e: (e["type"], e["s"], e["t"])),
    }
    (DATA / "graph.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(out_nodes)} nodes, {len(out['edges'])} links -> public/data/graph.json "
          f"({'with' if used_restricted else 'WITHOUT'} the short-quotes-only report text for mention counts)")
    print(Counter(e["type"] for e in out["edges"]), Counter(n["kind"] for n in out_nodes))


if __name__ == "__main__":
    main()
