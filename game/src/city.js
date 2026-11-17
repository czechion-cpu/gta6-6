// SOLMAR BAY — the city itself. Seeded procedural generation: a road grid
// of avenues and streets, blocks filled with varied buildings, two parks, a
// beach and ocean on the east edge, a wooden pier, and street props. The
// same seed always builds the same city, so screenshots are reproducible.
import { WORLD, ROAD_SPACING, ROAD_WIDTH, mulberry32, pick, range, clamp } from './config.js';

export const ROAD_LINES = [150, 450, 750, 1050, 1350, 1650, 1950];
export const COAST_X = 2100; // sand starts here; ocean past 2260
export const OCEAN_X = 2260;

const BUILDING_COLORS = ['#c98f5f', '#b5764f', '#8fa3b8', '#a8b09a', '#d9b48a', '#7d8aa0', '#c4a484', '#9fb4c7', '#b89a7a', '#e0c9a6'];
const ROOF_COLORS = ['#5d4a3a', '#3e4a56', '#6b4a3f', '#4a5d4f', '#54423a'];
const PARK_NAMES = ['Palm Court Park', 'Harbor Green'];

export function createCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];
  const signs = [];
  const parks = [];
  const parkingSpots = [];

  // Parks: two green blocks.
  parks.push({ x: 480, y: 480, w: 236, h: 236, name: PARK_NAMES[0] });
  parks.push({ x: 1380, y: 1680, w: 236, h: 236, name: PARK_NAMES[1] });
  const inPark = (x, y) => parks.some((p) => x > p.x - 10 && x < p.x + p.w + 10 && y > p.y - 10 && y < p.y + p.h + 10);

  // Buildings fill every block that is not a park, not the beach strip and
  // not the dockside yard (south-west block kept open for mission 3).
  for (let bx = 0; bx < 7; bx += 1) {
    for (let by = 0; by < 7; by += 1) {
      const x0 = ROAD_LINES[bx] + ROAD_WIDTH / 2 + 8;
      const y0 = ROAD_LINES[by] + ROAD_WIDTH / 2 + 8;
      const w = ROAD_SPACING - ROAD_WIDTH - 16;
      const h = ROAD_SPACING - ROAD_WIDTH - 16;
      if (x0 > COAST_X - 100) continue;
      if (inPark(x0 + w / 2, y0 + h / 2)) continue;
      if (bx === 0 && by === 6) continue; // dockside yard, open ground
      const n = rng() < 0.45 ? 1 : 2;
      if (n === 1) {
        buildings.push(makeBuilding(rng, x0 + 14, y0 + 14, w - 28, h - 28));
      } else {
        const vertical = rng() < 0.5;
        if (vertical) {
          buildings.push(makeBuilding(rng, x0 + 12, y0 + 12, w / 2 - 16, h - 24));
          buildings.push(makeBuilding(rng, x0 + w / 2 + 4, y0 + 12, w / 2 - 16, h - 24));
        } else {
          buildings.push(makeBuilding(rng, x0 + 12, y0 + 12, w - 24, h / 2 - 16));
          buildings.push(makeBuilding(rng, x0 + 12, y0 + h / 2 + 4, w - 24, h / 2 - 16));
        }
      }
      // A tree or two on the block's sidewalk corner.
      if (rng() < 0.8) trees.push({ x: x0 + 6, y: y0 + 6, r: 9 + rng() * 5 });
      if (rng() < 0.6) trees.push({ x: x0 + w - 6, y: y0 + h - 6, r: 9 + rng() * 5 });
    }
  }
  // Park trees.
  for (const p of parks) {
    for (let i = 0; i < 9; i += 1) trees.push({ x: p.x + 24 + rng() * (p.w - 48), y: p.y + 24 + rng() * (p.h - 48), r: 10 + rng() * 6 });
  }
  // Beach palms along the sand.
  for (let y = 120; y < WORLD - 120; y += 130) {
    trees.push({ x: COAST_X + 40 + rng() * 60, y: y + rng() * 40, r: 11, palm: true });
  }
  // Lamps along every road, signs at a few intersections.
  for (const rx of ROAD_LINES) {
    for (const ry of ROAD_LINES) {
      lamps.push({ x: rx + ROAD_WIDTH / 2 + 6, y: ry - ROAD_WIDTH / 2 - 6 });
      if ((rx + ry) % 600 === 0) signs.push({ x: rx - ROAD_WIDTH / 2 - 4, y: ry + ROAD_WIDTH / 2 + 4, text: streetName(rx, ry) });
    }
  }
  // Curbside parking spots on a few avenues (where parked cars spawn).
  for (const rx of [450, 1050, 1650]) {
    for (const ry of [450, 1050, 1650, 1950]) {
      parkingSpots.push({ x: rx + 26, y: ry + 60, angle: Math.PI / 2 });
      parkingSpots.push({ x: rx - 26, y: ry - 60, angle: -Math.PI / 2 });
    }
  }

  function makeBuilding(r, x, y, w, h) {
    const tall = r() < 0.3;
    return {
      x, y, w, h,
      color: pick(r, BUILDING_COLORS),
      roof: pick(r, ROOF_COLORS),
      height: tall ? 2 : 1, // storeys, drawn as a taller roof lip
      windows: Math.max(2, Math.floor(w / 34)),
      floors: Math.max(2, Math.floor(h / 46)),
      lit: r() < 0.5,
    };
  }

  return { buildings, trees, lamps, signs, parks, parkingSpots, seed };
}

