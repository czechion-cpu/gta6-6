// SOLMAR BAY — people on foot: the player (Mara Voss) and pedestrians.
// Pedestrians stroll the sidewalks, pause at corners, and flee when a crime
// happens nearby. Rival gang members are pedestrians with a gun and a grudge.
import { WORLD, PLAYER_WALK, PLAYER_SPRINT, PLAYER_RADIUS, mulberry32, pick, range, clamp, dist, angleTo, angleDiff } from './config.js';
import { resolveBuildingCollision, nearestRoadCoord, isOnRoad } from './city.js';

const PED_COLORS = ['#e8b48a', '#c98d64', '#8a5a3b', '#f0c8a0', '#6b4a2f'];
const SHIRT_COLORS = ['#d95f4b', '#4b7fd9', '#4bd97a', '#d9c94b', '#9b4bd9', '#e8e8e8', '#3a3a3a', '#d94b8a'];
const NAMES = ['Rin', 'Dario', 'Sofia', 'Kip', 'Lena', 'Marco', 'Ana', 'Tomas', 'Priya', 'Jonas', 'Mila', 'Omar'];

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    health: 100, maxHealth: 100,
    ammo: 24, ammoReserve: 96,
    inCar: null, // the car object when driving, else null
    onFoot: true,
    aimAngle: 0, shootCooldown: 0, reloadTimer: 0,
    invulnerable: 0, walkPhase: 0, moving: false,
    name: 'Mara Voss',
  };
}

export function createPedestrian(rng, x, y) {
  const vertical = rng() < 0.5;
  const road = nearestRoadCoord(vertical ? x : y);
  return {
    x, y, angle: rng() * Math.PI * 2,
    speed: 28 + rng() * 30,
    targetX: x, targetY: y,
    waitTimer: range(rng, 0, 3),
    fleeing: false, fleeTimer: 0,
    color: pick(rng, PED_COLORS),
    shirt: pick(rng, SHIRT_COLORS),
    name: pick(rng, NAMES),
    walkPhase: rng() * 6,
    radius: 11,
    rival: false, health: 50, shootTimer: 0,
    dead: false,
  };
}

export function spawnPedestrians(rng, city, count, centreX, centreY) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard < count * 40) {
    guard += 1;
    const x = centreX + range(rng, -700, 700);
    const y = centreY + range(rng, -700, 700);
    if (x < 40 || y < 40 || x > WORLD - 40 || y > WORLD - 40) continue;
    if (isOnRoad(x, y)) continue; // pedestrians belong on sidewalks, not the road
    if (city.buildings.some((b) => x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - 6 && y < b.y + b.h + 6)) continue;
    out.push(createPedestrian(rng, x, y));
  }
  return out;
}

export function makeRival(rng, x, y) {
  const p = createPedestrian(rng, x, y);
  p.rival = true;
  p.health = 60;
  p.shirt = '#7a1f1f';
  p.speed = 95;
  return p;
}

// --- player movement on foot ---------------------------------------------
export function updatePlayerOnFoot(player, input, dt, city, onCrime) {
  let mx = 0, my = 0;
  if (input.held.up) my -= 1;
  if (input.held.down) my += 1;
  if (input.held.left) mx -= 1;
  if (input.held.right) mx += 1;
  const moving = mx !== 0 || my !== 0;
  player.moving = moving;
  if (moving) {
    const len = Math.hypot(mx, my);
    const speed = input.held.sprint ? PLAYER_SPRINT : PLAYER_WALK;
    player.x += (mx / len) * speed * dt;
    player.y += (my / len) * speed * dt;
    player.angle = Math.atan2(my, mx);
    player.walkPhase += dt * (input.held.sprint ? 13 : 9);
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  resolveBuildingCollision(city, player, PLAYER_RADIUS);
  player.x = clamp(player.x, 24, WORLD - 24);
  player.y = clamp(player.y, 24, WORLD - 24);
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.reloadTimer > 0) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) {
      const need = 24 - player.ammo;
      const take = Math.min(need, player.ammoReserve);
      player.ammo += take; player.ammoReserve -= take;
    }
  }
  if (player.invulnerable > 0) player.invulnerable -= dt;
  return moving;
}

// --- pedestrians ----------------------------------------------------------
export function updatePedestrians(peds, dt, city, player, crime) {
  // crime: {x, y, radius, active} — a fresh crime makes nearby peds flee.
  for (const p of peds) {
    if (p.dead) continue;
    p.walkPhase += dt * 7;
    if (crime && crime.active && dist(p.x, p.y, crime.x, crime.y) < crime.radius) {
      p.fleeing = true; p.fleeTimer = 3 + Math.random() * 2;
    }
    if (p.fleeing) {
      p.fleeTimer -= dt;
      const away = angleTo(crime ? crime.x : player.x, crime ? crime.y : player.y, p.x, p.y);
      p.angle = away;
      p.x += Math.cos(away) * p.speed * 2.4 * dt;
      p.y += Math.sin(away) * p.speed * 2.4 * dt;
      if (p.fleeTimer <= 0) p.fleeing = false;
      resolveBuildingCollision(city, p, p.radius);
      continue;
    }
    if (p.rival) continue; // rivals are steered by missions.js
    if (p.waitTimer > 0) {
      p.waitTimer -= dt;
      if (p.waitTimer <= 0) {
        // Pick a new stroll target along a nearby sidewalk.
        const vertical = Math.random() < 0.5;
        const road = nearestRoadCoord(vertical ? p.x : p.y);
        const along = clamp((vertical ? p.y : p.x) + (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 260), 60, WORLD - 60);
        const off = (Math.random() < 0.5 ? -1 : 1) * (44 + Math.random() * 10);
        p.targetX = vertical ? road + off : along;
        p.targetY = vertical ? along : road + off;
      }
      continue;
    }
    const d = dist(p.x, p.y, p.targetX, p.targetY);
    if (d < 8) { p.waitTimer = 0.5 + Math.random() * 2.5; continue; }
    const a = angleTo(p.x, p.y, p.targetX, p.targetY);
    p.angle += angleDiff(p.angle, a) * Math.min(1, dt * 6);
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    resolveBuildingCollision(city, p, p.radius);
  }
}

// A car (or the player on foot) hitting a pedestrian: knock them down.
export function hitPedestrian(p, fromX, fromY) {
  if (p.dead) return false;
  p.dead = true;
  return true;
}
