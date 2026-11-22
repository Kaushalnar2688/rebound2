# The Last Rebound

A browser-based first-person psychological horror game built with Three.js, HTML, CSS, and JavaScript.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually http://localhost:5173).

## Build for Vercel

```bash
npm run build
```

Vercel settings:
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

No environment variables are required.

## Controls

- WASD — move
- Mouse — look
- Space — jump
- E — interact
- Shift — sprint
- F — flashlight
- Escape — pause

## Notes

The game uses procedural Three.js geometry and Web Audio synthesis, so it does not require external model or audio asset downloads. It is designed as a playable browser prototype and can be expanded with authored character models, recorded voice acting, and higher-resolution environmental textures.

## Stylized graphics overhaul

This version keeps the existing puzzle/interactable logic, collision map, timeline switching, and ending progression intact while upgrading the presentation with procedural painted surface textures, a stylized warm/cool timeline palette, ceiling light strips, wall/acoustic details, worn floor lane markings, party pennants, atmospheric dust motes, and restrained screen grain. All new environment dressing is visual-only and does not add collision blockers.

The graphics are generated locally in Three.js/canvas; no external model or texture downloads are required.
