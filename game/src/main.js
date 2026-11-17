// SOLMAR BAY — bootstrap + fixed-step game loop + state machine.
// Screens: title, play, paused, how-to, over (busted/wasted).
// ?seed=N fixes the city. ?shot=cover|street|drive|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { WORLD, VIEW_W, VIEW_H, mulberry32, clamp, dist, angleTo } from './config.js';
import { createCity, resolveBuildingCollision, isOnRoad, isInOcean } from './city.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_SHOOT, ACTION_MUTE, ACTION_RELOAD, ACTION_HORN } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayerOnFoot, updatePedestrians, spawnPedestrians, hitPedestrian } from './entities.js';
import { spawnTraffic, spawnParkedCars, updatePlayerCar, updateTraffic, nearestCar } from './vehicles.js';
import { createWanted, createPolice, addHeat, setWanted, updatePolice, clearPolice } from './police.js';
import { createMissionState, startMission, updateMission, updateRivals, missionMarker } from './missions.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_HOWTO } from './render.js';
import { drawHud } from './hud.js';
import { stageShot } from './shots.js';
import { loadSave, writeSave, loadBest, writeBest } from './save.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = mulberry32(seed);
const city = createCity(seed);
const audio = createAudio();
const saved = loadSave();

const world = {
  seed,
  city,
  time: 0,
  clock: 9 * 3600 + 14 * 60, // 09:14 game time
  sunset: false,
  mode: 'title',
  money: saved ? saved.money : 250,
  best: saved ? Math.max(saved.best, loadBest()) : loadBest(),
  player: createPlayer(750, 690),
  cars: [],
  peds: [],
  police: createPolice(),
  wanted: createWanted(),
  missions: createMissionState(saved ? saved.missionsDone : 0),
  bullets: [],
  particles: [],
  skids: [],
  camera: { x: 0, y: 0, w: VIEW_W, h: VIEW_H },
  shake: 0,
  overReason: null,
  muted: false,
  mouseScreen: { x: 640, y: 360 },
};

world.cars = [...spawnParkedCars(rng, city, 14), ...spawnTraffic(rng, city, 16)];
world.peds = spawnPedestrians(rng, city, 26, 1200, 1200);

const renderer = createRenderer(canvas);
const input = createInput(canvas);

function announce(message) { status.textContent = message; }

function saveNow() {
  writeSave({ money: world.money, missionsDone: world.missions.done, best: world.best });
  writeBest(world.best);
}

// Exposed for playtesting and debugging (read-only snapshot + a few
// sanctioned test hooks). Nothing here spends money or submits anything.
window.__SOLMAR = {
  get state() {
    const p = world.player;
    return {
      mode: world.mode, money: Math.round(world.money),
      player: { x: Math.round(p.x), y: Math.round(p.y), health: Math.round(p.health), ammo: p.ammo, inCar: !!p.inCar, speed: Math.round(p.inCar ? Math.abs(p.inCar.speed) : p.speed) },
      wanted: world.wanted.stars,
      mission: world.missions.active ? { id: world.missions.active.def.id, title: world.missions.active.def.title, step: world.missions.active.step } : null,
      missionsDone: world.missions.done,
      cars: world.cars.length, peds: world.peds.filter((x) => !x.dead).length,
      policeCars: world.police.cars.length,
    };
  },
  startMission(n) { if (n !== undefined) world.missions.done = n - 1; startMission(world.missions, world, rng); },
  setWanted(n) { setWanted(world.wanted, n); },
  teleport(x, y) { world.player.x = x; world.player.y = y; if (world.player.inCar) { world.player.inCar.x = x; world.player.inCar.y = y; } },
  begin() { startGame(); },
};

function resetWorld() {
  const keepMoney = world.money;
  const keepDone = world.missions.done;
  world.player = createPlayer(750, 690);
  world.cars = [...spawnParkedCars(rng, city, 14), ...spawnTraffic(rng, city, 16)];
  world.peds = spawnPedestrians(rng, city, 26, 1200, 1200);
  world.police = createPolice();
  world.wanted = createWanted();
  world.missions = createMissionState(keepDone);
  world.bullets = []; world.particles = []; world.skids = [];
  world.money = keepMoney;
  world.time = 0; world.clock = 9 * 3600 + 14 * 60; world.sunset = false;
  world.overReason = null; world.shake = 0;
}

