// All drawing: world (camera-followed) then HUD (screen space).
// Marker labels sit on a dark pill; building labels get a dark outline.
import { CFG } from './config.js';

export const MENU_BUTTONS = {
  newGame: { x: 480, y: 356, w: 320, h: 56 },
  cont: { x: 480, y: 428, w: 320, h: 56 },
  howto: { x: 480, y: 500, w: 320, h: 56 },
  closeHowto: { x: 480, y: 596, w: 320, h: 48 },
};

function pill(ctx, x, y, w, h, r = 8) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function labelOnPill(ctx, text, cx, y) {
  ctx.font = 'bold 13px sans-serif';
  const w = ctx.measureText(text).width + 18;
  ctx.fillStyle = 'rgba(10,10,14,0.82)';
  pill(ctx, cx - w / 2, y, w, 22);
  ctx.fill();
  ctx.fillStyle = '#ffd75e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + 12);
}

function outlinedText(ctx, text, x, y, size, color) {
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(8,8,10,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawCarShape(ctx, x, y, angle, len, wid, body, glass) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-len / 2 + 2, -wid / 2 + 3, len, wid);
  ctx.fillStyle = body;
  pill(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  ctx.fillStyle = glass;
  ctx.fillRect(-len * 0.18, -wid / 2 + 4, len * 0.26, wid - 8);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 6);
  ctx.fillRect(len / 2 - 3, wid / 2 - 9, 3, 6);
  ctx.fillStyle = '#ff4d4d';
  ctx.fillRect(-len / 2, -wid / 2 + 3, 3, 6);
  ctx.fillRect(-len / 2, wid / 2 - 9, 3, 6);
  ctx.restore();
}

