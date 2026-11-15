import type { HabitatId } from "../contracts/index.ts";

/**
 * The Interpret overview: plain statements, each tied to the records that support it.
 * The wording is SI's summary of those records; every number is quoted from them (brief.test.ts checks this).
 *
 * A ref names one record in public/data:
 *   claim:<id>          claims.json
 *   fact:<id>           facts.json
 *   solids:sample:<id>  solids.json, a SAFFIRE-II sample
 *   solids:finding:<n>  solids.json, BASS-II finding n (1-based)
 *   earth:<id>          earth.json
 *   inv:<id>            investigations.json
 *   habitat:<id>        habitats.json
 */
export type Ref = string;
export type Statement = { id: string; label?: string; text: string; refs: Ref[] };
export type Row = { id: string; topic: string; space: string; earth: string; refs: Ref[] };
export type OverviewBase = "iss" | "moon" | "rover";
export type BaseOverview = { heading: string; lead: Statement; air: Statement[]; limits: Statement[] };

/** How a flame behaves without gravity. */
export const BEHAVIOUR: Statement[] = [
  {
    id: "shape",
    label: "Shape",
    text: "A gas flame can burn as a ball. ACME feeds gas through a ball-shaped porous burner and gets a nearly spherical flame.",
    refs: ["claim:clm:PSI-23:summary", "claim:clm:PSI-10:summary"],
  },
  {
    id: "oxygen",
    label: "Oxygen",
    text: "Still air can starve it. With no airflow, ACME BRE flames at 21% oxygen went out in a short time; in richer oxygen they kept burning.",
    refs: ["claim:clm:PSI-20:finding:2"],
  },
  {
    id: "airflow",
    label: "Airflow",
    text: "Turning the airflow down put fabric flames out: in BASS-II at 2.2 to 5 cm/s. With less oxygen, a flame needed more airflow to stay alight.",
    refs: ["fact:solids-quench-flow", "solids:finding:1", "solids:finding:2"],
  },
  {
    id: "spread",
    label: "Spread",
    text: "Materials burned less in orbit. In SAFFIRE-II, more burned on Earth than in orbit in 4 of 6 comparable samples, and never more in orbit.",
    refs: ["fact:saffire2-gravity"],
  },
  {
    id: "cool",
    label: "Cool flames",
    text: "A droplet can keep burning in an invisible cool flame (a low-temperature flame) after the visible flame goes out. FLEX found this.",
    refs: ["earth:cool-flames", "claim:clm:PSI-142:summary"],
  },
];

/** Space and Earth, side by side. Only rows where the data has both sides. */
export const SIDE_BY_SIDE: Row[] = [
  {
    id: "silicone",
    topic: "Silicone, 4 samples",
    space: "None spread a flame.",
    earth: "3 of 4 burned, 2 completely.",
    refs: ["fact:saffire2-gravity", "solids:sample:2-1", "solids:sample:2-2", "solids:sample:2-3", "solids:sample:2-4"],
  },
  {
    id: "fabric",
    topic: "Cotton-fiberglass fabric",
    space: "Burned the whole 29 cm at 2.1 mm/s.",
    earth: "Burned completely, speeding up.",
    refs: ["solids:sample:2-5"],
  },
  {
    id: "pmma",
    topic: "PMMA plastic",
    space: "The flame stayed at the base and wore it away at only 0.01 to 0.04 mm/s.",
    earth: "Burned completely, speeding up.",
    refs: ["solids:sample:2-8"],
  },
  {
    id: "droplet",
    topic: "Droplet burning speed",
    space: "The ISS rate, the baseline.",
    earth: "About 1.5 times as fast for a 2 mm droplet. A textbook estimate, not a measurement.",
    refs: ["fact:physics-gravity-estimate"],
  },
  {
    id: "cool",
    topic: "Cool flames",
    space: "Last long enough to study.",
    earth: "Flicker out quickly.",
    refs: ["earth:cool-flames"],
  },
  {
    id: "smoke",
    topic: "Smoke detection",
    space: "SAME found a detector design often missed the smaller smoke particles from Teflon and Kapton.",
    earth: "ISS smoke detectors were designed from Earth-gravity test data, since no microgravity data existed.",
    refs: ["earth:smoke-detection", "claim:clm:PSI-102:rationale:iss"],
  },
];

/** The limit that holds whatever the base. The claim is named per base so each base cites its own takeaway. */
const commonLimits = (base: OverviewBase): Statement[] => [
  {
    id: "pressure",
    text: "Most experiments do not say what pressure they ran at: 18 of 24 list none.",
    refs: [`claim:clm:brief:${base}:pressure-coverage`],
  },
];

