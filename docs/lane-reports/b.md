# Lane B (Corpus) report, round 3

## State
- Sources: 30 = 26 `psi:` (CC0) + 4 public-domain `ntrs:`. 7 non-open NTRS records stay dropped. **Never push this branch:** `8f29d55` and `97148b7` hold the dropped text (and old excerpts in `index.json`, `claims.json`, `sources.json`).
- Claims: 51 = 24 summary, 5 finding, 6 rationale, 16 takeaway (3 SI-written, 13 computed). Live text by `claude-haiku-5-5`; $0.15 in total, no new calls this round.
- Round 3 retired 4 rationales: `clm:PSI-68:rationale:iss|moon|rover` (the facility envelope 0.1 to 0.4 O2 was called "tested"/"covering"; Lane A tested 17 to 30%) and `clm:PSI-25:rationale:iss` (excerpt says "below 21%", Lane A has up to 22.2%). The computed takeaways now carry those points from Lane A's table.
- Guard: no key + live claims on disk exits 1 ("pass --extractive ..."). `--extractive` overwrites on purpose; `--brief` rebuilds computed takeaways and reapplies the review without a model call.
- Retrieval: `retrieve.expand_query` adds synonyms to the query only (carbon dioxide/CO2, oxygen/O2, nitrogen/N2, helium/He, "put out" -> extinguish extinguishment extinction). Lane E: mirror `SYNONYMS` in `server/bm25.ts`. The CO2 droplet question now ranks FLEX (PSI-69) first.

## Rerun
```
python scripts/rag/precompute.py --brief      # computed takeaways + review, no key, no model
ANTHROPIC_API_KEY=... uv run --with anthropic python scripts/rag/precompute.py   # live, cached
python scripts/rag/precompute.py --extractive # fallback text, drops rationales and SI takeaways
```

## Habitat brief, verbatim (id | investigation | sources)
### iss
- `clm:brief:iss:bre-airflow` | PSI-20 | psi:PSI-20
  - text: Without airflow, PSI-20 ACME BRE gas-burner flames at 21% oxygen went out quickly, unlike elevated-oxygen flames; it tested 21 to 40% oxygen.
  - excerpt: The ongoing combustion without air flow was notably seen in elevated-oxygen atmospheres which are being considered for use in future spacecraft, whereas such flames in a normal atmosphere of 21% oxygen self-extinguished in a short time.
- `clm:brief:iss:o2-coverage` | PSI-10 | psi:PSI-10, psi:PSI-20, psi:PSI-23, psi:PSI-25, psi:PSI-39, psi:PSI-68
  - text: 8 of 24 experiments covered 21% oxygen in their tested range, for example ACME/Flame Design, ACME BRE, ACME s-Flame, BASS-II.
  - excerpt: Computed from PSI run tables: PSI-10 ACME/Flame Design 19.8 to 85% O2; PSI-20 ACME BRE 21 to 40% O2; PSI-23 ACME s-Flame 21 to 30% O2; PSI-25 BASS-II 13.6 to 22.2% O2; PSI-39 CFI 17 to 21% O2; PSI-68 FLEX-2 17 to 30% O2; PSI-69 FLEX 12 to 34% O2; PSI-159 ACME CFI-G 12 to 85% O2; 8 of 24 combustion experiments include 21% O2.
- `clm:brief:iss:pressure-coverage` | PSI-10 | psi:PSI-10, psi:PSI-23, psi:PSI-39, psi:PSI-68, psi:PSI-69, psi:PSI-159
  - text: Only 6 of 24 experiments record a tested pressure; all 6 include 101.3 kPa, and 18 list none.
  - excerpt: Computed from PSI run tables: PSI-10 ACME/Flame Design 43 to 305.8 kPa; PSI-23 ACME s-Flame 101.3 to 101.3 kPa; PSI-39 CFI 50.7 to 506.6 kPa; PSI-68 FLEX-2 50.7 to 304 kPa; PSI-69 FLEX 70.2 to 309.3 kPa; PSI-159 ACME CFI-G 49.5 to 331 kPa; 6 of 6 include 101.3 kPa; 18 of 24 have no pressure on record.
