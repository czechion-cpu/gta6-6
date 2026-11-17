// SOLMAR BAY — the wanted system and the Solmar Bay Police Department.
// Crimes raise heat; heat sets the star level; stars decide how many police
// cars and officers chase the player. Stay out of sight and the heat cools.
// Get caught on foot, or lose all health, and it is over: BUSTED / WASTED.
import { WORLD, mulberry32, pick, clamp, dist, angleTo, angleDiff, range } from './config.js';
import { makeCar, CAR_W } from './vehicles.js';
import { createPedestrian } from './entities.js';

export const MAX_WANTED = 5;

export function createWanted() {
  return {
    stars: 0,
    heat: 0, // 0..100, continuous; stars are bands of heat
    hiddenTimer: 0, // seconds since last seen by police
    bustedTimer: 0,
    message: '',
    messageTimer: 0,
  };
}

export function addHeat(wanted, amount, message) {
  wanted.heat = clamp(wanted.heat + amount, 0, 100);
  wanted.stars = heatToStars(wanted.heat);
  wanted.hiddenTimer = 0;
  if (message) { wanted.message = message; wanted.messageTimer = 2.5; }
}

export function heatToStars(heat) {
  if (heat < 12) return 0;
  if (heat < 28) return 1;
  if (heat < 45) return 2;
  if (heat < 62) return 3;
  if (heat < 82) return 4;
  return 5;
}

export function setWanted(wanted, stars) {
  wanted.stars = clamp(stars, 0, MAX_WANTED);
  wanted.heat = [0, 15, 32, 50, 68, 88][wanted.stars];
  wanted.hiddenTimer = 0;
}

// How many police units the current star level fields.
export function policeQuota(stars) {
  return [0, 1, 2, 3, 4, 5][clamp(stars, 0, 5)];
}

export function createPolice() {
  return {
    cars: [], // police cars (vehicles.js car objects, police: true)
    officers: [], // on-foot police (pedestrian-like)
    spawnTimer: 0,
    sirenOn: false,
  };
}

function spawnPoliceCar(rng, player) {
  // Appear on a road a little ahead of the player, in the direction of travel.
  const a = Math.random() * Math.PI * 2;
  const d = 620 + Math.random() * 260;
  let x = clamp(player.x + Math.cos(a) * d, 80, WORLD - 80);
  let y = clamp(player.y + Math.sin(a) * d, 80, WORLD - 80);
  // Snap to the nearest road line so they arrive on tarmac.
  const lines = [150, 450, 750, 1050, 1350, 1650, 1950];
  let best = lines[0], bd = Infinity;
  for (const r of lines) { const dd = Math.abs(x - r); if (dd < bd) { bd = dd; best = r; } }
  x = best + 14;
  const car = makeCar(rng, x, y, angleTo(x, y, player.x, player.y), { police: true, color: '#1c2f4a', name: 'SBPD Cruiser' });
  car.cruise = 300;
  car.speed = 200;
  return car;
}

function spawnOfficer(rng, player) {
  const a = Math.random() * Math.PI * 2;
  const x = clamp(player.x + Math.cos(a) * 420, 60, WORLD - 60);
  const y = clamp(player.y + Math.sin(a) * 420, 60, WORLD - 60);
  const o = createPedestrian(rng, x, y);
  o.shirt = '#1c2f4a';
  o.speed = 150;
  o.rival = false;
  return o;
}

// Chase AI: police cars ram the player's car or, on foot, close in until
// they can bust the player. Returns 'busted' when an officer catches the
// player on foot, else null.
export function updatePolice(police, wanted, dt, rng, player, playerCar, city, onRam) {
  const quota = policeQuota(wanted.stars);
  police.spawnTimer -= dt;
  if (wanted.stars > 0 && police.cars.length < quota && police.spawnTimer <= 0) {
    police.cars.push(spawnPoliceCar(rng, player));
    police.spawnTimer = 3.5;
  }
  if (wanted.stars > 0 && wanted.stars >= 2 && police.officers.length < Math.min(2, wanted.stars - 1) && police.spawnTimer <= -1.5) {
    police.officers.push(spawnOfficer(rng, player));
    police.spawnTimer = 3.5;
  }
  // Wanted decays only while no police unit is near the player.
  const anyNear = police.cars.some((c) => dist(c.x, c.y, player.x, player.y) < 420)
    || police.officers.some((o) => dist(o.x, o.y, player.x, player.y) < 300);
  if (wanted.stars > 0) {
    if (anyNear) wanted.hiddenTimer = 0;
    else {
      wanted.hiddenTimer += dt;
      if (wanted.hiddenTimer > 6) {
        wanted.heat = Math.max(0, wanted.heat - dt * 3.2);
        const s = heatToStars(wanted.heat);
        if (s < wanted.stars) wanted.stars = s;
      }
    }
  }
  if (wanted.messageTimer > 0) wanted.messageTimer -= dt;

  // Police cars: chase and ram.
  for (const car of police.cars) {
    const target = playerCar || player;
    const d = dist(car.x, car.y, target.x, target.y);
    const wantAngle = angleTo(car.x, car.y, target.x, target.y);
    car.angle += clamp(angleDiff(car.angle, wantAngle), -2.6 * dt, 2.6 * dt);
    const targetSpeed = d > 60 ? 330 + wanted.stars * 28 : 120;
    car.speed += clamp(targetSpeed - car.speed, -320 * dt, 260 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 24, WORLD - 24);
    car.y = clamp(car.y, 24, WORLD - 24);
    if (d < 46) {
      // Ram: shove the player's car and damage it.
      if (playerCar) {
        playerCar.health -= 6 * dt * 10 * 0.1;
        playerCar.speed *= 0.94;
        playerCar.x += Math.cos(car.angle) * 26 * dt * 4;
        playerCar.y += Math.sin(car.angle) * 26 * dt * 4;
        if (onRam) onRam();
      } else {
        player.health -= 14 * dt;
      }
      car.speed *= 0.6;
    }
    if (car.health <= 0) { car.wrecked = true; car.speed = 0; }
  }
  police.cars = police.cars.filter((c) => !c.wrecked || dist(c.x, c.y, player.x, player.y) < 900);
  // Officers on foot: run at the player; touch = busted.
  for (const o of police.officers) {
    const d = dist(o.x, o.y, player.x, player.y);
    if (playerCar) {
      // Officers cannot catch a car: they give up and walk back to the road.
      o.x += Math.cos(o.angle) * 40 * dt;
      continue;
    }
    const a = angleTo(o.x, o.y, player.x, player.y);
    o.angle = a;
    o.x += Math.cos(a) * o.speed * dt;
    o.y += Math.sin(a) * o.speed * dt;
    o.walkPhase += dt * 11;
    if (d < 26) return 'busted';
  }
  // When wanted clears, police drive off (despawn far away).
  if (wanted.stars === 0) {
    police.cars = police.cars.filter((c) => dist(c.x, c.y, player.x, player.y) < 700);
    police.officers = [];
  }
  return null;
}

export function clearPolice(police) {
  police.cars = [];
  police.officers = [];
}
