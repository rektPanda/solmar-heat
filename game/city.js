// Solmar Heat — city generation, landmarks, collision, pathfinding.
// Original fictional city "Solmar City". Deterministic (seeded) layout.
(function () {
  var S = (globalThis.Solmar = globalThis.Solmar || {});
  var C = S.Config;

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Named places. All sit on roads so a car can reach them.
  var LANDMARKS = {
    safehouse: { x: 600, y: 600, label: "Rico's Safehouse" },
    marina: { x: 200, y: 2200, label: 'Marina' },
    docks: { x: 200, y: 1800, label: 'Docks' },
    garage: { x: 1800, y: 1000, label: "Dante's Garage" },
    club: { x: 2200, y: 1400, label: 'Club Sol' },
    bank: { x: 1400, y: 1000, label: 'Solmar Bank' },
    hospital: { x: 2600, y: 600, label: 'Solmar Hospital' },
    lighthouse: { x: 3000, y: 200, label: 'Lighthouse' },
    sportscar: { x: 200, y: 1400, label: 'Sports Car' },
    checkpoint1: { x: 1000, y: 600, label: 'Checkpoint 1' },
    checkpoint2: { x: 2200, y: 1800, label: 'Checkpoint 2' },
    checkpoint3: { x: 600, y: 1800, label: 'Checkpoint 3' }
  };

  function roadXs() {
    var xs = [];
    for (var x = 200; x <= 3000; x += C.ROAD_GAP) xs.push(x);
    return xs;
  }
  function roadYs() {
    var ys = [];
    for (var y = 200; y <= 2200; y += C.ROAD_GAP) ys.push(y);
    return ys;
  }

  function buildCity(seed) {
    var rng = mulberry32(seed || 1337);
    var xs = roadXs();
    var ys = roadYs();
    var buildings = [];
    var palette = C.COLORS.building;
    for (var i = 0; i < xs.length - 1; i++) {
      for (var j = 0; j < ys.length - 1; j++) {
        var x0 = xs[i] + C.ROAD_W / 2 + 18;
        var x1 = xs[i + 1] - C.ROAD_W / 2 - 18;
        var y0 = ys[j] + C.ROAD_W / 2 + 18;
        var y1 = ys[j + 1] - C.ROAD_W / 2 - 18;
        // Western column is the beach strip: keep it open.
        if (x0 < C.BEACH_W + 40) continue;
        var n = 1 + Math.floor(rng() * 2);
        for (var k = 0; k < n; k++) {
          var w = 90 + rng() * 130;
          var h = 80 + rng() * 120;
          var bx = x0 + rng() * Math.max(1, (x1 - x0 - w));
          var by = y0 + rng() * Math.max(1, (y1 - y0 - h));
          buildings.push({
            x: bx, y: by, w: w, h: h,
            color: palette[Math.floor(rng() * palette.length)]
          });
        }
      }
    }
    return {
      seed: seed || 1337,
      roadsX: xs, roadsY: ys,
      buildings: buildings,
      landmarks: LANDMARKS
    };
  }

  function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  // Circle vs building rects, sea and world bounds.
  function circleHits(city, x, y, r) {
    if (x < C.SEA_W + r || x > C.WORLD_W - r) return true;
    if (y < r || y > C.WORLD_H - r) return true;
    for (var i = 0; i < city.buildings.length; i++) {
      var b = city.buildings[i];
      var cx = Math.max(b.x, Math.min(x, b.x + b.w));
      var cy = Math.max(b.y, Math.min(y, b.y + b.h));
      var dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  // Push a circle out of buildings / bounds (slide along walls).
  function resolveCircle(city, p, r) {
    // World bounds.
    p.x = Math.max(C.SEA_W + r, Math.min(C.WORLD_W - r, p.x));
    p.y = Math.max(r, Math.min(C.WORLD_H - r, p.y));
    for (var i = 0; i < city.buildings.length; i++) {
      var b = city.buildings[i];
      var cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
      var cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
      var dx = p.x - cx, dy = p.y - cy;
      var d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 < 0.0001) { p.y = b.y - r; continue; }
        var d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.y = cy + (dy / d) * r;
      }
    }
  }

  function nearestRoadPoint(x, y) {
    var xs = roadXs(), ys = roadYs();
    var bx = xs[0], bd = Infinity;
    for (var i = 0; i < xs.length; i++) {
      var d = Math.abs(xs[i] - x);
      if (d < bd) { bd = d; bx = xs[i]; }
    }
    var by = ys[0]; bd = Infinity;
    for (var j = 0; j < ys.length; j++) {
      var dd = Math.abs(ys[j] - y);
      if (dd < bd) { bd = dd; by = ys[j]; }
    }
    return { x: bx, y: by };
  }

  // True when the point is on a road (drivable asphalt).
  function isOnRoad(x, y) {
    var xs = roadXs(), ys = roadYs();
    for (var i = 0; i < xs.length; i++) {
      if (Math.abs(xs[i] - x) < C.ROAD_W / 2) return true;
    }
    for (var j = 0; j < ys.length; j++) {
      if (Math.abs(ys[j] - y) < C.ROAD_W / 2) return true;
    }
    return false;
  }

  // Road-graph pathfinding: nodes are road intersections, so the path
  // always runs down road centrelines (car-friendly, never through blocks).
  // Returns waypoints [{x,y}...] or null.
  function nearestRoadPointOnNetwork(x, y) {
    var xs = roadXs(), ys = roadYs();
    var best = null, bd = Infinity;
    for (var i = 0; i < xs.length; i++) {
      var d = Math.abs(xs[i] - x);
      var cy = Math.max(0, Math.min(C.WORLD_H, y));
      if (d < bd) { bd = d; best = { x: xs[i], y: cy }; }
    }
    for (var j = 0; j < ys.length; j++) {
      var dd = Math.abs(ys[j] - y);
      var cx = Math.max(0, Math.min(C.WORLD_W, x));
      if (dd < bd) { bd = dd; best = { x: cx, y: ys[j] }; }
    }
    return best;
  }

  function nearestIntersection(x, y) {
    var xs = roadXs(), ys = roadYs();
    var bx = xs[0], bd = Infinity;
    for (var i = 0; i < xs.length; i++) {
      var d = Math.abs(xs[i] - x);
      if (d < bd) { bd = d; bx = xs[i]; }
    }
    var by = ys[0]; bd = Infinity;
    for (var j = 0; j < ys.length; j++) {
      var dd = Math.abs(ys[j] - y);
      if (dd < bd) { bd = dd; by = ys[j]; }
    }
    return { x: bx, y: by };
  }

  function findPath(city, sx, sy, tx, ty) {
    var xs = roadXs(), ys = roadYs();
    var entry = nearestRoadPointOnNetwork(sx, sy);
    var start = nearestIntersection(entry.x, entry.y);
    var goal = nearestIntersection(tx, ty);
    var exit = nearestRoadPointOnNetwork(tx, ty);
    // A* over intersections (grid of roadX x roadY).
    var si = xs.indexOf(start.x), sj = ys.indexOf(start.y);
    var gi = xs.indexOf(goal.x), gj = ys.indexOf(goal.y);
    var key = function (i, j) { return j * xs.length + i; };
    var open = [{ i: si, j: sj, g: 0, f: 0, parent: null }];
    var best = {};
    best[key(si, sj)] = 0;
    var closed = {};
    var goalNode = null;
    var guard = 0;
    while (open.length && guard++ < 5000) {
      var bi = 0;
      for (var k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
      var cur = open.splice(bi, 1)[0];
      var ck = key(cur.i, cur.j);
      if (closed[ck]) continue;
      closed[ck] = true;
      if (cur.i === gi && cur.j === gj) { goalNode = cur; break; }
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var d = 0; d < 4; d++) {
        var ni = cur.i + dirs[d][0], nj = cur.j + dirs[d][1];
        if (ni < 0 || nj < 0 || ni >= xs.length || nj >= ys.length) continue;
        var nk = key(ni, nj);
        var ng = cur.g + 1;
        if (best[nk] !== undefined && best[nk] <= ng) continue;
        best[nk] = ng;
        var h = Math.abs(ni - gi) + Math.abs(nj - gj);
        open.push({ i: ni, j: nj, g: ng, f: ng + h, parent: cur });
      }
    }
    if (!goalNode) return null;
    var nodes = [];
    var n = goalNode;
    while (n) { nodes.push({ x: xs[n.i], y: ys[n.j] }); n = n.parent; }
    nodes.reverse();
    // Waypoints: entry road point, intersections, exit road point, target.
    var out = [entry];
    for (var p = 0; p < nodes.length; p++) {
      var last = out[out.length - 1];
      if (last.x === nodes[p].x && last.y === nodes[p].y) continue;
      out.push(nodes[p]);
    }
    if (exit.x !== out[out.length - 1].x || exit.y !== out[out.length - 1].y) out.push(exit);
    out.push({ x: tx, y: ty });
    // Simplify collinear runs (straight stretches).
    var simp = [out[0]];
    for (var q = 1; q < out.length - 1; q++) {
      var a = out[q - 1], b = out[q], c = out[q + 1];
      if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) continue;
      simp.push(b);
    }
    simp.push(out[out.length - 1]);
    return simp;
  }

  S.City = {
    buildCity: buildCity,
    circleHits: circleHits,
    resolveCircle: resolveCircle,
    nearestRoadPoint: nearestRoadPoint,
    isOnRoad: isOnRoad,
    findPath: findPath,
    LANDMARKS: LANDMARKS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})();
