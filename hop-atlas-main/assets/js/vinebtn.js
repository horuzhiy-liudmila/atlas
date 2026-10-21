/* =====================================================================
   Кнопка «Открыть атлас»: при наведении кнопку обвивает хмель.
   Лоза поднимается от левого нижнего угла, идёт по верхнему краю
   и спускается справа; по ходу распускаются листья и повисают шишки.
   Курсор ушёл — всё сворачивается в обратном порядке.
   На сенсорных экранах (без наведения) хмель один раз прорастает,
   когда кнопка появляется на экране. Рисунок — из HA.art (те же лист
   и шишка, что на глобусе и в орнаментах).
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, A = HA.art, r2 = A.r2;
  var P = 96; // запас вокруг кнопки под разросшийся куст

  /* Куст хмеля, разрастающийся из-за кнопки во все стороны.
     Побег: путь от точки за кнопкой наружу, с изгибом и лёгкой волной;
     сужается к кончику (рисуется несколькими отрезками всё тоньше),
     на кончике — завиток-усик. Листья — супротивно по узлам, у основания
     крупнее; на части побегов висят шишки. */
  function build(btn) {
    var host = btn.parentNode;
    var w = btn.offsetWidth, h = btn.offsetHeight;
    if (!w || !h) return;
    HA.$$(".atlas-vine", host).forEach(function (o) { o.remove(); });
    var W = w + 2 * P, H = h + 2 * P, cx = P + w / 2, cy = P + h / 2;
    var rnd = HA.lcg(17);
    var out = { stems: "", leaves: "", tips: "", cones: "" };
    // направления побегов (градусы, 0 — вправо, −90 — вверх): веером вокруг кнопки
    // вниз побеги не идут — там подсказка и легенда; вбок — длиннее
    // нижняя граница куста: чуть ниже кнопки — ничего не обрезается, ниже идёт подсказка
    var LIM = P + h + 9;
    var DIRS = [-176, -156, -131, -104, -84, -58, -33, -10, 8, 22, 158, 172];
    var GROW = 0.95;
    DIRS.forEach(function (deg, si) {
      deg += (rnd() - 0.5) * 14;
      var a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      // старт — за кнопкой, на эллипсе внутри неё
      var sx = cx + ca * w * 0.34, sy = cy + sa * h * 0.3;
      // длина: вбок длиннее, вверх-вниз короче (не закрывать глобус и подпись)
      // на узком экране сверху вплотную кнопки видов — вверх куст почти не растёт
      var up = window.innerWidth < 1024 ? 10 : 34;
      // вбок — не дальше края экрана (на телефоне кнопка во всю ширину)
      var side = Math.max(10, Math.min(58, (window.innerWidth - w) / 2 - 12));
      var len = (Math.abs(ca) * side + Math.abs(sa) * (sa < 0 ? up : 14)) * (0.85 + rnd() * 0.25);
      var reach = len + Math.abs(ca) * w * 0.16 + Math.abs(sa) * h * 0.2; // путь из-за кнопки наружу
      var bend = (rnd() - 0.5) * 0.8 - 0.3 * Math.sign(ca || 1) * (Math.abs(sa) < 0.35 ? 1 : 0.4); // боковые побеги загибаются вверх // изгиб побега
      // побег «ищет опору»: направление меняется по сумме случайных волн,
      // у части побегов посередине — виток-петля (хмель вьётся)
      var N = 40, pts = [[sx, sy]], hd = a, ds = reach / N;
      var f1 = 5 + rnd() * 6, f2 = 11 + rnd() * 9, p1 = rnd() * 6.3, p2 = rnd() * 6.3;
      var amp1 = 0.09 + rnd() * 0.07, amp2 = 0.05 + rnd() * 0.05;
      var loopAt = rnd() < 0.5 ? 0.45 + rnd() * 0.3 : -1, loopDir = rnd() < 0.5 ? 1 : -1;
      for (var i = 1; i <= N; i++) {
        var t = i / N;
        var curv = bend * 2 * t / N + amp1 * Math.sin(f1 * t + p1) * t + amp2 * Math.sin(f2 * t + p2) * t;
        if (loopAt > 0 && Math.abs(t - loopAt) < 0.1) curv += loopDir * (Math.PI * 2) / (0.2 * N); // полный виток за 20 % длины
        hd += curv;
        var ss = ds * (loopAt > 0 && Math.abs(t - loopAt) < 0.1 ? 0.55 : 1);
        var nx2 = pts[i - 1][0] + Math.cos(hd) * ss, ny2 = pts[i - 1][1] + Math.sin(hd) * ss;
        // упёрся в нижнюю границу — побег отворачивает вверх
        if (ny2 > LIM - 3) { hd = -Math.abs(hd % (2 * Math.PI)) * 0.3 + (Math.cos(hd) >= 0 ? -0.35 : Math.PI + 0.35); ny2 = Math.min(ny2, LIM - 3); }
        pts.push([nx2, ny2]);
      }
      // длина по точкам
      var acc = [0];
      for (i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      var L = acc[acc.length - 1];
      var delay = si * 0.035 + rnd() * 0.06, dur = 0.85 + rnd() * 0.25;
      function seg(i0, i1) {
        var d = "M" + r2(pts[i0][0]) + "," + r2(pts[i0][1]);
        for (var k = i0 + 1; k <= i1; k++) d += "L" + r2(pts[k][0]) + "," + r2(pts[k][1]);
        return d;
      }
      // сужение: 4 отрезка, каждый тоньше; растут по очереди
      var cuts = [0, 11, 20, 30, N], widths = [2.6, 2.0, 1.45, 0.95];
      for (var c = 0; c < 4; c++) {
        var l0 = acc[cuts[c]], l1 = acc[cuts[c + 1]], sl = l1 - l0;
        var din = delay + (l0 / L) * dur, dd = (sl / L) * dur;
        var dout = (1 - l1 / L) * 0.25 + 0.12;
        out.stems += '<path class="v-st" d="' + seg(cuts[c], cuts[c + 1]) + '" style="--l:' + r2(sl + 1) + ";--din:" + din.toFixed(3) + "s;--dur:" + dd.toFixed(3) + "s;--dout:" + dout.toFixed(3) + 's" stroke-width="' + widths[c] + '"/>';
      }
      // светлый блик вдоль основания побега (объём стебля)
      out.stems += '<path class="v-st v-st--hl" d="' + seg(0, 20) + '" style="--l:' + r2(acc[20] + 1) + ";--din:" + delay.toFixed(3) + "s;--dur:" + ((acc[20] / L) * dur).toFixed(3) + "s;--dout:" + (0.3).toFixed(3) + 's" stroke-width=".7"/>';
      // тонкий второй побег обвивает основной (хмель вьётся по часовой)
      var tw = "", nk = Math.round(N * 0.8);
      for (var k3 = 0; k3 <= nk; k3++) {
        var pA = pts[k3], pB = pts[Math.min(N, k3 + 1)], dx3 = pB[0] - pA[0], dy3 = pB[1] - pA[1], dl3 = Math.hypot(dx3, dy3) || 1;
        var o3 = Math.sin(acc[k3] / 5.5 + si) * 2.4 * (1 - k3 / nk * 0.6);
        tw += (k3 ? "L" : "M") + r2(pA[0] - dy3 / dl3 * o3) + "," + r2(pA[1] + dx3 / dl3 * o3);
      }
      out.stems += '<path class="v-st" d="' + tw + '" style="--l:' + r2(acc[nk] * 1.25 + 4) + ";--din:" + (delay + 0.08).toFixed(3) + "s;--dur:" + ((acc[nk] / L) * dur).toFixed(3) + 's;--dout:.1s" stroke-width=".8" stroke-opacity=".85"/>';
      // узлы с листьями: начиная с выхода из-за кнопки
      var startT = (Math.abs(ca) * w * 0.16 + Math.abs(sa) * h * 0.2) / reach;
      var nodes = Math.max(3, Math.round(len / 15)), side = si % 2 ? 1 : -1;
      for (var q = 0; q < nodes; q++) {
        var tt = startT + (1 - startT) * ((q + 0.6) / (nodes + 0.4));
        var idx = Math.min(N - 1, Math.round(tt * N));
        var p = pts[idx], pn = pts[idx + 1];
        var dir = Math.atan2(pn[1] - p[1], pn[0] - p[0]) * 180 / Math.PI;
        side = -side;
        var size = (7.6 - 4.2 * (q / nodes)) * (0.88 + rnd() * 0.24);
        // черешок — короткая веточка наружу от побега под углом
        var pa = (dir + side * 62) * Math.PI / 180, plen = 3 + size * 0.45;
        var lx = p[0] + Math.cos(pa) * plen, ly = p[1] + Math.sin(pa) * plen;
        var rot = dir + side * (34 + rnd() * 40) + 90 + (rnd() - 0.5) * 36;
        var din2 = delay + tt * dur + 0.04, dout2 = (1 - tt) * 0.18;
        var rr0 = rot * Math.PI / 180, tipY = ly - Math.cos(rr0) * size * 2.3;
        var leafOk = Math.max(ly, tipY) + size * 0.9 < LIM;
        // усик-завиток с узла (на каждом третьем)
        if (q % 3 === 2) {
          var ua = (dir - side * 55) * Math.PI / 180, ux = p[0] + Math.cos(ua) * 5, uy = p[1] + Math.sin(ua) * 5, sp = "M" + r2(p[0]) + "," + r2(p[1]) + "L" + r2(ux) + "," + r2(uy);
          for (var z2 = 1; z2 <= 16; z2++) { var zt2 = z2 / 16, an2 = ua + side * zt2 * Math.PI * 3, rr2 = 4 * (1 - zt2 * 0.75); sp += "L" + r2(ux + Math.cos(an2) * rr2 * zt2 + Math.cos(ua) * 3 * zt2) + "," + r2(uy + Math.sin(an2) * rr2 * zt2 + Math.sin(ua) * 3 * zt2); }
          out.tips += '<path class="v-st v-st--tip" d="' + sp + '" style="--l:40;--din:' + din2.toFixed(3) + "s;--dur:.4s;--dout:0s" + '" stroke-width=".65"/>';
        }
        if (leafOk) out.leaves += '<g class="v-it" style="--din:' + din2.toFixed(3) + "s;--dout:" + dout2.toFixed(3) + "s;transform-origin:" + r2(p[0]) + "px " + r2(p[1]) + 'px">' +
          '<path d="M' + r2(p[0]) + "," + r2(p[1]) + "L" + r2(lx) + "," + r2(ly) + '" stroke="#4E6B25" stroke-width=".8" fill="none"/>' +
          A.leafSVG(lx, ly, rot, size, { ink: "#33281D", sw: 0.55, kind: size < 4.6 || q % 3 === 2 ? "heart" : "lobed" }) + "</g>";
        // шишки: на некоторых узлах побегов, висят вниз парой
        if ((si % 3 === 1 && q === 1) || (si % 4 === 0 && q === 2 && nodes > 3)) {
          var cs = 11 + rnd() * 3;
          if (p[1] + 5 + 3 + cs * 1.3 < LIM) [-1, 1].forEach(function (o, j) {
            var hx = p[0] + o * 4 + (j ? 1 : 0), hy = p[1] + 5 + j * 3;
            out.cones += '<g class="v-it v-it--cone" style="--din:' + (din2 + 0.12 + j * 0.06).toFixed(3) + "s;--dout:" + dout2.toFixed(3) + "s;transform-origin:" + r2(p[0]) + "px " + r2(p[1]) + 'px">' +
              '<path d="M' + r2(p[0]) + "," + r2(p[1]) + "Q" + r2(hx - o * 2) + "," + r2(p[1] + 1) + " " + r2(hx) + "," + r2(hy) + '" stroke="#4E6B25" stroke-width=".8" fill="none"/>' +
              A.coneSVG(hx, hy + cs * 0.24, cs * (j ? 0.86 : 1), cs * 0.62 * (j ? 0.86 : 1), { ink: "#33281D", sw: 0.55 }) + "</g>";
          });
        }
      }
      // усик на кончике: спираль
      var tp = pts[N], tq = pts[N - 1], ta = Math.atan2(tp[1] - tq[1], tp[0] - tq[0]);
      var spiral = "M" + r2(tp[0]) + "," + r2(tp[1]), turn = si % 2 ? 1 : -1;
      for (var z = 1; z <= 22; z++) {
        var zt = z / 22, rr = 6 * (1 - zt * 0.8), an = ta + turn * zt * Math.PI * 2.6;
        spiral += "L" + r2(tp[0] + Math.cos(ta) * 6 * zt + Math.cos(an + turn * Math.PI / 2) * rr * zt) + "," + r2(tp[1] + Math.sin(ta) * 6 * zt + Math.sin(an + turn * Math.PI / 2) * rr * zt);
      }
      out.tips += '<path class="v-st v-st--tip" d="' + spiral + '" style="--l:40;--din:' + (delay + dur).toFixed(3) + "s;--dur:.35s;--dout:0s" + '" stroke-width=".75"/>';
    });

    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "atlas-vine");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.style.width = W + "px"; svg.style.height = H + "px";
    // положение — от рамки контейнера (offsetLeft врёт, если у предков display:contents)
    var hb = host.getBoundingClientRect(), bb = btn.getBoundingClientRect();
    svg.style.left = (bb.left - hb.left - P) + "px"; svg.style.top = (bb.top - hb.top - P) + "px";
    // порядок: стебли → усики → листья → шишки (шишки поверх листьев)
    // ниже кнопки куст не растёт (там подсказка и легенда): обрезаем у нижнего края
    svg.innerHTML = '<g><g fill="none" stroke="#4E6B25" stroke-linecap="round" stroke-linejoin="round">' + out.stems + out.tips + "</g>" + out.leaves + out.cones + "</g>";
    host.insertBefore(svg, btn); // куст — позади кнопки

    /* передний план: несколько листьев и пара шишек заходят на края кнопки —
       куст объёмный, кнопка будто стоит внутри него (надпись не закрывают) */
    var F = "", fi = 0;
    function front(x, y, rot, sz, kind, delay) {
      F += '<g class="v-it" style="--din:' + delay.toFixed(3) + "s;--dout:" + (0.02 + fi * 0.02).toFixed(3) + "s;transform-origin:" + r2(x) + "px " + r2(y) + 'px">' +
        A.leafSVG(x, y, rot, sz, { ink: "#33281D", sw: 0.55, kind: kind }) + "</g>";
      fi++;
    }
    var bx0 = P, by0 = P, bx1 = P + w, by1 = P + h;
    front(bx0 + 2, by0 + 8, 128, 9.2, "lobed", 0.42);        // левый верх — внутрь кнопки
    front(bx0 + 1, by1 - 4, 60, 7.4, "heart", 0.55);         // левый низ
    front(bx1 - 1, by0 + 7, -126, 9.4, "lobed", 0.48);       // правый верх
    front(bx1 - 1, by1 - 3, -66, 7, "heart", 0.6);         // правый низ
    front(bx0 + w * 0.28, by0 - 3, 168, 5.4, "heart", 0.66); // сверху, свисает на край
    // пара шишек свисает с верхнего правого угла на кнопку
    var chx = bx1 - 16, chy = by0 - 6;
    [[0, 0, 12.5], [7, 3, 10.5]].forEach(function (c, j) {
      F += '<g class="v-it v-it--cone" style="--din:' + (0.7 + j * 0.08).toFixed(3) + "s;--dout:0s;transform-origin:" + r2(chx) + "px " + r2(chy) + 'px">' +
        '<path d="M' + r2(chx) + "," + r2(chy) + "Q" + r2(chx + c[0] * 0.5) + "," + r2(chy + 2) + " " + r2(chx + c[0]) + "," + r2(chy + 5 + c[1]) + '" stroke="#4E6B25" stroke-width=".9" fill="none"/>' +
        A.coneSVG(chx + c[0], chy + 5 + c[1] + c[2] * 0.24, c[2], c[2] * 0.62, { ink: "#33281D", sw: 0.55 }) + "</g>";
    });
    var fsvg = document.createElementNS(NS, "svg");
    fsvg.setAttribute("class", "atlas-vine atlas-vine--front");
    fsvg.setAttribute("aria-hidden", "true");
    fsvg.setAttribute("viewBox", "0 0 " + W + " " + H);
    fsvg.style.cssText = svg.style.cssText;
    fsvg.innerHTML = '<g style="filter:drop-shadow(0 1.5px 1.2px rgba(30,24,10,.35))">' + F + "</g>";
    host.appendChild(fsvg);
    btn._vine = { classList: { toggle: function (c, on) { svg.classList.toggle(c, on); fsvg.classList.toggle(c, on); }, contains: function (c) { return svg.classList.contains(c); } } };
  }

  HA.initVineButtons = function () {
    HA.$$(".atlas-btn").forEach(function (btn) {
      var host = btn.parentNode;
      if (!host) return;
      host.classList.add("has-vine");
      function grow(on) { if (btn._vine) btn._vine.classList.toggle("is-grown", on); }
      var rebuild = function () { var g = btn._vine && btn._vine.classList.contains("is-grown"); build(btn); grow(!!g); };
      rebuild();
      btn.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse" || e.pointerType === "pen") grow(true); });
      btn.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse" || e.pointerType === "pen") grow(false); });
      btn.addEventListener("focus", function () { if (btn.matches(":focus-visible")) grow(true); });
      btn.addEventListener("blur", function () { grow(false); });
      var t = 0, lastW = 0;
      var later = function () { clearTimeout(t); t = setTimeout(rebuild, 120); };
      window.addEventListener("resize", later);
      // размер кнопки меняется (шрифты, раскладка) — куст перестраивается
      if ("ResizeObserver" in window) new ResizeObserver(function () { if (btn.offsetWidth !== lastW) { lastW = btn.offsetWidth; later(); } }).observe(btn);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
      // сенсорный экран: хмель прорастает, когда кнопка появляется на экране
      if (window.matchMedia && matchMedia("(hover: none)").matches && "IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (en) {
          if (en[0].isIntersecting) { setTimeout(function () { grow(true); }, 400); io.disconnect(); }
        }, { threshold: 0.9 });
        io.observe(btn);
      }
    });
  };
})();