function streetName(rx, ry) {
  const avenues = ['Marina Ave', 'Coral Ave', 'Palm Ave', 'Bayview Ave', 'Sunset Ave', 'Harbor Ave', 'Coast Ave'];
  const streets = ['1st St', '2nd St', '3rd St', '4th St', '5th St', '6th St', '7th St'];
  const ai = Math.round((rx - 150) / 300);
  const si = Math.round((ry - 150) / 300);
  return `${avenues[clamp(ai, 0, 6)]} & ${streets[clamp(si, 0, 6)]}`;
}

export function isOnRoad(x, y) {
  if (x > COAST_X) return false;
  for (const r of ROAD_LINES) {
    if (Math.abs(x - r) < ROAD_WIDTH / 2 || Math.abs(y - r) < ROAD_WIDTH / 2) return true;
  }
  return false;
}
export function isInOcean(x, y) { return x > OCEAN_X; }
export function isOnSand(x, y) { return x > COAST_X && x <= OCEAN_X; }
// Circle (x,y,r) blocked by any building? Returns the building or null.
export function buildingHit(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
// Push a circle out of buildings and the world edge; returns true if moved.
export function resolveBuildingCollision(city, obj, r) {
  let moved = false;
  for (const b of city.buildings) {
    const nx = clamp(obj.x, b.x, b.x + b.w);
    const ny = clamp(obj.y, b.y, b.y + b.h);
    const dx = obj.x - nx, dy = obj.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.01) {
      const d = Math.sqrt(d2);
      obj.x = nx + (dx / d) * r; obj.y = ny + (dy / d) * r; moved = true;
    } else if (d2 <= 0.01 && obj.x > b.x && obj.x < b.x + b.w && obj.y > b.y && obj.y < b.y + b.h) {
      // Centre inside the building: push out along the smallest overlap.
      const left = obj.x - b.x, right = b.x + b.w - obj.x, top = obj.y - b.y, bottom = b.y + b.h - obj.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) obj.x = b.x - r; else if (m === right) obj.x = b.x + b.w + r;
      else if (m === top) obj.y = b.y - r; else obj.y = b.y + b.h + r;
      moved = true;
    }
  }
  const before = obj.x; obj.x = clamp(obj.x, 20, WORLD - 20); if (obj.x !== before) moved = true;
  const by = obj.y; obj.y = clamp(obj.y, 20, WORLD - 20); if (obj.y !== by) moved = true;
  return moved;
}
// Nearest road-line coordinate (for snapping traffic / pedestrians to a lane).
export function nearestRoadCoord(v) {
  let best = ROAD_LINES[0], bd = Infinity;
  for (const r of ROAD_LINES) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
  return best;
}
// Random point on a road, for spawning traffic.
export function randomRoadPoint(rng) {
  const vertical = rng() < 0.5;
  const line = pick(rng, ROAD_LINES);
  const along = 80 + rng() * (WORLD - 160);
  const lane = (rng() < 0.5 ? -1 : 1) * 14;
  return vertical ? { x: line + lane, y: along, angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 } : { x: along, y: line + lane, angle: rng() < 0.5 ? 0 : Math.PI };
}
export function roadPointAt(lineIndex, along, laneOffset, vertical) {
  const line = ROAD_LINES[lineIndex];
  return vertical ? { x: line + laneOffset, y: along } : { x: along, y: line + laneOffset };
}