function startGame() {
  resetWorld();
  world.mode = 'play';
  announce('Playing Solmar Bay. Mara Voss is on Marina Ave.');
}

function endGame(reason) {
  world.mode = 'over';
  world.overReason = reason;
  world.best = Math.max(world.best, Math.round(world.money));
  saveNow();
  audio.engine(0, false);
  audio.sirenStop();
  announce(reason === 'busted' ? 'Busted. Game over.' : 'Wasted. Game over.');
}

function spawnParticles(x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    world.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, max: 0.9, color, size: 2 + Math.random() * 3 });
  }
}

function shoot() {
  const player = world.player;
  if (player.inCar || player.shootCooldown > 0 || player.reloadTimer > 0) return;
  if (player.ammo <= 0) { player.reloadTimer = 1.4; return; }
  player.ammo -= 1;
  player.shootCooldown = 0.22;
  // Aim at the mouse: CSS pixels -> logical 1280x720 screen -> world space.
  const cam = world.camera;
  const dpr = window.devicePixelRatio || 1;
  const aimX = cam.x + (world.mouseScreen.x * dpr - renderer.view.x) / renderer.view.scale;
  const aimY = cam.y + (world.mouseScreen.y * dpr - renderer.view.y) / renderer.view.scale;
  const angle = angleTo(player.x, player.y, aimX, aimY);
  player.aimAngle = angle;
  const speed = 900;
  world.bullets.push({ x: player.x + Math.cos(angle) * 18, y: player.y + Math.sin(angle) * 18, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.9, fromPlayer: true });
  spawnParticles(player.x + Math.cos(angle) * 22, player.y + Math.sin(angle) * 22, '#ffd23f', 4, 120);
  audio.gunshot();
  world.shake = Math.max(world.shake, 3);
  addHeat(world.wanted, 6, 'Shots fired — the SBPD heard that.');
}

function enterOrExitCar() {
  const player = world.player;
  if (player.inCar) {
    const car = player.inCar;
    player.inCar = null;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    player.angle = car.angle;
    car.speed *= 0.2;
    audio.click();
    return;
  }
  // Near a mission marker? Start the next job instead of stealing.
  const marker = missionMarker(world.missions);
  if (!world.missions.active && marker && dist(player.x, player.y, marker.x, marker.y) < 90) {
    if (startMission(world.missions, world, rng)) { audio.cash(); saveNow(); }
    return;
  }
  const car = nearestCar(world.cars, player.x, player.y, 62);
  if (!car) return;
  const wasParked = car.parked;
  car.parked = false;
  car.traffic = false;
  player.inCar = car;
  player.x = car.x; player.y = car.y;
  if (wasParked && !car.stolen) {
    car.stolen = true;
    addHeat(world.wanted, 14, 'Car stolen — someone called it in.');
    spawnParticles(car.x, car.y, '#ff8a7a', 6, 90);
  }
  audio.click();
}

