// SOLMAR BAY — drawing only: the city, the people, the cars, the effects,
// and the menu screens. The camera follows the player; the world is drawn
// in world coordinates, the HUD (hud.js) draws in screen coordinates.
import { WORLD, VIEW_W, VIEW_H, ROAD_WIDTH, clamp, dist } from './config.js';
import { ROAD_LINES, COAST_X, OCEAN_X, isOnRoad } from './city.js';
import { CAR_W, CAR_H } from './vehicles.js';
import { MARKERS, missionMarker, currentObjective } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_HOWTO = 'howto';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, w: VIEW_W, h: VIEW_H };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    canvas.width = w; canvas.height = h;
    view.scale = Math.min(w / VIEW_W, h / VIEW_H);
    view.x = (w - VIEW_W * view.scale) / 2;
    view.y = (h - VIEW_H * view.scale) / 2;
    view.w = w / view.scale; view.h = h / view.scale;
  }
  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? weight + ' ' : ''}${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }
  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

  // --- the world -----------------------------------------------------------
  function drawGround(world, cam) {
    // Grass base.
    rect(cam.x - 40, cam.y - 40, cam.w + 80, cam.h + 80, '#7fae62');
    // Sand strip and ocean on the east edge.
    rect(COAST_X, cam.y - 40, OCEAN_X - COAST_X, cam.h + 80, '#e8d29a');
    rect(OCEAN_X, cam.y - 40, WORLD - OCEAN_X + 80, cam.h + 80, '#2f7fb8');
    // Ocean waves.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    const t = world.time;
    for (let y = Math.floor(cam.y / 90) * 90; y < cam.y + cam.h; y += 90) {
      ctx.beginPath();
      for (let x = OCEAN_X + 8; x < WORLD; x += 24) {
        const yy = y + Math.sin(x * 0.05 + t * 1.4 + y) * 4;
        if (x === OCEAN_X + 8) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // Pier (wooden planks out into the ocean at y=1200).
    rect(2100, 1170, 240, 60, '#8a6a44');
    ctx.strokeStyle = '#6b4f30'; ctx.lineWidth = 2;
    for (let x = 2120; x < 2340; x += 22) { ctx.beginPath(); ctx.moveTo(x, 1170); ctx.lineTo(x, 1230); ctx.stroke(); }
    // Sidewalks + roads.
    for (const r of ROAD_LINES) {
      rect(r - ROAD_WIDTH / 2 - 14, cam.y - 40, ROAD_WIDTH + 28, cam.h + 80, '#b9b3a4');
      rect(cam.x - 40, r - ROAD_WIDTH / 2 - 14, cam.w + 80, ROAD_WIDTH + 28, '#b9b3a4');
      rect(r - ROAD_WIDTH / 2, cam.y - 40, ROAD_WIDTH, cam.h + 80, '#3c3f45');
      rect(cam.x - 40, r - ROAD_WIDTH / 2, cam.w + 80, ROAD_WIDTH, '#3c3f45');
    }
    // Road centre dashes.
    ctx.strokeStyle = '#e8d44d'; ctx.lineWidth = 3; ctx.setLineDash([22, 26]);
    for (const r of ROAD_LINES) {
      ctx.beginPath(); ctx.moveTo(r, Math.max(cam.y, 0)); ctx.lineTo(r, Math.min(cam.y + cam.h, WORLD)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(Math.max(cam.x, 0), r); ctx.lineTo(Math.min(cam.x + cam.w, WORLD), r); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Parks.
    for (const p of world.city.parks) {
      rect(p.x, p.y, p.w, p.h, '#5d9e4a');
      rect(p.x + 10, p.y + 10, p.w - 20, p.h - 20, '#6fb457');
      text(p.name, p.x + p.w / 2, p.y + p.h / 2, 15, 'rgba(255,255,255,0.85)', 'center');
      // Pond in the first park.
      if (p.x === 480) { ctx.fillStyle = '#4a90c2'; ctx.beginPath(); ctx.ellipse(p.x + 70, p.y + 150, 46, 28, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function drawBuildings(world, cam) {
    for (const b of world.city.buildings) {
      if (b.x > cam.x + cam.w || b.x + b.w < cam.x || b.y > cam.y + cam.h || b.y + b.h < cam.y) continue;
      // Soft shadow offset to the south-east.
      rect(b.x + 6, b.y + 8, b.w, b.h, 'rgba(0,0,0,0.18)');
      rect(b.x, b.y, b.w, b.h, b.color);
      // Roof lip.
      rect(b.x + 5, b.y + 5, b.w - 10, b.h - 10, b.roof);
      rect(b.x + 9, b.y + 9, b.w - 18, b.h - 18, b.color);
      // Windows.
      ctx.fillStyle = world.sunset ? '#ffd98a' : '#cfe8f5';
      for (let f = 0; f < b.floors; f += 1) {
        for (let w = 0; w < b.windows; w += 1) {
          const wx = b.x + 12 + w * ((b.w - 24) / Math.max(1, b.windows));
          const wy = b.y + 14 + f * ((b.h - 28) / Math.max(1, b.floors));
          if (wx + 14 < b.x + b.w - 8 && wy + 12 < b.y + b.h - 8) ctx.fillRect(wx, wy, 13, 11);
        }
      }
      if (b.height === 2) { rect(b.x + b.w * 0.3, b.y + b.h * 0.25, b.w * 0.4, b.h * 0.35, b.roof); }
    }
    // Street signs.
    for (const s of world.city.signs) {
      if (s.x < cam.x || s.x > cam.x + cam.w || s.y < cam.y || s.y > cam.y + cam.h) continue;
      rect(s.x, s.y, 4, 26, '#5a5a5a');
      rect(s.x - 26, s.y - 6, 56, 16, '#2f6db3');
      text(s.text, s.x + 2, s.y + 6, 8, '#fff', 'center');
    }
    // Lamps.
    for (const l of world.city.lamps) {
      if (l.x < cam.x || l.x > cam.x + cam.w || l.y < cam.y || l.y > cam.y + cam.h) continue;
      rect(l.x, l.y, 3, 14, '#444');
      circle(l.x + 1, l.y - 2, 5, world.sunset ? '#ffe9a8' : '#f5f5d0');
    }
    // Trees (round canopy + trunk; palms on the beach).
    for (const t of world.city.trees) {
      if (t.x < cam.x - 30 || t.x > cam.x + cam.w + 30 || t.y < cam.y - 30 || t.y > cam.y + cam.h + 30) continue;
      circle(t.x + 2, t.y + 3, t.r, 'rgba(0,0,0,0.15)');
      rect(t.x - 2, t.y, 4, 10, '#6b4a2f');
      circle(t.x, t.y - 4, t.r, t.palm ? '#3f9e4d' : '#2f7a3a');
      circle(t.x - t.r * 0.4, t.y - t.r * 0.5, t.r * 0.55, '#4cb35a');
    }
  }

  function drawSkids(world) {
    ctx.strokeStyle = 'rgba(20,20,20,0.35)';
    ctx.lineWidth = 4;
    for (const s of world.skids) {
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }
  }

  function drawCarShape(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-CAR_W / 2 + 3, -CAR_H / 2 + 4, CAR_W, CAR_H);
    ctx.fillStyle = car.police ? '#e8e8e8' : car.color;
    ctx.beginPath();
    ctx.roundRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 6);
    ctx.fill();
    if (car.police) {
      ctx.fillStyle = '#1c2f4a';
      ctx.fillRect(-6, -CAR_H / 2, 12, CAR_H);
      ctx.fillStyle = '#d94b4b'; ctx.fillRect(-16, -CAR_H / 2 + 2, 8, 5);
      ctx.fillStyle = '#4b7fd9'; ctx.fillRect(-16, CAR_H / 2 - 7, 8, 5);
      if (Math.floor(car.x / 30 + Date.now() / 260) % 2 === 0) { ctx.fillStyle = 'rgba(255,60,60,0.9)'; ctx.fillRect(-14, -CAR_H / 2 - 4, 10, 4); }
      else { ctx.fillStyle = 'rgba(80,140,255,0.9)'; ctx.fillRect(-14, -CAR_H / 2 - 4, 10, 4); }
    }
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(30,40,55,0.85)';
    ctx.fillRect(-8, -CAR_H / 2 + 4, 16, CAR_H - 8);
    ctx.fillStyle = 'rgba(180,220,240,0.8)';
    ctx.fillRect(8, -CAR_H / 2 + 5, 6, CAR_H - 10);
    // Wheels.
    ctx.fillStyle = '#161616';
    ctx.fillRect(-CAR_W / 2 + 4, -CAR_H / 2 - 3, 10, 4);
    ctx.fillRect(-CAR_W / 2 + 4, CAR_H / 2 - 1, 10, 4);
    ctx.fillRect(CAR_W / 2 - 14, -CAR_H / 2 - 3, 10, 4);
    ctx.fillRect(CAR_W / 2 - 14, CAR_H / 2 - 1, 10, 4);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(CAR_W / 2 - 2, -CAR_H / 2 + 3, 3, 5);
    ctx.fillRect(CAR_W / 2 - 2, CAR_H / 2 - 8, 3, 5);
    ctx.restore();
    if (car.smoking) {
      circle(car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, 8 + Math.random() * 4, 'rgba(120,120,120,0.5)');
    }
    if (car.health < 45) {
      text('!', car.x, car.y - 26, 16, '#ff5a4b', 'center', 'bold');
    }
  }

  function drawPerson(p, isPlayer) {
    ctx.save();
    ctx.translate(p.x, p.y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(2, 4, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(p.angle);
    const bob = Math.sin(p.walkPhase) * 2;
    // Legs (two small steps).
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(-4 + bob, -7, 8, 5);
    ctx.fillRect(-4 - bob, 2, 8, 5);
    // Body.
    ctx.fillStyle = p.rival ? '#7a1f1f' : p.shirt;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    // Head.
    ctx.fillStyle = p.color || '#e8b48a';
    ctx.beginPath(); ctx.arc(7, 0, 6, 0, Math.PI * 2); ctx.fill();
    if (isPlayer) {
      // Mara: dark jacket + red cap.
      ctx.fillStyle = '#22242e';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d94b4b';
      ctx.beginPath(); ctx.arc(7, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d94b4b';
      ctx.fillRect(9, -5, 6, 3);
    }
    if (p.rival) {
      ctx.fillStyle = '#222';
      ctx.fillRect(8, -3, 12, 3); // gun barrel
    }
    ctx.restore();
    if (p.rival && !p.dead) {
      // Health bar over rivals.
      rect(p.x - 14, p.y - 26, 28, 4, '#333');
      rect(p.x - 14, p.y - 26, 28 * Math.max(0, p.health / 60), 4, '#e84b4b');
    }
    if (p.dead) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(0.6);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-12, -4, 24, 8);
      ctx.restore();
    }
  }

  function drawBullets(world) {
    for (const b of world.bullets) {
      ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); ctx.stroke();
      circle(b.x, b.y, 2, '#fff');
    }
  }

  function drawParticles(world) {
    for (const p of world.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      circle(p.x, p.y, p.size * a + 1, p.color);
    }
    ctx.globalAlpha = 1;
  }

  function drawMarker(world, cam) {
    const m = missionMarker(world.missions);
    if (!m) return;
    const pulse = 1 + Math.sin(world.time * 4) * 0.15;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,63,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(10, -14); ctx.lineTo(-10, -14); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Vault hold circle for mission 5.
    if (world.missions.active && world.missions.active.def.id === 5 && world.missions.active.step === 0) {
      ctx.strokeStyle = 'rgba(255,210,63,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(MARKERS.vault.x, MARKERS.vault.y, 80, 0, Math.PI * 2); ctx.stroke();
      const a = world.missions.active;
      ctx.fillStyle = 'rgba(255,210,63,0.35)';
      ctx.beginPath(); ctx.moveTo(MARKERS.vault.x, MARKERS.vault.y);
      ctx.arc(MARKERS.vault.x, MARKERS.vault.y, 80, -Math.PI / 2, -Math.PI / 2 + (a.holdTimer / 8) * Math.PI * 2);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawAim(world, cam) {
    const player = world.player;
    if (player.inCar || world.mode !== 'play') return;
    const m = world.mouseScreen;
    const wx = cam.x + m.x / view.scale - view.x / view.scale;
    const wy = cam.y + m.y / view.scale - view.y / view.scale;
    // Crosshair at the mouse position in world space.
    const sx = (wx - cam.x) * view.scale + view.x;
    const sy = (wy - cam.y) * view.scale + view.y;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx - 13, sy); ctx.lineTo(sx - 5, sy); ctx.moveTo(sx + 5, sy); ctx.lineTo(sx + 13, sy);
    ctx.moveTo(sx, sy - 13); ctx.lineTo(sx, sy - 5); ctx.moveTo(sx, sy + 5); ctx.lineTo(sx, sy + 13); ctx.stroke();
    ctx.restore();
  }

  // --- menu screens ---------------------------------------------------------
  function panel(title, lines, prompt, accent) {
    const w = 640;
    const h = 150 + lines.length * 32;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.fillStyle = 'rgba(10,14,22,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || '#ffd23f'; ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    text(title, VIEW_W / 2, y + 62, 44, accent || '#ffd23f', 'center', 'bold');
    lines.forEach((line, i) => text(line, VIEW_W / 2, y + 108 + i * 32, 19, '#e8ecf2', 'center'));
    if (prompt) text(prompt, VIEW_W / 2, y + h - 26, 20, '#ffd23f', 'center');
  }

  function drawTitle(world, best) {
    // A painted backdrop: the city at sunset behind the title.
    drawWorld(world, { x: 900, y: 900, w: VIEW_W, h: VIEW_H }, true);
    ctx.fillStyle = 'rgba(8,10,18,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text('SOLMAR BAY', VIEW_W / 2, 190, 84, '#ffd23f', 'center', 'bold');
    text('An open-world crime story  •  A sun-soaked coastal city', VIEW_W / 2, 232, 22, '#ffffff', 'center');
    const done = world.missions.done;
    const lines = [
      `Mara Voss, driver-for-hire. Five jobs from fixer Delia Kross.`,
      done > 0 ? `Progress: ${done} of 5 missions complete  •  $${world.money} in the bank` : 'No jobs done yet — the city is waiting.',
      best > 0 ? `Best bank balance: $${best}` : '',
      'WASD walk • Shift sprint • E enter / steal a car • Click shoot • R reload',
      'M start next mission • Esc pause • H how to play • M mute sound',
    ];
    panel('', lines, 'Press Enter or click to play', '#ffd23f');
    text('SOLMAR BAY is an original game. No characters, places or art from any other game.', VIEW_W / 2, VIEW_H - 24, 14, 'rgba(255,255,255,0.6)', 'center');
  }

  // --- main world draw -------------------------------------------------------
  function drawWorld(world, cam, backdropOnly) {
    const shakeX = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
    const shakeY = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
    ctx.save();
    ctx.translate(-cam.x + shakeX, -cam.y + shakeY);
    drawGround(world, cam);
    drawSkids(world);
    drawBuildings(world, cam);
    drawMarker(world, cam);
    for (const car of world.cars) {
      if (car.x < cam.x - 80 || car.x > cam.x + cam.w + 80 || car.y < cam.y - 80 || car.y > cam.y + cam.h + 80) continue;
      drawCarShape(car, car === world.player.inCar);
    }
    for (const car of world.police.cars) drawCarShape(car, false);
    for (const p of world.peds) {
      if (p.x < cam.x - 40 || p.x > cam.x + cam.w + 40 || p.y < cam.y - 40 || p.y > cam.y + cam.h + 40) continue;
      drawPerson(p, false);
    }
    for (const o of world.police.officers) drawPerson(o, false);
    const player = world.player;
    if (!player.inCar) drawPerson(player, true);
    drawBullets(world);
    drawParticles(world);
    // Sunset wash over everything.
    if (world.sunset) {
      ctx.fillStyle = 'rgba(255,140,60,0.10)';
      ctx.fillRect(cam.x - 40, cam.y - 40, cam.w + 80, cam.h + 80);
    }
    ctx.restore();
    if (!backdropOnly) drawAim(world, cam);
  }

  function draw(world, screen, best) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0e16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = view.scale;
    ctx.setTransform(scale, 0, 0, scale, view.x, view.y);
    if (screen === SCREEN_TITLE) { drawTitle(world, best); return; }
    const cam = world.camera;
    drawWorld(world, cam, false);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8,10,18,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      panel('Paused', ['The city waits for no one — except right now.', 'Esc / P resume  •  H how to play  •  M mute'], 'Press Esc to resume');
    } else if (screen === SCREEN_HOWTO) {
      ctx.fillStyle = 'rgba(8,10,18,0.72)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      panel('How to play', [
        'WASD / arrows — walk or drive. Shift — sprint.',
        'E — enter a car, or steal a parked one (raises wanted).',
        'Mouse — aim. Click — shoot. R — reload. M — mute.',
        'Gold ! marker — walk close and press E, or press M, to start a job.',
        'Stars — the police. Lay low and they cool off. Get caught: BUSTED.',
        'Five jobs, $500 to $5,000. Finish them all and own Solmar Bay.',
      ], 'Press Esc to go back');
    } else if (screen === SCREEN_OVER) {
      ctx.fillStyle = 'rgba(8,10,18,0.65)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      const busted = world.overReason === 'busted';
      panel(busted ? 'BUSTED' : 'WASTED', [
        busted ? 'The SBPD caught up with Mara Voss.' : 'Mara Voss is down. Solmar Bay moves on.',
        `Money kept: $${world.money}  •  Missions done: ${world.missions.done} of 5`,
        world.money > best ? 'New best bank balance!' : `Best bank balance: $${best}`,
      ], 'Press Enter to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
