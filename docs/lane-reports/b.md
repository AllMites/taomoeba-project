# Lane B (Corpus) report, round 2

## Sources (30)
- 26 `psi:` (CC0, every PSI search hit incl. PSI-108/181) + 4 `ntrs:` public-domain (19960008413, 20010074094, 20170007283, 20040053582).
- Dropped 7 NTRS records with "short quotes only" licences (20070031686, 20150023456, 20120015928, 20130014061, 20210011385, 20160000593, 20170008805): text file, index chunks, source entry and citing claims removed. The message said 8; the data held 7. No exception needed: 7 detection and 5 suppression sources remain (title/topic keywords, PSI included).
- **History**: those 7 text files exist only in `8f29d55`. Their excerpts/chunks also sit in old versions of `index.json`, `claims.json`, `sources.json` in `8f29d55` and `97148b7`. The integrator must keep both commits out of any push (squash or rebuild); the new commit only removes them from the tip.

## Claims (54 per-investigation + 6 brief takeaways, live mode, `claude-haiku-5-5`)
- 24 summary, 7 finding, 23 rationale. 53 cite PSI, 1 cites NTRS. 0 over 25 words, 0 live fallbacks.
- Findings exist for 5 investigations (PSI-20, 25, 69, 101, 142); 19 get none because their PSI text gives goals and plans, not results.
- No rationale: iss 11, moon 19, rover 19 of 24. Moon and rover rationales exist for PSI-20, 39, 68, 98, 142 only (the excerpt gives an oxygen level, a pressure or a gravity point); iss rationales for 13.
- Shared source sentence: PSI-98/99/100 (SAFFIRE-I/II/III records repeat the same hypothesis and "deberthed from the ISS" sentences). Their texts differ by investigation name.
- Method: one call per investigation. Model sees numbered sentences and habitat facts, returns sentence numbers + text; the excerpt is copied from our own list, so it is verbatim. Checks before accepting: one sentence, at most 25 words, no banned phrases, no "source lacks data" filler, every number in the text is in the excerpt or the habitat facts. One retry with the failure reasons.
- Extractive no-key fallback: summary only, plus findings where a result sentence exists; no rationales. List lead-ins ("are to:") merge with their items and are never cut.

## Spend
147 calls over 8 prompt iterations (cache on disk): 383,498 in / 225,600 out tokens = about $0.15 at $0.10/$0.50 per M. Fewer, larger calls than the 150-200 estimate.

## Self-audit: 20 claims re-read against excerpts
Overreach or weak, worst first:
1. `clm:PSI-39:rationale:iss|moon|rover` compare 0.25 to 0.5 atm (the gas-delivery line) with habitat pressure; the same record's objective says up to 5 atm. Selective.
2. `clm:PSI-20:rationale:moon` says Moon Base's 30% oxygen is untested; the excerpt only says "elevated-oxygen".
3. `clm:PSI-98:summary` says "large fabric fire test"; the excerpt does not (it says the experiment ran on Cygnus).
4. `clm:PSI-101:finding:1` (66 test points) is a procedure count, not a science result.
5. `clm:PSI-142:rationale:*` only contrasts 20 atm with habitat pressure; says nothing about what that means.
Other 15 read fine. PSI-47 rationale and PSI-21 rationale are generic but supported.

## Rerun
```
python scripts/rag/fetch.py        # sources.json + corpus/text (cached)
python scripts/rag/precompute.py   # extractive claims, index, build-info
ANTHROPIC_API_KEY=... uv run --with anthropic python scripts/rag/precompute.py   # live; key never copied here
```
Unchanged from round 1: PSI `url` is the accession search call; no DOIs; `Claim.sourceIds` holds one id.

## Habitat brief: 6 takeaways (merged `main` first; Lane A data used)
Method: one call per habitat. Input: the vetted excerpts already used by claims, plus a FACTS block computed from `habitats.json` / `investigations.json` (habitat O2 and kPa, tested ranges, counts). Checks: one sentence, at most 25 words, every number in the excerpt, the named investigation's ranges, or a computed count (`brief.ungrounded`, re-run in tests). I read all 9 first-pass takeaways by hand and rejected 3 for overreach (listed in `brief.REJECTED`; two exact texts, the third was dropped by the prompt change):
- "PSI-102 smoke detectors were designed from 1-g data": the sentence is from an NTRS paper about other detectors, not PSI-102.
- FLEX "extinction droplets too small at every oxygen level" (iss and rover versions): the excerpt says at some ambient conditions.
- ACME BRE "no habitat link" versions: restated an excerpt with no habitat condition.
Shipped (id | investigation | sources | text):
- `clm:brief:iss:1` | PSI-20 | psi:PSI-20 | Without airflow, flames at 21% oxygen went out quickly, unlike elevated-oxygen flames; ACME BRE tested 21 to 40% oxygen.
- `clm:brief:moon:1` | PSI-20 | psi:PSI-20 | PSI-20 ACME BRE saw flames keep burning without airflow in elevated oxygen; moon's 30% lies inside its tested 21 to 40% range.
- `clm:brief:moon:2` | PSI-69 | psi:PSI-69 | PSI-69 FLEX's 70.2 to 309.3 kPa range includes moon's 70.3 kPa; some tested conditions had extinction (flame-out) droplets too small to measure.
- `clm:brief:moon:3` | PSI-25 | psi:PSI-25 | None of the 24 PSI combustion investigations tested partial gravity; PSI-25 BASS-II reports fuels burn as oval balls in space, not Earth's cone flames.
- `clm:brief:rover:1` | PSI-20 | psi:PSI-20 | PSI-20 ACME BRE flames kept burning without airflow at elevated oxygen; rover's 30% sits in its tested 21 to 40% range.
- `clm:brief:rover:2` | PSI-25 | psi:PSI-25 | None of the 24 PSI combustion investigations tested partial gravity; PSI-25 contrasted outer-space oval flames with Earth's cone flames.
Review round 2 (reviewer commit): 15 claims retired and 8 narrowed (`precompute.REJECTED` / `EDITED`, ids and reasons in code); 3 takeaways rejected and 3 narrowed (`brief.REJECTED` / `EDITED`). `precompute.review()` applies them on every rerun, before the brief. Now 42 claims: 24 summary, 5 finding, 10 rationale, 3 takeaway. History correction: the 7 dropped text files are also in `97148b7`, not only `8f29d55`.
Caveats (pre-review): iss has 1 takeaway, rover 2 (fewer is fine). "None of the 24 ... tested partial gravity" rests on the count of PSI texts that never mention partial, lunar or Mars gravity (24 of 24); no source states it outright. The Moon/rover 30% claims say only that 30% lies inside the tested range; no excerpt reports a result at 30%. SAFFIRE-II silicone not used: its source (NTRS 20170008805) was dropped as non-open.
