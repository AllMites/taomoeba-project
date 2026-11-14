import { create } from "zustand";
import type { HabitatId } from "../contracts/index.ts";

export type PdsFilter = "all" | "Prevention" | "Detection" | "Suppression";

export interface AppState {
  habitat: HabitatId;
  pds: PdsFilter;
  search: string;
  /** Investigation open in the detail drawer, or null when it is closed. */
  selectedInvestigationId: string | null;
  /** Investigations the last ask-box answer cited; their cards light up. Empty = nothing lit. */
  highlightIds: string[];
  /** A question another section asks the Ask box to send (the what-if tool's "Ask about this"); n makes repeats distinct. */
  askRequest?: { question: string; n: number } | null; // optional so older test states still type-check
  setHabitat: (h: HabitatId) => void;
  setPds: (p: PdsFilter) => void;
  setSearch: (s: string) => void;
  setSelectedInvestigationId: (id: string | null) => void;
  setHighlightIds: (ids: string[]) => void;
  requestAsk?: (question: string) => void;
  clearAskRequest?: () => void;
}

export const useStore = create<AppState>((set) => ({
  habitat: "moon",
  pds: "all",
  search: "",
  selectedInvestigationId: null,
  highlightIds: [],
  askRequest: null,
  setHabitat: (habitat) => set({ habitat }),
  setPds: (pds) => set({ pds }),
  setSearch: (search) => set({ search }),
  setSelectedInvestigationId: (selectedInvestigationId) => set({ selectedInvestigationId }),
  setHighlightIds: (highlightIds) => set({ highlightIds }),
  requestAsk: (question) => set((st) => ({ askRequest: { question, n: (st.askRequest?.n ?? 0) + 1 } })),
  clearAskRequest: () => set({ askRequest: null }),
}));
