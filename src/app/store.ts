import { create } from "zustand";
import type { HabitatId } from "../contracts/index.ts";

export type PdsFilter = "all" | "Prevention" | "Detection" | "Suppression";
export type EvidenceMode = "page" | "drawer";

export interface AppState {
  habitat: HabitatId;
  pds: PdsFilter;
  selectedInvestigationId: string | null;
  selectedClaimId: string | null;
  evidenceMode: EvidenceMode;
  setHabitat: (h: HabitatId) => void;
  setPds: (p: PdsFilter) => void;
  setSelectedInvestigationId: (id: string | null) => void;
  setSelectedClaimId: (id: string | null) => void;
  setEvidenceMode: (m: EvidenceMode) => void;
}

export const useStore = create<AppState>((set) => ({
  habitat: "iss",
  pds: "all",
  selectedInvestigationId: null,
  selectedClaimId: null,
  evidenceMode: "page",
  setHabitat: (habitat) => set({ habitat }),
  setPds: (pds) => set({ pds }),
  setSelectedInvestigationId: (selectedInvestigationId) => set({ selectedInvestigationId }),
  setSelectedClaimId: (selectedClaimId) => set({ selectedClaimId }),
  setEvidenceMode: (evidenceMode) => set({ evidenceMode }),
}));
