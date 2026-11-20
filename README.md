# Solmar Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rektPanda/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rektPanda/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) — the most complete open-world crime game in the spirit of GTA 6. Referral: https://make.fun/r/1e8h8xtg

A 2D top-down open-world crime story, 100% original: Solmar City, Rico, and
Dante the fixer. No real places, no borrowed names, no borrowed assets.

## Story

Rico is broke in Solmar City. Dante the fixer has four jobs that add up to
$1,500 — if the cops don't take it all back first.

1. **Wheels ($150)** — steal any car and deliver it to the Garage.
2. **The Pickup ($300)** — grab the package at the Docks, deliver it to the
   Safehouse.
3. **Heat ($250)** — the same run, but the buyer tipped off the cops.
4. **The Big Score ($800)** — take the cash from Solmar Central Bank and
   bring it home.

Finish all four and the city is yours — free roam, keep the money.

## Controls

| Key / Mouse | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Mouse | Aim |
| Click | Shoot (pistol, 12 rounds) |
| R | Reload |
| E | Enter / exit / steal a car |
| H | Horn |

Stealing, shooting, and hitting people raise your wanted level (0–5 stars).
Police chase, ram, and bust you. Busted or wasted: −$150, goods lost, back
to the Safehouse. Wanted fades after 20 s without a crime, one star every
8 s. Progress saves automatically — Continue picks up where you left off.

## Play

Open `game/index.html` in a desktop browser. No install, no network, no
account. Sound is synthesized in the browser (WebAudio); there are no audio
files.

## Tech

Plain ES modules, no libraries, no build step. `main.ts` (Node 22, stdlib
only) copies `game/` + `screenshots/` to `/output` and writes
`/output/dossier.json` via the vendored make.fun library.
