import { useEffect, useState } from "react";
import type { DatasetName } from "../contracts/index.ts";
import { loadDataset, type Loaded } from "./load.ts";

export type DatasetState<N extends DatasetName> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | ({ status: "ready" } & Loaded<N>);

export function useDataset<N extends DatasetName>(name: N): DatasetState<N> {
  const [state, setState] = useState<DatasetState<N>>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    loadDataset(name).then(
      (r) => alive && setState({ status: "ready", ...r }),
      (e: unknown) => alive && setState({ status: "error", error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      alive = false;
    };
  }, [name]);
  return state;
}
