// SOLMAR BAY — deterministic staged scenes behind ?shot=cover|street|
// drive|mission (with &seed=N). Each scene builds the real game from a
// fixed seed, places the player, traffic and police by hand, and freezes the
// camera, so the same URL always renders the same frame for screenshots.
import { WORLD } from './config.js';
import { setWanted } from './police.js';
import { startMission } from './missions.js';
import { makeCar } from './vehicles.js';
import { mulberry32 } from './config.js';

export function stageShot(name, world) {
  const rng = mulberry32(world.seed + 101);
  const player = world.player;
  const cam = world.camera;
  // Reset the dynamic bits to a clean staged state.
  world.wanted.stars = 0; world.wanted.heat = 0;
  world.police.cars = []; world.police.officers = [];
  world.bullets = []; world.particles = [];
  world.missions.active = null;
  world.missions.bannerTimer = 0;
  world.missions.toastTimer = 0;
  world.sunset = name === 'cover' || name === 'mission';
  world.time = name === 'cover' ? 12 : 4;

  if (name === 'cover') {
    // Police chase in a car at wanted 3, minimap + mission HUD visible.
    const car = world.cars.find((c) => c.parked) || world.cars[0];
    car.parked = false; car.stolen = true; car.health = 82;
    player.inCar = car; player.x = 1050; player.y = 1050; car.x = 1050; car.y = 1050;
    car.angle = Math.PI / 2; car.speed = 380;
    setWanted(world.wanted, 3);
    for (let i = 0; i < 3; i += 1) {
      const pc = makeCar(rng, 1050 + (i - 1) * 70, 1050 - 150 - i * 60, Math.PI / 2, { police: true, color: '#1c2f4a', name: 'SBPD Cruiser' });
      pc.speed = 300;
      world.police.cars.push(pc);
    }
    // Three jobs already done, so the next job is mission 4, The Getaway.
    world.missions.done = 3;
    startMission(world.missions, world, rng);
    world.missions.banner = 'The Getaway';
    world.missions.bannerTimer = 99;
    world.missions.active.timer = 74;
    cam.x = 1050 - 640; cam.y = 1050 - 360;
  } else if (name === 'street') {
    // On foot downtown, traffic + pedestrians around.
    player.inCar = null; player.x = 750; player.y = 750; player.angle = 0.4;
    world.money = 1250;
    cam.x = 750 - 640; cam.y = 750 - 360;
  } else if (name === 'drive') {
    // Driving south on the coastal avenue (x=1950), beach + ocean on the right.
    const car = world.cars.find((c) => c.parked) || world.cars[0];
    car.parked = false; car.health = 96;
    player.inCar = car; player.x = 1950; player.y = 1050; car.x = 1950; car.y = 1050;
    car.angle = Math.PI / 2; car.speed = 420;
    world.money = 2100;
    cam.x = 1950 - 640; cam.y = 1050 - 360;
  } else if (name === 'mission') {
    // Mission 3 in progress: dockside shootout, objective + HUD visible.
    player.inCar = null; player.x = 300; player.y = 1900; player.angle = -0.5;
    player.ammo = 18;
    // Two jobs already done, so the next job is mission 3, Dockside Trouble.
    world.missions.done = 2;
    startMission(world.missions, world, rng);
    // Jump straight to the shootout step with rivals present.
    world.missions.active.step = 1;
    world.missions.active.spawned = true;
    importRivals(world, rng);
    world.missions.banner = 'Dockside Trouble';
    world.missions.bannerTimer = 99;
    world.money = 1750;
    cam.x = 300 - 640; cam.y = 1900 - 360;
  } else {
    // Unknown shot name: the street scene is the safe default.
    player.inCar = null; player.x = 750; player.y = 750;
    cam.x = 750 - 640; cam.y = 750 - 360;
  }
  // Clamp the camera inside the world and settle traffic near it.
  cam.x = Math.max(0, Math.min(WORLD - 1280, cam.x));
  cam.y = Math.max(0, Math.min(WORLD - 720, cam.y));
  // Nudge a few traffic cars into the frame so the street is alive.
  let placed = 0;
  for (const car of world.cars) {
    if (car === player.inCar || car.police) continue;
    if (placed < 5 && (car.x < cam.x - 50 || car.x > cam.x + 1330 || car.y < cam.y - 50 || car.y > cam.y + 770)) {
      const spots = [
        { x: cam.x + 220, y: cam.y + 330, a: 0 },
        { x: cam.x + 700, y: cam.y + 330, a: 0 },
        { x: cam.x + 1050, y: cam.y + 330, a: Math.PI },
        { x: cam.x + 460, y: cam.y + 560, a: Math.PI / 2 },
        { x: cam.x + 900, y: cam.y + 120, a: -Math.PI / 2 },
      ];
      const s = spots[placed];
      car.x = s.x; car.y = s.y; car.angle = s.a; car.parked = false; car.traffic = true; car.speed = 120;
      placed += 1;
    }
  }
  world.mode = 'play';
  return { screen: 'play' };
}

function importRivals(world, rng) {
  // Local import avoided (static imports only at top): rivals are built
  // here with the same shape makeRival produces, via the missions module's
  // own helper through the world's pedestrian list.
  const docks = { x: 210, y: 1980 };
  for (let i = 0; i < 4; i += 1) {
    const r = {
      x: docks.x + (i - 1.5) * 90, y: docks.y - 60 + (i % 2) * 120,
      angle: Math.PI, speed: 95, targetX: docks.x, targetY: docks.y,
      waitTimer: 0, fleeing: false, fleeTimer: 0,
      color: '#e8b48a', shirt: '#7a1f1f', name: 'Viper',
      walkPhase: i, radius: 11, rival: true, health: 60, shootTimer: 1, dead: false,
    };
    world.peds.push(r);
    world.missions.active.rivals.push(r);
  }
}