export function render(ctx, G, view) {
  const W = 1280;
  const H = 720;
  const { city, player, traffic, peds, police, parked, missions, tracers, time } = G;
  const camX = Math.max(W / 2, Math.min(CFG.WORLD - W / 2, player.x));
  const camY = Math.max(H / 2, Math.min(CFG.WORLD - H / 2, player.y));
  const ox = camX - W / 2;
  const oy = camY - H / 2;

  // Ground.
  ctx.fillStyle = '#3d5a3a';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(-ox, -oy);

  // Blocks (sidewalk slabs).
  for (let by = 0; by < 8; by++) {
    for (let bx = 0; bx < 8; bx++) {
      const b = city.blockRect(bx, by);
      ctx.fillStyle = '#8a8d84';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  }
  // Parks.
  for (const p of city.parks) {
    ctx.fillStyle = '#4a7a44';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#2f5c2b';
    for (const t of p.trees) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Roads.
  ctx.fillStyle = '#2e2f33';
  for (const s of city.streets) {
    ctx.fillRect(0, s - CFG.ROAD_HALF, CFG.WORLD, CFG.ROAD_HALF * 2);
    ctx.fillRect(s - CFG.ROAD_HALF, 0, CFG.ROAD_HALF * 2, CFG.WORLD);
  }
  // Lane dashes.
  ctx.strokeStyle = '#c9b458';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const s of city.streets) {
    ctx.moveTo(0, s);
    ctx.lineTo(CFG.WORLD, s);
    ctx.moveTo(s, 0);
    ctx.lineTo(s, CFG.WORLD);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Buildings + crates.
  for (const b of city.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
  }
  ctx.fillStyle = '#a9803e';
  for (const c of city.crates) {
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = '#6e5222';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x, c.y, c.w, c.h);
  }

  // Mission marker (pulsing ring + pill label).
  const target = G.marker;
  if (target) {
    const pulse = 1 + 0.12 * Math.sin(time * 4);
    ctx.strokeStyle = '#ffd75e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,215,94,0.25)';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 44);
    ctx.lineTo(target.x - 8, target.y - 58);
    ctx.lineTo(target.x + 8, target.y - 58);
    ctx.closePath();
    ctx.fill();
    labelOnPill(ctx, `▼ ${target.label}`, target.x, target.y - 84);
  }

  // Building labels (dark outline so they stay readable).
  for (const b of city.buildings) {
    outlinedText(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2, 15, '#f2ead8');
  }

  // Parked cars.
  for (const c of parked) drawCarShape(ctx, c.x, c.y, c.angle, CFG.CAR_LENGTH, CFG.CAR_WIDTH, c.type === 'sport' ? '#c93a3a' : '#7a8894', '#20303c');
  // Traffic.
  for (const c of traffic.cars) {
    if (c.disabled) continue;
    drawCarShape(ctx, c.x, c.y, c.angle, CFG.CAR_LENGTH, CFG.CAR_WIDTH, c.type === 'sport' ? '#b23a6e' : '#5a7a9a', '#20303c');
  }
  // Police.
  for (const cop of police) {
    if (cop.disabled) continue;
    drawCarShape(ctx, cop.x, cop.y, cop.angle, CFG.CAR_LENGTH, CFG.CAR_WIDTH, '#1c1e26', '#20303c');
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = Math.floor(time * 4) % 2 === 0 ? '#ff3b30' : '#2f7bff';
    ctx.fillRect(-4, -CFG.CAR_WIDTH / 2 + 2, 8, 6);
    ctx.fillStyle = Math.floor(time * 4) % 2 === 0 ? '#2f7bff' : '#ff3b30';
    ctx.fillRect(-4, CFG.CAR_WIDTH / 2 - 8, 8, 6);
    ctx.restore();
  }
  // Pedestrians.
  for (const p of peds) {
    if (p.down) continue;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player's car.
  if (player.inCar) {
    const car = player.inCar;
    drawCarShape(ctx, car.x, car.y, car.angle, CFG.CAR_LENGTH, CFG.CAR_WIDTH, car.type === 'sport' ? '#d43a2a' : '#8a97a3', '#20303c');
  } else {
    // Player on foot: green circle + facing tick.
    ctx.fillStyle = '#37d67a';
    ctx.beginPath();
    ctx.arc(player.x, player.y, CFG.PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d3d22';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#0d3d22';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(player.angle) * 20, player.y + Math.sin(player.angle) * 20);
    ctx.stroke();
  }
  // Tracers.
  for (const t of tracers) {
    ctx.strokeStyle = `rgba(255,220,90,${t.ttl})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
  ctx.restore();

  drawHud(ctx, G, view);
}

function drawHud(ctx, G, view) {
  const { player, missions } = G;
  // Top bar background.
  ctx.fillStyle = 'rgba(8,8,12,0.72)';
  pill(ctx, 10, 10, 330, 64, 10);
  ctx.fill();
  // HP bar.
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 24, 130, 14);
  ctx.fillStyle = player.hp > 50 ? '#37d67a' : player.hp > 25 ? '#ffb02e' : '#ff4d4d';
  ctx.fillRect(24, 24, 130 * Math.max(0, player.hp / 100), 14);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`HP ${Math.ceil(player.hp)}`, 162, 31);
  ctx.fillText(`$${player.money}`, 24, 56);
  ctx.fillText(`AMMO ${player.ammo}${player.reloading > 0 ? ' …' : ''}`, 110, 56);
  // Wanted stars.
  ctx.font = 'bold 22px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < G.wanted ? '#ffd75e' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', 232 + i * 24, 31);
  }
  // Objective pill.
  ctx.font = 'bold 14px sans-serif';
  const obj = missions.objective;
  const ow = ctx.measureText(obj).width + 28;
  ctx.fillStyle = 'rgba(8,8,12,0.72)';
  pill(ctx, 640 - ow / 2, 10, ow, 34, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd75e';
  ctx.textAlign = 'center';
  ctx.fillText(obj, 640, 28);

  // Minimap (live).
  const mm = { x: 1052, y: 10, s: 200 };
  const sc = mm.s / CFG.WORLD;
  ctx.fillStyle = 'rgba(8,8,12,0.78)';
  ctx.fillRect(mm.x - 4, mm.y - 4, mm.s + 8, mm.s + 8);
  ctx.fillStyle = '#22301f';
  ctx.fillRect(mm.x, mm.y, mm.s, mm.s);
  ctx.fillStyle = '#3a3b40';
  for (const s of G.city.streets) {
    ctx.fillRect(mm.x, mm.y + s * sc - 1, mm.s, 2);
    ctx.fillRect(mm.x + s * sc - 1, mm.y, 2, mm.s);
  }
  ctx.fillStyle = '#8a8d84';
  for (const b of G.city.buildings) ctx.fillRect(mm.x + b.x * sc, mm.y + b.y * sc, Math.max(2, b.w * sc), Math.max(2, b.h * sc));
  if (G.marker) {
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.arc(mm.x + G.marker.x * sc, mm.y + G.marker.y * sc, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of G.police) {
    ctx.fillStyle = '#4d8dff';
    ctx.fillRect(mm.x + cop.x * sc - 2, mm.y + cop.y * sc - 2, 4, 4);
  }
  ctx.fillStyle = '#37d67a';
  ctx.beginPath();
  ctx.arc(mm.x + player.x * sc, mm.y + player.y * sc, 4, 0, Math.PI * 2);
  ctx.fill();

  // Speed.
  ctx.fillStyle = 'rgba(8,8,12,0.72)';
  pill(ctx, 1180, 660, 90, 40, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  const spd = player.inCar ? Math.round(Math.abs(player.inCar.speed) * 0.36) : 0;
  ctx.fillText(`${spd} km/h`, 1225, 681);

  // Toast.
  if (missions.toast) {
    ctx.font = 'bold 15px sans-serif';
    const tw = ctx.measureText(missions.toast).width + 28;
    ctx.fillStyle = 'rgba(8,8,12,0.8)';
    pill(ctx, 640 - tw / 2, 56, tw, 32, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(missions.toast, 640, 73);
  }

  // Hints (hidden while dialogue is up).
  if (!missions.dialogue && G.mode === 'play') {
    ctx.fillStyle = 'rgba(8,8,12,0.6)';
    pill(ctx, 10, 668, 430, 34, 9);
    ctx.fill();
    ctx.fillStyle = '#cfd3d8';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('WASD move / drive   •   E enter car   •   Click shoot   •   R reload   •   H horn', 22, 686);
  }

  // Dialogue box.
  if (missions.dialogue) {
    const d = missions.dialogue;
    ctx.fillStyle = 'rgba(8,8,12,0.88)';
    pill(ctx, 240, 540, 800, 130, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DANTE — THE FIXER', 264, 566);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    wrapText(ctx, d.lines[d.i], 264, 596, 752, 22);
    ctx.fillStyle = '#9aa0a8';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('click to continue ▸', 1016, 652);
  }

  // Busted / wasted flash.
  if (G.bustedFlash > 0) {
    ctx.fillStyle = `rgba(20,60,180,${Math.min(0.55, G.bustedFlash * 0.3)})`;
    ctx.fillRect(0, 0, 1280, 720);
    outlinedText(ctx, 'BUSTED!  -$150', 640, 300, 44, '#fff');
    outlinedText(ctx, 'The cops took your goods. Back to the Safehouse.', 640, 350, 18, '#ffd75e');
  }
  if (G.wastedFlash > 0) {
    ctx.fillStyle = `rgba(160,20,20,${Math.min(0.55, G.wastedFlash * 0.3)})`;
    ctx.fillRect(0, 0, 1280, 720);
    outlinedText(ctx, 'WASTED', 640, 300, 48, '#fff');
    outlinedText(ctx, 'You got taken down. -$150', 640, 350, 18, '#ffd75e');
  }

  if (G.mode === 'menu') drawMenu(ctx, G, view);
  if (view.howto) drawHowto(ctx);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawMenu(ctx, G, view) {
  ctx.fillStyle = 'rgba(6,6,10,0.82)';
  ctx.fillRect(0, 0, 1280, 720);
  outlinedText(ctx, 'SOLMAR HEAT', 640, 170, 72, '#ffd75e');
  outlinedText(ctx, 'An open-world crime story — Solmar City', 640, 232, 20, '#f2ead8');
  outlinedText(ctx, 'Rico needs $1,500. Dante has the jobs. The cops have other plans.', 640, 262, 16, '#cfd3d8');
  const btn = (r, label, hot) => {
    ctx.fillStyle = hot ? '#d43a2a' : '#2a2d33';
    pill(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fill();
    ctx.strokeStyle = '#ffd75e';
    ctx.lineWidth = 2;
    pill(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
  };
  btn(MENU_BUTTONS.newGame, 'NEW GAME', true);
  btn(MENU_BUTTONS.cont, G.hasSave ? 'CONTINUE' : 'CONTINUE  (no save)', false);
  btn(MENU_BUTTONS.howto, 'HOW TO PLAY', false);
  ctx.fillStyle = '#9aa0a8';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('100% original — Solmar City, Rico & Dante. No real places, no borrowed assets.', 640, 590);
}

function drawHowto(ctx) {
  ctx.fillStyle = 'rgba(6,6,10,0.94)';
  ctx.fillRect(0, 0, 1280, 720);
  outlinedText(ctx, 'HOW TO PLAY', 640, 110, 40, '#ffd75e');
  const lines = [
    'WASD — walk / drive        Mouse — aim        Click — shoot (pistol)',
    'E — enter / exit / steal a car        R — reload (12 rounds)',
    'H — horn        Stealing, shooting and hitting people raise your wanted level.',
    'Police chase, ram and bust you. Busted or wasted: -$150, goods lost, back to the Safehouse.',
    'Wanted fades after 20 s without a crime, one star every 8 s.',
    '',
    'THE STORY — 4 jobs from Dante the fixer:',
    '1. Wheels ($150) — steal any car, deliver it to the Garage.',
    '2. The Pickup ($300) — grab the package at the Docks, deliver to the Safehouse.',
    '3. Heat ($250) — same run, but the cops are waiting.',
    '4. The Big Score ($800) — rob the bank cash, bring it home.',
    'Finish all four and Solmar City is yours. Progress saves automatically.',
  ];
  ctx.fillStyle = '#f2ead8';
  ctx.font = '17px sans-serif';
  ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, 640, 170 + i * 30));
  const r = MENU_BUTTONS.closeHowto;
  ctx.fillStyle = '#d43a2a';
  pill(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('CLOSE', r.x + r.w / 2, r.y + r.h / 2 + 1);
}
