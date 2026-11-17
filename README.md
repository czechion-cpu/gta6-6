# SOLMAR BAY

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/czechion-cpu/gta6-6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/czechion-cpu/gta6-6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the browser. You are **Mara Voss**, a
driver-for-hire in **Solmar Bay**, a sun-soaked coastal city of avenues,
parks, a beach and a pier. Take five jobs from fixer **Delia Kross** — steal
a car, run a pickup, clear the docks, outrun the law, and pull the Bay Heist
— while the Solmar Bay Police Department watches your every move.

## What is in the game

- **A city to explore** — a 2400×2400 seeded procedural world: a road grid
  of avenues and streets, varied buildings, two parks, a beach, the ocean
  and a wooden pier. Same seed, same city.
- **On foot and by car** — walk, sprint, steal parked cars, and drive with
  traffic AI that follows the roads, turns at intersections and slows for
  the car ahead. Cars take damage, smoke, and leave skid marks.
- **Wanted level 0–5** — stealing, hitting pedestrians and shooting raise
  the heat. Police cruisers chase and ram; officers on foot will bust you.
  Lay low and the heat cools off. Get caught and it is BUSTED; lose all
  health and it is WASTED.
- **Combat** — a pistol with mouse aim, ammo and reloads, muzzle flash and
  rival gang members who shoot back.
- **Five story missions** — Get Wheels ($500), The Pickup ($800), Dockside
  Trouble ($1,200), The Getaway ($1,500) and the Bay Heist ($5,000), with
  dialogue, objectives, a waypoint arrow, a map marker and a timer where
  it matters. Progress is saved.
- **HUD + minimap** — wanted stars, health, money, ammo, speed, game clock,
  mission banner, and a live minimap with roads, cars, police and the
  mission marker.
- **Menus and save** — title screen, pause, how-to-play, game over, and a
  localStorage save (money, missions, best balance).
- **Procedural sound** — WebAudio only: engine hum, sirens, gunshots,
  crashes, pickup blips and UI clicks. No audio files. M mutes.
- **Polish** — particles, screen shake, day/sunset lighting, shadows and a
  sunset wash over the whole city.

## How to run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no
network requests — every file is local.

## Controls

| Key | Action |
| --- | ------ |
| WASD / arrows | Walk / drive |
| Shift | Sprint |
| E | Enter or exit a car · steal a parked car · start a job at the gold `!` marker |
| Mouse + click | Aim and shoot |
| R | Reload |
| M | Mute / unmute |
| Esc / P | Pause |
| H | How to play (from pause) |
| Enter / click | Start / restart |

## Structure

- `game/index.html` — the page, loads the ES modules, nothing else.
- `game/src/main.js` — bootstrap, fixed-step loop, state machine.
- `game/src/config.js` — tuning constants and the seeded RNG.
- `game/src/city.js` — procedural city generation and collision.
- `game/src/entities.js` — the player and pedestrians.
- `game/src/vehicles.js` — cars, traffic AI, driving physics.
- `game/src/police.js` — wanted level and police AI.
- `game/src/missions.js` — the five-mission story chain.
- `game/src/render.js` — world and menu drawing.
- `game/src/hud.js` — HUD and minimap.
- `game/src/audio.js` — procedural WebAudio sounds.
- `game/src/input.js` — keyboard and mouse input.
- `game/src/shots.js` — deterministic staged scenes for screenshots.
- `game/src/save.js` — localStorage save / load.
- `main.ts` — the entrypoint that copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json`.

Everything in this game — the city, characters, story, art and sounds — is
original. No names, characters, places or art from any other game.

---
<sub>Entered on [make.fun](https://make.fun/?ref=g437m30w&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
