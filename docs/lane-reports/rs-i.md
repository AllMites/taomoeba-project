# Lane I: Interpret overview

The Interpret sheet now opens with an overview above the takeaway cards (kept under "The evidence, point by point"):
a lead sentence for the picked base, then four blocks: how a flame behaves without gravity, space and Earth side by side,
the picked base's air, and what the data cannot tell you. Earth uses ISS figures (`habitatOf`).

Content lives in `src/brief/overview.ts`. Each statement lists the records that support it; "How we know" (the shared
`HowWeKnow` component, also used by the takeaway cards) quotes each record and links its sources.

Ref scheme: `claim:<id>` claims.json, `fact:<id>` facts.json, `solids:sample:<id>` SAFFIRE-II sample in solids.json,
`solids:finding:<n>` BASS-II finding n (1-based), `earth:<id>` earth.json, `inv:<id>` investigations.json,
`habitat:<id>` habitats.json.

Checks (`src/brief/overview.test.ts`): every statement has at least one ref; every ref resolves to a real record; every
record shows a source; every number in a statement appears in one of its records; no em dashes; refs to missing records
resolve to null.

Counts: 5 behaviour statements, 6 comparison rows; ISS 1 lead + 3 air + 4 limits; Moon Base and rover 1 lead + 4 air + 4 limits each (37 in all).

Screens: `docs/lane-reports/rs-i/` (1440x900 per base, tall views, 390x844 via CDP device emulation because headless Chrome
will not size a window below 500px, and a view with every "How we know" open).

# Every statement and its support

## How a flame behaves without gravity
- **Shape**: A gas flame can burn as a ball. ACME feeds gas through a ball-shaped porous burner and gets a nearly spherical flame.  
  Support: claim:clm:PSI-23:summary, claim:clm:PSI-10:summary
- **Oxygen**: Still air can starve it. With no airflow, ACME BRE flames at 21% oxygen went out in a short time; in richer oxygen they kept burning.  
  Support: claim:clm:PSI-20:finding:2
- **Airflow**: Turning the airflow down put fabric flames out: in BASS-II at 2.2 to 5 cm/s. With less oxygen, a flame needed more airflow to stay alight.  
  Support: fact:solids-quench-flow, solids:finding:1, solids:finding:2
- **Spread**: Materials burned less in orbit. In SAFFIRE-II, more burned on Earth than in orbit in 4 of 6 comparable samples, and never more in orbit.  
  Support: fact:saffire2-gravity
- **Cool flames**: A droplet can keep burning in an invisible cool flame (a low-temperature flame) after the visible flame goes out. FLEX found this.  
  Support: earth:cool-flames, claim:clm:PSI-142:summary

## Space and Earth, side by side
- **Silicone, 4 samples**: in orbit "None spread a flame." / on Earth "3 of 4 burned, 2 completely."  
  Support: fact:saffire2-gravity, solids:sample:2-1, solids:sample:2-2, solids:sample:2-3, solids:sample:2-4
- **Cotton-fiberglass fabric**: in orbit "Burned the whole 29 cm at 2.1 mm/s." / on Earth "Burned completely, speeding up."  
  Support: solids:sample:2-5
- **PMMA plastic**: in orbit "The flame stayed at the base and wore it away at only 0.01 to 0.04 mm/s." / on Earth "Burned completely, speeding up."  
  Support: solids:sample:2-8
- **Droplet burning speed**: in orbit "The ISS rate, the baseline." / on Earth "About 1.5 times as fast for a 2 mm droplet. A textbook estimate, not a measurement."  
  Support: fact:physics-gravity-estimate
- **Cool flames**: in orbit "Last long enough to study." / on Earth "Flicker out quickly."  
  Support: earth:cool-flames
- **Smoke detection**: in orbit "SAME found a detector design often missed the smaller smoke particles from Teflon and Kapton." / on Earth "ISS smoke detectors were designed from Earth-gravity test data, since no microgravity data existed."  
  Support: earth:smoke-detection, claim:clm:PSI-102:rationale:iss

## Base: iss (In ISS air)
- **Lead**: ISS air is the best-tested of the three bases, and in it gas flames went out soon after the airflow stopped.  
  Support: claim:clm:brief:iss:o2-coverage, claim:clm:brief:moon:o2-coverage, claim:clm:brief:iss:bre-airflow

Air:
- 8 of 24 experiments covered 21% oxygen, and all 6 that record a pressure include 101.3 kPa.  
  Support: claim:clm:brief:iss:o2-coverage, claim:clm:brief:iss:pressure-coverage
- Cutting the airflow is a standard step against spacecraft fires. At 21% oxygen, ACME BRE flames with no airflow went out in a short time.  
  Support: claim:clm:PSI-20:finding:1, claim:clm:brief:iss:bre-airflow
- Of 94 FLEX droplet runs at 21% to 28% oxygen, 52 ended with the flame going out and 31 with the droplet breaking apart.  
  Support: fact:flex-end-o2

What the data cannot tell you:
- Most experiments do not say what pressure they ran at: 18 of 24 list none.  
  Support: claim:clm:brief:iss:pressure-coverage
- The lowest oxygen that still lets a fabric flame burn was not pinned down. The BASS-II report says a test that slowly lowers oxygen is needed.  
  Support: solids:finding:4
