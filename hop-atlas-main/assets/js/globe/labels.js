/* =====================================================================
   Глобус · labels.js — подписи регионов, метки ранга, выноски,
   подписи потоков и рамка «ряда шпалер» Европы.

   Расстановка жадная: сначала выбранный и фокусный регион, затем рамка
   «ряда» и подписи потоков, затем регионы по объёму.
   Правила, чтобы подпись не «уезжала» в чужую страну:
   • сначала — места вплотную к шпалере (без выноски);
   • выноска — короткая: метка ранга не дальше ≈ 50 px от точки региона;
   • при выборе стороны предпочитаем направление внутрь своей страны
     (к её центру на экране) и наружу от соседних регионов;
   • выноски не пересекают друг друга, чужие подписи, шпалеры и точки;
   • нет места — остаётся одна метка ранга (номер есть и в списке).
   Под каждой подписью — бумажный ореол (контраст как на бумаге).
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, G = HA.globe, C = HA.C;
  var widthCache = {};
  function tw(ctx, font, text) {
    var key = font + "|" + text;
    var v = widthCache[key];
    if (v == null) { ctx.font = font; v = widthCache[key] = ctx.measureText(text).width; }
    return v;
  }
  function resetCache() { widthCache = {}; }
  function overlaps(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }
  /* пересекает ли отрезок прямоугольник (Лианг — Барски) */
  function segHits(x1, y1, x2, y2, b) {
    var dx = x2 - x1, dy = y2 - y1, t0 = 0, t1 = 1;
    var p = [-dx, dx, -dy, dy], q = [x1 - b.x0, b.x1 - x1, y1 - b.y0, b.y1 - y1];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; }
      else {
        var t = q[i] / p[i];
        if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
        else { if (t < t0) return false; if (t < t1) t1 = t; }
      }
    }
    return t1 - t0 > 0.02;
  }
  function orient(ax, ay, bx, by, cx, cy) { return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); }
  /* пересекаются ли два отрезка (без общих концов) */
  function segCross(a, b) {
    var d1 = orient(b[0], b[1], b[2], b[3], a[0], a[1]), d2 = orient(b[0], b[1], b[2], b[3], a[2], a[3]);
    var d3 = orient(a[0], a[1], a[2], a[3], b[0], b[1]), d4 = orient(a[0], a[1], a[2], a[3], b[2], b[3]);
    return d1 * d2 < 0 && d3 * d4 < 0;
  }
  function distSeg(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    var t = l2 ? HA.clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1) : 0;
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  function inLens(b, L, pad) {
    var R = L.R - (pad || 4);
    var pts = [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]];
    for (var i = 0; i < 4; i++) if (Math.hypot(pts[i][0] - L.cx, pts[i][1] - L.cy) > R) return false;
    return true;
  }
  function haloText(ctx, txt, x, y, font, color, align) {
    ctx.font = font;
    ctx.textAlign = align || "left";
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(244,236,217,.93)"; ctx.lineJoin = "round";
    ctx.strokeText(txt, x, y);
    ctx.fillStyle = color; ctx.fillText(txt, x, y);
  }
  /* метка ранга: номер крупный (12–13 px) — он связывает глобус со списком регионов */
  function badge(ctx, x, y, n, sel, small, alpha) {
    var r = small ? 9.5 : 10.5;
    ctx.save();
    ctx.globalAlpha = Math.max(0.55, alpha == null ? 1 : alpha);
    ctx.beginPath(); ctx.arc(x, y, r + 1.6, 0, Math.PI * 2); ctx.fillStyle = C.paperA(0.9); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = sel ? C.ink : C.card; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.fillStyle = sel ? C.onDark : C.ink;
    ctx.font = "700 " + (small ? 12 : 13) + 'px "PT Serif", Georgia, serif';
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(n), x, y + 0.6);
    ctx.restore();
  }

  /* P: {items, flowLabels, cluster, lens, card, small, z, W, H}
     у элемента items: r, x, y (точка региона), box (рамка шпалеры), top,
     cv — единичный вектор к центру своей страны на экране (или null) */
  function place(ctx, P) {
    var small = P.small;
    var FN = "italic " + (small ? 14 : 16) + 'px "Old Standard TT", "Times New Roman", serif';
    var FNb = "italic 700 " + (small ? 14 : 16) + 'px "Old Standard TT", "Times New Roman", serif';
    var FV = (small ? 13 : 14) + 'px "PT Serif", Georgia, serif';
    var FF = (small ? 12 : 13) + 'px "PT Serif", Georgia, serif';
    var FFi = "italic " + (small ? 12 : 13) + 'px "PT Serif", Georgia, serif';
    var LH1 = small ? 15 : 17, LH2 = small ? 15 : 16;
    var BADGE = small ? 23 : 25, BR = small ? 9.5 : 10.5;
    var placed = [], hits = [], draws = [], leaders = [];
    var L = P.lens;
    var obstacles = P.items.map(function (it) { return { x0: it.box.x0, y0: it.box.y0, x1: it.box.x1, y1: it.box.y1, id: it.r.id }; });
    if (P.card) obstacles.push({ x0: P.card.x0 - 6, y0: P.card.y0 - 6, x1: P.card.x1 + 6, y1: P.card.y1 + 6, id: "card" });
    // из «ряда» Европы подписывается только самая высокая шпалера (крупнейший регион);
    // в слое «Торговые потоки» (P.quiet) подписаны только выбранный и наведённый регионы
    var regs = P.items.filter(function (it) { return (!it.clustered || it.clusterTop) && (!P.quiet || it.selected || it.hot); });
    var anchors = regs.map(function (it) { return { x: it.x, y: it.y, id: it.r.id }; });

    function boxOk(b, selfId, lens) {
      if (!inLens(b, L, lens == null ? 5 : lens)) return false;
      if (b.x0 < 2 || b.y0 < 2 || b.x1 > P.W - 2 || b.y1 > P.H - 2) return false;
      var i;
      for (i = 0; i < placed.length; i++) if (overlaps(b, placed[i])) return false;
      for (i = 0; i < obstacles.length; i++) if (obstacles[i].id !== selfId && overlaps(b, obstacles[i])) return false;
      for (i = 0; i < leaders.length; i++) if (segHits(leaders[i][0], leaders[i][1], leaders[i][2], leaders[i][3], b)) return false;
      return true;
    }
    function leaderOk(seg, selfId) {
      var i;
      for (i = 0; i < placed.length; i++) if (segHits(seg[0], seg[1], seg[2], seg[3], placed[i])) return false;
      for (i = 0; i < leaders.length; i++) if (segCross(seg, leaders[i])) return false;
      for (i = 0; i < obstacles.length; i++) {
        var o = obstacles[i];
        if (o.id === selfId) continue;
        if (segHits(seg[0], seg[1], seg[2], seg[3], { x0: o.x0 + 2, y0: o.y0 + 2, x1: o.x1 - 2, y1: o.y1 - 2 })) return false;
      }
      for (i = 0; i < anchors.length; i++) {
        if (anchors[i].id !== selfId && distSeg(anchors[i].x, anchors[i].y, seg[0], seg[1], seg[2], seg[3]) < 6) return false;
      }
      return true;
    }
    /* штраф за направление: внутрь своей страны и наружу от соседей — лучше */
    function localOut(it) {
      var sx = 0, sy = 0, n = 0;
      regs.forEach(function (o) {
        if (o === it) return;
        if (Math.hypot(o.x - it.x, o.y - it.y) < 90) { sx += o.x; sy += o.y; n++; }
      });
      if (!n) return null;
      var vx = it.x - sx / n, vy = it.y - sy / n, l = Math.hypot(vx, vy);
      return l > 0.5 ? [vx / l, vy / l] : null;
    }
    function dirPenalty(it, out, vx, vy) {
      var l = Math.hypot(vx, vy);
      if (l < 0.5) return 0.4;
      vx /= l; vy /= l;
      var p = 0;
      if (it.cv) p += 0.62 * (1 - (vx * it.cv[0] + vy * it.cv[1])) / 2;
      if (out) p += 0.45 * (1 - (vx * out[0] + vy * out[1])) / 2;
      return p;
    }

    /* 1. Ярлык «ряда шпалер» Европы (мировой вид): одна короткая строка у самого ряда,
          нажатие — приближение к Европе */
    function placeCluster() {
      if (!P.cluster || P.cluster.k <= 0.5 || P.quiet) return;
      var cl = P.cluster;
      var t1 = "Европа · " + cl.n + HA.NB + HA.plural(cl.n, ["регион", "региона", "регионов"]) + " →";
      var cbw = tw(ctx, FN, t1) + 16, cbh = LH1 + 9;
      var cc = [[cl.x - cbw / 2, cl.y + 12], [cl.x - cbw / 2, cl.y + 28], [cl.x + 12, cl.y + 10], [cl.x - cbw - 12, cl.y + 10],
        [cl.x - cbw / 2, cl.top - cbh - 10], [cl.x + 24, cl.top - cbh / 2], [cl.x - cbw - 24, cl.top - cbh / 2], [cl.x - cbw / 2, cl.y + 48]];
      for (var ci = 0; ci < cc.length; ci++) {
        var b0 = { x0: cc[ci][0], y0: cc[ci][1], x1: cc[ci][0] + cbw, y1: cc[ci][1] + cbh };
        if (!inLens(b0, L, 5) || (P.card && overlaps(b0, P.card))) continue;
        var clash = false, oi;
        for (oi = 0; oi < obstacles.length && !clash; oi++) if (overlaps(b0, obstacles[oi]) && cl.ids.indexOf(obstacles[oi].id) < 0) clash = true;
        for (oi = 0; oi < placed.length && !clash; oi++) if (overlaps(b0, placed[oi])) clash = true;
        for (oi = 0; oi < leaders.length && !clash; oi++) if (segHits(leaders[oi][0], leaders[oi][1], leaders[oi][2], leaders[oi][3], b0)) clash = true;
        if (clash) continue;
        placed.push(b0);
        (function (b, alpha) {
          var below = b.y0 > cl.y;
          var ax = HA.clamp(cl.x, b.x0 + 10, b.x1 - 10), ay = below ? b.y0 : b.y1;
          // выноска — только если ярлык не вплотную к ряду
          if (Math.abs(ay - (below ? cl.y : cl.top)) > 16 || b.x0 > cl.x || b.x1 < cl.x) leaders.push([ax, ay, cl.x, below ? cl.y + 5 : cl.top - 3, alpha]);
          draws.push(function () {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = "rgba(250,245,232,.96)"; ctx.fillRect(b.x0, b.y0, cbw, cbh);
            ctx.lineWidth = 0.9; ctx.strokeStyle = C.inkA(0.8); ctx.strokeRect(b.x0 + 0.5, b.y0 + 0.5, cbw - 1, cbh - 1);
            ctx.textAlign = "left";
            ctx.font = FN; ctx.fillStyle = C.ink; ctx.fillText(t1, b.x0 + 8, b.y0 + LH1 + 2);
            ctx.globalAlpha = 1;
          });
        })(b0, Math.min(1, (cl.k - 0.5) * 2));
        hits.push({ kind: "cluster", x0: b0.x0, y0: b0.y0, x1: b0.x1, y1: b0.y1 });
        break;
      }
    }

    /* 2. Подписи потоков: рамка --paper-card, суммы киноварью */
    function placeFlows() {
      (P.flowLabels || []).forEach(function (fl) {
        var lines = fl.lines;
        var widths = lines.map(function (ln) { return tw(ctx, FF, ln[0][0]) + tw(ctx, FF, ln[1][0]); });
        var bw = Math.max.apply(null, widths) + 16, bh = lines.length * (LH2 + 1) + 9;
        var cands = fl.up
          ? [[fl.x - bw / 2, fl.y - bh - 12], [fl.x - bw / 2, fl.y + 12], [fl.x - bw / 2, fl.y - bh - 32], [fl.x + 16, fl.y - bh / 2], [fl.x - bw - 16, fl.y - bh / 2], [fl.x - bw / 2, fl.y + 32]]
          : [[fl.x + 14, fl.y - bh - 8], [fl.x - bw - 14, fl.y - bh - 8], [fl.x + 14, fl.y + 8], [fl.x - bw - 14, fl.y + 8], [fl.x - bw / 2, fl.y + 26]];
        // дальние места — с выноской к середине маршрута
        [[50, -bh - 40], [-bw - 50, -bh - 40], [50, 40], [-bw - 50, 40], [-bw / 2, 70], [-bw / 2, -bh - 70], [90, -bh / 2], [-bw - 90, -bh / 2], [70, 90], [-bw - 70, 90],
         [-bw / 2, 130], [-bw / 2, 175], [-bw * 0.2, 150], [-bw * 0.8, 150], [-bw / 2, 220]].forEach(function (o) {
          cands.push([fl.x + o[0], fl.y + o[1], 1]);
        });
        for (var i = 0; i < cands.length; i++) {
          var b = { x0: cands[i][0], y0: cands[i][1], x1: cands[i][0] + bw, y1: cands[i][1] + bh };
          if (!boxOk(b, "flow")) continue;
          var seg = null;
          if (cands[i][2]) {
            seg = [HA.clamp(fl.x, b.x0, b.x1), HA.clamp(fl.y, b.y0, b.y1), fl.x, fl.y, 1];
            if (!leaderOk(seg, "flow")) continue;
          }
          placed.push(b);
          if (seg) leaders.push(seg);
          (function (b) {
            draws.push(function () {
              ctx.fillStyle = "rgba(250,245,232,.95)"; ctx.fillRect(b.x0, b.y0, bw, bh);
              ctx.lineWidth = 0.9; ctx.strokeStyle = C.inkA(0.8); ctx.strokeRect(b.x0 + 0.5, b.y0 + 0.5, bw - 1, bh - 1);
              ctx.textAlign = "left";
              lines.forEach(function (ln, k) {
                var y = b.y0 + 4 + (k + 1) * (LH2 + 1) - 2, x = b.x0 + 8;
                ctx.font = FF; ctx.fillStyle = C.ink; ctx.fillText(ln[0][0], x, y);
                x += tw(ctx, FF, ln[0][0]);
                ctx.fillStyle = ln[1][1] === "unit" ? C.ink3 : C.vermInk; ctx.fillText(ln[1][0], x, y);
              });
            });
          })(b);
          hits.push({ kind: "flow", k: fl.k, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
          break;
        }
      });
    }

    /* 3. Регионы: подпись «название + т» с меткой ранга, иначе — одна метка ранга */
    function placeRegion(it) {
      var r = it.r, sel = it.selected, hot = it.hot;
      var out = localOut(it);
      var name = r.name, val = HA.fmtT(r.t);
      var fN = sel || hot ? FNb : FN;
      var wT = Math.max(tw(ctx, fN, name), tw(ctx, FV, val));
      var bw = wT + BADGE + 3, bh = LH1 + LH2 + 3;
      var full = it.box.full;
      var cands = [];
      var add = function (x0, y0, al, lead, base) {
        var b = { x0: x0, y0: y0, x1: x0 + bw, y1: y0 + bh };
        var cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
        cands.push({ b: b, al: al, lead: lead, score: base + dirPenalty(it, out, cx - it.x, cy - it.y) });
      };
      // вплотную к шпалере — без выноски
      var right = it.box.x1 + 2, left = it.box.x0 - 2;
      var midY = full ? it.top - 14 : it.y - bh / 2 - 2;
      add(right, midY, "l", false, 0); add(left - bw, midY, "r", false, 0);
      if (full) { add(it.x + 9, it.y - bh / 2, "l", false, 0.05); add(it.x - 9 - bw, it.y - bh / 2, "r", false, 0.05); }
      add(it.x + 7, it.y + 5, "l", false, 0.08); add(it.x - 7 - bw, it.y + 5, "r", false, 0.08);
      add(it.x + 6, it.box.y0 - bh + 4, "l", false, 0.1); add(it.x - 6 - bw, it.box.y0 - bh + 4, "r", false, 0.1);
      // короткая выноска к метке ранга: не дальше ≈ 50 px от точки региона
      if (P.z >= 2 || sel || hot) {
        // в сильном приближении (вид «Европа») выноска у небольших соседей может быть длиннее:
        // так подписаны и они; у выбранного и фокусного региона подпись остаётся вплотную
        (P.z >= 3 && !sel && !hot ? [24, 36, 50, 66, 82] : [24, 36, 50]).forEach(function (D) {
          for (var k = 0; k < 16; k++) {
            var a = (k / 16) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
            var bcx = it.x + D * ca, bcy = it.y + D * sa;
            var y0 = bcy - LH1 / 2 - 1;
            if (ca > -0.25) add(bcx - BR - 1, y0, "l", true, 0.45 + D / 45);
            if (ca < 0.25) add(bcx + BR + 1 - bw, y0, "r", true, 0.45 + D / 45);
          }
        });
      }
      cands.sort(function (a, b) { return a.score - b.score; });
      var spot = null, seg = null, foreign = null;
      for (var i = 0; i < cands.length && !spot; i++) {
        var c = cands[i], s0 = null;
        if (!boxOk(c.b, r.id)) continue;
        if (c.lead) {
          var bx = c.al === "l" ? c.b.x0 + BR + 1 : c.b.x1 - BR - 1, by = c.b.y0 + LH1 / 2 + 1;
          var dl = Math.hypot(bx - it.x, by - it.y) || 1;
          s0 = [bx - (bx - it.x) / dl * (BR + 1), by - (by - it.y) / dl * (BR + 1), it.x, it.y, 1];
          if (!leaderOk(s0, r.id)) continue;
        }
        // название не ставим поверх чужой страны: середина подписи — в своей стране или над морем
        if (P.where && P.where((c.b.x0 + c.b.x1) / 2, (c.b.y0 + c.b.y1) / 2, r.iso) === 2) {
          if (!foreign && (!c.lead || sel || hot)) foreign = { c: c, seg: s0 };
          continue;
        }
        spot = c; seg = s0;
      }
      // запасной вариант — подпись над соседней страной: в приближенных видах только у выбранного
      // или наведённого региона; в мировом виде (у края диска страны сжаты) — если подпись вплотную к знаку
      if (!spot && foreign && (sel || hot || (P.z < 1.2 && !foreign.c.lead))) { spot = foreign.c; seg = foreign.seg; }
      if (!spot && (sel || hot)) {
        // выбранный регион подписываем обязательно — в первом месте внутри линзы
        for (var fi = 0; fi < cands.length && !spot; fi++) if (!cands[fi].lead && inLens(cands[fi].b, L, 4)) spot = cands[fi];
      }
      if (spot) {
        placed.push(spot.b);
        var alpha = it.alpha * (it.dim ? 0.68 : 1);
        if (seg) { seg[4] = alpha; leaders.push(seg); }
        (function (s) {
          var b2 = s.b;
          draws.push(function () {
            ctx.globalAlpha = alpha;
            var bx = s.al === "l" ? b2.x0 + BR + 1 : b2.x1 - BR - 1;
            var textX = s.al === "l" ? b2.x0 + BADGE : b2.x1 - BADGE;
            var col = sel ? C.ochreInk : C.ink;
            haloText(ctx, name, textX, b2.y0 + LH1 - 2, fN, col, s.al === "l" ? "left" : "right");
            haloText(ctx, val, textX, b2.y0 + LH1 + LH2 - 2, FV, sel ? C.ochreInk : C.hopInk, s.al === "l" ? "left" : "right");
            ctx.globalAlpha = 1;
            badge(ctx, bx, b2.y0 + LH1 / 2 + 1, r.rank, sel, small, alpha);
          });
        })(spot);
        hits.push({ kind: "region", id: r.id, x0: spot.b.x0, y0: spot.b.y0, x1: spot.b.x1, y1: spot.b.y1 });
        return;
      }
      // места для подписи нет — только метка ранга (рядом со шпалерой или на короткой выноске)
      var rr = BR + 1.5;
      var bc = [{ x: it.x, y: it.box.y0 - rr - 1, lead: false, score: 0 }];
      [17, 25, 33].forEach(function (D) {
        for (var k = 0; k < 12; k++) {
          var a = (k / 12) * Math.PI * 2, x = it.x + Math.cos(a) * D, y = it.y + Math.sin(a) * D;
          bc.push({ x: x, y: y, lead: true, score: 0.3 + D / 40 + dirPenalty(it, out, x - it.x, y - it.y) });
        }
      });
      bc.sort(function (a, b) { return a.score - b.score; });
      var got = null, bseg = null;
      for (var bi = 0; bi < bc.length && !got; bi++) {
        var q = bc[bi], bb = { x0: q.x - rr, y0: q.y - rr, x1: q.x + rr, y1: q.y + rr };
        if (!boxOk(bb, r.id, 3)) continue;
        if (q.lead) {
          var dl2 = Math.hypot(q.x - it.x, q.y - it.y) || 1;
          var s1 = [q.x - (q.x - it.x) / dl2 * rr, q.y - (q.y - it.y) / dl2 * rr, it.x, it.y, it.alpha];
          if (!leaderOk(s1, r.id)) continue;
          bseg = s1;
        }
        got = { q: q, bb: bb };
      }
      if (!got) {
        // совсем тесно — метка ранга поверх соседей, но обязательно внутри диска (на кольце она закрыла бы надписи);
        // номер обязателен: он связывает глобус со списком
        // из мест внутри диска — то, где метка меньше всего перекрывает уже поставленные подписи и метки
        var bestOv = Infinity;
        for (var fb = 0; fb < bc.length; fb++) {
          var q1 = bc[fb], b1 = { x0: q1.x - rr, y0: q1.y - rr, x1: q1.x + rr, y1: q1.y + rr };
          if (!inLens(b1, L, 3)) continue;
          var ov = fb * 0.01;
          for (var pi = 0; pi < placed.length; pi++) {
            var pb = placed[pi], w = Math.min(b1.x1, pb.x1) - Math.max(b1.x0, pb.x0), h = Math.min(b1.y1, pb.y1) - Math.max(b1.y0, pb.y0);
            if (w > 0 && h > 0) ov += w * h;
          }
          if (ov < bestOv) { bestOv = ov; got = { q: q1, bb: b1 }; }
        }
        if (got && got.q.lead) { var dl3 = Math.hypot(got.q.x - it.x, got.q.y - it.y) || 1; bseg = [got.q.x - (got.q.x - it.x) / dl3 * rr, got.q.y - (got.q.y - it.y) / dl3 * rr, it.x, it.y, it.alpha]; }
        if (!got) { var q0 = { x: it.x, y: it.y + rr + 5 }; got = { q: q0, bb: { x0: q0.x - rr, y0: q0.y - rr, x1: q0.x + rr, y1: q0.y + rr } }; }
      }
      placed.push(got.bb);
      if (bseg) leaders.push(bseg);
      (function (x, y, alpha) {
        draws.push(function () { badge(ctx, x, y, r.rank, sel, small, alpha); });
      })(got.q.x, got.q.y, it.alpha * (it.dim ? 0.5 : 1));
      hits.push({ kind: "region", id: r.id, x0: got.bb.x0, y0: got.bb.y0, x1: got.bb.x1, y1: got.bb.y1 });
    }

    var hotFirst = regs.filter(function (it) { return it.hot || it.selected; }).sort(function (a, b) { return (b.selected ? 1 : 0) - (a.selected ? 1 : 0) || b.r.t - a.r.t; });
    var rest = regs.filter(function (it) { return !(it.hot || it.selected); }).sort(function (a, b) { return b.r.t - a.r.t; });
    hotFirst.forEach(placeRegion);
    placeCluster();
    placeFlows();
    rest.forEach(placeRegion);

    /* рисуем: сначала выноски, потом подписи поверх */
    ctx.save();
    ctx.textBaseline = "alphabetic";
    leaders.forEach(function (l) {
      ctx.globalAlpha = l[4];
      ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]);
      ctx.lineWidth = 3; ctx.strokeStyle = C.paperA(0.7); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = C.ink2; ctx.stroke();
      ctx.beginPath(); ctx.arc(l[2], l[3], 1.8, 0, Math.PI * 2); ctx.fillStyle = C.ink2; ctx.fill();
    });
    ctx.globalAlpha = 1;
    draws.forEach(function (fn) { fn(); });
    ctx.restore();
    return hits;
  }

  G.labels = { place: place, badge: badge, haloText: haloText, tw: tw, resetCache: resetCache };
})();