function step(dt) {
  const player = world.player;
  world.time += dt;
  world.clock += dt * 12; // game clock runs 12x real time
  world.sunset = (world.clock / 3600) % 24 >= 17.5 || (world.clock / 3600) % 24 < 6.5;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 22);

  // Mouse position (CSS pixels) for aiming.
  const m = input.mouse();
  world.mouseScreen = { x: m.x, y: m.y };

  // --- player --------------------------------------------------------------
  let crime = null;
  if (player.inCar) {
    const car = player.inCar;
    const before = car.health;
    const skidding = updatePlayerCar(car, input, dt, city, world.cars, (impact) => {
      audio.crash();
      world.shake = Math.max(world.shake, Math.min(10, impact / 60));
      spawnParticles(car.x, car.y, '#c8c8c8', 8, 160);
      if (impact > 300) addHeat(world.wanted, 4, '');
    });
    if (skidding && Math.abs(car.speed) > 120) {
      const bx = car.x - Math.cos(car.angle) * 20, by = car.y - Math.sin(car.angle) * 20;
      world.skids.push({ x1: bx, y1: by, x2: bx + Math.cos(car.angle) * 14, y2: by + Math.sin(car.angle) * 14 });
      if (world.skids.length > 220) world.skids.splice(0, world.skids.length - 220);
    }
    player.x = car.x; player.y = car.y; player.angle = car.angle;
    player.speed = Math.abs(car.speed);
    if (car.wrecked) {
      spawnParticles(car.x, car.y, '#888', 12, 140);
      player.inCar = null;
      player.x = car.x + 40; player.y = car.y + 40;
      player.health -= 15;
      world.missions.toast = 'Your car is wrecked. Find another one.';
      world.missions.toastTimer = 3;
    }
    audio.engine(Math.abs(car.speed) / 540, true);
    // Running over pedestrians in a car is a crime.
    for (const p of world.peds) {
      if (p.dead) continue;
      if (dist(p.x, p.y, car.x, car.y) < 30 && Math.abs(car.speed) > 60) {
        hitPedestrian(p, car.x, car.y);
        addHeat(world.wanted, 16, 'Pedestrian hit — the SBPD is on its way.');
        crime = { x: p.x, y: p.y, radius: 420, active: true };
        spawnParticles(p.x, p.y, '#e84b4b', 10, 120);
        audio.crash();
      }
    }
  } else {
    updatePlayerOnFoot(player, input, dt, city);
    audio.engine(0, false);
    // Bumping pedestrians on foot at sprint speed knocks them over.
    for (const p of world.peds) {
      if (p.dead) continue;
      if (dist(p.x, p.y, player.x, player.y) < 20 && input.held.sprint) {
        hitPedestrian(p, player.x, player.y);
        addHeat(world.wanted, 12, 'Pedestrian hit — the SBPD is on its way.');
        crime = { x: p.x, y: p.y, radius: 420, active: true };
      }
    }
  }

  // --- traffic, pedestrians, police -----------------------------------------
  for (const car of world.cars) {
    if (car === player.inCar) continue;
    updateTraffic(car, dt, city, world.cars, player.inCar);
  }
  // Keep the streets busy: respawn traffic that wandered far away.
  if (world.cars.filter((c) => c.traffic).length < 12) {
    const extra = spawnTraffic(rng, city, 1);
    world.cars.push(...extra);
  }
  if (world.peds.filter((p) => !p.dead).length < 16) {
    world.peds.push(...spawnPedestrians(rng, city, 4, player.x, player.y));
  }
  updatePedestrians(world.peds, dt, city, player, crime);
  updateRivals(world.missions, world, dt);
  const busted = updatePolice(world.police, world.wanted, dt, rng, player, player.inCar, city, () => {
    world.shake = Math.max(world.shake, 5);
    audio.crash();
  });
  if (busted === 'busted') { endGame('busted'); return; }
  if (world.wanted.stars > 0) audio.sirenStart(); else audio.sirenStop();

  // --- bullets ----------------------------------------------------------------
  for (const b of world.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    // Hit a rival?
    for (const p of world.peds) {
      if (!p.rival || p.dead) continue;
      if (dist(b.x, b.y, p.x, p.y) < 16) {
        p.health -= 34; b.life = 0;
        spawnParticles(p.x, p.y, '#e84b4b', 8, 130);
        if (p.health <= 0) { p.dead = true; spawnParticles(p.x, p.y, '#e84b4b', 16, 180); }
        break;
      }
    }
    // Hit a police car?
    for (const c of world.police.cars) {
      if (c.wrecked) continue;
      if (dist(b.x, b.y, c.x, c.y) < 24) {
        c.health -= 12; b.life = 0;
        addHeat(world.wanted, 5, '');
        spawnParticles(b.x, b.y, '#ffd23f', 5, 110);
        break;
      }
    }
    // Hit a building or left the world?
    if (b.life > 0 && city.buildings.some((bb) => b.x > bb.x && b.x < bb.x + bb.w && b.y > bb.y && b.y < bb.y + bb.h)) {
      b.life = 0;
      spawnParticles(b.x, b.y, '#c8c8c8', 4, 90);
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);

  // --- particles ---------------------------------------------------------------
  for (const p of world.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
  world.particles = world.particles.filter((p) => p.life > 0);

  // --- missions ------------------------------------------------------------------
  const events = { carStolen: !!player.inCar && player.inCar.stolen };
  const doneBefore = world.missions.done;
  updateMission(world.missions, world, dt, rng, events);
  if (world.missions.done > doneBefore) { audio.cash(); saveNow(); }

  // --- camera ----------------------------------------------------------------------
  const tx = clamp(player.x - VIEW_W / 2, 0, WORLD - VIEW_W);
  const ty = clamp(player.y - VIEW_H / 2, 0, WORLD - VIEW_H);
  world.camera.x += (tx - world.camera.x) * Math.min(1, dt * 6);
  world.camera.y += (ty - world.camera.y) * Math.min(1, dt * 6);

  // --- health / game over -------------------------------------------------------------
  if (player.health <= 0) { player.health = 0; endGame('wasted'); return; }
  if (player.inCar && player.inCar.health <= 0) { /* handled above */ }
}

function handleActions() {
  const actions = input.takeActions();
  if (actions & ACTION_CONFIRM) {
    audio.unlock();
    if (world.mode === 'title' || world.mode === 'over') startGame();
    else if (world.mode === 'howto') world.mode = 'paused';
  }
  if (actions & ACTION_PAUSE) {
    audio.unlock();
    if (world.mode === 'play') { world.mode = 'paused'; announce('Paused.'); }
    else if (world.mode === 'paused') { world.mode = 'play'; announce('Playing.'); }
    else if (world.mode === 'howto') { world.mode = 'paused'; }
  }
  if (world.mode !== 'play') return;
  if (actions & ACTION_ENTER) enterOrExitCar();
  if (actions & ACTION_SHOOT) shoot();
  if (actions & ACTION_MUTE) {
    world.muted = audio.toggleMute();
  }
  if (actions & ACTION_RELOAD) {
    const p = world.player;
    if (!p.inCar && p.ammo < 24 && p.ammoReserve > 0 && p.reloadTimer <= 0) p.reloadTimer = 1.4;
  }
  if (actions & ACTION_HORN) audio.horn();
}

let lastNow = 0;
let accumulator = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!lastNow) lastNow = now;
  accumulator += Math.min((now - lastNow) / 1000, MAX_FRAME);
  lastNow = now;
  handleActions();
  while (world.mode === 'play' && accumulator >= STEP) {
    step(STEP);
    accumulator -= STEP;
  }
  if (world.mode !== 'play') accumulator = 0;
  renderer.draw(world, world.mode === 'title' ? SCREEN_TITLE : world.mode === 'paused' ? SCREEN_PAUSED : world.mode === 'howto' ? SCREEN_HOWTO : world.mode === 'over' ? SCREEN_OVER : SCREEN_PLAY, world.best);
  if (world.mode === 'play' || world.mode === 'paused' || world.mode === 'howto' || world.mode === 'over') {
    // HUD draws in screen space on top of the world.
    const ctx = canvas.getContext('2d');
    ctx.save();
    const scale = renderer.view.scale;
    ctx.setTransform(scale, 0, 0, scale, renderer.view.x, renderer.view.y);
    if (world.mode === 'play') drawHud(ctx, world);
    ctx.restore();
  }
}

function runShot(name) {
  world.mode = 'play';
  stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, SCREEN_PLAY, world.best);
    const ctx = canvas.getContext('2d');
    ctx.save();
    const scale = renderer.view.scale;
    ctx.setTransform(scale, 0, 0, scale, renderer.view.x, renderer.view.y);
    drawHud(ctx, world);
    ctx.restore();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) {
  runShot(shot);
} else {
  document.addEventListener('keydown', (e) => {
    // H opens the how-to-play panel from pause, and closes it again.
    if (e.code === 'KeyH' && (world.mode === 'paused' || world.mode === 'howto')) {
      world.mode = world.mode === 'howto' ? 'paused' : 'howto';
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.mode === 'play') world.mode = 'paused';
  });
  announce('Solmar Bay. Press Enter or click to play.');
  requestAnimationFrame(frame);
}
