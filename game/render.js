// Solmar Heat — canvas rendering (browser only). Original art, code-drawn.
(function () {
  var S = (globalThis.Solmar = globalThis.Solmar || {});
  var C = S.Config;

  function drawCar(ctx, car, scale) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    var w = 46, h = 22;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 12, -h / 2 + 4, 14, h - 8, 3);
    ctx.fill();
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(w / 2 - 6, -h / 2 + 2, 3, 4);
    ctx.fillRect(w / 2 - 6, h / 2 - 6, 3, 4);
    if (car.kind === 'police') {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(-w / 2 + 2, -h / 2, 10, h);
      ctx.fillStyle = (Math.floor(performance.now() / 300) % 2 === 0) ? '#ff2e2e' : '#2e7bff';
      ctx.fillRect(-4, -h / 2 - 3, 8, 5);
    }
    if (car.kind === 'mission') {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
    }
    ctx.restore();
  }

  function draw(state, ctx, viewW, viewH) {
    var city = state.city;
    var p = state.player;
    var camX = Math.max(0, Math.min(C.WORLD_W - viewW, p.x - viewW / 2));
    var camY = Math.max(0, Math.min(C.WORLD_H - viewH, p.y - viewH / 2));
    var t = state.clock;
    var night = (t >= 19 || t < 6) ? 0.45 : (t >= 17.5 ? 0.22 : 0);

    ctx.save();
    ctx.translate(-camX, -camY);

    // Ground.
    ctx.fillStyle = C.COLORS.grass;
    ctx.fillRect(0, 0, C.WORLD_W, C.WORLD_H);
    ctx.fillStyle = C.COLORS.grass2;
    for (var gx = 0; gx < C.WORLD_W; gx += 400) {
      for (var gy = 0; gy < C.WORLD_H; gy += 400) {
        if (((gx + gy) / 400) % 2 === 0) ctx.fillRect(gx, gy, 400, 400);
      }
    }
    // Sea + sand (west).
    ctx.fillStyle = C.COLORS.sea;
    ctx.fillRect(0, 0, C.SEA_W, C.WORLD_H);
    ctx.fillStyle = C.COLORS.sand;
    ctx.fillRect(C.SEA_W, 0, C.BEACH_W - C.SEA_W, C.WORLD_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(C.SEA_W, 0); ctx.lineTo(C.SEA_W, C.WORLD_H);
    ctx.stroke();

    // Roads.
    ctx.fillStyle = C.COLORS.road;
    var i, j;
    for (i = 0; i < city.roadsX.length; i++) {
      ctx.fillRect(city.roadsX[i] - C.ROAD_W / 2, 0, C.ROAD_W, C.WORLD_H);
    }
    for (j = 0; j < city.roadsY.length; j++) {
      ctx.fillRect(0, city.roadsY[j] - C.ROAD_W / 2, C.WORLD_W, C.ROAD_W);
    }
    // Centre dashes.
    ctx.strokeStyle = C.COLORS.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 26]);
    for (i = 0; i < city.roadsX.length; i++) {
      ctx.beginPath();
      ctx.moveTo(city.roadsX[i], 0); ctx.lineTo(city.roadsX[i], C.WORLD_H);
      ctx.stroke();
    }
    for (j = 0; j < city.roadsY.length; j++) {
      ctx.beginPath();
      ctx.moveTo(0, city.roadsY[j]); ctx.lineTo(C.WORLD_W, city.roadsY[j]);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Buildings.
    for (var b = 0; b < city.buildings.length; b++) {
      var bd = city.buildings[b];
      ctx.fillStyle = bd.color;
      ctx.fillRect(bd.x, bd.y, bd.w, bd.h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(bd.x + 6, bd.y + 6, bd.w - 12, 10);
      ctx.strokeStyle = C.COLORS.roof;
      ctx.lineWidth = 2;
      ctx.strokeRect(bd.x, bd.y, bd.w, bd.h);
    }

    // Landmarks.
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    for (var lk in city.landmarks) {
      var L = city.landmarks[lk];
      ctx.fillStyle = '#ffd700';
      ctx.beginPath(); ctx.arc(L.x, L.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5b00'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#1c1c22';
      ctx.fillText('★', L.x, L.y + 5);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      var wTxt = ctx.measureText(L.label).width + 10;
      ctx.fillRect(L.x - wTxt / 2, L.y + 14, wTxt, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(L.label, L.x, L.y + 27);
    }

    // Mission marker (pulsing).
    var step = S.Missions.currentStep(state);
    var target = step ? S.Missions.missionTarget(state, step) : null;
    if (target) {
      var pulse = 14 + Math.sin(performance.now() / 220) * 5;
      ctx.strokeStyle = '#ffdf2e';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(target.x, target.y, pulse + 12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,223,46,0.25)';
      ctx.beginPath(); ctx.arc(target.x, target.y, pulse + 12, 0, Math.PI * 2); ctx.fill();
    }

    // Pedestrians.
    for (var q = 0; q < state.peds.length; q++) {
      var pd = state.peds[q];
      if (pd.down) {
        ctx.fillStyle = '#888';
        ctx.beginPath(); ctx.arc(pd.x, pd.y, 9, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      ctx.fillStyle = pd.color;
      ctx.beginPath(); ctx.arc(pd.x, pd.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.stroke();
    }

    // Cars.
    for (var ci = 0; ci < state.cars.length; ci++) {
      drawCar(ctx, state.cars[ci], 1);
    }

    // Player on foot.
    if (p.onFoot) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#1e90ff';
      ctx.beginPath(); ctx.arc(0, 0, C.PLAYER_RADIUS, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(5, -5, 3, 0, Math.PI * 2); ctx.arc(5, 5, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(C.PLAYER_RADIUS - 2, -3, 8, 6);
      ctx.restore();
      // Ring so the player is always visible.
      ctx.strokeStyle = '#1e90ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, C.PLAYER_RADIUS + 5, 0, Math.PI * 2); ctx.stroke();
    } else if (p.car) {
      ctx.strokeStyle = '#1e90ff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 34, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.restore();

    // Night tint.
    if (night > 0) {
      ctx.fillStyle = 'rgba(8,12,40,' + night + ')';
      ctx.fillRect(0, 0, viewW, viewH);
    }

    // ---- HUD (screen space) ----
    ctx.textAlign = 'left';
    // Top-left panel.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(10, 10, 300, 96);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('SOLMAR HEAT', 20, 34);
    ctx.font = '15px sans-serif';
    ctx.fillText('$' + state.money, 20, 56);
    var hh = Math.floor(state.clock), mm = Math.floor((state.clock - hh) * 60);
    ctx.fillText((hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm, 240, 56);
    // Health bar.
    ctx.fillStyle = '#333';
    ctx.fillRect(20, 64, 160, 12);
    ctx.fillStyle = state.health > 30 ? '#3ecf5a' : '#e03a2e';
    ctx.fillRect(20, 64, 160 * Math.max(0, state.health) / 100, 12);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText('HP ' + Math.ceil(state.health), 186, 74);
    // Wanted stars.
    ctx.font = '20px sans-serif';
    var stars = '';
    for (var s = 0; s < 5; s++) stars += s < state.wanted ? '★' : '☆';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(stars, 20, 98);

    // Mission panel.
    var m = state.mission;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(10, viewH - 86, 460, 76);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 15px sans-serif';
    if (m.active && step) {
      var def = S.Missions.MISSIONS[m.index];
      ctx.fillText(def.title + '  (' + (m.step + 1) + '/' + def.steps.length + ')', 20, viewH - 62);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText(step.text, 20, viewH - 40);
      if (step.type === 'wait') {
        ctx.fillText('Hold: ' + Math.ceil(Math.max(0, (step.seconds || 5) - m.waitTimer)) + 's', 20, viewH - 20);
      }
    } else if (state.won) {
      ctx.fillText('KING OF SOLMAR — all 8 missions done!', 20, viewH - 40);
    } else {
      ctx.fillText('Free roam — press ENTER to start mission ' + (S.Missions.nextMissionIndex(state) + 1), 20, viewH - 40);
      ctx.fillStyle = '#fff';
      ctx.font = '13px sans-serif';
      ctx.fillText('Missions done: ' + m.completed.length + '/8', 20, viewH - 20);
    }

    // Dialogue / message toast.
    if (state.message && state.messageTimer > 0) {
      ctx.font = 'bold 16px sans-serif';
      var mw = ctx.measureText(state.message).width + 24;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect((viewW - mw) / 2, 14, mw, 30);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(state.message, viewW / 2, 35);
      ctx.textAlign = 'left';
    }
    if (state.dialogue && state.dialogue.length && state.dialogueTimer < 6) {
      ctx.font = '14px sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      var dw = 0;
      for (var di = 0; di < state.dialogue.length; di++) dw = Math.max(dw, ctx.measureText(state.dialogue[di]).width);
      ctx.fillRect(10, viewH - 190, dw + 24, state.dialogue.length * 20 + 14);
      ctx.fillStyle = '#ffe9a8';
      for (var dj = 0; dj < state.dialogue.length; dj++) {
        ctx.fillText(state.dialogue[dj], 20, viewH - 172 + dj * 20);
      }
    }

    // Minimap.
    var mw2 = 190, mh2 = 142;
    var mx = viewW - mw2 - 10, my = 10;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(mx - 4, my - 4, mw2 + 8, mh2 + 8);
    ctx.fillStyle = '#24401c';
    ctx.fillRect(mx, my, mw2, mh2);
    ctx.fillStyle = '#2f6fb2';
    ctx.fillRect(mx, my, (C.SEA_W / C.WORLD_W) * mw2, mh2);
    ctx.fillStyle = '#e0c98f';
    ctx.fillRect(mx + (C.SEA_W / C.WORLD_W) * mw2, my, ((C.BEACH_W - C.SEA_W) / C.WORLD_W) * mw2, mh2);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    for (var rx = 0; rx < city.roadsX.length; rx++) {
      var lx = mx + (city.roadsX[rx] / C.WORLD_W) * mw2;
      ctx.beginPath(); ctx.moveTo(lx, my); ctx.lineTo(lx, my + mh2); ctx.stroke();
    }
    for (var ry = 0; ry < city.roadsY.length; ry++) {
      var ly = my + (city.roadsY[ry] / C.WORLD_H) * mh2;
      ctx.beginPath(); ctx.moveTo(mx, ly); ctx.lineTo(mx + mw2, ly); ctx.stroke();
    }
    function dot(x, y, color, r) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx + (x / C.WORLD_W) * mw2, my + (y / C.WORLD_H) * mh2, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (target) dot(target.x, target.y, '#ffdf2e', 5);
    for (var pk = 0; pk < state.cars.length; pk++) {
      if (state.cars[pk].kind === 'police') dot(state.cars[pk].x, state.cars[pk].y, '#ff2e2e', 3);
    }
    dot(p.x, p.y, '#1e90ff', 4);

    // Controls hint.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, viewH - 112, 460, 20);
    ctx.fillStyle = '#ddd';
    ctx.font = '12px sans-serif';
    ctx.fillText('WASD / arrows drive  •  SPACE enter car  •  ENTER mission  •  P autopilot', 18, viewH - 98);
  }

  S.Render = { draw: draw };
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})();
