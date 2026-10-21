/* =====================================================================
   Глобус · trellis.js — хмелевая шпалера, главный знак глобуса.
   Высота жерди ∝ т/год СТРОГО линейно, без минимума: задаётся в пикселях
   экрана и не растёт с зумом. У крупных регионов (жердь ≥ 10 px) —
   холмик земли, жердь, перекладина, одна шпагатина с лозой (вьётся по
   часовой стрелке), листья через ~17 px, полупрозрачный полог и шишки
   под перекладиной (1 шт. < 2 000 т, 2 шт. < 10 000 т, 3 шт. — крупнее).
   У небольших регионов жердь короткая (у регионов в сотни тонн — меньше
   пикселя), на её верхушке — пара листиков-«росток». Листья, шишки
   и холмик — украшение и в высоту не входят (так и сказано в легенде).
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, G = HA.globe, C = HA.C;
  var CANOPY = HA.range(32).map(function (i) { return 0.82 + 0.3 * Math.abs(Math.sin(i * 2.17) * Math.cos(i * 0.73)); });

  function coneCount(t) { return t < 2000 ? 1 : t < 10000 ? 2 : 3; }
  var FULL = 10; // с этой высоты жерди рисуются перекладина, лоза и шишки
  function barHalf(h) { return h < FULL ? 0 : 5 + Math.min(11, h * 0.11); }

  /* it: {x, y, h, t, alpha, state: normal|hot|selected|dim, seed, small} */
  function draw(ctx, it) {
    var x = it.x, y = it.y, h = Math.max(0, it.h), seed = it.seed || 1;
    var full = h >= FULL;
    var hot = it.state === "hot" || it.state === "selected";
    var sel = it.state === "selected";
    var cb = barHalf(h);
    var top = y - h;
    ctx.save();
    ctx.globalAlpha = it.alpha * (it.state === "dim" ? 0.45 : 1);
    ctx.lineCap = "round"; ctx.lineJoin = "round";

    // ореол выбранного региона — охристый эллипс у основания
    if (sel) {
      ctx.beginPath(); ctx.ellipse(x, y + 0.5, 13, 4.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(200,149,63,.5)"; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = C.ochreInk; ctx.stroke();
    }
    // тень на земле (свет слева сверху)
    if (h > 8) {
      ctx.fillStyle = "rgba(60,40,20,.13)";
      ctx.beginPath();
      ctx.moveTo(x - 1, y + 0.5); ctx.lineTo(x + h * 0.26, y - h * 0.05 + 1.5);
      ctx.lineTo(x + h * 0.28, y - h * 0.05 + 4); ctx.lineTo(x + 3, y + 2.2); ctx.closePath(); ctx.fill();
    }
    // холмик земли
    ctx.fillStyle = "rgba(96,70,40,.2)";
    ctx.beginPath(); ctx.ellipse(x + 1, y + 0.6, 5.5 + Math.min(4, h * 0.04), 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.inkA(0.7); ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(x - 6, y + 1.2); ctx.quadraticCurveTo(x, y - 2.6, x + 6.5, y + 1.2); ctx.stroke();

    if (full) {
      var tx0 = x + 3, tx1 = x + cb - 1.5; // шпагат: от земли к концу перекладины
      var twX = function (s) { return tx0 + (tx1 - tx0) * (s / h); };
      // полог — неровная акварельная крона, шире кверху
      var n = 12, lo = Math.min(h * 0.18, 9);
      ctx.beginPath();
      for (var i = 0; i <= n; i++) {
        var k = i / n, s = lo + k * (h - lo - 1);
        var half = (2.4 + (cb + 0.5) * Math.pow(k, 0.9)) * CANOPY[(i + seed) % 32];
        ctx.lineTo(twX(s) - half - 1.2 * Math.sin(k * 9 + seed), y - s);
      }
      for (var j = n; j >= 0; j--) {
        var k2 = j / n, s2 = lo + k2 * (h - lo - 1);
        var half2 = (2.4 + (cb + 0.5) * Math.pow(k2, 0.9)) * CANOPY[(j + seed + 7) % 32];
        ctx.lineTo(twX(s2) + half2 + 1.2 * Math.cos(k2 * 7 + seed), y - s2);
      }
      ctx.closePath();
      // бумажная подложка: крона отделяется от карты (особенно от зелёных стран атласа)
      ctx.save();
      ctx.shadowColor = "rgba(51,40,29,.28)"; ctx.shadowBlur = 5; ctx.shadowOffsetX = 1.2; ctx.shadowOffsetY = 1.5;
      ctx.strokeStyle = C.paperA(0.75); ctx.lineWidth = 2.6; ctx.stroke();
      ctx.restore();
      ctx.fillStyle = C.paperA(0.55); ctx.fill();
      // крона — глубокая хмелевая зелень (темнее шалфейной заливки стран), свет слева
      ctx.fillStyle = hot ? "rgba(92,128,40,.78)" : "rgba(98,132,46,.68)"; ctx.fill();
      ctx.save(); ctx.translate(-1.2, -0.8); ctx.globalAlpha *= 0.55; ctx.fillStyle = "rgba(190,206,112,.6)"; ctx.fill(); ctx.restore();
      ctx.strokeStyle = "rgba(52,78,24,.75)"; ctx.lineWidth = 0.9; ctx.stroke();

      // шпагат
      ctx.strokeStyle = C.inkA(0.5); ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(tx0, y); ctx.lineTo(tx1, top); ctx.stroke();

      // лоза: винтовая линия вокруг шпагата; задние витки бледнее
      var A = 2.3, per = 12.5;
      var phase = seed * 0.7;
      var strand = function (front) {
        ctx.beginPath();
        var pen = false;
        for (var s3 = 0; s3 <= h - 2; s3 += 0.9) {
          var phi = (s3 / per) * Math.PI * 2 + phase;
          var isFront = Math.sin(phi) > 0;
          var px = twX(s3) + A * Math.cos(phi);
          if (isFront === front) { if (pen) ctx.lineTo(px, y - s3); else { ctx.moveTo(px, y - s3); pen = true; } }
          else pen = false;
        }
        ctx.stroke();
      };
      ctx.strokeStyle = "rgba(92,122,43,.55)"; ctx.lineWidth = 0.9; strand(false);
      ctx.strokeStyle = C.vine; ctx.lineWidth = 1.35; strand(true);

      // листья: супротивно, через ~18 px; нижние — трёхлопастные, верхние — сердцевидные
      var LS = G.sprites.leaf(6.5, "lobed"), LH = G.sprites.leaf(5.5, "heart");
      for (var s4 = 8, q = 0; s4 < h - 5; s4 += 17, q++) {
        var bx = twX(s4);
        var upper = s4 > h * 0.55;
        var spr = upper ? LH : LS;
        for (var sd = -1; sd <= 1; sd += 2) {
          if (h < 24 && sd === -1) continue;
          ctx.save();
          ctx.translate(bx + sd * 1.4, y - s4);
          ctx.rotate(sd * (1.0 + 0.14 * Math.sin(q + seed)));
          var sc = 0.85 + 0.2 * Math.sin(q * 1.7 + seed + sd);
          ctx.drawImage(spr.c, -spr.ax * sc, -spr.ay * sc, spr.w * sc, spr.h * sc);
          ctx.restore();
        }
      }
    }

    // жердь (её высота и есть объём) и перекладина
    var poleTop = top - (full ? 3 : 0);
    var pw = full ? (hot ? 3.4 : 3) : 2;
    if (h > 0.4) {
      // подложка жерди
      ctx.strokeStyle = C.paperA(0.85); ctx.lineWidth = pw + 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, poleTop); ctx.stroke();
      // деревянная жердь: тёмная сторона, светлая грань слева, контур
      ctx.strokeStyle = C.ink; ctx.lineWidth = pw + 0.8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, poleTop); ctx.stroke();
      if (full) {
        ctx.strokeStyle = "#7A5530"; ctx.lineWidth = pw - 0.6;
        ctx.beginPath(); ctx.moveTo(x, y - 0.5); ctx.lineTo(x, poleTop + 0.5); ctx.stroke();
        ctx.strokeStyle = "rgba(214,176,118,.9)"; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(x - pw * 0.22, y - 1); ctx.lineTo(x - pw * 0.22, poleTop + 1); ctx.stroke();
      }
      // насечки мерной рейки: каждые 10 000 т (если между ними ≥ 6 px)
      var per = it.t > 0 ? h * 10000 / it.t : 0;
      if (per >= 6) {
        ctx.strokeStyle = C.paper; ctx.lineWidth = 1.1; ctx.lineCap = "butt";
        ctx.beginPath();
        for (var m = per; m < h - 2; m += per) { ctx.moveTo(x - pw * 0.5 - 1.6, y - m); ctx.lineTo(x + pw * 0.5 + 1.6, y - m); }
        ctx.stroke();
        ctx.strokeStyle = C.ink; ctx.lineWidth = 0.6;
        ctx.beginPath();
        for (var m2 = per; m2 < h - 2; m2 += per) { ctx.moveTo(x - pw * 0.5 - 1.6, y - m2 - 0.9); ctx.lineTo(x + pw * 0.5 + 1.6, y - m2 - 0.9); }
        ctx.stroke();
        ctx.lineCap = "round";
      }
    }
    if (full) {
      // перекладина: подложка, брус, привязка к жерди, навершие
      ctx.strokeStyle = C.paperA(0.85); ctx.lineWidth = 4.2;
      ctx.beginPath(); ctx.moveTo(x - cb, top); ctx.lineTo(x + cb + 1.5, top); ctx.stroke();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - cb, top); ctx.lineTo(x + cb + 1.5, top); ctx.stroke();
      ctx.strokeStyle = "#8A6236"; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(x - cb + 0.8, top - 0.2); ctx.lineTo(x + cb + 0.7, top - 0.2); ctx.stroke();
      ctx.strokeStyle = C.inkA(0.8); ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(x - 2.2, top - 2.2); ctx.lineTo(x + 2.2, top + 2.2); ctx.moveTo(x + 2.2, top - 2.2); ctx.lineTo(x - 2.2, top + 2.2); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, poleTop - 0.6, pw * 0.55, 0, Math.PI * 2); ctx.fill();
      // шишки под перекладиной
      var nc = coneCount(it.t);
      var spr = G.sprites.cone(h >= 40 ? 14 : 11.5);
      var cones = [], right = x + cb - 0.5;
      if (nc === 1) cones.push([right, top + 0.5]);
      else if (nc === 2) { cones.push([right, top + 0.5]); cones.push([x - cb * 0.55, top + 0.5]); }
      else { cones.push([right, top + 0.5]); cones.push([x - cb * 0.6, top + 0.5]); cones.push([x + cb * 0.25, top + 5]); }
      cones.forEach(function (p) { ctx.drawImage(spr.c, p[0] - spr.ax, p[1] - spr.ay, spr.w, spr.h); });
    } else {
      // росток: пара листиков на верхушке короткой жерди (в высоту не входят)
      var lf = G.sprites.leaf(hot ? 3.8 : 3.2, "heart");
      [-1, 1].forEach(function (sd) {
        ctx.save();
        ctx.translate(x + sd * 0.6, top + 0.5);
        ctx.rotate(sd * 0.95);
        ctx.drawImage(lf.c, -lf.ax, -lf.ay, lf.w, lf.h);
        ctx.restore();
      });
    }

    // условный знак региона — кружок с точкой (фактическое место);
    // у шпалер «ряда» знак стоит в настоящей точке региона, а не здесь
    if (!it.noMarker) marker(ctx, x, y, sel);
    ctx.restore();

    return {
      x0: x - Math.max(cb, 6) - 2, x1: x + Math.max(cb, 6) + 4,
      y0: top - (full ? 5 : 8), y1: y + 4, top: top, cb: cb, full: full
    };
  }

  function marker(ctx, x, y, sel) {
    ctx.fillStyle = C.paper; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = sel ? C.ochreInk : C.ink;
    ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  /* мини-шпалера для легенды и подсказок (SVG) */
  function iconSVG(w, hh) {
    var x = w * 0.42, y = hh - 3, top = 5, cb = w * 0.26;
    var vine = "M" + (x + 2.4) + "," + y;
    for (var s = 0; s <= y - top - 2; s += 1) {
      var phi = (s / 7) * Math.PI * 2;
      vine += "L" + HA.art.r2(x + 2.4 + (cb - 2.4) * (s / (y - top)) + 1.6 * Math.cos(phi)) + "," + (y - s);
    }
    return '<path d="M' + (x - 5) + "," + (y + 1) + "Q" + x + "," + (y - 2.4) + " " + (x + 5.5) + "," + (y + 1) + '" fill="none" stroke="#33281D" stroke-width=".7"/>' +
      '<path d="' + vine + '" fill="none" stroke="#5C7A2B" stroke-width="1.1"/>' +
      '<path d="M' + x + "," + y + "V" + (top - 2) + "M" + (x - cb) + "," + top + "H" + (x + cb + 1) + '" stroke="#33281D" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
      '<g>' + HA.art.coneSVG(x + cb - 0.5, top + 1.2, 8, 5.2, { ink: "#33281D", sw: 0.55 }) + "</g>" +
      '<circle cx="' + x + '" cy="' + y + '" r="2" fill="#F4ECD9" stroke="#33281D" stroke-width=".8"/>';
  }

  G.trellis = { draw: draw, marker: marker, coneCount: coneCount, barHalf: barHalf, iconSVG: iconSVG, FULL: FULL };
})();
