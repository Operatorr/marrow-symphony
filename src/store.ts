import { create } from "zustand";

/**
 * Scaffold-stage UI store. Proves the Zustand integration end to end and
 * gives us a real home for cross-cutting UI state (theme, layout, focus) as
 * the cockpit grows. For now it tracks the dark-mode toggle.
 */
interface UiState {
  dark: boolean;
  toggleDark: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  dark: false,
  toggleDark: () =>
    set((state) => {
      const dark = !state.dark;
      document.documentElement.classList.toggle("dark", dark);
      return { dark };
    }),
}));
