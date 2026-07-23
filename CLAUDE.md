# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Austin Simpson's browser game arcade — a static HTML/CSS/JS hub (no framework, no build step, no package manager) linking out to seven playable games, with Google sign-in and Firebase-backed progress/leaderboards. Deployed via GitHub Pages from `DefenderofAsgard/game-arcade`; pushes to `main` go live at that Pages URL.

## Running locally

No build/dev/test/lint tooling exists — serve the folder directly, e.g. `python3 -m http.server`, and open `index.html`. Opening game pages via `file://` also works for most features, but see "Production lock" below — some things only render fully when run locally.

## Structure

- `index.html`, `style.css`, `platform.js`, `auth.js`, `lock.js` — the arcade hub (game grid + sign-in).
- `account.html`, `account.js`, `account.css` — signed-in user's account/stats page.
- `games/<game-name>/` — one folder per game (`stick-duel`, `jigsaw`, `police-chase`, `circuit-builder`, `orbit-mechanics`, `element-rush`, `code-runner`), each with its own `index.html`, `game.js`, `style.css`, and assets (`sounds/`, `images/`) where applicable.
- `circuit-builder`, `orbit-mechanics`, `element-rush`, `code-runner` are the STEM-education games (electricity/logic, orbital physics, chemistry categorization, and programming loops respectively). They only use the shared platform app for progress (no per-game Firebase project/leaderboard).

## Firebase architecture (two layers — don't conflate them)

1. **Platform app** (`platform.js`, root): a single named Firebase app (`"platform"`, project `game-arcade-platform`) shared by every page. Handles Google sign-in (`auth.js`) and per-user cross-game progress (`savePlatformProgress`, `addPlaytime`, `saveJigsawState`/`loadJigsawState`/`clearJigsawState`) stored under `users/{uid}`. It's initialized with an explicit app name specifically so it can coexist with each game's own default-named Firebase app on the same page.
2. **Per-game app** (`games/<game>/firebase-config.js`, `stick-duel` and `police-chase` only): each of these games has its own separate Firebase *project* (different `projectId`/`apiKey` from the platform project and from each other), initialized as the default (unnamed) app, used solely for that game's top-3 `leaderboard.js` high-score list. `jigsaw` and the four STEM games have no separate project/leaderboard — they only use the platform app for saving progress (`savePlatformProgress("circuitBuilder"|"orbitMechanics"|"elementRush"|"codeRunner", ...)`); jigsaw's images are static local JPGs, not a live API.

When touching leaderboard or cross-game progress code, be clear about which Firebase app/project you're writing to — `db` (per-game, in games with `firebase-config.js`) vs `platformDb` (shared, from `platform.js`).

## Production lock (`lock.js`)

Every game page loads `../../lock.js` first. It checks if the page is running locally (`file:`, `localhost`, `127.0.0.1`); if not, it hides the entire page and replaces the body with a "Coming Soon" placeholder linking back to the arcade. **This means a game only actually plays on the live GitHub Pages site once its `lock.js` gate is removed from that game's `index.html`** — as of now all seven games are still locked in production regardless of how finished the code is. Don't assume a game is live just because its card appears on the arcade hub page. When adding a new game, include the same `<script src="../../lock.js"></script>` tag as the first thing in its `index.html` `<head>`.

## Deployment

Site is served by GitHub Pages directly from the repo — there's no separate build/deploy step. Merging/pushing to the default branch is the deploy.
