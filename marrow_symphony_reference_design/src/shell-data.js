// Project data + iconography catalog for the Marrow Symphony shell exploration.
// Project colors are user-specified (webapp blue, api green, docs orange,
// infra purple) and mapped onto the design system's curated --project-* tokens.

window.SHELL_DATA = {
  projects: [
    { id: 'webapp', name: 'webapp', color: '#5b8cff', group: 'Work',   live: 5, needs: 2, gitBacked: true,  glyph: 'w', ref: { kind: 'pr',     label: 'PR #214 open' } },
    { id: 'api',    name: 'api',    color: '#79fa87', group: 'Work',   live: 4, needs: 0, gitBacked: true,  glyph: 'a', ref: { kind: 'branch', label: 'feature/ranked-cache' } },
    { id: 'docs',   name: 'docs',   color: '#ffb300', group: 'Work',   live: 1, needs: 1, gitBacked: true,  glyph: 'd', ref: { kind: 'branch', label: 'main' } },
    { id: 'infra',  name: 'infra',  color: '#7c4dff', group: 'Ops',    live: 3, needs: 0, gitBacked: false, glyph: 'i', ref: { kind: 'folder', label: 'shared checkout' } },
  ],
};

window.SHELL_ICONS = {
  search:     'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  plus:       'M12 5v14M5 12h14',
  sidebar:    'M3 5h18v14H3zM10 5v14',
  chevD:      'm6 9 6 6 6-6',
  chevR:      'm9 6 6 6-6 6',
  gitBranch:  'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9v6M18 9a9 9 0 0 1-9 9',
  gitPr:      'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9v6M18 12V6a3 3 0 0 0-3-3h-2M15 6l-2-3 2-3M13 0',
  folder:     'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  keyboard:   'M2 6h20v12H2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12',
  cog:        'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9 1.65 1.65 0 0 0 4.27 7.18l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.15.68.39.95.69',
  // Linear mark — stylized angled-bars hint
  linear:     'M3.5 13l9.5-9.5M5 18.5l13.5-13.5M10.5 21l10.5-10.5',
};
