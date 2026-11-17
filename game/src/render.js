// Rendering: the city, entities, HUD with minimap, menus and overlays.
// Top-down, sun-soaked palette; everything is drawn, no images.
import { WORLD, ROAD_CENTERS, ROAD_W, VIEW_W, VIEW_H, PALETTE, LANDMARKS, BUST_FINE, blockRect } from './config.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const l = car.len, w = car.wid;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, -l / 2 + 3, -w / 2 + 4, l, w, 7);
  ctx.fill();
  ctx.fillStyle = car.color;
  roundRect(ctx, -l / 2, -w / 2, l, w, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,24,32,0.85)';
  roundRect(ctx, -l * 0.18, -w / 2 + 3, l * 0.32, w - 6, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, -l * 0.18, -w / 2 + 3, l * 0.32, 4, 2);
  ctx.fill();
  // Headlights + tail lights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(l / 2 - 2, -w / 2 + 3, 3, 5);
  ctx.fillRect(l / 2 - 2, w / 2 - 8, 3, 5);
  ctx.fillStyle = car.brakeLight ? '#ff2e2e' : '#a33';
  ctx.fillRect(-l / 2 - 1, -w / 2 + 3, 3, 5);
  ctx.fillRect(-l / 2 - 1, w / 2 - 8, 3, 5);
  if (car.driver === 'police') {
    const on = Math.floor(car.flash / 0.45) % 2 === 0;
    ctx.fillStyle = on ? '#ff3b30' : '#3b82ff';
    ctx.fillRect(-6, -w / 2 - 1, 7, 5);
    ctx.fillStyle = on ? '#3b82ff' : '#ff3b30';
    ctx.fillRect(-6, w / 2 - 4, 7, 5);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-l / 2 + 6, -w / 2 + 2, l - 12, 3);
  }
  ctx.restore();
}