- `clm:brief:iss:saffire-gravity` | PSI-99 | psi:PSI-99
  - text: SAFFIRE-II silicone burned about 0 cm in microgravity in all 4 samples; in normal gravity 3 of 4 burned (sample 2-2: 7.6 cm).
  - excerpt: Computed from PSI run tables: PSI-99 Silicone rows, sample 2-1 0.27 mm: ?-g Burn Length ~ 0, 1-g Burn Length Complete; sample 2-2 0.61 mm: ?-g Burn Length ~ 0, 1-g Burn Length 7.6 cm; sample 2-3 1.03 mm: ?-g Burn Length ~ 0, 1-g Burn Length ~ 0; sample 2-4 037 mm: ?-g Burn Length ~ 0, 1-g Burn Length Complete. ('?-g' is the table's microgravity column; its mu sign was lost.)
### moon
- `clm:brief:moon:bre-airflow` | PSI-20 | psi:PSI-20
  - text: PSI-20 ACME BRE gas-burner flames kept burning without airflow in elevated oxygen in microgravity; Moon's 30% lies inside its tested 21 to 40% range.
  - excerpt: The ongoing combustion without air flow was notably seen in elevated-oxygen atmospheres which are being considered for use in future spacecraft, whereas such flames in a normal atmosphere of 21% oxygen self-extinguished in a short time.
- `clm:brief:moon:o2-coverage` | PSI-10 | psi:PSI-10, psi:PSI-20, psi:PSI-23, psi:PSI-68, psi:PSI-69, psi:PSI-159
  - text: 6 of 24 experiments covered 30% oxygen in their tested range (ACME/Flame Design, ACME BRE, ACME s-Flame, FLEX-2); all burned liquid-droplet or gas fuels.
  - excerpt: Computed from PSI run tables: PSI-10 ACME/Flame Design 19.8 to 85% O2; PSI-20 ACME BRE 21 to 40% O2; PSI-23 ACME s-Flame 21 to 30% O2; PSI-68 FLEX-2 17 to 30% O2; PSI-69 FLEX 12 to 34% O2; PSI-159 ACME CFI-G 12 to 85% O2; 6 of 24 combustion experiments include 30% O2.
- `clm:brief:moon:fuel-gap` | PSI-10 | psi:PSI-10, psi:PSI-20, psi:PSI-23, psi:PSI-68, psi:PSI-69, psi:PSI-159
  - text: None of the 6 experiments that cover 30% oxygen burned solid materials; they are liquid-droplet and gas flames.
  - excerpt: Computed from PSI run tables: PSI-10 ACME/Flame Design fuel gas; PSI-20 ACME BRE fuel gas; PSI-23 ACME s-Flame fuel gas; PSI-68 FLEX-2 fuel droplet; PSI-69 FLEX fuel droplet; PSI-159 ACME CFI-G fuel gas; solid-fuel experiments with an oxygen range: PSI-25 BASS-II 13.6 to 22.2% O2; PSI-98 SAFFIRE-I 21.5 to 21.7% O2; PSI-99 SAFFIRE-II 21.5 to 22.1% O2; none of them include 30% O2.
- `clm:brief:moon:pressure-coverage` | PSI-10 | psi:PSI-10, psi:PSI-39, psi:PSI-68, psi:PSI-69, psi:PSI-159
  - text: Only 6 of 24 experiments record a tested pressure; 5 of those include 70.3 kPa, and 18 list none.
  - excerpt: Computed from PSI run tables: PSI-10 ACME/Flame Design 43 to 305.8 kPa; PSI-23 ACME s-Flame 101.3 to 101.3 kPa; PSI-39 CFI 50.7 to 506.6 kPa; PSI-68 FLEX-2 50.7 to 304 kPa; PSI-69 FLEX 70.2 to 309.3 kPa; PSI-159 ACME CFI-G 49.5 to 331 kPa; 5 of 6 include 70.3 kPa; 18 of 24 have no pressure on record.
- `clm:brief:moon:gravity-limit` | PSI-60 | psi:PSI-60, psi:PSI-62, psi:PSI-115, psi:PSI-117, psi:PSI-142, psi:PSI-10
  - text: None of the 24 PSI combustion experiments ran in partial gravity such as the Moon's: 19 flew in microgravity, 5 were ground studies.
  - excerpt: Computed from PSI run tables: evidence flag per experiment: flight PSI-10, PSI-20, PSI-21, PSI-22, PSI-23, PSI-25, PSI-26, PSI-39, PSI-47, PSI-68, PSI-69, PSI-98, PSI-99, PSI-100, PSI-101, PSI-102, PSI-106, PSI-107, PSI-159; ground PSI-60, PSI-62, PSI-115, PSI-117, PSI-142.
- `clm:brief:moon:saffire-gravity` | PSI-99 | psi:PSI-99
  - text: SAFFIRE-II silicone burned about 0 cm in microgravity in all 4 samples; in normal gravity 3 of 4 burned (sample 2-2: 7.6 cm).
  - excerpt: Computed from PSI run tables: PSI-99 Silicone rows, sample 2-1 0.27 mm: ?-g Burn Length ~ 0, 1-g Burn Length Complete; sample 2-2 0.61 mm: ?-g Burn Length ~ 0, 1-g Burn Length 7.6 cm; sample 2-3 1.03 mm: ?-g Burn Length ~ 0, 1-g Burn Length ~ 0; sample 2-4 037 mm: ?-g Burn Length ~ 0, 1-g Burn Length Complete. ('?-g' is the table's microgravity column; its mu sign was lost.)
### rover
- `clm:brief:rover:bre-airflow` | PSI-20 | psi:PSI-20
  - text: PSI-20 ACME BRE gas-burner flames kept burning without airflow at elevated oxygen in microgravity; rover's 30% sits in its tested 21 to 40% range.
  - excerpt: The ongoing combustion without air flow was notably seen in elevated-oxygen atmospheres which are being considered for use in future spacecraft, whereas such flames in a normal atmosphere of 21% oxygen self-extinguished in a short time.
- `clm:brief:rover:o2-coverage` | PSI-10 | psi:PSI-10, psi:PSI-20, psi:PSI-23, psi:PSI-68, psi:PSI-69, psi:PSI-159
  - text: 6 of 24 experiments covered 30% oxygen in their tested range (ACME/Flame Design, ACME BRE, ACME s-Flame, FLEX-2); all burned liquid-droplet or gas fuels.
  - excerpt: Computed from PSI run tables: PSI-10 ACME/Flame Design 19.8 to 85% O2; PSI-20 ACME BRE 21 to 40% O2; PSI-23 ACME s-Flame 21 to 30% O2; PSI-68 FLEX-2 17 to 30% O2; PSI-69 FLEX 12 to 34% O2; PSI-159 ACME CFI-G 12 to 85% O2; 6 of 24 combustion experiments include 30% O2.
- `clm:brief:rover:fuel-gap` | PSI-10 | psi:PSI-10, psi:PSI-20, psi:PSI-23, psi:PSI-68, psi:PSI-69, psi:PSI-159
  - text: None of the 6 experiments that cover 30% oxygen burned solid materials; they are liquid-droplet and gas flames.
  - excerpt: Computed from PSI run tables: PSI-10 ACME/Flame Design fuel gas; PSI-20 ACME BRE fuel gas; PSI-23 ACME s-Flame fuel gas; PSI-68 FLEX-2 fuel droplet; PSI-69 FLEX fuel droplet; PSI-159 ACME CFI-G fuel gas; solid-fuel experiments with an oxygen range: PSI-25 BASS-II 13.6 to 22.2% O2; PSI-98 SAFFIRE-I 21.5 to 21.7% O2; PSI-99 SAFFIRE-II 21.5 to 22.1% O2; none of them include 30% O2.
- `clm:brief:rover:pressure-coverage` | PSI-10 | psi:PSI-10, psi:PSI-39, psi:PSI-68, psi:PSI-69, psi:PSI-159
  - text: Only 6 of 24 experiments record a tested pressure; 5 of those include 70.3 kPa, and 18 list none.
  - excerpt: Computed from PSI run tables: PSI-10 ACME/Flame Design 43 to 305.8 kPa; PSI-23 ACME s-Flame 101.3 to 101.3 kPa; PSI-39 CFI 50.7 to 506.6 kPa; PSI-68 FLEX-2 50.7 to 304 kPa; PSI-69 FLEX 70.2 to 309.3 kPa; PSI-159 ACME CFI-G 49.5 to 331 kPa; 5 of 6 include 70.3 kPa; 18 of 24 have no pressure on record.
- `clm:brief:rover:gravity-limit` | PSI-60 | psi:PSI-60, psi:PSI-62, psi:PSI-115, psi:PSI-117, psi:PSI-142, psi:PSI-10
  - text: None of the 24 PSI combustion experiments ran in partial gravity such as the Moon's: 19 flew in microgravity, 5 were ground studies.
  - excerpt: Computed from PSI run tables: evidence flag per experiment: flight PSI-10, PSI-20, PSI-21, PSI-22, PSI-23, PSI-25, PSI-26, PSI-39, PSI-47, PSI-68, PSI-69, PSI-98, PSI-99, PSI-100, PSI-101, PSI-102, PSI-106, PSI-107, PSI-159; ground PSI-60, PSI-62, PSI-115, PSI-117, PSI-142.
- `clm:brief:rover:saffire-gravity` | PSI-99 | psi:PSI-99
  - text: SAFFIRE-II silicone burned about 0 cm in microgravity in all 4 samples; in normal gravity 3 of 4 burned (sample 2-2: 7.6 cm).
  - excerpt: Computed from PSI run tables: PSI-99 Silicone rows, sample 2-1 0.27 mm: ?-g Burn Length ~ 0, 1-g Burn Length Complete; sample 2-2 0.61 mm: ?-g Burn Length ~ 0, 1-g Burn Length 7.6 cm; sample 2-3 1.03 mm: ?-g Burn Length ~ 0, 1-g Burn Length ~ 0; sample 2-4 037 mm: ?-g Burn Length ~ 0, 1-g Burn Length Complete. ('?-g' is the table's microgravity column; its mu sign was lost.)

## saffire-gravity: what PSI-99 holds
`runs/PSI-99.json` columns: sample_number, material, samle_thickness, sample_length, sample_width_cm, airflow_cm_s, o2_percent, ignition_*, burn_time_s, flow_direction, `g_burn_length` (header "?-g Burn Length"), g_spread_length, `1_g_burn_length` ("1-g Burn Length"), 1_g_spread_rate, camera_1/2.
The "?-g" header lost its mu sign; I read it as the microgravity run (Saffire flew in microgravity, and sample 2-2 matches the pre-event 7.6 cm / ~0 pair). Raw Silicone rows (all four have flow Concurrent except 2-4 Opposed; airflow 20 cm/s):
| sample | thickness | O2 % | ?-g Burn Length | 1-g Burn Length |
|---|---|---|---|---|
| 2-1 | 0.27 mm | 21.5 | ~ 0 | Complete |
| 2-2 | 0.61 mm | 22.1 | ~ 0 | 7.6 cm |
| 2-3 | 1.03 mm | 22.1 | ~ 0 | ~ 0 |
| 2-4 | 037 mm | 22.1 | ~ 0 | Complete |
Other rows are SIBAL, PMMA/Nomex and PMMA samples (burned 5 to 29 cm in the ?-g column); no silicone-like contrast is claimed for them. The "037 mm" thickness is the file's own typo.

## Notes
- `ground` evidence = the 5 modelling studies (PSI-60, 62, 115, 117, 142); the text says "ground studies", never "normal gravity". PSI-22 appears only in the evidence list in the excerpt.
- `fuel-gap` exists only where zero solid-fuel experiments cover the habitat's oxygen, so it is absent for iss (BASS-II covers 21%). "Cover" means the Lane A tested range includes the value, not that a run sat exactly there.
- Weakest SI takeaways: the three `bre-airflow` ones rest on one outreach-style BRE sentence plus the 21 to 40% range; they say 30% lies inside it, not that flames were seen at 30%.
