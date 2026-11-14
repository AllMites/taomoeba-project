import { parseDoc, type WhatIfDoc } from "./logic.ts";

// One request for the model grid, shared by every part of the page that reads it (the what-if tool, "How we know").
let pending: Promise<WhatIfDoc | null> | null = null;

export function loadWhatIf(): Promise<WhatIfDoc | null> {
  pending ??= fetch("/data/whatif.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => parseDoc(j))
    .catch(() => null)
    .then((doc) => {
      if (!doc) pending = null; // let a later visit try again
      return doc;
    });
  return pending;
}
