import { create } from "zustand";
import type { ViewMode } from "@/types";

const THEME_KEY = "marrow:dark";

/** Resolve the startup theme: an explicit prior choice wins, else follow the OS. */
function resolveInitialDark(): boolean {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored !== null) return stored === "true";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Scaffold-stage UI store. Proves the Zustand integration end to end and
 * gives us a real home for cross-cutting UI state (theme, layout, focus) as
 * the cockpit grows. For now it tracks the dark-mode toggle.
 */
interface UiState {
  dark: boolean;
  selectedProjectId: number | null;
  view: ViewMode;
  toggleDark: () => void;
  selectProject: (projectId: number | null) => void;
  setView: (view: ViewMode) => void;
}

const initialDark = resolveInitialDark();

// Apply once at module load so the DOM matches the initial store state and
// dark-preferring users don't get a light-mode flash on boot/reload.
document.documentElement.classList.toggle("dark", initialDark);

export const useUiStore = create<UiState>((set) => ({
  dark: initialDark,
  selectedProjectId: null,
  view: "cockpit",
  toggleDark: () =>
    set((state) => {
      const dark = !state.dark;
      document.documentElement.classList.toggle("dark", dark);
      localStorage.setItem(THEME_KEY, String(dark));
      return { dark };
    }),
  selectProject: (projectId) => set({ selectedProjectId: projectId }),
  setView: (view) => set({ view }),
}));
