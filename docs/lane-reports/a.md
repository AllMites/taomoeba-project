# Lane A (Data) report

Rerun (from `scripts/`, cache in `data/raw/`, network only on a cold cache):

    uv run python -m ingest.build

## Output
- `public/data/investigations.json`: 26 rows (24 combustion + PSI-108, PSI-181 as `pds: "Other"`). PSI-20, PSI-22, PSI-47 present from the search itself. No `fixture` key. Validates against `Investigation.json`.
- `public/data/habitats.json`: ISS 21 / 101.3, Moon Base 30 / 70.3, rover 30 / 70.3, suit reference 100 / 29.6. Mars omitted: no cited planned atmosphere.
- `public/data/overlap.json`: 104 rows (26 x 4). 64 are null (16 investigations have neither O2 nor pressure).

## Coverage (of 26 rows)
- O2 range: 10. Pressure range: 6. Airflow range: 7.
- No O2 and no pressure (overlap null everywhere): PSI-21, 22, 26, 47, 60, 62, 100, 101, 102, 106, 107, 108, 115, 117, 142, 181.
- No experimental table in PSI: PSI-60, 62, 115, 117 (ground modeling studies). Their rows carry metadata only.
- Tables with no usable condition columns: PSI-21 and PSI-22 (fuel concentration only), PSI-26 BASS (6 columns, no O2/pressure; they sit only in a planned-matrix xlsx that was not read), PSI-106 (date and fuel), PSI-47, PSI-108, PSI-142, PSI-181.

## Method notes
- Table values only. Pressure: atm/bar/mmHg/kPa converted to kPa. O2: fractions x100, "21; 26.5; 40" lists and "~30% and ~21%" text parsed; values over 100 dropped (spreadsheet artefacts). Airflow: negative readings dropped (SPICE logs -5.92 and -0.28 cm/s, a sensor offset). "final/after" columns skipped, initial ones used.
- `varies`: spread above 1 point O2, 5 kPa or 1 cm/s; fuel and diluent: more than one distinct label.
- PSI-23 pressure [101.3, 101.3] comes from its Notes column ("~1 atm"), approximate (pressure rises as O2 drops).
- Fuel names: spreadsheet auto-increment labels in PSI-21 (C2H10, CH5, C2H5 ...) are dropped by a chemistry check (stable hydrocarbon: even H count, at most 2C+2). Notes that landed in material columns are dropped.
- `sensors`: file names, hardware text, approach text (keyword match). `measurements`: table headers. Both are keyword matches, not instrument specs.
- `pds`, `hardwareGroup`, `fuelKind` are editorial tables at the top of `ingest/build.py`; indirect links say why in `pdsBasis`. BASS-II also has an airflow only as a dial setting ("fan display"), so airflow is null there.
- Overlap formula is in the docstring of `ingest/overlap.py` (hand example in the test file).
- Not downloaded: raw imagery, anything over 20 MB, any Test Matrix xlsx.

## Round 2
- Conditions by basis (of 26): O2 table 10, none 16. Pressure table 6, none 20. No record-based range survived review: PSI-20's psia/O2 list is a plan ("will be examined"; its table shows 25 % and 40 % runs the list lacks, and says chamber pressures are not identified), and PSI-106/107 "co-flow air" is the stream fed around the burner, not the test atmosphere. The record reader now skips sentences about co-flow or airflow and plan or design language (will, considered, proposed, up to ...). Allowed conversions stay "cabin/ambient air" = 21 % and "ambient pressure" = 101.3 kPa; neither occurs. Table ranges are never overwritten.
- Still without O2 and pressure, and why: PSI-106, 107 (co-flow air only), PSI-21, 22 (fuel concentration only; PSI-22 coflow air does not state the ambient), 26 (table has no conditions; record only says "same pressure, oxygen"), 47, 100-102 (SAFFIRE-III, SAME: record gives no atmosphere), 108, 181 (not combustion), 60, 62, 115, 117, 142 (ground).
- `evidence`: from the record's Flight Platform. Ground: PSI-60, 62, 115, 117, 142. PSI-108 (Shuttle) and PSI-181 (ISS) are flight.
- `runs/`: 19 investigations x (.json + .csv), 1,066,289 bytes total. None for PSI-60, 62, 115, 117 (no table), PSI-142 (figure list, not runs), PSI-108, 181 (Other). FLEX 274 rows. Only the 3 condition columns are converted; other numbers keep PSI's full precision; a multi-value cell stays text ("21; 26.5; 40"); O2 values over 100 are blank. Column names snake_case with unit; `original` keeps PSI's header.
- `related`: up to 4 per row, grounds are its record naming another investigation, the PSI "Related Investigations" field, same hardware group (not ground/lab), or same fuel name. ACME rows fill with same-hardware. Unicode dashes in record text are read as hyphens (PSI-25 "BASS–II" is itself, not BASS). Test Matrix files are refused by name in `psi.tables_of`.

## Contract issues (not edited)
- `fuelKind` has no "liquid" or "unknown". PSI-108 uses "droplet" and PSI-60/142 "gas" as nearest fit; hidden or ground rows only.
- `fuel`, `sampleShape`, `hardware` are required strings: the value "Not stated" means unknown.
- Mojibake in PSI text (U+FFFD) is stripped.

## Tests
`scripts/tests/test_ingest_data.py` (offline): schemas, 24 non-Other, required ids, habitats, overlap complete, null iff dimsUsed 0, hand example.
