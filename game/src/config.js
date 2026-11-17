// SOLMAR BAY — shared tuning constants and the seeded random number
// generator. Every number that shapes how the city feels lives here so the
// rest of the game can stay about behaviour, not magic numbers.
export const WORLD = 2400; // world is WORLD x WORLD pixels
export const ROAD_SPACING = 300;
export const ROAD_WIDTH = 64;
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const PLAYER_WALK = 185;
export const PLAYER_SPRINT = 305;
export const PLAYER_RADIUS = 13;
export const CAR_MAX_SPEED = 540;
export const CAR_ACCEL = 420;
export const CAR_BRAKE = 620;
export const CAR_REVERSE_MAX = 190;

export const MISSION_REWARDS = [500, 800, 1200, 1500, 5000];
export const START_MONEY = 250;
export const START_AMMO = 24;

// Mulberry32 — small, fast, deterministic. The city, traffic and staged
// screenshots all draw from seeds built on this, so the same seed always
// builds the same Solmar Bay.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function range(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
// Shortest signed turn from angle a toward angle b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function lerp(a, b, t) { return a + (b - a) * t; }