/** Limits that matter most at station air (21% oxygen, where the fabric and droplet tests sit). */
const ISS_LIMITS: Statement[] = [
  {
    id: "min-oxygen",
    text: "The lowest oxygen that still lets a fabric flame burn was not pinned down. The BASS-II report says a test that slowly lowers oxygen is needed.",
    refs: ["solids:finding:4"],
  },
  {
    id: "one-fabric",
    text: "The fabric results cover one fabric and one airflow direction.",
    refs: ["fact:solids-o2-range"],
  },
  {
    id: "droplet-estimate",
    text: "The Earth-versus-orbit droplet speed is a textbook estimate; no partial-gravity droplet data exists to check it.",
    refs: ["fact:physics-gravity-estimate"],
  },
];

const lunar = (base: "moon" | "rover", air: string): BaseOverview => ({
  heading: base === "moon" ? "In Moon Base air" : "In the rover's air",
  lead: {
    id: "lead",
    text: `In richer oxygen like ${air} 30%, gas flames kept burning with the airflow off, and no solid material has been burned in that air or in Moon gravity.`,
    refs: [`claim:clm:brief:${base}:bre-airflow`, `claim:clm:brief:${base}:fuel-gap`, `claim:clm:brief:${base}:gravity-limit`],
  },
  air: [
    {
      id: "airflow-off",
      text: `Cutting the airflow is a standard step against spacecraft fires, but ACME BRE flames kept burning without it in richer oxygen. ${air[0].toUpperCase()}${air.slice(1)} 30% lies inside its tested 21 to 40%.`,
      refs: [`claim:clm:brief:${base}:bre-airflow`, "claim:clm:PSI-20:finding:1"],
    },
    {
      id: "burn-rate",
      text: "Droplets burn faster in richer oxygen. FLEX methanol averaged 0.62 mm2/s at 25% oxygen or more, against 0.49 at 18% to 25%.",
      refs: ["fact:flex-br-o2-methanol"],
    },
    {
      id: "break-apart",
      text: "Droplets also break apart more often: 17 of 23 FLEX runs at 28% oxygen or more did.",
      refs: ["fact:model-disruption-moon", "fact:flex-end-o2"],
    },
    {
      id: "coverage",
      text: "6 of 24 experiments covered 30% oxygen, and 5 of the 6 that record a pressure include 70.3 kPa.",
      refs: [`claim:clm:brief:${base}:o2-coverage`, `claim:clm:brief:${base}:pressure-coverage`],
    },
  ],
  limits: [
    {
      id: "gravity",
      text: "No experiment ran in Moon gravity: 19 flew in microgravity and 5 were ground studies.",
      refs: [`claim:clm:brief:${base}:gravity-limit`],
    },
    {
      id: "solids-30",
      text: "No solid material was burned at 30% oxygen. The BASS fabric tests stop at 21%, 9 percentage points below this air.",
      refs: ["fact:solids-o2-range", `claim:clm:brief:${base}:fuel-gap`],
    },
    {
      id: "low-pressure-edge",
      text: "This air sits at the low-pressure edge of the FLEX droplet data: only 9 methanol and 7 heptane runs have 30% oxygen or more at 620 mmHg or less, so some team models do not apply.",
      refs: base === "rover" ? ["fact:model-moon-validity", "habitat:rover"] : ["fact:model-moon-validity"],
    },
    ...commonLimits(base),
  ],
});

export const FOR_BASE: Record<OverviewBase, BaseOverview> = {
  iss: {
    heading: "In ISS air",
    lead: {
      id: "lead",
      text: "ISS air is the best-tested of the three bases, and in it gas flames went out soon after the airflow stopped.",
      refs: ["claim:clm:brief:iss:o2-coverage", "claim:clm:brief:moon:o2-coverage", "claim:clm:brief:iss:bre-airflow"],
    },
    air: [
      {
        id: "coverage",
        text: "8 of 24 experiments covered 21% oxygen, and all 6 that record a pressure include 101.3 kPa.",
        refs: ["claim:clm:brief:iss:o2-coverage", "claim:clm:brief:iss:pressure-coverage"],
      },
      {
        id: "airflow-off",
        text: "Cutting the airflow is a standard step against spacecraft fires. At 21% oxygen, ACME BRE flames with no airflow went out in a short time.",
        refs: ["claim:clm:PSI-20:finding:1", "claim:clm:brief:iss:bre-airflow"],
      },
      {
        id: "droplet-end",
        text: "Of 94 FLEX droplet runs at 21% to 28% oxygen, 52 ended with the flame going out and 31 with the droplet breaking apart.",
        refs: ["fact:flex-end-o2"],
      },
    ],
    limits: [...commonLimits("iss"), ...ISS_LIMITS],
  },
  moon: lunar("moon", "Moon Base's"),
  rover: lunar("rover", "the rover's"),
};

