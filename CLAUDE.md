# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Website for "Freiwillige Feuerwehr Mitte" (a volunteer fire department), built on **Adobe Edge Delivery Services (AEM / Franklin/Helix)**. There is no build step: content lives in a linked Google Docs/Sharepoint document (authored externally) and the JS/CSS in this repo progressively enhances the server-rendered HTML that Edge Delivery Services generates from that content.

- Preview: https://main--ffmitte--phornig.aem.page/
- Live: https://main--ffmitte--phornig.aem.live/

## Commands

```sh
npm i                # install dependencies
npm run lint          # lint JS (eslint) + CSS (stylelint)
npm run lint:js       # eslint only
npm run lint:css      # stylelint only
```

Local development requires the AEM CLI (not a repo dependency, install globally):
```sh
npm install -g @adobe/aem-cli
aem up                # serves the site at http://localhost:3000, proxying content from the linked doc
```

There is no test suite in this repo. CI (`.github/workflows/main.yaml`) only runs `npm run lint` on push.

## Architecture

### Page load lifecycle (`scripts/scripts.js`)
Edge Delivery Services renders semantic HTML from the authored document, then this script decorates it in three phases, each deferred further than the last to prioritize perceived performance:
1. **`loadEager`** — sets up template/theme, decorates the `main` element (buttons, icons, auto-blocks, sections, blocks), then waits for LCP block(s) to load. `LCP_BLOCKS` in `scripts.js` should list any block that renders above-the-fold content needing eager loading.
2. **`loadLazy`** — loads all remaining blocks, header/footer (fetched as fragments), lazy styles, fonts, and hash-based scroll-into-view.
3. **`loadDelayed`** — fires 3s later via dynamic import of `scripts/delayed.js`; used for RUM (Real User Monitoring / Core Web Vitals) and anything non-critical to UX.

`scripts/aem.js` is the vendored Edge Delivery Services runtime (block loading, section/block decoration, RUM sampling, fragment loading, etc.) — treat it as framework code, not application code to modify casually.

`scripts/section.js` is a small custom helper (not part of the vendored `aem.js`) that tags each section's first picture with `.section-main-image`.

### Blocks
Each directory under `blocks/` is a self-contained Edge Delivery Services **block**: authored in the source document as a table with the block's name, rendered into a `div[data-block-name]`, and decorated by a default-exported `decorate(block)` function in `<name>.js`, styled by `<name>.css`. Current blocks: `cards`, `columns`, `footer`, `fragment`, `header`, `hero`.

- `header`/`footer` are special: they're loaded separately from other blocks (via `loadHeader`/`loadFooter` in `aem.js`) and their content comes from fragment documents (`/nav`, etc.), not the page itself.
- `fragment` implements reusable content includes (`loadFragment`), consumed by `header` and available for use elsewhere.
- `hero` is auto-built (not authored explicitly) — `buildHeroBlock` in `scripts.js` detects a leading `h1` + `picture` in the document and synthesizes a hero block/section from them.
- New blocks follow the same shape: `blocks/<name>/<name>.js` (default-exported `decorate` function) + `blocks/<name>/<name>.css`, auto-discovered and auto-loaded by `decorateBlocks`/`loadBlocks` in `aem.js` — no manual registration needed.

### Styles
- `styles/styles.css` — global/base styles, loaded eagerly.
- `styles/lazy-styles.css` — loaded during the lazy phase.
- `styles/fonts.css` — loads the custom `BerlinTypeWeb` webfont (files in `fonts/`); loaded eagerly on desktop widths or once fonts were already loaded this session (flagged via `sessionStorage`), otherwise deferred to the lazy phase to avoid delaying LCP on slower connections.

## Code style

- ESLint config extends `airbnb-base` (see `.eslintrc.js`) with Babel parser; notable overrides: `no-param-reassign` allows prop mutation, `import/extensions` requires explicit `.js` extensions in imports.
- Stylelint extends `stylelint-config-standard`.
- Follow the existing block pattern (default-exported `decorate(block)`) for any new block.
