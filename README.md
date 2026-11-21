# Solmar Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rektPanda/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rektPanda/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) — a 2D top-down open-world crime game in the fictional coastal city of Solmar. Referral: https://make.fun/r/1e8h8xtg

## What it is

You play Rico, a driver for hire in Solmar City, working jobs for Rico's crew boss Rico and his partner Dante. Drive, steal cars, outrun the police, and finish all **8 story missions** — from a first errand at the Marina to a bank heist and a five-star escape to the Lighthouse.

- **8 story missions**: deliveries, getaways, a car theft, a roadblock run, a night courier route, a bank heist, and a final five-star escape — each with a cash reward and short Rico/Dante dialogue.
- **Wanted system (1–5 stars)**: steal cars or hit pedestrians and the Solmar police come after you — chase cars, ramming, and roadblocks at high heat. Stay out of sight and the heat cools off.
- **Open world**: a 3.2 × 2.4 km coastal city with a beach, marina, docks, bank, club, garage, hospital and lighthouse; drivable cars, ambient traffic, and pedestrians.
- **HUD + minimap**: health, cash, wanted stars, clock (day turns to night), mission objective, and a live minimap.
- **Autopilot (P)**: a demo driver that plays the missions by itself — also the headless test driver.

## How to play

Open `game/index.html` in a browser (or serve `game/` with any static server). No build step, no dependencies, no network requests.

| Key | Action |
|---|---|
| W A S D / arrows | Drive / walk |
| Shift | Run (on foot) |
| Space | Enter or exit a car |
| Enter | Start the next story mission |
| P | Toggle autopilot |

Get busted on foot or wasted and you lose money and the mission — then try again.

## Files

- `game/` — the game (`index.html`, `config.js`, `city.js`, `entities.js`, `missions.js`, `input.js`, `render.js`, `main.js`) plus `test.js`, the headless Node autopilot test.
- `main.ts` — entry program (Node 22+, stdlib only): copies `game/` to `/output` and writes `dossier.json`.
- `LICENSE` — MIT

All characters, places, dialogue and art are original. No Rockstar Games / GTA logo, artwork, font or audio is used.

## Test

```sh
node game/test.js   # headless autopilot: movement, collision, vehicles, wanted/police, all 8 missions
node main.ts        # copies game/ to /output + dossier.json
```