/** The overview for the picked habitat. Earth uses ISS figures (habitatOf). Other presets have none. */
export const overviewFor = (habitat: HabitatId): BaseOverview | null =>
  habitat === "iss" || habitat === "moon" || habitat === "rover" ? FOR_BASE[habitat] : null;

/** Every statement and row, for checks. */
export function allStatements(): { where: string; text: string; refs: Ref[] }[] {
  const out = [
    ...BEHAVIOUR.map((s) => ({ where: `behaviour:${s.id}`, text: s.text, refs: s.refs })),
    ...SIDE_BY_SIDE.map((r) => ({ where: `row:${r.id}`, text: `${r.topic} ${r.space} ${r.earth}`, refs: r.refs })),
  ];
  for (const [base, o] of Object.entries(FOR_BASE)) {
    for (const s of [o.lead, ...o.air, ...o.limits]) out.push({ where: `${base}:${s.id}`, text: s.text, refs: s.refs });
  }
  return out;
}

/* ---------- resolving a ref to what "How we know" shows ---------- */

export type Cited = { title: string; url: string | null };
export type CitedRecord = { summary?: string; quote: string; cited: Cited[] };

type Src = { id: string; title: string; url: string };
export type OverviewDb = {
  claims: { id: string; text: string; excerpt: string; sourceIds: string[] }[];
  sources: Src[];
  facts: { id: string; statement: string; caveat?: string; source: string; dataset: string }[];
  solids: {
    flammability: { source: Src; findings: string[] };
    saffire: { source: Src; samples: { sample: string; material: string; space: { text: string }; earth: { text: string }; o2: number | string }[] };
  } | null;
  earth: { id: string; title: string; summary: string; sources: Src[] }[];
  investigations: { id: string; title: string; objectives: string }[];
  habitats: { id: string; label: string; o2Percent: number; pressureKPa: number; note?: string }[];
};

const bySource = (db: OverviewDb, id: string): Cited[] => {
  const s = db.sources.find((x) => x.id === id);
  return s ? [{ title: s.title, url: s.url }] : [];
};

/** The record a ref names, as a quote plus its sources; null when the ref names nothing. */
export function resolveRef(ref: Ref, db: OverviewDb): CitedRecord | null {
  const i = ref.indexOf(":");
  const kind = ref.slice(0, i);
  const id = ref.slice(i + 1);
  switch (kind) {
    case "claim": {
      const c = db.claims.find((x) => x.id === id);
      return c ? { summary: c.text, quote: c.excerpt, cited: c.sourceIds.flatMap((s) => bySource(db, s)) } : null;
    }
    case "fact": {
      const f = db.facts.find((x) => x.id === id);
      if (!f) return null;
      const cited = bySource(db, f.source);
      return { quote: f.caveat ? `${f.statement} Caveat: ${f.caveat}` : f.statement, cited: cited.length ? cited : [{ title: f.dataset, url: null }] };
    }
    case "solids": {
      if (!db.solids) return null;
      if (id.startsWith("sample:")) {
        const s = db.solids.saffire.samples.find((x) => x.sample === id.slice(7));
        const src = db.solids.saffire.source;
        return s
          ? { quote: `Sample ${s.sample}, ${s.material}, ${s.o2}% oxygen. In orbit: ${s.space.text}. On Earth: ${s.earth.text}.`, cited: [{ title: src.title, url: src.url }] }
          : null;
      }
      if (id.startsWith("finding:")) {
        const n = Number(id.slice(8));
        const f = Number.isInteger(n) && n >= 1 ? db.solids.flammability.findings[n - 1] : undefined;
        const src = db.solids.flammability.source;
        return f ? { quote: f, cited: [{ title: src.title, url: src.url }] } : null;
      }
      return null;
    }
    case "earth": {
      const e = db.earth.find((x) => x.id === id);
      return e ? { quote: e.summary, cited: e.sources.map((s) => ({ title: s.title, url: s.url })) } : null;
    }
    case "inv": {
      const v = db.investigations.find((x) => x.id === id);
      return v ? { quote: v.objectives, cited: bySource(db, `psi:${v.id}`) } : null;
    }
    case "habitat": {
      const h = db.habitats.find((x) => x.id === id);
      return h
        ? { quote: `${h.label}: ${h.o2Percent}% oxygen at ${h.pressureKPa} kPa. ${h.note ?? ""}`.trim(), cited: [{ title: "Habitat presets (habitats.json)", url: null }] }
        : null;
    }
    default:
      return null;
  }
}
