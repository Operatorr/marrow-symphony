import { create } from "zustand";
import type { ViewMode } from "@/types";

const THEME_KEY = "marrow:dark";
const REDUCE_MOTION_KEY = "marrow:reduce-motion";

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
  reduceMotion: boolean;
  sidebarOpen: boolean;
  selectedProjectId: number | null;
  boardScope: "project" | "global";
  openedIssueId: number | null;
  focusedSessionId: number | null;
  view: ViewMode;
  toggleDark: () => void;
  toggleReduceMotion: () => void;
  toggleSidebar: () => void;
  selectProject: (projectId: number | null) => void;
  setBoardScope: (scope: "project" | "global") => void;
  openIssue: (issueId: number | null) => void;
  focusSession: (sessionId: number | null) => void;
  setView: (view: ViewMode) => void;
}

const initialDark = resolveInitialDark();
const initialReduceMotion =
  localStorage.getItem(REDUCE_MOTION_KEY) === "true" ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Apply once at module load so the DOM matches the initial store state and
// dark-preferring users don't get a light-mode flash on boot/reload.
document.documentElement.classList.toggle("dark", initialDark);
document.documentElement.classList.toggle("reduce-motion", initialReduceMotion);

export const useUiStore = create<UiState>((set) => ({
  dark: initialDark,
  reduceMotion: initialReduceMotion,
  sidebarOpen: true,
  selectedProjectId: null,
  boardScope: "global",
  openedIssueId: null,
  focusedSessionId: null,
  view: "cockpit",
  toggleDark: () =>
    set((state) => {
      const dark = !state.dark;
      document.documentElement.classList.toggle("dark", dark);
      localStorage.setItem(THEME_KEY, String(dark));
      return { dark };
    }),
  toggleReduceMotion: () =>
    set((state) => {
      const reduceMotion = !state.reduceMotion;
      document.documentElement.classList.toggle("reduce-motion", reduceMotion);
      localStorage.setItem(REDUCE_MOTION_KEY, String(reduceMotion));
      return { reduceMotion };
    }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  selectProject: (projectId) =>
    set({
      selectedProjectId: projectId,
      boardScope: projectId === null ? "global" : "project",
      openedIssueId: null,
    }),
  setBoardScope: (boardScope) => set({ boardScope }),
  openIssue: (openedIssueId) => set({ openedIssueId }),
  focusSession: (focusedSessionId) => set({ focusedSessionId }),
  setView: (view) =>
    set((state) => ({
      view,
      openedIssueId: view === "board" ? state.openedIssueId : null,
    })),
}));
