"""Lane B: build public/data/claims.json (+ index.json, corpus/build-info.json) from corpus/text.

Claim rules (both modes): 1 summary per combustion investigation; findings (0-2) only where the source states an
observed result; rationales (0-1 per habitat) only where the source supports a link to that habitat. Emit nothing
otherwise. `excerpt` is always a verbatim source sentence; ids are deterministic.

Modes, by environment:
  no ANTHROPIC_API_KEY  -> extractive: summary (+ findings where a result sentence exists), no rationales.
  ANTHROPIC_API_KEY set -> live: one claude-haiku-5-5 call per investigation picks sentences by number and writes
                           the plain sentence; excerpts come from our own sentence list, so they stay verbatim.

Rerun:  python scripts/rag/precompute.py
Live:   ANTHROPIC_API_KEY=... uv run --with anthropic python scripts/rag/precompute.py   (cache: corpus/raw/llm/)
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rag.common import DATA, ROOT, load_corpus, units, words  # noqa: E402
from rag.retrieve import INDEX_PATH, build_index  # noqa: E402

MODEL = "claude-haiku-5-5"
PRICE_IN, PRICE_OUT = 0.10, 0.50  # USD per million tokens (prompts up to 100K)
MAX_WORDS = 25
NOT_COMBUSTION = {"PSI-108", "PSI-181"}
HABITATS = ("iss", "moon", "rover")
CACHE = ROOT / "corpus" / "raw" / "llm"
USAGE = ROOT / "corpus" / "raw" / "llm_usage.jsonl"
INFO = ROOT / "corpus" / "build-info.json"

# open-licence NTRS records that add sentences for specific investigations
EXTRA = {
    "PSI-102": ["ntrs:20010074094", "ntrs:20170007283"],
    "PSI-115": ["ntrs:20010074094", "ntrs:20170007283"],
    "PSI-47": ["ntrs:20010074094", "ntrs:20170007283"],
}
BAD = re.compile(r"^(\d+[.)]|Consider|Objectives? \d|Note|Figure|Table|See )")
SECTIONS = ("Objectives", "Approach", "Hypothesis", "Research impacts and Earth benefits", "Abstract")
APPROACH_MAX_UNITS = 6
DANGLING = re.compile(r"^(This|These|It|They|Such|That|Other than)\b(?! (investigation|experiment|study|research|project|mission))")
RESULT = re.compile(r"\b(observed|showed|found|demonstrated|measured|yielded|revealed|reduced|increased|extinguished|resulted)\b", re.I)
PLANNED = re.compile(r"\b(will|aims?|seeks?|objectives?|hypothes\w+|to (determine|investigate|examine|evaluate|study|understand)|whether|expected|planned|proposed?|intended|goal|could|may|might)\b", re.I)
FUNCTION_WORDS = {"to", "are", "is", "include", "including", "following", "of", "the", "a", "an", "and", "by", "that", "for"}

HABITAT_FACTS = (
    "ISS: about 21% oxygen at 101.3 kPa, microgravity (near-weightless).\n"
    "Moon Base: 30% oxygen at 70.3 kPa, Moon gravity (about one sixth of Earth's).\n"
    "Pressurized rover: 30% oxygen at 70.3 kPa, partial gravity.\n"
    "All PSI experiments ran in microgravity; PSI holds no partial-gravity (Moon or Mars) data."
)

SYSTEM = (
    "You write short claims for a web dashboard that shows NASA microgravity combustion experiments to students and "
    "engineers. You are given numbered source sentences [S1], [S2], ... from one PSI investigation. Pick sentences by "
    "number and write the claim text yourself.\n\n"
    "Text rules for every claim: exactly one sentence, at most 25 words, plain words, any jargon glossed in "
    "parentheses (e.g. microgravity (near-weightless)), numbers with units, active voice. Say 'PSI investigation "
    "<ACRONYM> reports/tested/measured ...' (use the acronym or a short name). Never write 'according to NASA'. Say "
    "'SI', never 'AI'. State only what the numbered sentence says: no outside knowledge, no invented numbers.\n\n"
    "summary (exactly 1): what the experiment did, from a sentence about its goal or method.\n"
    "findings (0 to 2): only a RESULT the source states as observed or measured. Objectives, hypotheses, plans, "
    "benefits, or anything with 'will', 'aims', 'to determine', 'whether' are NOT findings. If no sentence states a "
    "result, return an empty list.\n"
    "rationales (per habitat iss, moon, rover; a claim or null): one sentence that links something a numbered sentence "
    "states to that habitat's condition (given below). You may state the habitat's condition and what the sentence "
    "says, but must not claim a result at that condition unless the sentence has it. If nothing in the sentences "
    "transfers to that habitat, use null. No filler and no generic 'combustion matters' statements. 'The test ran in "
    "microgravity, which is also the ISS condition' is filler: use null unless the sentence states something more "
    "specific (an oxygen level, pressure, material, detector, fire-safety point) that bears on the habitat. When a "
    "sentence gives an oxygen level or pressure, compare it with the habitat's. Mention the partial-gravity limit "
    "only when the rationale leans on gravity.\n"
    "Add no fact the numbered sentence does not state: no claims about what other sources report, what a result 'bears on', what microgravity 'can do', or what the habitat would see. Do not stretch 'elevated oxygen' to a number unless the sentence gives one.\n"
    "A rationale whose point is that the sentence lacks data ('gives no oxygen level', 'not reported') is filler: use "
    "null.\n"
    "Name the investigation by the acronym in its title (in parentheses), e.g. 'PSI investigation SAFFIRE-II'; if the "
    "title has none, write 'PSI-60'. Never write 'PSI investigation PSI-22'. Never mention sentence numbers like S5 or say 'the sentence' or 'the excerpt'; say 'PSI reports', 'PSI gives', or name the investigation.\n\n"
    "Reply with JSON only, no prose, no code fence:\n"
    '{"summary": {"s": 3, "text": "..."}, "findings": [{"s": 7, "text": "..."}], '
    '"rationales": {"iss": {"s": 5, "text": "..."} or null, "moon": null, "rover": null}}\n'
    '"s" is the sentence number without brackets.'
)


def cut(s: str, limit: int) -> str:
    """Shorten at the last ';' or ':' that fits `limit` words; otherwise keep whole (counted as over-limit).

    Never at ', and|but|which|...' (drops list items or the contrast clause), and never where the prefix ends
    in a function word ("... are to:"), so a list lead-in is not cut off.
    """
    if words(s) <= limit:
        return s
    best = None
    for m in re.finditer(r"[;:]\s", s):
        pre = s[: m.start()]
        if 8 <= words(pre) <= limit and pre.split()[-1].lower() not in FUNCTION_WORDS:
            best = pre
    return (best.rstrip(",;:") + ".") if best else s


def build_units(inv: str, corpus: dict) -> list[dict]:
    out = []
    for sid in [f"psi:{inv}"] + EXTRA.get(inv, []):
        if sid not in corpus:
            continue
        secs = corpus[sid]["sections"]
        for sec in SECTIONS:
            if sec not in secs:
                continue
            us = units(secs[sec])
            if sec == "Approach":
                us = us[:APPROACH_MAX_UNITS]
            for s in us:
                if 8 <= words(s) <= 130 and not BAD.match(s) and "as follows" not in s:
                    out.append({"n": len(out) + 1, "sid": sid, "sec": sec, "s": s})
    return out


def claim(cid: str, inv: str, kind: str, text: str, u: dict, habitat: str | None = None) -> dict:
    c = {"id": cid, "investigationId": inv, "kind": kind}
    if habitat:
        c["habitat"] = habitat
    c.update({"text": text, "sourceIds": [u["sid"]], "excerpt": u["s"]})
    return c


def plain_text(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def extractive(inv: str, us: list[dict]) -> list[dict]:
    """Summary always; findings only where a result sentence exists; never rationales."""
    plain = [u for u in us if not u["s"].rstrip().endswith(":") and " 1.) " not in u["s"] and not re.search(r":\s+\d", u["s"])]
    pref = [u for u in plain if u["sec"] == "Objectives" and not DANGLING.match(u["s"])] \
        or [u for u in plain if u["sec"] == "Approach" and not DANGLING.match(u["s"])] or plain or us
    sm = pref[0]
    out = [claim(f"clm:{inv}:summary", inv, "summary", cut(sm["s"], MAX_WORDS), sm)]
    res = [u for u in us if u is not sm and u["sec"] != "Approach" and RESULT.search(u["s"]) and not PLANNED.search(u["s"])
           and not DANGLING.match(u["s"])]
    for i, u in enumerate(res[:2], 1):
        out.append(claim(f"clm:{inv}:finding:{i}", inv, "finding", cut(u["s"], MAX_WORDS), u))
    return out


def call_model(client, system: str, user: str, tok: dict) -> str | None:
    """One cached model call. Haiku 5.5 thinks by default and thinking counts toward max_tokens, so leave room, and
    never accept (or cache) a cut-off or refused reply: a truncated answer can still look valid."""
    key = hashlib.sha256((MODEL + system + user).encode()).hexdigest()[:24]
    f = CACHE / f"{key}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))["text"]
    r = client.messages.create(model=MODEL, max_tokens=4096, system=system,
                               messages=[{"role": "user", "content": user}])
    if r.stop_reason != "end_turn":
        return None
    text = "".join(b.text for b in r.content if b.type == "text").strip()
    out = {"text": text, "in": r.usage.input_tokens, "out": r.usage.output_tokens}
    CACHE.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(out), encoding="utf-8")
    with USAGE.open("a", encoding="utf-8") as u:
        u.write(json.dumps({"key": key, **out}) + "\n")
    tok["in"] += out["in"]
    tok["out"] += out["out"]
    return text


BANNED = re.compile(r"according to NASA|\bAI\b|\bS\d+\b|\bbear(s|ing)? on\b|\bits sources\b|\b(the|this|that) (sentence|excerpt|source)\b", re.I)
# a rationale whose point is that the source lacks data is filler: emit nothing instead
ABSENCE = re.compile(r"\b(gives|reports|states|lists|has|provides|offers) no (?!partial|moon)|\bnot reported\b|\bunverified\b|\bnot as an\b|\bno (iss )?results?\b", re.I)


NUM = re.compile(r"\d+(?:\.\d+)?")
HABITAT_NUMS = {"21", "30", "101.3", "70.3", "0.69", "1"}  # given to the model as habitat facts (0.69 atm = 70.3 kPa)


def ungrounded_numbers(text: str, excerpt: str) -> str | None:
    """Every number in the claim must come from the excerpt or the habitat facts: no invented numbers."""
    bad = [n for n in NUM.findall(text) if n not in set(NUM.findall(excerpt)) | HABITAT_NUMS]
    return f"numbers not in the sentence: {', '.join(bad)}" if bad else None


def check_text(t) -> str | None:
    """Return a problem description, or None when the claim text obeys the rules."""
    if not isinstance(t, str) or not t.strip():
        return "empty text"
    if words(t) > MAX_WORDS:
        return f"{words(t)} words (max {MAX_WORDS})"
    if "\n" in t or re.search(r"(?<!e\.g)(?<!i\.e)[.!?]\s+[A-Z]", t):
        return "more than one sentence"
    if BANNED.search(t):
        return "banned phrase"
    return None


def parse(reply: str, by_n: dict) -> tuple[dict | None, list[str]]:
    try:
        d = json.loads(reply[reply.index("{"): reply.rindex("}") + 1])
    except ValueError:
        return None, ["reply is not valid JSON"]
    errs, ok = [], {"summary": None, "findings": [], "rationales": {}}

    def item(x, where):
        if not isinstance(x, dict) or x.get("s") not in by_n:
            errs.append(f"{where}: unknown sentence number")
            return None
        text = re.sub(r"PSI investigation (PSI-\d+)", r"\1", plain_text(str(x.get("text") or "")))
        p = check_text(text) or ("says the source lacks data: use null" if ABSENCE.search(text) else None)             or ungrounded_numbers(text, by_n[x["s"]]["s"])
        if p:
            errs.append(f"{where}: {p}")
            return None
        return {"u": by_n[x["s"]], "text": text}

    ok["summary"] = item(d.get("summary"), "summary")
    for i, f in enumerate((d.get("findings") or [])[:2]):
        v = item(f, f"finding {i + 1}")
        if v:
            ok["findings"].append(v)
    for h in HABITATS:
        r = (d.get("rationales") or {}).get(h)
        if r is not None:
            v = item(r, f"rationale {h}")
            if v:
                ok["rationales"][h] = v
    return ok, errs


# Claims a human reviewer read against their excerpts. A rejected id is retired: never shipped again, whatever text
# the model writes for it. An edit applies while the model returns the exact reviewed text. Takeaway ids are
# positional, so takeaways are matched by text (brief.REJECTED, brief.EDITED).
REJECTED = {  # id -> (rejected text, reason)
    "clm:PSI-20:rationale:moon": ("PSI investigation ACME BRE saw elevated-oxygen flames keep burning in microgravity, not Moon gravity, so Moon Base's 30% oxygen is untested.",
                                  "'so 30% is untested' does not follow from the excerpt and contradicts the tested 21-40% range"),
    "clm:PSI-20:rationale:rover": ("PSI investigation ACME BRE saw elevated-oxygen flames keep burning in microgravity, so the rover's partial gravity remains untested.",
                                   "non-sequitur 'so'; drops the excerpt's 'without air flow' condition"),
    "clm:PSI-21:rationale:iss": ("PSI reports that understanding flame extinction is critical for fire suppression, a point bearing on ISS fire safety at 21% oxygen and 101.3 kPa.",
                                 "generic 'combustion matters' filler; nothing ISS-specific in the excerpt"),
    "clm:PSI-25:finding:1": ("PSI reports fuels burn as oval balls in space, not as upward pointed cone flames as on Earth.",
                             "outreach background sentence, not an observed BASS-II result"),
    "clm:PSI-39:rationale:iss": ("PSI investigation CFI delivered gas mixtures at 0.25 to 0.5 atm, well below the ISS pressure of 101.3 kPa (1 atm).",
                                 "gas-delivery line; the objective says 0.25 to 5 atm, so 'below habitat pressure' misleads"),
    "clm:PSI-39:rationale:moon": ("PSI investigation CFI delivered gas mixtures at 0.25 to 0.5 atm, which is below the Moon Base pressure of 70.3 kPa (about 0.69 atm).",
                                  "gas-delivery line; the objective says 0.25 to 5 atm, so 'below habitat pressure' misleads"),
    "clm:PSI-39:rationale:rover": ("PSI investigation CFI delivered gas mixtures at 0.25 to 0.5 atm, which is below the rover pressure of 70.3 kPa (about 0.69 atm).",
                                   "gas-delivery line; the objective says 0.25 to 5 atm, so 'below habitat pressure' misleads"),
    "clm:PSI-60:rationale:iss": ("PSI states its results support safer fire detection and suppression for long-duration space missions, which includes the ISS (about 21% oxygen at 101.3 kPa).",
                                 "generic benefit statement with the habitat condition appended"),
    "clm:PSI-25:rationale:iss": ("PSI investigation BASS-II varied oxygen below 21% by adding nitrogen, so its tests stayed at or under the ISS's roughly 21% oxygen level.",
                                 "excerpt says 'below 21%' but Lane A's table has BASS-II up to 22.2%; the brief states the table's range"),
    "clm:PSI-68:rationale:iss": ("PSI reports FLEX-2 atmospheres spanned 0.1 to 0.4 mole fraction oxygen and 0.5 to 3.0 atm, covering ISS's 21% oxygen and 1 atm.",
                                 "facility envelope called 'covering'; Lane A's tested oxygen is 17 to 30%"),
    "clm:PSI-68:rationale:moon": ("PSI reports FLEX-2 tested 0.1 to 0.4 mole fraction oxygen and 0.5 to 3.0 atm, covering Moon Base's 30% oxygen and 70.3 kPa (0.69 atm).",
                                  "facility envelope called 'tested'/'covering'; Lane A's tested oxygen is 17 to 30%"),
    "clm:PSI-68:rationale:rover": ("PSI reports FLEX-2 tested 0.1 to 0.4 mole fraction oxygen and 0.5 to 3.0 atm, covering the rover's 30% oxygen and 70.3 kPa (0.69 atm).",
                                   "facility envelope called 'tested'/'covering'; Lane A's tested oxygen is 17 to 30%"),
    "clm:PSI-98:rationale:moon": ("PSI says fire behavior differs greatly between normal and reduced gravity, so Earth fire standards carry uncertainty, and PSI holds no Moon gravity data.",
                                  "states a hypothesis as fact; the Moon link is an injected corpus claim, not the excerpt"),
    "clm:PSI-98:rationale:rover": ("PSI says fire behavior differs greatly between normal and reduced gravity, so Earth fire standards carry uncertainty, and PSI holds no partial-gravity data.",
                                   "states a hypothesis as fact; the rover link is an injected corpus claim, not the excerpt"),
    "clm:PSI-101:finding:1": ("PSI investigation SAME-R completed 66 test points on flight tests from July 16 to September 9, 2010.",
                              "procedure count, not a science result"),
    "clm:PSI-117:rationale:iss": ("For the ISS, PSI says the cool-flame work has potential to improve spacecraft fire-safety modeling in microgravity.",
                                  "generic 'potential benefit' line; microgravity alone is filler"),
    "clm:PSI-142:rationale:iss": ("PSI models DME (dimethyl ether) and air flames up to 20 atm, far above the ISS habitat pressure of 101.3 kPa.",
                                  "contrasts one model's 20 atm ceiling with habitat pressure and says nothing"),
    "clm:PSI-142:rationale:moon": ("PSI models DME (dimethyl ether) and air flames up to 20 atm, far above Moon Base's 70.3 kPa pressure.",
                                   "contrasts one model's 20 atm ceiling with habitat pressure and says nothing"),
    "clm:PSI-142:rationale:rover": ("PSI models DME (dimethyl ether) and air flames up to 20 atm, far above the pressurized rover's 70.3 kPa pressure.",
                                    "contrasts one model's 20 atm ceiling with habitat pressure and says nothing"),
}
EDITED = {  # id -> (model text, reviewed text, reason)
    "clm:PSI-20:summary": ("PSI investigation ACME BRE observes flames in microgravity without varying the fuel flow rate.",
                           "PSI investigation ACME BRE initially observes flames in microgravity without varying the fuel flow rate.",
                           "excerpt says 'initially'; flow is later cut to find extinction"),
    "clm:PSI-20:finding:1": ("PSI investigation ACME BRE observed quasi-steady burning of PMMA and Nylon in microgravity despite no airflow.",
                             "PSI investigation ACME BRE observed quasi-steady burning corresponding to PMMA and Nylon in microgravity despite no airflow.",
                             "BRE burns gas that emulates PMMA and Nylon; it did not burn them"),
    "clm:PSI-20:finding:2": ("PSI investigation ACME BRE reports 21% oxygen flames self-extinguished in a short time, while elevated-oxygen flames kept burning.",
                             "PSI investigation ACME BRE reports that without airflow, 21% oxygen flames self-extinguished in a short time, while elevated-oxygen flames kept burning.",
                             "dropped the excerpt's 'without air flow' condition"),
    "clm:PSI-20:rationale:iss": ("At ISS's 21% oxygen, PSI investigation ACME BRE reports microgravity flames self-extinguished in a short time.",
                                 "At ISS's 21% oxygen, PSI investigation ACME BRE reports microgravity flames without airflow self-extinguished in a short time.",
                                 "dropped 'without air flow': ventilated ISS fires do not self-extinguish"),
    "clm:PSI-26:rationale:iss": ("PSI reports BASS assessed an inert gaseous extinguishing agent similar to the one already used on ISS.",
                                 "PSI reports BASS aimed to assess an inert gaseous extinguishing agent similar to the one already used on ISS.",
                                 "excerpt is an objective, not a completed assessment"),
    "clm:PSI-98:summary": ("PSI investigation SAFFIRE-I performed a large fabric fire test on the Cygnus resupply vehicle after it left the ISS.",
                           "PSI investigation SAFFIRE-I performed a fire test on the Cygnus resupply vehicle after it left the ISS.",
                           "'large fabric' is not in the excerpt"),
    "clm:PSI-142:finding:1": ("PSI reports warm flames have a double reaction zone and play a critical role in cool-to-hot flame transition.",
                              "PSI-142 modelling shows warm flames have a double reaction zone and play a critical role in cool-to-hot flame transition.",
                              "a numerical-model result, not an observation"),
    "clm:PSI-142:finding:2": ("PSI reports flammable regions of warm and cool flames expand as pressure rises, due to higher low-temperature reactivity.",
                              "PSI-142 modelling shows flammable regions of warm and cool flames expand as pressure rises, due to higher low-temperature reactivity.",
                              "a numerical-model result, not an observation"),
}


def review(claims: list[dict]) -> list[dict]:
    """Apply the human review: drop retired ids and rejected texts, apply edits, renumber takeaways per habitat."""
    from rag import brief, brief_facts
    rejected_texts = {t for t, _ in REJECTED.values()} | set(brief.REJECTED)
    out, seen = [], set()
    for c in claims:
        if c["id"] in REJECTED or c["text"] in rejected_texts:
            continue
        c = dict(c)
        if c["kind"] == "takeaway" and c["id"].rsplit(":", 1)[1] in brief_facts.TOPICS:
            pass  # computed takeaway: owned by brief_facts, never edited here
        elif c["kind"] == "takeaway":
            if c["text"] in brief.EDITED:
                c["text"] = brief.EDITED[c["text"]][0]
            topic = brief.TOPIC_BY_INV.get(c["investigationId"], "si-" + c["investigationId"].lower())
            c["id"] = f"clm:brief:{c['habitat']}:{topic}"  # stable by topic, not by position
            if c["id"] in seen:
                continue
            seen.add(c["id"])
        elif c["id"] in EDITED and c["text"] == EDITED[c["id"]][0]:
            c["text"] = EDITED[c["id"]][1]
        out.append(c)
    return out


def live(client, inv: str, title: str, us: list[dict], tok: dict) -> list[dict]:
    listing = "\n".join(f"[S{u['n']}] ({u['sid']}, {u['sec']}) {u['s']}" for u in us)
    user = f"Investigation: {inv} {title}\n\nHabitats:\n{HABITAT_FACTS}\n\nSource sentences:\n{listing}"
    by_n = {u["n"]: u for u in us}
    errs: list[str] = []
    ok = None
    for attempt in (0, 1):
        prompt = user if not errs else user + "\n\nYour last reply broke these rules, fix them: " + "; ".join(errs)
        reply = call_model(client, SYSTEM, prompt, tok)
        if reply is None:
            errs = ["reply was cut off or refused; answer shorter"]
            continue
        ok, errs = parse(reply, by_n)
        if ok and ok["summary"] and not errs:
            break
    if not ok or not ok["summary"]:
        print(f"live failed for {inv}: {errs}", file=sys.stderr)
        return extractive(inv, us)  # live failed twice: fall back so the investigation still has a summary
    out = [claim(f"clm:{inv}:summary", inv, "summary", ok["summary"]["text"], ok["summary"]["u"])]
    for i, f in enumerate(ok["findings"], 1):
        out.append(claim(f"clm:{inv}:finding:{i}", inv, "finding", f["text"], f["u"]))
    for h in HABITATS:
        if h in ok["rationales"]:
            r = ok["rationales"][h]
            out.append(claim(f"clm:{inv}:rationale:{h}", inv, "rationale", r["text"], r["u"], h))
    return out


def guard(is_live: bool, argv: list[str]) -> None:
    """Refuse the silent downgrade: no key + live claims on disk replaces SI-written claims with extractive ones."""
    if is_live or "--extractive" in argv or "--brief" in argv:
        return
    if INFO.exists() and json.loads(INFO.read_text(encoding="utf-8")).get("mode") == "live":
        sys.exit("precompute: no ANTHROPIC_API_KEY and live claims are on disk; pass --extractive to overwrite them "
                 "(drops rationales), or --brief to refresh the computed takeaways only.")


def apply_brief(claims: list[dict]) -> list[dict]:
    """Replace the computed takeaways (pure data, no model) and keep the SI-written ones."""
    from rag import brief_facts
    keep = [c for c in claims if not (c["kind"] == "takeaway" and c["id"].rsplit(":", 1)[1] in brief_facts.TOPICS)]
    return keep + brief_facts.build()


def on_screen(text: str) -> str:
    """Text as the page shows it: the page says "experiment", so the "PSI investigation" lead-in is dropped
    ("PSI investigation ACME runs ..." reads "ACME runs ..."). Applied at write time only, so prompts, the
    cache and the review table keep the model's own wording."""
    out = text.replace("PSI investigation ", "")
    return out[:1].upper() + out[1:]