- The fabric results cover one fabric and one airflow direction.  
  Support: fact:solids-o2-range
- The Earth-versus-orbit droplet speed is a textbook estimate; no partial-gravity droplet data exists to check it.  
  Support: fact:physics-gravity-estimate

## Base: moon (In Moon Base air)
- **Lead**: In richer oxygen like Moon Base's 30%, gas flames kept burning with the airflow off, and no solid material has been burned in that air or in Moon gravity.  
  Support: claim:clm:brief:moon:bre-airflow, claim:clm:brief:moon:fuel-gap, claim:clm:brief:moon:gravity-limit

Air:
- Cutting the airflow is a standard step against spacecraft fires, but ACME BRE flames kept burning without it in richer oxygen. Moon Base's 30% lies inside its tested 21 to 40%.  
  Support: claim:clm:brief:moon:bre-airflow, claim:clm:PSI-20:finding:1
- Droplets burn faster in richer oxygen. FLEX methanol averaged 0.62 mm2/s at 25% oxygen or more, against 0.49 at 18% to 25%.  
  Support: fact:flex-br-o2-methanol
- Droplets also break apart more often: 17 of 23 FLEX runs at 28% oxygen or more did.  
  Support: fact:model-disruption-moon, fact:flex-end-o2
- 6 of 24 experiments covered 30% oxygen, and 5 of the 6 that record a pressure include 70.3 kPa.  
  Support: claim:clm:brief:moon:o2-coverage, claim:clm:brief:moon:pressure-coverage

What the data cannot tell you:
- No experiment ran in Moon gravity: 19 flew in microgravity and 5 were ground studies.  
  Support: claim:clm:brief:moon:gravity-limit
- No solid material was burned at 30% oxygen. The BASS fabric tests stop at 21%, 9 percentage points below this air.  
  Support: fact:solids-o2-range, claim:clm:brief:moon:fuel-gap
- This air sits at the low-pressure edge of the FLEX droplet data: only 9 methanol and 7 heptane runs have 30% oxygen or more at 620 mmHg or less, so some team models do not apply.  
  Support: fact:model-moon-validity
- Most experiments do not say what pressure they ran at: 18 of 24 list none.  
  Support: claim:clm:brief:moon:pressure-coverage

## Base: rover (In the rover's air)
- **Lead**: In richer oxygen like the rover's 30%, gas flames kept burning with the airflow off, and no solid material has been burned in that air or in Moon gravity.  
  Support: claim:clm:brief:rover:bre-airflow, claim:clm:brief:rover:fuel-gap, claim:clm:brief:rover:gravity-limit

Air:
- Cutting the airflow is a standard step against spacecraft fires, but ACME BRE flames kept burning without it in richer oxygen. The rover's 30% lies inside its tested 21 to 40%.  
  Support: claim:clm:brief:rover:bre-airflow, claim:clm:PSI-20:finding:1
- Droplets burn faster in richer oxygen. FLEX methanol averaged 0.62 mm2/s at 25% oxygen or more, against 0.49 at 18% to 25%.  
  Support: fact:flex-br-o2-methanol
- Droplets also break apart more often: 17 of 23 FLEX runs at 28% oxygen or more did.  
  Support: fact:model-disruption-moon, fact:flex-end-o2
- 6 of 24 experiments covered 30% oxygen, and 5 of the 6 that record a pressure include 70.3 kPa.  
  Support: claim:clm:brief:rover:o2-coverage, claim:clm:brief:rover:pressure-coverage

What the data cannot tell you:
- No experiment ran in Moon gravity: 19 flew in microgravity and 5 were ground studies.  
  Support: claim:clm:brief:rover:gravity-limit
- No solid material was burned at 30% oxygen. The BASS fabric tests stop at 21%, 9 percentage points below this air.  
  Support: fact:solids-o2-range, claim:clm:brief:rover:fuel-gap
- This air sits at the low-pressure edge of the FLEX droplet data: only 9 methanol and 7 heptane runs have 30% oxygen or more at 620 mmHg or less, so some team models do not apply.  
  Support: fact:model-moon-validity, habitat:rover
- Most experiments do not say what pressure they ran at: 18 of 24 list none.  
  Support: claim:clm:brief:rover:pressure-coverage

# Left out: the data does not support it

- Comparison row "Flame shape": the data says microgravity gas flames are spherical (PSI-10, PSI-23) but has no record of flame shape on Earth. Shape stays as a behaviour statement only.
- Comparison row "What puts it out": the space side is supported (BASS-II quench flows, ACME BRE without airflow), but no record says what puts a flame out on Earth.
- Comparison row "What airflow does": no Earth-side record.
- Comparison row "Soot": PSI-60 objectives mention a "large discrepancy between soot formation in 1g and in 0g flames" but give no per-side finding, so it is not a row.
- Why flames are spherical or slower in orbit (buoyancy, hot gas rising): not stated by any record beyond PSI-107's "non-buoyant" label and a textbook estimate, so no causal explanation is given.
- Water mist as an extinguisher (earth.json `water-mist`): it says what the ISS carries, not how a flame behaves, so it is not used.
- Any statement about burning in Moon gravity: no measured partial-gravity data exists; only the textbook buoyancy estimate (shown with that label).
- Suit reference and Mars presets: no overview (the picker does not offer them).
