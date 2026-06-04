# Marrow Symphony — Visual Language

> **Status:** _draft (initial direction)_
>
> **Purpose.** The visual / aesthetic direction — the complement to
> [`ui-io-spec.md`](./ui-io-spec.md), which deliberately covers only layout and IO. This doc is the
> style intent: mood, color, type, surface treatment. Also written to be handed to a design tool
> (e.g. Claude Design) as the "brand notes."

## Reference

Take cues from **[terax.app](https://terax.app/)**: a black-and-white site using animated WebGL
**shaders** (cf. **[shaders.com](https://shaders.com/)**) that react to the mouse cursor, with cards on
**blurred, semi-transparent (glassmorphic)** backgrounds, **generous rounded corners**, and **no
borders** — separation comes from blur, shadow, and spacing, not lines. Built on **shadcn/ui** +
Tailwind (the stack already chosen for Marrow).

A clickable Claude Design realization of this direction now exists — catalogued in
[`reference-design.md`](./reference-design.md). Its `colors_and_type.css` is the canonical token set
(Project colors **follow `--project-*`**); the **alert color is warm amber `#f5a524`** (chosen
2026-06-03; Neon Cyan and an animated rainbow remain as toggleable alternatives) — see that doc's
"Decisions & cleanup" #1.

## Principles

1. **Monochrome shell, chromatic Projects.** The chrome is black / white / greys. The **only** vivid
   color comes from **per-Project accent colors** (already required by the IO spec: an Issue card's
   color, the sidebar dot, the Cockpit group header). Monochrome frame → vivid per-Project accents.
2. **Glass, rounded, borderless.** Cards = blurred translucent surfaces, large radii, soft shadows, no
   borders. Lots of negative space in the shell.
3. **Cursor-reactive shader backdrop** behind shell surfaces (home/empty/onboarding, the Feed's
   ambiance) — the "future of web" feel, used as atmosphere, not decoration on top of data.
4. **Legibility and performance first on working surfaces.** This is a dense, always-on developer
   cockpit, not a landing page. **Do not** put shaders or heavy translucency behind the **embedded
   terminals**, the **Kanban board**, or the **Cockpit's terminal grid** — those render on solid,
   high-contrast backgrounds. Assume a **Tauri desktop webview** with ~20 live terminals on screen:
   GPU and battery matter.
5. **Reduce-motion / disable-shader setting** — a first-class toggle; the app must be fully usable and
   calm with shaders off.

## Color

- **Base:** near-black / near-white / a small grey ramp.
- **Accents:** per-Project colors (the chromatic layer). Keep a curated, distinguishable palette since
  ~4+ Projects appear at once.
- **Status (semantic, small set):** **Needs Input** = a warm attention glow (the one alert color);
  Running / Idle / Exited read mostly through the monochrome ramp + iconography.

## Typography

- **UI:** a clean grotesque / neo-grotesque sans.
- **Terminals & code:** a crisp monospace.

## Voice / mood

Precise, calm, fast, engineer-grade. An orchestration tool for power users running many AI agents at
once — confident and minimal, never playful or noisy.
