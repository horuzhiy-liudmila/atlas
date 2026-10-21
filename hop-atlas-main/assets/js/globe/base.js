/* =====================================================================
   Глобус · base.js — неподвижные слои.
   • океан (акварель + гравюрная штриховка) — текстура, строится один раз
     на размер линзы;
   • тень сферы (перекрёстная штриховка, блик, зерно бумаги) — текстура;
   • основа: суша по странам, пигмент у края, сетка, границы, берег,
     пятна-пологи регионов, выбранная страна — перерисовывается только
     при изменении поворота, масштаба, выбора или размера.
   paintMap() общая и для глобуса, и для плоской карты потоков (лист II).
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, G = HA.globe, C = HA.C;

  function pathOf(gen, geo) {
    var p = new Path2D();
    gen.context(p)(geo);
    gen.context(null);
    return p;
  }

  /* ---------- Океан: акварель от центра к краю + горизонтальная штриховка ---------- */
  function makeOcean(R, dpr, q) {
    var M = 3, S = Math.ceil(2 * R + 2 * M);
    var c = document.createElement("canvas");
    c.width = Math.round(S * dpr); c.height = Math.round(S * dpr);
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cx = S / 2, cy = S / 2;
    var lx = cx - R * 0.4, ly = cy - R * 0.45;
    var gr = g.createRadialGradient(lx, ly, R * 0.05, cx, cy, R * 1.02);
    gr.addColorStop(0, C.sea[0]); gr.addColorStop(0.5, C.sea[1]); gr.addColorStop(0.84, C.sea[2]); gr.addColorStop(1, C.sea[3]);
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    // «расцветы» пигмента — неровность заливки
    var rnd = HA.lcg(3);
    for (var k = 0; k < 30; k++) {
      var a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R, rr = R * (0.12 + rnd() * 0.3);
      var x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      var b = g.createRadialGradient(x, y, 0, x, y, rr);
      var tone = rnd() < 0.5 ? "120,158,156" : "236,240,226";
      b.addColorStop(0, "rgba(" + tone + "," + (0.05 + rnd() * 0.07).toFixed(3) + ")");
      b.addColorStop(0.7, "rgba(" + tone + ",0.035)");
      b.addColorStop(1, "rgba(" + tone + ",0)");
      g.fillStyle = b; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    // штриховка: к краю диска гуще и темнее
    var step = q === "low" ? 4.2 : 3.1;
    g.lineCap = "round";
    for (var yy = cy - R; yy <= cy + R; yy += step) {
      var half = Math.sqrt(Math.max(0, R * R - (yy - cy) * (yy - cy)));
      var seg = 22;
      for (var xx = cx - half; xx < cx + half; xx += seg) {
        var mx = xx + seg / 2;
        var dd = Math.hypot(mx - lx, yy - ly) / (R * 1.6);
        g.strokeStyle = "rgba(52,78,84," + (0.03 + 0.14 * dd * dd).toFixed(3) + ")";
        g.lineWidth = 0.5 + 0.3 * dd;
        g.beginPath(); g.moveTo(xx, yy + (rnd() - 0.5) * 0.25); g.lineTo(Math.min(xx + seg + 0.3, cx + half), yy); g.stroke();
      }
    }
    g.restore();
    return { c: c, R: R, S: S };
  }

  /* ---------- Тень сферы: серповидные слои штриховки, блик, зерно ---------- */
  function hatch(g, angle, spacing, x0, y0, x1, y1) {
    var ca = Math.cos(angle), sa = Math.sin(angle);
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2, D = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
    g.beginPath();
    for (var s = -D; s <= D; s += spacing) {
      var px = mx - sa * s, py = my + ca * s;
      g.moveTo(px - ca * D, py - sa * D); g.lineTo(px + ca * D, py + sa * D);
    }
    g.stroke();
  }
  function makeShade(R, dpr, q) {
    var M = 3, S = Math.ceil(2 * R + 2 * M);
    var c = document.createElement("canvas");
    c.width = Math.round(S * dpr); c.height = Math.round(S * dpr);
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cx = S / 2, cy = S / 2;
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    // блик слева сверху
    var hl = g.createRadialGradient(cx - R * 0.42, cy - R * 0.46, 0, cx - R * 0.42, cy - R * 0.46, R * 1.05);
    hl.addColorStop(0, "rgba(255,252,240,.30)"); hl.addColorStop(1, "rgba(255,252,240,0)");
    g.fillStyle = hl; g.fillRect(0, 0, S, S);
    // перекрёстная штриховка: каждый следующий серп ближе к терминатору
    var LX = -0.62, LY = -0.7;
    var layers = q === "low"
      ? [[0.2, 0.7, 5.2, 0.22], [0.5, -0.7, 5.2, 0.24]]
      : [[0.14, 0.66, 4.4, 0.2], [0.32, -0.66, 4.4, 0.21], [0.52, 0.66, 4.4, 0.24], [0.72, -0.66, 4.4, 0.24]];
    layers.forEach(function (L) {
      g.save();
      g.beginPath();
      g.arc(cx, cy, R + 2, 0, Math.PI * 2);
      g.arc(cx + LX * L[0] * R, cy + LY * L[0] * R, R * 1.02, 0, Math.PI * 2);
      g.clip("evenodd");
      g.lineWidth = 0.55; g.strokeStyle = "rgba(51,40,29," + L[3] + ")";
      hatch(g, L[1], L[2], cx - R, cy - R, cx + R, cy + R);
      g.restore();
    });
    // тёплая тень по краю
    var s = g.createRadialGradient(cx - R * 0.4, cy - R * 0.45, R * 0.2, cx, cy, R * 1.04);
    s.addColorStop(0, "rgba(255,250,235,.06)"); s.addColorStop(0.6, "rgba(255,250,235,0)");
    s.addColorStop(0.86, "rgba(90,70,40,.05)"); s.addColorStop(1, "rgba(70,50,25,.2)");
    g.fillStyle = s; g.fillRect(0, 0, S, S);
    // неподвижное зерно бумаги поверх всего диска
    if (q !== "low") {
      g.globalCompositeOperation = "multiply";
      g.globalAlpha = 0.32;
      g.fillStyle = g.createPattern(G.sprites.GRAIN, "repeat");
      g.fillRect(0, 0, S, S);
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
    g.restore();
    return { c: c, R: R, S: S };
  }

  /* ---------- Карта: отбивка берега, суша, пигмент, сетка, границы, берег ----------
     g — контекст (уже с нужным клипом), gen — d3.geoPath без контекста,
     W — подготовленная геометрия мира, o — параметры:
       scratch (canvas для отбивки), size [w,h], dpr, z (масштаб), q (качество),
       moving (в движении — проще), grat (сетка), equator, mute (приглушить страны) */
  function paintMap(g, gen, W, o) {
    var groups = W.groups.map(function (fc) { return pathOf(gen, fc); });
    // суша = объединение стран: собираем из готовых контуров, без второго прохода проекции
    var land = new Path2D();
    groups.forEach(function (p) { land.addPath(p); });
    var coast = pathOf(gen, W.coast);
    var borders = pathOf(gen, W.borders);
    var w = o.size[0], h = o.size[1], dpr = o.dpr;
    var zl = Math.min(1.8, Math.sqrt(o.z || 1));
    // упрощённый режим для слабых компьютеров: в движении без отбивки, второго слоя акварели и пунктиров
    var lite = o.q === "low" && o.moving;

    // 1. отбивка берега — тонкие волны вдоль побережья (на отдельном слое)
    if (o.scratch && !lite) {
      var rg = o.scratch.getContext("2d");
      rg.setTransform(dpr, 0, 0, dpr, 0, 0);
      rg.clearRect(0, 0, w, h);
      rg.lineJoin = "round";
      rg.strokeStyle = "rgba(48,78,84,.55)";
      rg.lineWidth = 7.5 * zl; rg.stroke(coast);
      rg.globalCompositeOperation = "destination-out";
      rg.lineWidth = 6.3 * zl; rg.stroke(coast);
      rg.globalCompositeOperation = "source-over";
      if (!o.moving && o.q !== "low") {
        rg.strokeStyle = "rgba(48,78,84,.3)";
        rg.lineWidth = 15 * zl; rg.stroke(coast);
        rg.globalCompositeOperation = "destination-out";
        rg.lineWidth = 13.8 * zl; rg.stroke(coast);
      }
      rg.globalCompositeOperation = "destination-out";
      rg.fill(land);
      rg.globalCompositeOperation = "source-over";
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 0.55;
      g.drawImage(o.scratch, 0, 0);
      g.restore();
    }

    // 2. суша — акварель по странам (три тона + шалфей для стран атласа)
    var fills = C.land.concat([C.sage]);
    var edges = C.landEdge.concat([C.sageEdge]);
    g.globalAlpha = 0.94;
    groups.forEach(function (p, k) { g.fillStyle = fills[k]; g.fill(p); });
    // «рука колориста»: второй слой со сдвигом
    if (!lite) {
      g.save(); g.translate(1.6, 1.1); g.globalAlpha = 0.24;
      groups.forEach(function (p, k) { g.fillStyle = edges[k]; g.fill(p); });
      g.restore();
    }
    // пигмент скапливается у края заливки
    g.save(); g.clip(land);
    g.lineJoin = "round";
    groups.forEach(function (p, k) {
      g.strokeStyle = edges[k];
      g.globalAlpha = k === 3 ? 0.55 : 0.42; g.lineWidth = 3.2; g.stroke(p);
      if (!o.moving && o.q !== "low") { g.globalAlpha = k === 3 ? 0.24 : 0.18; g.lineWidth = 8; g.stroke(p); }
    });
    g.restore();
    g.globalAlpha = 1;

    // 3. градусная сетка — точечная, экватор — пунктир сепией (красный — только торговля)
    g.lineCap = "round";
    if (o.grat !== false) {
      g.setLineDash(lite ? [] : [0.6, 2.6]);
      g.strokeStyle = C.inkA(lite ? 0.16 : 0.42); g.lineWidth = lite ? 0.5 : 0.7;
      g.stroke(pathOf(gen, o.gratGeo || G.world.GRAT));
    }
    if (o.equator !== false) {
      g.setLineDash([5, 3]);
      g.strokeStyle = "rgba(110,80,50,.5)"; g.lineWidth = 0.8;
      g.stroke(pathOf(gen, G.world.EQUATOR));
    }
    // 4. границы — пунктиром, берег — сплошным пером
    g.setLineDash(lite ? [] : [1.4, 2.2]); g.strokeStyle = C.inkA(lite ? 0.28 : 0.5); g.lineWidth = 0.6; g.lineCap = "butt";
    g.stroke(borders);
    g.setLineDash([]); g.lineCap = "round"; g.lineJoin = "round";
    g.strokeStyle = C.inkA(0.86); g.lineWidth = 0.85;
    g.stroke(coast);
    return { land: land, coast: coast };
  }

  /* ---------- Выбранная страна: двойной охристый контур + подкраска у региона ---------- */
  function paintSelection(g, gen, W, region, pt) {
    var f = W.byId[region.iso];
    if (!f) return;
    var p = pathOf(gen, f);
    if (pt) {
      g.save();
      g.clip(p);
      var gr = g.createRadialGradient(pt[0], pt[1], 0, pt[0], pt[1], 42);
      gr.addColorStop(0, "rgba(200,149,63,.42)"); gr.addColorStop(0.6, "rgba(200,149,63,.22)"); gr.addColorStop(1, "rgba(200,149,63,0)");
      g.fillStyle = gr;
      g.fillRect(pt[0] - 44, pt[1] - 44, 88, 88);
      g.restore();
    }
    g.save();
    g.lineJoin = "round";
    g.strokeStyle = "rgba(200,149,63,.55)"; g.lineWidth = 3; g.stroke(p);
    g.strokeStyle = C.ochreInk; g.lineWidth = 1; g.stroke(p);
    g.restore();
  }

  G.base = {
    pathOf: pathOf,
    makeOcean: makeOcean,
    makeShade: makeShade,
    paintMap: paintMap,
    paintSelection: paintSelection,
    hatch: hatch
  };
})();
