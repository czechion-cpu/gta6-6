// SOLMAR BAY — cars: parked cars, traffic AI driving the road grid, and
// the player's driving. Traffic follows lanes, slows for the car ahead,
// turns at intersections, and honks when blocked. Cars take damage, smoke
// when wrecked, and leave skid marks when they brake hard or turn fast.
import { WORLD, CAR_MAX_SPEED, CAR_ACCEL, CAR_BRAKE, CAR_REVERSE_MAX, mulberry32, pick, range, clamp, dist, angleDiff } from './config.js';
import { ROAD_LINES, randomRoadPoint, buildingHit, resolveBuildingCollision, isOnRoad } from './city.js';

export const CAR_COLORS = ['#d94b4b', '#4b7fd9', '#e8c84b', '#4bd97a', '#e8e8e8', '#3a3a4a', '#d97a2b', '#7a4bd9', '#2b9aa8', '#c0c8d0'];
const CAR_NAMES = ['Harbor GT', 'Sunset Coupe', 'Bay Runner', 'Coral Sedan', 'Pier Cruiser', 'Dune Buggy', 'Marina Van', 'Solstice'];
export const CAR_W = 46;
export const CAR_H = 22;

let nextCarId = 1;

export function makeCar(rng, x, y, angle, opts) {
  const o = opts || {};
  return {
    id: nextCarId += 1,
    x, y, angle,
    speed: 0,
    color: o.color || pick(rng, CAR_COLORS),
    name: o.name || pick(rng, CAR_NAMES),
    parked: !!o.parked,
    traffic: !!o.traffic,
    police: !!o.police,
    stolen: false,
    health: 100,
    smoking: false,
    wrecked: false,
    // traffic AI state
    cruise: 130 + rng() * 90,
    turnCooldown: 0,
    stuckTimer: 0,
    honkTimer: 0,
    driver: !o.parked,
    angleTarget: angle,
  };
}

export function spawnTraffic(rng, city, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(rng);
    cars.push(makeCar(rng, p.x, p.y, p.angle, { traffic: true }));
  }
  return cars;
}

export function spawnParkedCars(rng, city, count) {
  const cars = [];
  const spots = city.parkingSpots.slice();
  for (let i = 0; i < count && spots.length > 0; i += 1) {
    const s = spots.splice(Math.floor(rng() * spots.length), 1)[0];
    cars.push(makeCar(rng, s.x, s.y, s.angle, { parked: true }));
  }
  // A few extra parked cars along the beach road.
  for (let i = 0; i < 4; i += 1) {
    cars.push(makeCar(rng, 2060, 300 + i * 420, Math.PI / 2, { parked: true }));
  }
  return cars;
}

// --- collision between two cars (circle-ish, using their centres) --------
function carsOverlap(a, b) {
  return dist(a.x, a.y, b.x, b.y) < 42;
}

// --- player driving --------------------------------------------------------
export function updatePlayerCar(car, input, dt, city, allCars, onCrash) {
  const throttle = (input.held.up ? 1 : 0) - (input.held.down ? 1 : 0);
  const steer = (input.held.left ? -1 : 0) + (input.held.right ? 1 : 0);
  let skidding = false;
  if (throttle > 0) car.speed += CAR_ACCEL * dt;
  else if (throttle < 0) {
    if (car.speed > 20) car.speed -= CAR_BRAKE * dt; // brake
    else car.speed -= CAR_ACCEL * 0.55 * dt; // reverse
    skidding = car.speed > 60;
  } else {
    car.speed -= Math.sign(car.speed) * 140 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CAR_REVERSE_MAX, CAR_MAX_SPEED);
  const steerAmount = steer * 2.1 * dt * clamp(Math.abs(car.speed) / 120, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steerAmount;
  if (Math.abs(steer) > 0 && Math.abs(car.speed) > 300) skidding = true;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Building collision: stop and take damage.
  if (buildingHit(city, nx, ny, 20)) {
    if (Math.abs(car.speed) > 160) {
      car.health -= Math.abs(car.speed) * 0.06;
      if (onCrash) onCrash(Math.abs(car.speed));
    }
    car.speed *= -0.25;
  } else {
    car.x = nx; car.y = ny;
  }
  car.x = clamp(car.x, 24, WORLD - 24);
  car.y = clamp(car.y, 24, WORLD - 24);
  // Bump other cars.
  for (const other of allCars) {
    if (other === car || other.wrecked) continue;
    if (carsOverlap(car, other)) {
      const d = dist(car.x, car.y, other.x, other.y) || 1;
      const push = (42 - d) / 2;
      const ux = (other.x - car.x) / d, uy = (other.y - car.y) / d;
      other.x += ux * push; other.y += uy * push;
      car.x -= ux * push * 0.4; car.y -= uy * push * 0.4;
      if (Math.abs(car.speed) > 140) {
        car.health -= 4; other.health -= 6;
        if (onCrash) onCrash(Math.abs(car.speed));
        car.speed *= 0.55;
      }
    }
  }
  if (car.health <= 0) { car.health = 0; car.wrecked = true; car.speed = 0; }
  car.smoking = car.health < 45;
  return skidding;
}

// --- traffic AI -------------------------------------------------------------
export function updateTraffic(car, dt, city, allCars, playerCar) {
  if (car.wrecked) { car.speed *= 0.9; return; }
  if (car.parked) return;
  car.turnCooldown -= dt;
  // At an intersection, sometimes turn onto the crossing road.
  const onV = ROAD_LINES.some((r) => Math.abs(car.x - r) < 10);
  const onH = ROAD_LINES.some((r) => Math.abs(car.y - r) < 10);
  if (onV && onH && car.turnCooldown <= 0 && Math.random() < 0.012) {
    const vertical = Math.abs(Math.cos(car.angle)) < 0.5;
    const choices = vertical ? [0, Math.PI] : [Math.PI / 2, -Math.PI / 2];
    car.angleTarget = choices[Math.floor(Math.random() * choices.length)];
    car.turnCooldown = 4 + Math.random() * 4;
  }
  // Steer toward the target angle, snap to the lane centre.
  const diff = angleDiff(car.angle, car.angleTarget);
  car.angle += clamp(diff, -1.6 * dt, 1.6 * dt);
  // Slow for a car ahead.
  let blocked = false;
  for (const other of allCars) {
    if (other === car) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 70 && side < 26) { blocked = true; break; }
  }
  const targetSpeed = blocked ? 0 : car.cruise;
  car.speed += clamp(targetSpeed - car.speed, -260 * dt, 150 * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!buildingHit(city, nx, ny, 20)) { car.x = nx; car.y = ny; }
  else { car.angleTarget = car.angle + Math.PI / 2; car.turnCooldown = 2; }
  car.x = clamp(car.x, 24, WORLD - 24);
  car.y = clamp(car.y, 24, WORLD - 24);
  if (car.health <= 0) { car.wrecked = true; car.speed = 0; }
  car.smoking = car.health < 45;
}

// Nearest car to a point within radius (for E to enter).
export function nearestCar(cars, x, y, radius) {
  let best = null, bd = radius;
  for (const c of cars) {
    if (c.wrecked) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
