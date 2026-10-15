# Robot Island

A browser game for children aged 7–9: Blockly programs run the robots and buildings of a small 3D island. See [PLAN.md](PLAN.md) for the design and the phases.

Phase 0 (foundation and compatibility) is in place: the app shell and the **editor lab** at `/lab`, which shows the Blockly editor over the 3D world. Its findings are in [docs/phase0.md](docs/phase0.md).

## Development

| Command | What it does |
| --- | --- |
| `npm install` | Installs the pinned dependencies |
| `npm run dev` | Development server |
| `npm run build` / `npm run preview` | Production build in `dist/`, and serving it |
| `npm test` | Node unit tests in `test/` |
| `npx playwright install chromium webkit` | Once: the browsers for the browser tests |
| `npm run e2e` | Browser tests in `e2e/` (Chromium, WebKit, WebKit as an iPad), against a fresh build |
| `npm run shots` | Screenshots and frame times for `docs/phase0/` |

Add `?dev` to a URL for the test hooks (`window.island`, `window.lab`).

## Versions

Tested with Node 24.14.1. Vite 8 needs Node `^20.19.0 || >=22.12.0`.

| Package | Version | Notes |
| --- | --- | --- |
| vite | 8.3.1 | as GyroRocket |
| three | 0.186.1 | as GyroRocket |
| blockly | 13.4.0 | media served from `/blockly-media/` (vite.config.js), never static.blockly.com |
| @playwright/test | 1.64.1 | Chromium and WebKit browsers |

npm also installs `jsdom` 29.1.1, as a peer dependency of Blockly; only Blockly's Node build uses it, and this project doesn't.
