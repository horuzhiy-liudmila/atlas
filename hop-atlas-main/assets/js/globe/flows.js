/* =====================================================================
   Глобус · flows.js — торговые потоки (деньги — киноварь).
   Великие круги с подъёмом над сферой (sin(πt)·h, у встречных дуг
   разная h), прячутся за сферой. Порядок рисования: бумажный ореол →
   пунктир киноварью (толщина ∝ млн долл.) → шевроны на 35 % и 72 % →
   залитый наконечник у покупателя. Пунктир бежит к покупателю 18 px/с.
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, G = HA.globe, C = HA.C;
  var MAXV = 274;

  function prep(list) {
    var maxv = Math.max.apply(null, list.map(function (f) { return f.musd; })) || MAXV;
    var out = list.map(function (f, k) {
      var dist = d3.geoDistance(f.a, f.b);
      var back = list.find(function (o) { return o.from === f.to && o.to === f.from; });
      var alt = dist < 0.2 ? 0.03 : (back && f.musd < back.musd ? 0.1 : 0.22);
      return Object.assign({}, f, {
        k: k, dist: dist, alt: alt, short: dist < 0.2,
        interp: d3.geoInterpolate(f.a, f.b),
        w: 1.2 + 2.2 * (f.musd / maxv),
        back: back || null
      });
    });
    // встречный маршрут — ссылка на уже подготовленный объект (с высотой дуги)
    out.forEach(function (f) {
      if (f.back) f.back = out.filter(function (o) { return o.from === f.to && o.to === f.from; })[0] || null;
    });
    return out;
  }

  function chevron(ctx, x, y, a, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(s * 0.9, 0); ctx.lineTo(-s * 0.6, -s * 0.66); ctx.lineTo(-s * 0.22, 0); ctx.lineTo(-s * 0.6, s * 0.66); ctx.closePath();
    ctx.lineWidth = 2.2; ctx.strokeStyle = C.paperA(0.85); ctx.stroke();
    ctx.fillStyle = C.verm; ctx.fill();
    ctx.restore();
  }

  /* Два прохода, чтобы потоки читались и в тесной Европе:
     layer "lines" — пунктир под шпалерами; layer "marks" — шевроны и наконечники
     поверх шпалер (короткий маршрут рисуется поверх целиком).
     P: {proj3: fn(lon,lat,alt)→{x,y,vis}, now, reduced, z, lens:{cx,cy,R}, emph} */
  function geometry(f, P) {
    var N = f.short ? 24 : 90, pts = [];
    for (var i = 0; i <= N; i++) {
      var u = i / N, ll = f.interp(u);
      pts.push(P.proj3(ll[0], ll[1], f.alt * Math.sin(Math.PI * u)));
    }
    return { N: N, pts: pts };
  }
  function strokeLine(ctx, f, pts, P) {
    ctx.beginPath();
    var pen = false;
    for (var j = 0; j < pts.length; j++) {
      var p = pts[j];
      if (!p.vis) { pen = false; continue; }
      if (pen) ctx.lineTo(p.x, p.y); else { ctx.moveTo(p.x, p.y); pen = true; }
    }
    ctx.setLineDash([]); ctx.strokeStyle = C.paperA(0.72); ctx.lineWidth = f.w + 3.2; ctx.lineCap = "round"; ctx.stroke();
    ctx.setLineDash([7, 5]);
    ctx.lineDashOffset = P.reduced ? 0 : -((P.now * 0.018) % 12);
    ctx.strokeStyle = C.verm; ctx.lineWidth = f.w; ctx.lineCap = "butt"; ctx.stroke();
    ctx.setLineDash([]); ctx.lineCap = "round";
  }
  function marks(ctx, f, g) {
    var pts = g.pts, N = g.N;
    [0.35, 0.72].forEach(function (at) {
      if (f.short && at < 0.5) return;
      var i2 = Math.round(at * N), p = pts[i2], q = pts[Math.min(N, i2 + 1)];
      if (p.vis && q.vis) chevron(ctx, p.x, p.y, Math.atan2(q.y - p.y, q.x - p.x), 4.2 + f.w * 0.9);
    });
    var e = pts[N], e0 = pts[N - (f.short ? 3 : 5)];
    if (e.vis && e0.vis) {
      var a = Math.atan2(e.y - e0.y, e.x - e0.x), L = 8 + f.w * 1.6;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x - Math.cos(a - 0.38) * L, e.y - Math.sin(a - 0.38) * L);
      ctx.quadraticCurveTo(e.x - Math.cos(a) * L * 0.62, e.y - Math.sin(a) * L * 0.62, e.x - Math.cos(a + 0.38) * L, e.y - Math.sin(a + 0.38) * L);
      ctx.closePath();
      ctx.lineWidth = 2; ctx.strokeStyle = C.paperA(0.85); ctx.stroke();
      ctx.fillStyle = C.verm; ctx.fill();
    }
  }
  function draw(ctx, flows, P, layer) {
    var labels = [];
    layer = layer || "lines";
    ctx.save();
    ctx.beginPath(); ctx.arc(P.lens.cx, P.lens.cy, P.lens.R, 0, Math.PI * 2); ctx.clip();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    flows.forEach(function (f) {
      if (f.short && P.z < 1.8) return; // короткий маршрут — только в приближении
      var g = geometry(f, P);
      if (!g.pts.some(function (p) { return p.vis; })) return;
      ctx.globalAlpha = P.emph != null && P.emph !== f.k ? 0.35 : 1;
      if (layer === "lines") {
        if (!f.short) strokeLine(ctx, f, g.pts, P);
      } else {
        if (f.short) strokeLine(ctx, f, g.pts, P);
        marks(ctx, f, g);
      }
      ctx.globalAlpha = 1;
      if (layer !== "lines") return;
      // кандидат подписи — у вершины дуги; встречная пара — одна общая подпись
      if (f.back && f.alt < f.back.alt) return;
      // якорь подписи — вершина дуги, а если она за краем линзы — ближайшая видимая точка дуги
      var inside = function (q) { return q.vis && Math.hypot(q.x - P.lens.cx, q.y - P.lens.cy) < P.lens.R - 14; };
      var m = null;
      [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74].some(function (u) { var q = g.pts[Math.round(g.N * u)]; if (inside(q)) { m = q; return true; } return false; });
      if (!m) return;
      var unit = "млн" + HA.NB + "долл. США";
      var line = function (o, withUnit) {
        return [[o.from + " → " + o.to + " — ", "ink"], [HA.fmtAuto(o.musd, 1) + (withUnit ? HA.NB + unit : ""), "verm"]];
      };
      var lines = f.back ? [line(f, false), line(f.back, false), [["", "ink"], [unit, "unit"]]] : [line(f, true)];
      labels.push({ kind: "flow", k: f.k, x: m.x, y: m.y, lines: lines, prio: 500 - f.k, up: !f.short, short: f.short });
    });
    ctx.restore();
    return labels;
  }

  G.flows = { prep: prep, draw: draw, chevron: chevron };
})();
