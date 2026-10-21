/* =====================================================================
   Лист II · Торговые потоки: плоская карта-«таблица» Северной
   Атлантики (та же акварельная техника, что и глобус) + врезка
   «Чехия → Германия», таблица маршрутов и выводы.
   Маршруты связывают СТРАНЫ; концы дуг стоят в координатах из НИР
   и подписаны названиями стран. Подписи карты (океан, материки,
   градусы) не ставятся туда, где лежат подписи маршрутов и врезка.
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, C = HA.C, DATA = window.ATLAS_DATA, NB = HA.NB;
  var G = HA.globe;
  function hit(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }

  function boxPoly(lon0, lon1, lat0, lat1) {
    var c = [];
    for (var x = lon0; x <= lon1; x += 2) c.push([x, lat0]);
    for (var y = lat0; y <= lat1; y += 2) c.push([lon1, y]);
    for (var x2 = lon1; x2 >= lon0; x2 -= 2) c.push([x2, lat1]);
    for (var y2 = lat1; y2 >= lat0; y2 -= 2) c.push([lon0, y2]);
    c.push([lon0, lat0]);
    return { type: "Polygon", coordinates: [c.reverse()] };
  }

  /* карта на canvas: море с гравюрной штриховкой, суша по странам, сетка */
  function paintPlate(cv, proj, W, H, dpr, world, o) {
    var g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    var gr = g.createLinearGradient(0, 0, W * 0.3, H);
    gr.addColorStop(0, C.sea[0]); gr.addColorStop(0.6, C.sea[1]); gr.addColorStop(1, C.sea[2]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    var rnd = HA.lcg(9);
    for (var y = 2; y < H; y += 3.2) {
      for (var x = 0; x < W; x += 26) {
        var dd = Math.abs(y / H - 0.45) + 0.2;
        g.strokeStyle = "rgba(52,78,84," + (0.05 + 0.08 * dd).toFixed(3) + ")";
        g.lineWidth = 0.55;
        g.beginPath(); g.moveTo(x, y + (rnd() - 0.5) * 0.2); g.lineTo(x + 27, y); g.stroke();
      }
    }
    var scratch = document.createElement("canvas");
    scratch.width = cv.width; scratch.height = cv.height;
    var gen = d3.geoPath(proj);
    G.base.paintMap(g, gen, world, { scratch: scratch, size: [W, H], dpr: dpr, z: o.z || 1, q: "high", moving: false, gratGeo: o.grat, equator: false });
    g.save();
    g.globalCompositeOperation = "multiply"; g.globalAlpha = 0.28;
    g.fillStyle = g.createPattern(G.sprites.GRAIN, "repeat"); g.fillRect(0, 0, W, H);
    g.restore();
  }

  /* точка конца маршрута; name — название страны (на врезке без подписи: страны подписаны капителью) */
  var DOT_F = 'italic 15px "Old Standard TT", serif';
  function dotBox(g, x, y, name, align, dy) {
    var w = G.labels.tw(g, DOT_F, name), tx = x + (align === "right" ? -9 : 9);
    var x0 = align === "right" ? tx - w : tx;
    return { x0: x0 - 3, y0: y + dy - 16, x1: x0 + w + 3, y1: y + dy + 4 };
  }
  function dot(g, x, y, name, align, dy) {
    g.fillStyle = C.paper; g.strokeStyle = C.ink; g.lineWidth = 1.1;
    g.beginPath(); g.arc(x, y, 3.6, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = C.ink; g.beginPath(); g.arc(x, y, 1.3, 0, Math.PI * 2); g.fill();
    if (name) G.labels.haloText(g, name, x + (align === "right" ? -9 : 9), y + dy - 2, DOT_F, C.ink, align);
  }

  HA.initTrade = function () {
    var cv = HA.$("#plate"), frame = HA.$("#plate-frame"), insetCv = HA.$("#plate-inset-canvas"), insetBox = HA.$("#plate-inset");
    if (!cv || !window.d3) return;
    var flows = G.flows.prep(DATA.flows);
    var main = flows.filter(function (f) { return !f.short; });
    var shortF = flows.filter(function (f) { return f.short; });
    var ctx = cv.getContext("2d"), ictx = insetCv.getContext("2d");
    var base = document.createElement("canvas"), ibase = document.createElement("canvas");
    var W = 0, H = 0, IW = 0, IH = 0, dpr = 1, proj, iproj, emph = null;
    var lines = [], ilines = [];
    var tip = document.createElement("div");
    tip.className = "tip"; tip.setAttribute("aria-hidden", "true");
    frame.appendChild(tip);

    var BOX = boxPoly(-131, 33, 31, 76);
    var IBOX = boxPoly(8.6, 17.2, 47, 52.4);

    function polyline(f, P, lift, n) {
      var pts = [];
      for (var i = 0; i <= n; i++) pts.push(P(f.interp(i / n)));
      // смещение по нормали: встречные потоки расходятся в разные стороны
      var out = [];
      for (var j = 0; j <= n; j++) {
        var a = pts[Math.max(0, j - 1)], b = pts[Math.min(n, j + 1)];
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        var nx = dy / L, ny = -dx / L, h = lift * Math.sin(Math.PI * (j / n));
        out.push([pts[j][0] + nx * h, pts[j][1] + ny * h]);
      }
      return out;
    }

    function layout() {
      var r = cv.getBoundingClientRect();
      W = Math.round(r.width); H = Math.round(r.height);
      var ir = insetCv.getBoundingClientRect();
      IW = Math.round(ir.width); IH = Math.round(ir.height);
      if (!W || !H) return false;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      [cv, base].forEach(function (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
      [insetCv, ibase].forEach(function (c) { c.width = Math.max(1, Math.round(IW * dpr)); c.height = Math.max(1, Math.round(IH * dpr)); });
      var world = G.world.W50 || G.world.W110;
      proj = d3.geoConicConformal().parallels([42, 66]).rotate([52, 0]).fitExtent([[0, 0], [W, H]], BOX);
      paintPlate(base, proj, W, H, dpr, world, { grat: G.world.GRAT10 });
      var bg = base.getContext("2d");
      var narrow = W < 560;
      // 1) маршруты и их подписи — первыми: остальные подписи карты их обходят
      lines = main.map(function (f) {
        var lift = Math.max(10, (W / 900) * 14);
        var pts = polyline(f, function (ll) { return proj(ll); }, lift, 120);
        var mid = proj(f.interp(0.5));
        return { f: f, pts: pts, side: pts[60][1] < mid[1] ? -1 : 1 };
      });
      var obst = [];
      lines.forEach(function (ln) { ln.lab = routeLabel(bg, ln, W); obst.push(ln.lab.box); });
      // врезка поверх карты (на широком экране) и её подпись
      var cr = cv.getBoundingClientRect(), irr = insetBox.getBoundingClientRect();
      if (irr.width && irr.left < cr.right && irr.top < cr.bottom) {
        obst.push({ x0: irr.left - cr.left - 10, y0: irr.top - cr.top - 34, x1: irr.right - cr.left + 10, y1: irr.bottom - cr.top + 10 });
      }
      // 2) точки концов маршрутов — подписаны странами (координаты — из материалов НИР)
      var ends = {};
      main.forEach(function (f) { ends[f.from] = ends[f.from] || f.a; ends[f.to] = ends[f.to] || f.b; }); // короткий маршрут — на врезке
      var endDots = [];
      Object.keys(ends).forEach(function (c) {
        var p = proj(ends[c]);
        if (!p || p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) return;
        // из четырёх мест (снизу/сверху, слева/справа) — то, где меньше линий маршрутов и нет других подписей
        var right = p[0] > W * 0.6, best = null;
        [[right ? "right" : "left", 24], [right ? "right" : "left", -14], [right ? "left" : "right", 24], [right ? "left" : "right", -14]].forEach(function (o, k) {
          var b = dotBox(bg, p[0], p[1], c, o[0], o[1]);
          if (b.x0 < 2 || b.x1 > W - 2 || b.y0 < 2 || b.y1 > H - 2) return;
          var cost = k * 0.5 + (obst.some(function (q) { return hit(b, q); }) ? 100 : 0);
          lines.forEach(function (ln) { ln.pts.forEach(function (q) { if (q[0] > b.x0 && q[0] < b.x1 && q[1] > b.y0 - 3 && q[1] < b.y1 + 3) cost += 1; }); });
          if (!best || cost < best.cost) best = { cost: cost, al: o[0], dy: o[1], b: b };
        });
        if (!best) return;
        endDots.push({ x: p[0], y: p[1], name: c, al: best.al, dy: best.dy });
        obst.push(best.b);
      });
      // 3) названия: океан, материки, Гренландия — в первом свободном месте из нескольких
      bg.save();
      var lab = function (txt, places, size, col, sp) {
        var font = "italic " + size + 'px "Old Standard TT", serif';
        if ("letterSpacing" in bg) bg.letterSpacing = (sp || 3) + "px";
        var w = G.labels.tw(bg, font, txt) + txt.length * (("letterSpacing" in bg) ? (sp || 3) : 0);
        for (var k = 0; k < places.length; k++) {
          var p = proj(places[k]);
          var b = { x0: p[0] - w / 2 - 4, y0: p[1] - size, x1: p[0] + w / 2 + 4, y1: p[1] + 5 };
          if (b.x0 < 4 || b.x1 > W - 4 || b.y0 < 4 || b.y1 > H - 4) continue;
          if (obst.some(function (o) { return hit(b, o); })) continue;
          G.labels.haloText(bg, txt, p[0], p[1], font, col || C.ink2, "center");
          obst.push(b);
          break;
        }
        if ("letterSpacing" in bg) bg.letterSpacing = "0px";
      };
      lab("Атлантический океан", narrow ? [[-47, 38], [-42, 35], [-52, 41]] : [[-56, 42], [-50, 38], [-44, 35], [-60, 36]], narrow ? 13 : 17, "#4E6A6E", narrow ? 2.5 : 4);
      if (!narrow) {
        lab("Северная Америка", [[-100, 40], [-98, 36], [-104, 44]], 15, C.ink3, 3);
        lab("Европа", [[18, 57.5], [22, 55], [14, 60]], 15, C.ink3, 3);
        lab("Гренландия", [[-41, 74.5], [-40, 70.5], [-44, 67.5], [-38, 77]], 12, C.ink3, 2);
      }
      // 4) подписи параллелей у левого края и меридианов у нижнего — только там, где свободно
      var F = 'italic 12px "PT Serif", serif';
      (narrow ? [] : [40, 50, 60, 70]).forEach(function (lat) {
        for (var lon = -131; lon < 33; lon += 0.5) {
          var p = proj([lon, lat]);
          if (p[0] >= 2) {
            var t = lat + "°" + NB + "с." + NB + "ш.", w = G.labels.tw(bg, F, t), b = { x0: 4, y0: p[1] - 15, x1: 10 + w, y1: p[1] };
            if (p[1] > 14 && p[1] < H - 18 && !obst.some(function (o) { return hit(b, o); })) G.labels.haloText(bg, t, 6, p[1] - 3, F, C.ink3, "left");
            break;
          }
        }
      });
      (narrow ? [-90, -60, -30, 0] : [-120, -90, -60, -30, 0, 30]).forEach(function (lon) {
        var p = null;
        for (var lat = 31; lat < 76; lat += 0.25) { var q = proj([lon, lat]); if (q[1] <= H - 2) { p = q; break; } }
        if (!p || p[0] < 40 || p[0] > W - 40) return;
        var t = Math.abs(lon) + "°" + (lon < 0 ? NB + "з." + NB + "д." : lon > 0 ? NB + "в." + NB + "д." : ""), w = G.labels.tw(bg, F, t);
        var b = { x0: p[0] - w / 2 - 3, y0: H - 19, x1: p[0] + w / 2 + 3, y1: H };
        if (!obst.some(function (o) { return hit(b, o); })) G.labels.haloText(bg, t, p[0], H - 6, F, C.ink3, "center");
      });
      // рамка-указатель врезки
      var a = proj([8.6, 52.4]), b2 = proj([17.2, 47]);
      bg.strokeStyle = C.ink; bg.lineWidth = 0.9; bg.setLineDash([3, 2]);
      bg.strokeRect(Math.min(a[0], b2[0]) - 2, Math.min(a[1], b2[1]) - 2, Math.abs(b2[0] - a[0]) + 4, Math.abs(b2[1] - a[1]) + 4);
      bg.setLineDash([]);
      bg.restore();
      endDots.forEach(function (d) { dot(bg, d.x, d.y, d.name, d.al, d.dy); });
      if (IW > 20 && IH > 20) {
        iproj = d3.geoConicConformal().parallels([47, 52]).rotate([-12.6, 0]).fitExtent([[6, 6], [IW - 6, IH - 6]], IBOX);
        paintPlate(ibase, iproj, IW, IH, dpr, world, { grat: d3.geoGraticule().step([2, 2])(), z: 4 });
        var ig = ibase.getContext("2d");
        var cap = function (t, lon, lat) {
          var p = iproj([lon, lat]);
          if ("letterSpacing" in ig) ig.letterSpacing = "2.5px";
          G.labels.haloText(ig, t, p[0], p[1], '12px "PT Serif", serif', C.ink3, "center");
          if ("letterSpacing" in ig) ig.letterSpacing = "0px";
        };
        cap("ГЕРМАНИЯ", 10.4, 50.7); cap("ЧЕХИЯ", 15.6, 49.5); cap("АВСТРИЯ", 14.8, 47.6);
        // концы маршрута — точки без подписи: страны уже подписаны капителью
        shortF.forEach(function (f) { var pa = iproj(f.a), pb = iproj(f.b); dot(ig, pa[0], pa[1], "", "left", 0); dot(ig, pb[0], pb[1], "", "left", 0); });
        ilines = shortF.map(function (f) { var ln = { f: f, side: -1, pts: polyline(f, function (ll) { return iproj(ll); }, IW * 0.07, 60) }; ln.lab = routeLabel(ig, ln, IW); return ln; });
      } else ilines = [];
      return true;
    }

    /* подпись маршрута: страна → страна — сумма с единицей; у середины дуги, с внешней её стороны.
       На врезке — в левом верхнем углу с отступом от рамки, при нехватке места — в две строки. */
    function routeLabel(g, ln, k) {
      var f = ln.f, pts = ln.pts, n = pts.length - 1;
      var small = k < 560, LH = small ? 16 : 18;
      var F = (small ? 12.5 : 14) + 'px "PT Serif", serif';
      var a = f.from + " → " + f.to + " — ", v = HA.fmtAuto(f.musd, 1) + NB + "млн" + NB + "долл." + NB + "США";
      var rows = [[a, v]];
      var wOne = G.labels.tw(g, F, a) + G.labels.tw(g, F, v);
      if (wOne > k - 20) rows = [[f.from + " → " + f.to, ""], ["", v]];
      var w = Math.max.apply(null, rows.map(function (r) { return G.labels.tw(g, F, r[0]) + G.labels.tw(g, F, r[1]); }));
      var x0, y0;
      if (f.short) { x0 = 10; y0 = small ? 20 : 22; }
      else {
        var m = pts[Math.round(n * 0.5)], up = ln.side < 0;
        x0 = Math.min(Math.max(6, m[0] - w / 2), k - w - 6);
        y0 = m[1] + (up ? -12 - (rows.length - 1) * LH : (small ? 42 : 22));
      }
      return { F: F, rows: rows, x0: x0, y0: y0, LH: LH, box: { x0: x0 - 4, y0: y0 - LH + 2, x1: x0 + w + 4, y1: y0 + (rows.length - 1) * LH + 6 } };
    }

    function drawRoute(g, ln, now, k, reduced) {
      var f = ln.f, pts = ln.pts;
      var dim = emph != null && emph !== f.k ? 0.3 : 1;
      var w = (f.short ? 2.4 : f.w) * (emph === f.k ? 1.25 : 1);
      g.save();
      g.globalAlpha = dim;
      g.lineCap = "round"; g.lineJoin = "round";
      g.beginPath();
      pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
      g.strokeStyle = C.paperA(0.75); g.lineWidth = w + 3.4; g.stroke();
      g.setLineDash([7, 5]); g.lineDashOffset = reduced ? 0 : -((now * 0.018) % 12);
      g.strokeStyle = C.verm; g.lineWidth = w; g.lineCap = "butt"; g.stroke();
      g.setLineDash([]);
      var n = pts.length - 1;
      [0.35, 0.72].forEach(function (at) {
        var i = Math.round(at * n), p = pts[i], q = pts[Math.min(n, i + 1)];
        G.flows.chevron(g, p[0], p[1], Math.atan2(q[1] - p[1], q[0] - p[0]), 4.4 + w * 0.9);
      });
      var e = pts[n], e0 = pts[n - 3];
      var a = Math.atan2(e[1] - e0[1], e[0] - e0[0]), L = 9 + w * 1.6;
      g.beginPath(); g.moveTo(e[0], e[1]);
      g.lineTo(e[0] - Math.cos(a - 0.38) * L, e[1] - Math.sin(a - 0.38) * L);
      g.quadraticCurveTo(e[0] - Math.cos(a) * L * 0.6, e[1] - Math.sin(a) * L * 0.6, e[0] - Math.cos(a + 0.38) * L, e[1] - Math.sin(a + 0.38) * L);
      g.closePath(); g.lineWidth = 2; g.strokeStyle = C.paperA(0.85); g.stroke(); g.fillStyle = C.verm; g.fill();
      // подпись маршрута (место рассчитано в layout)
      var L = ln.lab;
      if (L) L.rows.forEach(function (r, i) {
        var y = L.y0 + i * L.LH;
        if (r[0]) G.labels.haloText(g, r[0], L.x0, y, L.F, C.ink, "left");
        if (r[1]) G.labels.haloText(g, r[1], L.x0 + (r[0] ? G.labels.tw(g, L.F, r[0]) : 0), y, L.F, C.vermInk, "left");
      });
      g.restore();
    }

    var timer = 0, rafId = 0, visible = false, shownAt = 0;
    function frameDraw(now) {
      rafId = 0;
      var reduced = HA.reduced();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(base, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lines.forEach(function (ln) { drawRoute(ctx, ln, now, W, reduced); });
      if (ilines.length) {
        ictx.setTransform(1, 0, 0, 1, 0, 0); ictx.clearRect(0, 0, insetCv.width, insetCv.height); ictx.drawImage(ibase, 0, 0);
        ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ilines.forEach(function (ln) { drawRoute(ictx, ln, now, IW, reduced); });
      }
      // пунктир бежит 6 с после появления карты (30 кадров/с), затем замирает — движение не длится дольше 5–6 с
      if (visible && !reduced && !document.hidden && now - shownAt < 6000) timer = setTimeout(function () { timer = 0; kick(); }, 33);
    }
    function kick() { if (!rafId && !timer) rafId = requestAnimationFrame(frameDraw); }

    var ro = 0;
    function relayout() { if (layout()) kick(); }
    if ("ResizeObserver" in window) new ResizeObserver(function () { clearTimeout(ro); ro = setTimeout(relayout, 80); }).observe(frame);
    else window.addEventListener("resize", relayout);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        var was = visible;
        visible = en[0].isIntersecting;
        if (visible && !was) shownAt = performance.now();
        if (visible) kick();
      }).observe(frame);
    } else visible = true;
    document.addEventListener("visibilitychange", function () { if (!document.hidden) kick(); });
    G.world.load50(function () { relayout(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { G.labels.resetCache(); relayout(); });
    relayout();
    HA.plateSnapshot = function () {
      try { return { main: cv.toDataURL("image/png"), inset: IW ? insetCv.toDataURL("image/png") : "" }; } catch (e) { return null; }
    };

    /* подсветка маршрута при наведении на карту */
    function nearest(x, y) {
      var best = null, bd = 12;
      lines.forEach(function (ln) {
        ln.pts.forEach(function (p) { var d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = ln.f; } });
      });
      return best;
    }
    cv.addEventListener("pointermove", function (e) {
      var r = cv.getBoundingClientRect();
      var f = nearest(e.clientX - r.left, e.clientY - r.top);
      setEmph(f ? f.k : null);
      if (f) {
        tip.innerHTML = "<b>" + HA.t(f.from) + " → " + HA.t(f.to) + '</b><span class="m">' + HA.fmtAuto(f.musd, 1) + "&nbsp;млн&nbsp;долл. США</span><small>экспорт хмеля</small>";
        var fr = frame.getBoundingClientRect();
        tip.style.left = Math.max(6, Math.min(fr.width - 250, e.clientX - fr.left + 14)) + "px";
        tip.style.top = (e.clientY - fr.top + 14) + "px";
        tip.classList.add("on");
      } else tip.classList.remove("on");
    });
    cv.addEventListener("pointerleave", function () { setEmph(null); tip.classList.remove("on"); });

    /* ---------- таблица маршрутов ---------- */
    var tbody = HA.$("#flows-table tbody");
    var maxv = Math.max.apply(null, flows.map(function (f) { return f.musd; }));
    tbody.innerHTML = flows.map(function (f) {
      return '<tr tabindex="0" data-k="' + f.k + '"><td><span class="route">' + HA.t(f.from) + " → " + HA.t(f.to) + "</span></td>" +
        '<td class="num m">' + HA.fmtAuto(f.musd, 1) + "</td>" +
        '<td class="barc" aria-hidden="true"><span class="bar" style="width:' + ((f.musd / maxv) * 100).toFixed(1) + '%"></span></td></tr>';
    }).join("");
    var trs = HA.$$("tr", tbody);
    function setEmph(k) {
      if (emph === k) return;
      emph = k;
      trs.forEach(function (tr) { tr.classList.toggle("is-sel", k != null && +tr.getAttribute("data-k") === k); });
      if (!rafId && !timer) kick();
    }
    trs.forEach(function (tr) {
      var k = +tr.getAttribute("data-k");
      tr.addEventListener("mouseenter", function () { setEmph(k); });
      tr.addEventListener("mouseleave", function () { setEmph(null); });
      tr.addEventListener("focus", function () { setEmph(k); });
      tr.addEventListener("blur", function () { setEmph(null); });
    });

    /* ---------- вывод — одна фраза (суммы уже на карте и в таблице) ---------- */
    var pair = flows.filter(function (f) { return f.back && f.musd >= f.back.musd; })[0];
    var out = HA.$("#trade-text");
    if (out && pair) {
      out.innerHTML = "<b>Вывод:</b> " + HA.t(pair.from) + " и&nbsp;" + HA.t(pair.to) + " торгуют хмелем почти поровну&nbsp;— встречные потоки различаются на&nbsp;" +
        '<span class="money">' + HA.fmtAuto(pair.musd - pair.back.musd, 1) + "&nbsp;млн&nbsp;долл. США</span>" +
        '<span class="fn" aria-hidden="true" title="Рассчитано по данным атласа">*</span>.';
    }
  };
})();
