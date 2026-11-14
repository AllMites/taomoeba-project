import { mkdirSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { Claim } from "../src/contracts/claim.ts";
import { HabitatPreset } from "../src/contracts/habitat.ts";
import { Investigation } from "../src/contracts/investigation.ts";
import { Provenance } from "../src/contracts/provenance.ts";
import { RankItem } from "../src/contracts/rank.ts";
import { Source } from "../src/contracts/source.ts";

const out = new URL("../src/contracts/schema/", import.meta.url);
mkdirSync(out, { recursive: true });

const schemas = { Provenance, Source, Claim, Investigation, HabitatPreset, RankItem };
for (const [name, schema] of Object.entries(schemas)) {
  writeFileSync(new URL(`${name}.json`, out), JSON.stringify(z.toJSONSchema(schema), null, 2) + "\n");
}
console.log(`wrote ${Object.keys(schemas).length} schemas`);