def write_claims(claims: list[dict]) -> dict:
    claims = [{**c, "text": on_screen(c["text"])} for c in claims]
    (DATA / "claims.json").write_text(json.dumps({"items": claims}, indent=2, ensure_ascii=False) + "\n",
                                      encoding="utf-8", newline="\n")
    return {"claims": len(claims), "over25": sum(1 for c in claims if words(c["text"]) > MAX_WORDS),
            "byKind": {k: sum(1 for c in claims if c["kind"] == k) for k in ("summary", "finding", "rationale", "takeaway")}}


def refresh_brief() -> None:
    """--brief: reapply the review and rebuild the computed takeaways in the existing claims.json. No model call."""
    items = json.loads((DATA / "claims.json").read_text(encoding="utf-8"))["items"]
    claims = apply_brief(review(items))
    info = json.loads(INFO.read_text(encoding="utf-8"))
    info.update(write_claims(claims))
    INFO.write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(info))


def main() -> None:
    argv = sys.argv[1:]
    if "--brief" in argv:
        return refresh_brief()
    corpus = load_corpus()
    invs = sorted((s.split(":", 1)[1] for s in corpus if s.startswith("psi:")), key=lambda p: int(p.split("-")[1]))
    invs = [i for i in invs if i not in NOT_COMBUSTION]
    is_live = bool(os.environ.get("ANTHROPIC_API_KEY")) and "--extractive" not in argv
    guard(is_live, argv)
    client = None
    if is_live:
        import anthropic  # lazy: stdlib-only in extractive mode
        client = anthropic.Anthropic()
    tok = {"in": 0, "out": 0}
    claims = []
    for inv in invs:
        us = build_units(inv, corpus)
        title = corpus[f"psi:{inv}"]["meta"]["title"]
        claims += live(client, inv, title, us, tok) if is_live else extractive(inv, us)
    claims = review(claims)  # before the brief, so rejected claims' excerpts never reach its sentence pool
    if is_live:  # SI-written takeaways: one call per habitat. Extractive mode writes none.
        from rag import brief
        for hab in brief.HABITATS:
            claims += brief.generate(hab, claims, corpus, lambda s, u, t: call_model(client, s, u, t), check_text, tok)
        claims = review(claims)
    claims = apply_brief(claims)  # computed takeaways: pure data, both modes
    counts = write_claims(claims)
    log = [json.loads(x) for x in USAGE.read_text(encoding="utf-8").splitlines()] if USAGE.exists() else []
    total = {"in": sum(x["in"] for x in log), "out": sum(x["out"] for x in log), "calls": len(log)}
    info = {"mode": "live" if is_live else "extractive", "model": MODEL if is_live else None,
            "date": date.today().isoformat(), **counts,
            "tokens": total if is_live else None,  # cumulative over every live run (cache hits cost nothing)
            "usd": round(total["in"] * PRICE_IN / 1e6 + total["out"] * PRICE_OUT / 1e6, 4) if is_live else 0,
            "rerun": "python scripts/rag/precompute.py"}
    INFO.write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8", newline="\n")
    idx = build_index()
    INDEX_PATH.write_text(json.dumps(idx, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(info), f"| chunks {len(idx['chunks'])}")


if __name__ == "__main__":
    main()
