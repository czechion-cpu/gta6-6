// SOLMAR BAY — the story: five missions for Mara Voss, a driver-for-hire
// pulled into the city's underworld by fixer Delia Kross. Each mission is a
// small state machine: go somewhere, do something, get out. Rewards in $.
// Missions start at the gold "!" marker (walk or drive close, press E) or
// with M. Progress is saved: missionsDone counts completed missions.
import { MISSION_REWARDS, dist, clamp } from './config.js';
import { makeRival } from './entities.js';
import { setWanted, addHeat } from './police.js';

export const MISSION_DEFS = [
  {
    id: 1, title: 'Get Wheels', reward: MISSION_REWARDS[0],
    briefing: 'Delia Kross needs a driver. First, prove it: steal any car and bring it to the garage on Marina Ave.',
    start: { x: 450, y: 450 },
    steps: [
      { key: 'steal', text: 'Steal a car (press E near a parked car)' },
      { key: 'deliver', text: 'Deliver the car to the garage on Marina Ave' },
    ],
  },
  {
    id: 2, title: 'The Pickup', reward: MISSION_REWARDS[1],
    briefing: 'A package is waiting under the pier. Grab it — and mind the patrol cars that show up after.',
    start: { x: 1950, y: 1200 },
    steps: [
      { key: 'collect', text: 'Collect the package at the pier' },
      { key: 'dropoff', text: 'Drop the package at Harbor Green' },
    ],
  },
  {
    id: 3, title: 'Dockside Trouble', reward: MISSION_REWARDS[2],
    briefing: 'The Coral Vipers jumped Delia\'s crew at the docks. Go down there and clear them out. Click to shoot.',
    start: { x: 150, y: 1950 },
    steps: [
      { key: 'arrive', text: 'Reach the dockside yard' },
      { key: 'clear', text: 'Take out the Coral Vipers' },
    ],
  },
  {
    id: 4, title: 'The Getaway', reward: MISSION_REWARDS[3],
    briefing: 'The job went loud. Lose the heat and reach the safehouse on Sunset Ave before the clock runs out.',
    start: { x: 1050, y: 750 },
    steps: [
      { key: 'escape', text: 'Reach the safehouse — 90 seconds, wanted level 3' },
    ],
  },
  {
    id: 5, title: 'Bay Heist', reward: MISSION_REWARDS[4],
    briefing: 'The big one: the Bay Trust vault on Coral Ave. Hold the vault for 8 seconds, then run for the pier. Every cop in Solmar Bay will be on you.',
    start: { x: 750, y: 750 },
    steps: [
      { key: 'rob', text: 'Hold the vault (stay in the gold circle)' },
      { key: 'flee', text: 'Escape to the end of the pier' },
    ],
  },
];

// Marker positions used by the objectives (world coordinates).
export const MARKERS = {
  garage: { x: 450, y: 330 },
  pierPackage: { x: 2180, y: 1200 },
  dropoff: { x: 1500, y: 1800 },
  docks: { x: 210, y: 1980 },
  safehouse: { x: 1350, y: 1050 },
  vault: { x: 750, y: 640 },
  pierEnd: { x: 2320, y: 1200 },
};

export function createMissionState(missionsDone) {
  return {
    active: null, // {def, step, timer, holdTimer, rivals, collected}
    done: missionsDone || 0,
    banner: '',
    bannerTimer: 0,
    toast: '',
    toastTimer: 0,
  };
}

export function nextMissionIndex(state) {
  return state.done < MISSION_DEFS.length ? state.done : -1;
}
export function nextMissionDef(state) {
  const i = nextMissionIndex(state);
  return i >= 0 ? MISSION_DEFS[i] : null;
}
export function missionMarker(state) {
  if (state.active) {
    const def = state.active.def;
    const step = def.steps[state.active.step];
    if (def.id === 1) return state.active.step === 0 ? null : MARKERS.garage;
    if (def.id === 2) return state.active.step === 0 ? MARKERS.pierPackage : MARKERS.dropoff;
    if (def.id === 3) return MARKERS.docks;
    if (def.id === 4) return MARKERS.safehouse;
    if (def.id === 5) return state.active.step === 0 ? MARKERS.vault : MARKERS.pierEnd;
    return null;
  }
  const def = nextMissionDef(state);
  return def ? def.start : null;
}
export function currentObjective(state) {
  if (!state.active) return null;
  const def = state.active.def;
  return def.steps[state.active.step].text;
}

export function startMission(state, world, rng) {
  const def = nextMissionDef(state);
  if (!def) return false;
  const active = { def, step: 0, timer: 0, holdTimer: 0, rivals: [], collected: false, spawned: false };
  if (def.id === 4) { active.timer = 90; setWanted(world.wanted, 3); }
  if (def.id === 2) { active.timer = 0; }
  state.active = active;
  state.banner = def.title;
  state.bannerTimer = 3.5;
  state.toast = def.briefing;
  state.toastTimer = 6;
  return true;
}

