/* =====================================================================
   Глобус · ring.js — меридианное кольцо (SVG под/над canvas):
   латунное кольцо с охристой подкраской, деления через 5° и 15°,
   название по верхней дуге (легенда — одна, строкой под глобусом),
   хмелевая лоза на левой четверти.
   Кольцо строится для базового радиуса R0 и потом только
   перемещается/масштабируется вместе с линзой.
   Надпись сдвинута вправо от лозы: лоза занимает левую четверть
   (≈ 150°–212°). Без надписи (телефон) полоса текста тоньше.
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, G = HA.globe, C = HA.C, r2 = HA.art.r2;
  var RAD = Math.PI / 180;
  var uid = 0;

  function pt(r, deg) { return [r * Math.cos(deg * RAD), r * Math.sin(deg * RAD)]; }
  /* гладкая линия через точки (Катмулл — Ром → кубические Безье) */
  function smooth(P) {
    var d = "M" + r2(P[0][0]) + "," + r2(P[0][1]);
    for (var i = 0; i < P.length - 1; i++) {
      var p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      d += "C" + r2(p1[0] + (p2[0] - p0[0]) / 6) + "," + r2(p1[1] + (p2[1] - p0[1]) / 6) + " " +
        r2(p2[0] - (p3[0] - p1[0]) / 6) + "," + r2(p2[1] - (p3[1] - p1[1]) / 6) + " " + r2(p2[0]) + "," + r2(p2[1]);
    }
    return d;
  }

  /* opts: {R0, small, vine (bool), top, bottom, topShort, bottomShort} */
  function build(svg, opts) {
    uid++;
    var R0 = opts.R0, small = opts.small;
    var hasText = !!(opts.top || opts.bottom);
    var band = small ? 7 : 10;           // градуированная полоса
    var tband = hasText ? (small ? 13 : 17) : (small ? 6 : 8); // полоса текста
    var r1 = R0 + 3, r2b = r1 + band, r3 = r2b + tband;
    var s = "";
    s += '<g class="ring-g" id="ring-g-' + uid + '">';
    // кольцо фокуса клавиатуры: снаружи кольца, охристая подкраска + чернильный пунктир
    s += '<g class="ring-focus" fill="none"><circle r="' + r2(r3 + 7) + '" stroke="' + C.ochre + '" stroke-opacity=".55" stroke-width="5"/>' +
      '<circle r="' + r2(r3 + 7) + '" stroke="' + C.ink + '" stroke-width="1.6" stroke-dasharray="7 4"/></g>';
    // подкраска кольца охрой (акварель)
    s += '<circle r="' + r2((r1 + r3) / 2) + '" fill="none" stroke="#D9B56A" stroke-opacity=".3" stroke-width="' + (r3 - r1) + '"/>';
    s += '<g class="pen" fill="none" stroke="' + C.ink + '">';
    s += '<circle r="' + r2(R0 + 0.6) + '" stroke-width="1.5"/>';
    s += '<circle r="' + r2(r1) + '" stroke-width=".55" stroke-opacity=".8"/>';
    s += '<circle r="' + r2(r2b) + '" stroke-width=".6" stroke-opacity=".75"/>';
    s += '<circle r="' + r2(r3) + '" stroke-width="1"/>';
    s += '<circle r="' + r2(r3 + 3) + '" stroke-width=".45" stroke-opacity=".7"/>';
    var tk = "";
    for (var d = 0; d < 360; d += 5) {
      var L = d % 15 === 0 ? band : band * 0.45;
      var a = pt(r1, d), b = pt(r1 + L, d);
      tk += "M" + r2(a[0]) + "," + r2(a[1]) + "L" + r2(b[0]) + "," + r2(b[1]);
    }
    s += '<path d="' + tk + '" stroke-width=".55" stroke-opacity=".8"/>';
    s += "</g>";
    // текст по дуге: сверху (читается слева направо), снизу (тоже слева направо).
    // Центр верхней надписи — правее зенита (≈ 280°), нижняя — по центру снизу,
    // чтобы буквы не перекрывались лозой и высокими шпалерами у левого края диска.
    var fs = small ? 10.5 : 12;
    var rt = r2b + (small ? 4 : 5);              // верх: буквы растут наружу
    var rb = r3 - (small ? 3.5 : 4.5);            // низ: буквы растут внутрь
    // где стоит лоза (≈ 150°–212°), надписи её обходят: верхняя — правее зенита, нижняя — правее надира;
    // если на небольшом глобусе полная надпись не помещается в свободную дугу — короткий вариант
    var ls = small ? 1.3 : 2;
    var fits = function (t, r, deg) { return t.length * (fs * 0.72 + ls) <= r * deg * RAD; };
    var topText = opts.top || "", botText = opts.bottom || "";
    if (topText && !fits(topText, rt, opts.vine ? 128 : 165) && opts.topShort) topText = opts.topShort;
    if (botText && !fits(botText, rb, opts.vine ? 130 : 165) && opts.bottomShort) botText = opts.bottomShort;
    var TC = opts.vine ? 288 : 270, BC = opts.vine ? 78 : 90, SPAN = 85; // дуга ≤ 180°, иначе SVG выберет другую окружность
    var A1 = pt(rt, TC - SPAN), A2 = pt(rt, TC + SPAN), B1 = pt(rb, BC + SPAN), B2 = pt(rb, BC - SPAN);
    var tstyle = 'font-family="Old Standard TT, Times New Roman, serif" font-size="' + fs + '" letter-spacing="' + ls + '" fill="' + C.ink2 + '"';
    if (topText) {
      s += '<path id="ring-top-' + uid + '" d="M' + r2(A1[0]) + "," + r2(A1[1]) + "A" + r2(rt) + "," + r2(rt) + " 0 0 1 " + r2(A2[0]) + "," + r2(A2[1]) + '" fill="none"/>';
      s += "<text " + tstyle + '><textPath href="#ring-top-' + uid + '" startOffset="50%" text-anchor="middle">' + HA.esc(topText) + "</textPath></text>";
    }
    if (botText) {
      s += '<path id="ring-bot-' + uid + '" d="M' + r2(B1[0]) + "," + r2(B1[1]) + "A" + r2(rb) + "," + r2(rb) + " 0 0 0 " + r2(B2[0]) + "," + r2(B2[1]) + '" fill="none"/>';
      s += "<text " + tstyle + '><textPath href="#ring-bot-' + uid + '" startOffset="50%" text-anchor="middle">' + HA.esc(botText) + "</textPath></text>";
    }
    if (opts.vine) s += vine(R0, r3);
    s += "</g>";
    svg.innerHTML = s;
    return { g: svg.querySelector(".ring-g"), outer: r3 + 3 };
  }

  /* Лоза: поднимается по часовой стрелке по левой четверти (от 150° к 212°),
     то над кольцом, то под ним; в узлах — супротивные листья (нижние
     трёхлопастные, верхние — сердцевидные), шишки висят гроздьями.
     На небольшом глобусе лоза и листья мельче (k). */
  function vine(R0, rOut) {
    var k = HA.clamp(R0 / 250, 0.62, 1);
    var a0 = 152, a1 = 212, N = 120, WAVES = 6;
    var rv = rOut + 3;
    var wig = function (t) { return Math.sin(t * Math.PI * WAVES) * 6 * k * (1 - 0.3 * t); };
    var main = [], back = [];
    for (var i = 0; i <= N; i++) {
      var t = i / N, a = a0 + (a1 - a0) * t;
      main.push(pt(rv + wig(t), a));
      back.push(pt(rv - wig(t) * 0.75 - 1.2, a));
    }
    var s = '<g class="vine" filter="url(#f-pen)">';
    // задняя прядь (стебель уходит за кольцо)
    s += '<path class="vine-back" d="' + smooth(back.slice(5, 105)) + '" fill="none" stroke="' + C.vine + '" stroke-opacity=".42" stroke-width="1.1"/>';
    s += '<path class="vine-main" pathLength="1" d="' + smooth(main) + '" fill="none" stroke="' + C.vine + '" stroke-width="' + r2(2.2 * k + 0.2) + '" stroke-linecap="round"/>';
    // шероховатость стебля: короткие волоски
    var hairs = "";
    for (var h = 4; h < N; h += 7) {
      var p0 = main[h], p1 = main[h + 1];
      var nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0], L = Math.hypot(nx, ny) || 1;
      hairs += "M" + r2(p0[0]) + "," + r2(p0[1]) + "l" + r2(nx / L * 2.2 * k) + "," + r2(ny / L * 2.2 * k);
    }
    s += '<path d="' + hairs + '" stroke="' + C.vine + '" stroke-width=".7" stroke-opacity=".8"/>';
    // молодая верхушка — завиток
    var e = main[N], tipA = pt(rv + 1, a1 + 2.5), tipB = pt(rv + 8 * k, a1 + 5), tipC = pt(rv + 4.5 * k, a1 + 7.5);
    s += '<path d="M' + r2(e[0]) + "," + r2(e[1]) + "Q" + r2(tipA[0]) + "," + r2(tipA[1]) + " " + r2(tipB[0]) + "," + r2(tipB[1]) + "T" + r2(tipC[0]) + "," + r2(tipC[1]) + '" fill="none" stroke="' + C.vine + '" stroke-width="1.2" stroke-linecap="round"/>';
    s += "</g>";
    // узлы: пары листьев и грозди шишек
    var nodes = [
      { t: 0.06, s: 14, kind: "lobed" }, { t: 0.22, s: 15, kind: "lobed", cones: 3 },
      { t: 0.4, s: 13.5, kind: "lobed" }, { t: 0.57, s: 12, kind: "heart", cones: 2 },
      { t: 0.74, s: 10, kind: "heart" }, { t: 0.9, s: 7, kind: "heart" }
    ];
    var g = '<g class="vine-items">';
    nodes.forEach(function (nd, idx) {
      var a = a0 + (a1 - a0) * nd.t;
      var p = pt(rv + wig(nd.t), a);
      var sz = nd.s * k;
      var leaves = "";
      [-1, 1].forEach(function (side, j) {
        // черешок от узла наружу, лист повёрнут наружу с наклоном вверх или вниз
        var dir = a + side * (48 + 8 * Math.sin(idx * 1.7));
        var pe = pt(4 * k + sz * 0.25, dir);
        var lx = p[0] + pe[0], ly = p[1] + pe[1];
        leaves += '<path d="M' + r2(p[0]) + "," + r2(p[1]) + "L" + r2(lx) + "," + r2(ly) + '" stroke="' + C.vine + '" stroke-width=".9" fill="none"/>';
        leaves += HA.art.leafSVG(lx, ly, dir + 90, sz * (j ? 1 : 0.88), { ink: C.ink, sw: 0.75, kind: nd.kind });
      });
      g += '<g class="vi" style="--i:' + idx + '">' + leaves + "</g>";
      if (nd.cones) {
        var cl = "", cs = sz * 1.25;
        for (var c = 0; c < nd.cones; c++) {
          var dx = (c - (nd.cones - 1) / 2) * cs * 0.52, dy = (c % 2) * cs * 0.3 + 6 * k;
          cl += '<path d="M' + r2(p[0]) + "," + r2(p[1]) + "Q" + r2(p[0] + dx * 0.3) + "," + r2(p[1] + dy * 0.6) + " " + r2(p[0] + dx) + "," + r2(p[1] + dy) + '" fill="none" stroke="' + C.vine + '" stroke-width=".8"/>';
          cl += HA.art.coneSVG(p[0] + dx, p[1] + dy + cs * 0.16, cs, cs * 0.64, { ink: C.ink, sw: 0.7 });
        }
        g += '<g class="vi" style="--i:' + (idx + 0.5) + '">' + cl + "</g>";
      }
    });
    g += "</g>";
    return s + g;
  }

  G.ring = { build: build };
})();
