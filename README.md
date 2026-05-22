# Marrow Symphony

A Tauri 2 (Rust) + React 19 desktop app for running interactive coding-agent CLIs against your
work. See [`AGENTS.md`](./AGENTS.md) for the map, [`CONTEXT.md`](./CONTEXT.md) for the domain
glossary, and [`docs/`](./docs) for architecture, ADRs, and exec plans.

## Stack

- **Frontend:** React 19 + Vite 7 + TypeScript (strict), Tailwind v4, shadcn/ui, TanStack Query
  (over Tauri `invoke`), Zustand (UI state), xterm.js (embedded terminals).
- **Backend:** Rust + Tauri 2, sqlx (SQLite), portable-pty, tokio.

## Prerequisites

- Node + [pnpm](https://pnpm.io)
- [Rust](https://rustup.rs) (stable) and the Tauri
  [system prerequisites](https://tauri.app/start/prerequisites/) for your OS.

## Develop

```sh
pnpm install        # JS deps (Rust deps build on first `tauri dev`)
pnpm tauri dev      # boot the desktop app with hot reload
```

## Build

```sh
pnpm build          # type-check + bundle the frontend
pnpm tauri build    # produce a distributable desktop binary
```

## Layout

```
src/            React frontend (components/, lib/, store.ts)
src-tauri/      Rust backend (src/lib.rs = command surface, tauri.conf.json)
docs/           architecture, ADRs, design docs, exec plans
```
