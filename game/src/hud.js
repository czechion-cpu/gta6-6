// SOLMAR BAY — the HUD: wanted stars, health, money, ammo, speed, clock,
// mission objective banner, controls hint, and the minimap (top-right:
// roads, the player arrow, cars, police, and the mission marker).
import { WORLD, VIEW_W, VIEW_H, clamp } from './config.js';
import { ROAD_LINES } from './city.js';
import { missionMarker, currentObjective } from './missions.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MAP_SIZE = 208;
const MAP_SCALE = MAP_SIZE / WORLD;

export function drawHud(ctx, world) {
  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? weight + ' ' : ''}${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }
  const player = world.player;
  const wanted = world.wanted;

  // --- top-left: wanted stars + health ------------------------------------
  for (let i = 0; i < 5; i += 1) {
    const x = 24 + i * 30;
    const y = 34;
    ctx.fillStyle = i < wanted.stars ? '#ffd23f' : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    for (let k = 0; k < 5; k += 1) {
      const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
      const r = k === 0 ? 13 : 13;
      const px = x + Math.cos(a) * 12, py = y + Math.sin(a) * 12;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      const a2 = a + Math.PI / 5;
      ctx.lineTo(x + Math.cos(a2) * 5, y + Math.sin(a2) * 5);
    }
    ctx.closePath(); ctx.fill();
  }
  if (wanted.stars > 0 && wanted.messageTimer > 0) {
    text(wanted.message, 24, 66, 15, '#ff8a7a', 'left', 'bold');
  }
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(20, 74, 184, 18);
  ctx.fillStyle = player.health > 40 ? '#4bd97a' : '#e84b4b';
  ctx.fillRect(22, 76, 180 * clamp(player.health / 100, 0, 1), 14);
  text('HEALTH', 24, 68, 12, '#fff', 'left', 'bold');
  text(`${Math.ceil(player.health)}`, 210, 89, 14, '#fff', 'left');

  // --- top-left below health: money + ammo ---------------------------------
  text(`$${Math.round(world.money)}`, 24, 124, 30, '#7dff9a', 'left', 'bold');
  if (!player.inCar) {
    text(`AMMO ${player.ammo} / ${player.ammoReserve}`, 24, 148, 16, '#fff', 'left');
    if (player.reloadTimer > 0) text('RELOADING…', 150, 148, 16, '#ffd23f', 'left', 'bold');
  } else {
    const car = player.inCar;
    text(`${car.name}`, 24, 148, 16, '#fff', 'left');
    text(`CAR ${Math.ceil(car.health)}%`, 24, 170, 16, car.health > 40 ? '#fff' : '#ff8a7a', 'left');
  }

  // --- bottom-left: speed + clock ------------------------------------------
  const speed = player.inCar ? Math.abs(player.inCar.speed) * 0.12 : player.speed * 0.12;
  text(`${Math.round(speed)}`, 24, VIEW_H - 52, 40, '#fff', 'left', 'bold');
  text(player.inCar ? 'KM/H' : 'ON FOOT', 24, VIEW_H - 28, 14, 'rgba(255,255,255,0.75)', 'left');
  const totalMin = Math.floor(world.clock / 60);
  const hh = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
  const ss = String(totalMin % 60).padStart(2, '0');
  text(`${hh}:${ss}  ${world.sunset ? 'SUNSET' : 'DAY'}`, 130, VIEW_H - 40, 16, '#fff', 'left');

  // --- bottom-centre: controls hint -----------------------------------------
  text('WASD move/drive  •  E enter car / start job  •  Click shoot  •  R reload  •  M mute  •  Esc pause', VIEW_W / 2, VIEW_H - 14, 13, 'rgba(255,255,255,0.65)', 'center');

  // --- top-centre: mission banner + objective -------------------------------
  const missions = world.missions;
  if (missions.bannerTimer > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const bw = 520;
    ctx.fillRect((VIEW_W - bw) / 2, 16, bw, 40);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.strokeRect((VIEW_W - bw) / 2, 16, bw, 40);
    text(missions.banner, VIEW_W / 2, 44, 22, '#ffd23f', 'center', 'bold');
  }
  const objective = currentObjective(missions);
  if (objective) {
    const y = missions.bannerTimer > 0 ? 78 : 30;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(VIEW_W / 2 - 300, y - 18, 600, 28);
    text(`◆ ${missions.active.def.title}: ${objective}`, VIEW_W / 2, y + 3, 16, '#fff', 'center');
    if (missions.active.def.id === 4) text(`${Math.ceil(missions.active.timer)}s`, VIEW_W / 2 + 320, y + 3, 18, '#ff8a7a', 'left', 'bold');
    if (missions.active.def.id === 5 && missions.active.step === 0) text(`${Math.floor(missions.active.holdTimer)} / 8s`, VIEW_W / 2 + 320, y + 3, 18, '#ffd23f', 'left', 'bold');
  } else if (missions.done < 5) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(VIEW_W / 2 - 260, 12, 520, 28);
    text('Next job: follow the gold !  •  press E at the marker to start', VIEW_W / 2, 32, 15, '#ffd23f', 'center');
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(VIEW_W / 2 - 260, 12, 520, 28);
    text('All five jobs done — Solmar Bay is yours.', VIEW_W / 2, 32, 15, '#7dff9a', 'center');
  }
  if (missions.toastTimer > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const tw = 640;
    ctx.fillRect((VIEW_W - tw) / 2, VIEW_H - 84, tw, 30);
    text(missions.toast, VIEW_W / 2, VIEW_H - 63, 15, '#fff', 'center');
  }

  // --- minimap (top-right) ---------------------------------------------------
  const mx = VIEW_W - MAP_SIZE - 16;
  const my = 16;
  ctx.fillStyle = 'rgba(8,12,20,0.85)';
  ctx.fillRect(mx - 4, my - 4, MAP_SIZE + 8, MAP_SIZE + 8);
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
  ctx.strokeRect(mx - 4, my - 4, MAP_SIZE + 8, MAP_SIZE + 8);
  ctx.save();
  ctx.beginPath(); ctx.rect(mx, my, MAP_SIZE, MAP_SIZE); ctx.clip();
  // Grass base, then ocean + sand on the east edge.
  ctx.fillStyle = '#7fae62'; ctx.fillRect(mx, my, MAP_SIZE, MAP_SIZE);
  ctx.fillStyle = '#2f7fb8'; ctx.fillRect(mx + 2260 * MAP_SCALE, my, MAP_SIZE, MAP_SIZE);
  ctx.fillStyle = '#e8d29a'; ctx.fillRect(mx + 2100 * MAP_SCALE, my, MAP_SIZE - 2100 * MAP_SCALE, MAP_SIZE);
  ctx.fillStyle = '#3c3f45';
  for (const r of ROAD_LINES) {
    ctx.fillRect(mx + (r - 32) * MAP_SCALE, my, 64 * MAP_SCALE, MAP_SIZE);
    ctx.fillRect(mx, my + (r - 32) * MAP_SCALE, MAP_SIZE, 64 * MAP_SCALE);
  }
  ctx.fillStyle = '#5d9e4a';
  for (const p of world.city.parks) ctx.fillRect(mx + p.x * MAP_SCALE, my + p.y * MAP_SCALE, p.w * MAP_SCALE, p.h * MAP_SCALE);
  // Mission marker.
  const mm = missionMarker(missions);
  if (mm) {
    const pulse = 1 + Math.sin(world.time * 4) * 0.2;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(mx + mm.x * MAP_SCALE, my + mm.y * MAP_SCALE, 6 * pulse, 0, Math.PI * 2); ctx.fill();
  }
  // Cars (white), police (blue/red), player (arrow).
  for (const car of world.cars) {
    ctx.fillStyle = car.police ? '#4b8aff' : 'rgba(255,255,255,0.85)';
    ctx.fillRect(mx + car.x * MAP_SCALE - 2, my + car.y * MAP_SCALE - 2, 4, 4);
  }
  for (const car of world.police.cars) {
    ctx.fillStyle = '#ff4b4b';
    ctx.fillRect(mx + car.x * MAP_SCALE - 2, my + car.y * MAP_SCALE - 2, 4, 4);
  }
  const px = mx + player.x * MAP_SCALE;
  const py = my + player.y * MAP_SCALE;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  text('SOLMAR BAY', mx + MAP_SIZE / 2, my + MAP_SIZE + 20, 12, 'rgba(255,255,255,0.8)', 'center', 'bold');

  // Mute indicator.
  if (world.muted) text('MUTED (M)', VIEW_W - 24, VIEW_H - 14, 13, 'rgba(255,255,255,0.6)', 'right');
}