export function failMission(state, reason) {
  if (!state.active) return;
  state.active = null;
  state.toast = `Mission failed: ${reason}`;
  state.toastTimer = 4;
}

export function completeMission(state, world) {
  const def = state.active.def;
  state.active = null;
  state.done += 1;
  world.money += def.reward;
  world.best = Math.max(world.best, world.money);
  state.banner = `Mission complete — $${def.reward}`;
  state.bannerTimer = 3.5;
  state.toast = def.id >= MISSION_DEFS.length
    ? 'That was the last job. Solmar Bay is yours, Mara.'
    : `Next job from Delia Kross is waiting at the gold marker.`;
  state.toastTimer = 5;
  return def.reward;
}

function advance(state) {
  state.active.step += 1;
  if (state.active.step >= state.active.def.steps.length) return true;
  return false;
}

// Called every step while a mission is active. `events` carries what just
// happened in the world (car stolen, package taken, rival shot...).
export function updateMission(state, world, dt, rng, events) {
  if (!state.active) return;
  const a = state.active;
  const def = a.def;
  const player = world.player;
  const px = player.x, py = player.y;
  if (state.bannerTimer > 0) state.bannerTimer -= dt;
  if (state.toastTimer > 0) state.toastTimer -= dt;

  if (def.id === 1) {
    if (a.step === 0 && events.carStolen) { if (advance(state)) completeMission(state, world); }
    else if (a.step === 1 && player.inCar && dist(px, py, MARKERS.garage.x, MARKERS.garage.y) < 70) {
      completeMission(state, world);
    }
  } else if (def.id === 2) {
    if (a.step === 0 && dist(px, py, MARKERS.pierPackage.x, MARKERS.pierPackage.y) < 55) {
      a.step = 1;
      setWanted(world.wanted, 2);
      state.toast = 'Package grabbed! Patrol cars are on you — get it to Harbor Green.';
      state.toastTimer = 4;
    } else if (a.step === 1 && dist(px, py, MARKERS.dropoff.x, MARKERS.dropoff.y) < 70) {
      completeMission(state, world);
    }
  } else if (def.id === 3) {
    if (a.step === 0 && dist(px, py, MARKERS.docks.x, MARKERS.docks.y) < 180) {
      a.step = 1;
      if (!a.spawned) {
        a.spawned = true;
        for (let i = 0; i < 4; i += 1) {
          const r = makeRival(rng, MARKERS.docks.x + (i - 1.5) * 90, MARKERS.docks.y - 60 + (i % 2) * 120);
          world.peds.push(r);
          a.rivals.push(r);
        }
        state.toast = 'Four Vipers. Clear them out.';
        state.toastTimer = 3;
      }
    } else if (a.step === 1) {
      const alive = a.rivals.filter((r) => !r.dead).length;
      if (a.spawned && alive === 0) completeMission(state, world);
    }
  } else if (def.id === 4) {
    a.timer -= dt;
    if (a.timer <= 0) { failMission(state, 'the clock ran out'); return; }
    if (dist(px, py, MARKERS.safehouse.x, MARKERS.safehouse.y) < 70) completeMission(state, world);
  } else if (def.id === 5) {
    if (a.step === 0) {
      if (dist(px, py, MARKERS.vault.x, MARKERS.vault.y) < 80) {
        a.holdTimer += dt;
        if (a.holdTimer >= 8) {
          a.step = 1;
          setWanted(world.wanted, 4);
          state.toast = 'Vault cracked! Run for the pier — every cop in the city is coming.';
          state.toastTimer = 4;
        }
      } else {
        a.holdTimer = Math.max(0, a.holdTimer - dt * 2);
      }
    } else if (a.step === 1) {
      a.timer += dt;
      if (a.timer > 150) { failMission(state, 'you took too long to escape'); return; }
      if (dist(px, py, MARKERS.pierEnd.x, MARKERS.pierEnd.y) < 70) completeMission(state, world);
    }
  }
}

// Rivals shoot back when the player is close during mission 3.
export function updateRivals(state, world, dt) {
  if (!state.active || state.active.def.id !== 3) return;
  const player = world.player;
  for (const r of state.active.rivals) {
    if (r.dead) continue;
    const d = dist(r.x, r.y, player.x, player.y);
    if (d < 520) {
      const a = Math.atan2(player.y - r.y, player.x - r.x);
      r.angle = a;
      if (d > 160) { r.x += Math.cos(a) * r.speed * dt; r.y += Math.sin(a) * r.speed * dt; }
      r.shootTimer -= dt;
      if (r.shootTimer <= 0 && d < 420 && player.invulnerable <= 0) {
        r.shootTimer = 1.1 + Math.random() * 0.7;
        if (Math.random() < 0.45) {
          if (player.inCar) player.inCar.health -= 3;
          else player.health -= 6;
          world.particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ffd23f', size: 4 });
        }
      }
    }
  }
}