export function drawWorld(ctx, S) {
  const cam = S.cam;
  const vx0 = cam.x - VIEW_W / 2 - 60, vx1 = cam.x + VIEW_W / 2 + 60;
  const vy0 = cam.y - VIEW_H / 2 - 60, vy1 = cam.y + VIEW_H / 2 + 60;
  ctx.save();
  ctx.translate(VIEW_W / 2 - cam.x, VIEW_H / 2 - cam.y);

  // Ground + south beach and sea.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  if (vy1 > 3480) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(vx0, 3480, vx1 - vx0, 120);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(vx0, 3555, vx1 - vx0, 45);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let x = 40; x < WORLD; x += 130) {
      if (x < vx0 - 60 || x > vx1 + 60) continue;
      ctx.beginPath();
      ctx.moveTo(x, 3568 + Math.sin((x + S.time * 30) * 0.01) * 3);
      ctx.lineTo(x + 46, 3568 + Math.sin((x + S.time * 30) * 0.01) * 3);
      ctx.stroke();
    }
  }

  // Sidewalks (wider, lighter) then asphalt.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const c of ROAD_CENTERS) {
    ctx.fillRect(0, c - ROAD_W / 2 - 12, WORLD, ROAD_W + 24);
    ctx.fillRect(c - ROAD_W / 2 - 12, 0, ROAD_W + 24, WORLD);
  }
  ctx.fillStyle = PALETTE.asphalt;
  for (const c of ROAD_CENTERS) {
    ctx.fillRect(0, c - ROAD_W / 2, WORLD, ROAD_W);
    ctx.fillRect(c - ROAD_W / 2, 0, ROAD_W, WORLD);
  }
  // Lane dashes.
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const c of ROAD_CENTERS) {
    ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(WORLD, c); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, WORLD); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at visible intersections only.
  ctx.fillStyle = 'rgba(232,227,200,0.75)';
  for (const cx of ROAD_CENTERS) {
    if (cx < vx0 - 60 || cx > vx1 + 60) continue;
    for (const cy of ROAD_CENTERS) {
      if (cy < vy0 - 60 || cy > vy1 + 60) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(cx - 34 + i * 10, cy - ROAD_W / 2 - 8, 5, 14);
        ctx.fillRect(cx - 34 + i * 10, cy + ROAD_W / 2 - 6, 5, 14);
      }
    }
  }

  // Parks.
  for (const [name, def] of Object.entries(LANDMARKS)) {
    if (name !== 'park') continue;
    const r = blockRect(def.bx, def.by);
    ctx.fillStyle = PALETTE.parkGrass;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  // Trees (visible ones only).
  for (const t of S.city.trees) {
    if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
    ctx.fillStyle = '#4d7a35';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6da34e';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.7, 0, Math.PI * 2); ctx.fill();
  }

  // Buildings with a fake height shadow + roof detail (visible ones only).
  for (const b of S.city.buildings) {
    if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = PALETTE.buildingEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
    if (b.label) {
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      // Dark outline first so the name stays readable over any roof colour.
      ctx.strokeStyle = 'rgba(20,20,24,0.9)';
      ctx.lineWidth = 4;
      ctx.strokeText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
  }

  // Cash pickups.
  for (const pk of S.pickups) {
    const pulse = 1 + Math.sin(S.time * 5) * 0.15;
    ctx.fillStyle = 'rgba(216,197,106,0.35)';
    ctx.beginPath(); ctx.arc(pk.x, pk.y, 26 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath(); ctx.arc(pk.x, pk.y, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', pk.x, pk.y + 5);
  }

  // Mission marker: pulsing ring + beam, with the label on a dark pill so
  // the ring and the landmark name underneath never swallow the text.
  if (S.marker) {
    const m = S.marker;
    const pulse = 1 + Math.sin(S.time * 4) * 0.18;
    ctx.strokeStyle = '#ffc233';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(m.x, m.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,194,51,0.25)';
    ctx.beginPath(); ctx.arc(m.x, m.y, 34 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const label = '▼ ' + m.label;
    const lw = ctx.measureText(label).width + 18;
    ctx.fillStyle = 'rgba(12,14,20,0.85)';
    roundRect(ctx, m.x - lw / 2, m.y - 62, lw, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#ffc233';
    ctx.fillText(label, m.x, m.y - 46);
  }

  // Pedestrians.
  for (const ped of S.peds) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 7, ped.angle, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8b88a';
      ctx.beginPath(); ctx.arc(4, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Cars (traffic + police + player's).
  for (const car of S.cars) {
    if (car.dead) continue;
    drawCarShape(ctx, car);
  }
  // Player on foot.
  const p = S.player;
  if (!p.inCar && S.mode !== 'menu') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ff5d47';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2f38';
    ctx.beginPath(); ctx.arc(5, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd9a0';
    ctx.fillRect(8, -3, 7, 6);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2); ctx.stroke();
  }
  if (p.inCar) {
    // "YOU" tag above the player's car.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', p.x, p.y - 30);
  }

  // Particles.
  for (const pt of S.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawMinimap(ctx, S) {
  const size = 196, mx = VIEW_W - size - 14, my = 14, sc = size / WORLD;
  ctx.fillStyle = PALETTE.hud;
  roundRect(ctx, mx - 6, my - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, size, size);
  ctx.clip();
  ctx.fillStyle = '#20242c';
  ctx.fillRect(mx, my, size, size);
  ctx.strokeStyle = '#5a6068';
  ctx.lineWidth = 2;
  for (const c of ROAD_CENTERS) {
    ctx.beginPath(); ctx.moveTo(mx, my + c * sc); ctx.lineTo(mx + size, my + c * sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx + c * sc, my); ctx.lineTo(mx + c * sc, my + size); ctx.stroke();
  }
  for (const [name, lm] of Object.entries(S.city.landmarks)) {
    ctx.fillStyle = name === 'policeHQ' ? PALETTE.police : '#d8c56a';
    ctx.fillRect(mx + lm.x * sc - 3, my + lm.y * sc - 3, 6, 6);
  }
  if (S.marker) {
    const pulse = 4 + Math.sin(S.time * 5) * 2;
    ctx.fillStyle = '#ffc233';
    ctx.beginPath(); ctx.arc(mx + S.marker.x * sc, my + S.marker.y * sc, pulse, 0, Math.PI * 2); ctx.fill();
  }
  for (const car of S.cars) {
    if (car.dead || car.driver === 'player') continue;
    ctx.fillStyle = car.driver === 'police' ? '#ff5252' : '#c8ccd2';
    ctx.fillRect(mx + car.x * sc - 2, my + car.y * sc - 2, 4, 4);
  }
  // Player arrow.
  const p = S.player;
  ctx.save();
  ctx.translate(mx + p.x * sc, my + p.y * sc);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  // View rectangle.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + (S.cam.x - VIEW_W / 2) * sc, my + (S.cam.y - VIEW_H / 2) * sc, VIEW_W * sc, VIEW_H * sc);
  ctx.restore();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR CITY', mx, my + size + 16);
}

function drawStars(ctx, S) {
  const cx = VIEW_W / 2;
  const y = 16;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < S.wanted ? (S.wanted >= 3 ? '#ff5252' : '#ffc233') : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', cx + (i - 2) * 30, y + 22);
  }
}

export function drawHUD(ctx, S) {
  const p = S.player;
  // Top-left status panel.
  ctx.fillStyle = PALETTE.hud;
  roundRect(ctx, 14, 14, 250, 78, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('RICO  •  $' + p.money, 26, 38);
  ctx.fillStyle = '#3a3f47';
  roundRect(ctx, 26, 50, 150, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.hp > 40 ? '#7ac74f' : '#ff5252';
  roundRect(ctx, 26, 50, Math.max(0, 150 * p.hp / 100), 12, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('HP ' + Math.max(0, Math.ceil(p.hp)), 182, 61);
  ctx.fillText(p.inCar ? '🚗 ' + p.inCar.kind.toUpperCase() : '🚶 ON FOOT', 26, 82);
  if (p.inCar) {
    ctx.fillText('AMMO ' + p.ammo + ' [R]', 150, 82);
  }
  drawStars(ctx, S);
  drawMinimap(ctx, S);
  // Objective bar.
  if (S.objective) {
    ctx.fillStyle = PALETTE.hud;
    const w = Math.min(560, ctx.measureText(S.objective).width + 90);
    roundRect(ctx, VIEW_W / 2 - w / 2, VIEW_H - 92, w, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#ffc233';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◆ ' + S.objective, VIEW_W / 2, VIEW_H - 70);
  }
  // Speed when driving.
  if (p.inCar) {
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.36) + ' km/h', VIEW_W - 24, VIEW_H - 24);
  }
  // Toasts.
  let ty = 120;
  for (const t of S.toasts) {
    ctx.globalAlpha = Math.min(1, t.t / 0.5, (t.max - t.t) / 0.5);
    ctx.fillStyle = PALETTE.hud;
    const w = ctx.measureText(t.text).width + 36;
    roundRect(ctx, VIEW_W / 2 - w / 2, ty, w, 32, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.text, VIEW_W / 2, ty + 21);
    ty += 40;
  }
  ctx.globalAlpha = 1;
  // Dialogue box, with the speaker's name tagged above it.
  if (S.dialogue && S.dialogue.idx < S.dialogue.lines.length) {
    const line = S.dialogue.lines[S.dialogue.idx];
    ctx.fillStyle = '#ffc233';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DANTE — THE FIXER', 200, VIEW_H - 186);
    ctx.fillStyle = 'rgba(10,12,18,0.82)';
    roundRect(ctx, 180, VIEW_H - 178, VIEW_W - 360, 64, 12);
    ctx.fill();
    ctx.strokeStyle = '#ffc233';
    ctx.lineWidth = 2;
    ctx.strokeRect(180, VIEW_H - 178, VIEW_W - 360, 64);
    ctx.fillStyle = '#fff';
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    wrapText(ctx, line, 200, VIEW_H - 152, VIEW_W - 400, 20);
    ctx.fillStyle = '#9aa0aa';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('E / click — continue', VIEW_W - 380, VIEW_H - 126);
  }
  // Off-screen marker arrow.
  if (S.marker && S.mode === 'playing') {
    const dx = S.marker.x - p.x, dy = S.marker.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 420) {
      const ang = Math.atan2(dy, dx);
      const ax = VIEW_W / 2 + Math.cos(ang) * 300;
      const ay = VIEW_H / 2 + Math.sin(ang) * 200;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffc233';
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffc233';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(dist) + 'm', ax, ay + 26);
    }
  }
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

export function menuButtons(S) {
  const cx = VIEW_W / 2;
  const btns = [
    { id: 'new', label: '▶  NEW GAME', x: cx - 160, y: 396, w: 320, h: 52 },
    { id: 'continue', label: '↻  CONTINUE', x: cx - 160, y: 458, w: 320, h: 52 },
    { id: 'how', label: '?  HOW TO PLAY', x: cx - 160, y: 520, w: 320, h: 52 },
  ];
  return S.hasSave ? btns : btns.filter((b) => b.id !== 'continue');
}

export function drawMenu(ctx, S) {
  // City backdrop (already drawn by drawWorld with a panning camera).
  ctx.fillStyle = 'rgba(8,10,16,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffc233';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLMAR HEAT', VIEW_W / 2, 170);
  ctx.fillStyle = '#fff';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('An open-world crime story in Solmar City', VIEW_W / 2, 210);
  ctx.fillStyle = '#c8ccd2';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Steal cars • Outrun the cops • Run the jobs • Take the Big Score', VIEW_W / 2, 244);
  for (const b of menuButtons(S)) {
    ctx.fillStyle = 'rgba(20,24,32,0.85)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    ctx.strokeStyle = '#ffc233';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + 34);
  }
  ctx.fillStyle = '#9aa0aa';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('WASD drive / walk   •   E enter & steal cars   •   Mouse aim, Click shoot   •   R reload   •   P pause   •   M mute', VIEW_W / 2, 600);
  ctx.fillText('An original game. No Rockstar Games names, characters, maps or assets.', VIEW_W / 2, 628);
  if (S.showHow) {
    ctx.fillStyle = 'rgba(10,12,18,0.92)';
    roundRect(ctx, 240, 120, VIEW_W - 480, 480, 14);
    ctx.fill();
    ctx.strokeStyle = '#ffc233';
    ctx.strokeRect(240, 120, VIEW_W - 480, 480);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOW TO PLAY', VIEW_W / 2, 160);
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const lines = [
      'You are Rico, a driver new to Solmar City. Dante the fixer has four jobs for you.',
      '',
      '• Walk with WASD / arrows. Hold Shift to sprint.',
      '• Walk up to any car and press E to get in. Taking a car with a driver',
      '  inside is stealing — the cops will notice.',
      '• In a car: W accelerate, S brake / reverse, A D steer.',
      '• Aim with the mouse, click to shoot, R to reload. Shooting is a crime.',
      '• Crimes raise your wanted level. Police cars chase and ram you.',
      '  On foot, a cop car touching you too long gets you BUSTED.',
      '• Lose the cops to cool your wanted level down. Follow the yellow',
      '  marker and the arrow to your next objective.',
      '• Finish all four jobs to complete the story. Progress saves.',
    ];
    let y = 200;
    for (const ln of lines) { ctx.fillText(ln, 270, y); y += 26; }
    ctx.fillStyle = '#ffc233';
    ctx.textAlign = 'center';
    ctx.fillText('Click anywhere to close', VIEW_W / 2, 570);
  }
}

export function drawOverlay(ctx, S) {
  const kind = S.mode;
  let title = '', sub = '', color = '#fff';
  if (kind === 'busted') { title = 'BUSTED'; sub = 'The Solmar PD caught up with you. -$' + BUST_FINE; color = '#4da3ff'; }
  if (kind === 'wasted') { title = 'WASTED'; sub = 'You wake up at St. Marina Hospital. -$' + BUST_FINE; color = '#ff5252'; }
  if (kind === 'paused') { title = 'PAUSED'; sub = 'Press P or Esc to continue'; color = '#fff'; }
  if (kind === 'complete') {
    title = 'STORY COMPLETE';
    sub = 'The Big Score is yours. Solmar City is yours now.';
    color = '#ffc233';
  }
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = color;
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_W / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(sub, VIEW_W / 2, 350);
  if (kind === 'complete') {
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(`Missions done: ${S.stats.missionsDone} / 4    •    Cars stolen: ${S.stats.carsStolen}    •    Cash: $${S.player.money}`, VIEW_W / 2, 400);
    ctx.fillText('Free roam continues — keep driving, keep earning.', VIEW_W / 2, 432);
  }
  ctx.fillStyle = '#c8ccd2';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(kind === 'complete' ? 'Press Enter to keep playing in free roam' : 'Press Enter to continue', VIEW_W / 2, 480);
}
