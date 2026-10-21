/* =====================================================================
   Лист V · Аналитика и прогнозы: тезис о площадях и честный график
   прогноза рынка. ВСЕ точки графика — прогноз из материалов НИР
   (2025, 2026 и 2031 г.) — это сказано один раз, в заголовке графика.
   Ось лет пропорциональна; между 2026 и 2031 промежуточных значений
   нет — промежуток заштрихован и подписан «данных нет», линия через
   него — пунктир. Ось значений начинается с 8 (знак разрыва «≈»).
   Над графиком — одна строка-вывод (рост прогноза).
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, DATA = window.ATLAS_DATA, NB = HA.NB;
  var STAR = '<span class="fn" aria-hidden="true" title="Рассчитано по данным атласа">*</span>';

  HA.initForecast = function () {
    var F = DATA.forecast;
    var pts = F.points.slice().sort(function (a, b) { return a.year - b.year; });

    /* ---------- тезис: крупно «примерно −1 300 га», под ним смысл — один раз ---------- */
    var th = HA.$("#thesis");
    // число уже стоит крупно — из фразы НИР убираем повтор «примерно на 1300 га»
    var cap = F.text.replace(new RegExp("\\s*(?:примерно\\s+|около\\s+|~\\s*)?на\\s+~?\\s*" + F.areaCutHa + "\\s*га", "i"), "");
    if (cap.indexOf(String(F.areaCutHa)) >= 0) cap = F.text.replace(String(F.areaCutHa), HA.fmt(F.areaCutHa));
    th.innerHTML =
      '<p class="thesis__fig" aria-label="' + HA.esc("примерно минус " + HA.fmt(F.areaCutHa) + " гектаров") + '"><span class="pre" aria-hidden="true">примерно</span><span aria-hidden="true"><span class="minus">−</span>' + HA.fmt(F.areaCutHa) + '</span><span class="u" aria-hidden="true">га</span></p>' +
      '<p class="thesis__cap">' + HA.t(cap) + "</p>" +
      '<p class="thesis__second">' + HA.t(F.text2) + "</p>";

    /* ---------- график ---------- */
    var host = HA.$("#forecast-chart");
    var tip = document.createElement("div");
    tip.className = "tip"; tip.setAttribute("aria-hidden", "true");
    host.style.position = "relative";
    var y0 = 8, y1 = 12;
    var first = pts[0], last = pts[pts.length - 1];
    var growth = (last.v / first.v - 1) * 100;
    var gapFrom = null, gapTo = null;
    for (var g = 0; g < pts.length - 1; g++) if (pts[g + 1].year - pts[g].year > 1) { gapFrom = pts[g].year + 1; gapTo = pts[g + 1].year - 1; }
    var gapText = gapFrom == null ? "" : (gapFrom === gapTo ? gapFrom + NB + "г." : gapFrom + "–" + gapTo + NB + "гг.");

    // вывод над графиком — одна цифра и одна фраза
    HA.$("#forecast-take").innerHTML = "<b>+" + HA.fmt(growth, 1) + NB + "%</b>" + STAR + " — рост прогноза с&nbsp;" + first.year + " по&nbsp;" + last.year + "&nbsp;г.";

    function draw() {
      var W = Math.max(300, Math.round(host.getBoundingClientRect().width));
      var narrow = W < 520;
      var H = narrow ? 290 : 320;
      var m = { l: narrow ? 40 : 52, r: narrow ? 26 : 40, t: 34, b: 40 };
      var pad = narrow ? 20 : 30; // первая точка отходит от оси
      var X = function (yr) { return m.l + pad + (W - m.l - m.r - pad) * (yr - first.year) / (last.year - first.year); };
      var Y = function (v) { return m.t + (H - m.t - m.b) * (1 - (v - y0) / (y1 - y0)); };
      var halo = ' paint-order="stroke" stroke="#F4ECD9" stroke-width="4" stroke-linejoin="round"';
      var s = '<svg class="fchart" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="group" aria-labelledby="fc-t" aria-describedby="fc-d">' +
        '<title id="fc-t">' + HA.esc(F.title + " (прогноз НИР), " + F.unit) + "</title>" +
        '<desc id="fc-d">' + HA.esc("Прогноз НИР: " + pts.map(function (p) { return p.year + " год — " + HA.fmt(p.v, 2); }).join("; ") + (gapText ? ". За " + gapText.replace(NB, " ") + " данных нет." : ".")) + "</desc>";
      // сетка (точечная) и подписи оси значений
      for (var v = y0; v <= y1; v++) {
        s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#33281D" stroke-opacity="' + (v === y0 ? 0 : 0.28) + '" stroke-dasharray="1 3"/>';
        s += '<text x="' + (m.l - 10) + '" y="' + (Y(v) + 5) + '" text-anchor="end" font-size="15" fill="#5A4A38">' + v + "</text>";
      }
      // промежуток без данных (2027–2030): заметная штриховка и подпись
      if (gapFrom != null) {
        var gx0 = X(gapFrom - 1) + 10, gx1 = X(gapTo + 1) - 10;
        s += '<rect x="' + gx0 + '" y="' + m.t + '" width="' + (gx1 - gx0) + '" height="' + (H - m.t - m.b) + '" fill="url(#hatch-gap)"/>';
        s += '<rect x="' + gx0 + '" y="' + m.t + '" width="' + (gx1 - gx0) + '" height="' + (H - m.t - m.b) + '" fill="none" stroke="#33281D" stroke-opacity=".35" stroke-dasharray="2 3"/>';
        var cx = (gx0 + gx1) / 2;
        var lbl = narrow ? [gapText + ":", "данных нет"] : [gapText + ": данных нет"];
        // плашка — в нижней части промежутка, под линией прогноза (не закрывает пунктир)
        var bw = narrow ? 112 : 196, by = Y(y0 + (y1 - y0) * 0.22) - 14;
        s += '<rect x="' + (cx - bw / 2) + '" y="' + by + '" width="' + bw + '" height="' + (lbl.length * 19 + 9) + '" fill="#FAF5E8" stroke="#33281D" stroke-opacity=".45"/>';
        lbl.forEach(function (t, k) {
          s += '<text x="' + cx + '" y="' + (by + 20 + k * 19) + '" text-anchor="middle" font-size="15" font-style="italic" fill="#5A4A38">' + HA.esc(t) + "</text>";
        });
      }
      // ось лет: пропорциональная; подписаны только годы со значениями
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + (H - m.b) + '" y2="' + (H - m.b) + '" stroke="#5A4A38"/>';
      for (var yr = first.year; yr <= last.year; yr++) {
        var has = pts.some(function (p) { return p.year === yr; });
        s += '<line x1="' + X(yr) + '" x2="' + X(yr) + '" y1="' + (H - m.b) + '" y2="' + (H - m.b + (has ? 6 : 3)) + '" stroke="#5A4A38" stroke-opacity="' + (has ? 1 : 0.5) + '"/>';
        if (has) s += '<text x="' + X(yr) + '" y="' + (H - m.b + 24) + '" text-anchor="middle" font-size="15" fill="#33281D">' + yr + "</text>";
      }
      // ось значений с разрывом «≈»: начинается с 8, а не с нуля
      var ay = H - m.b;
      s += '<line x1="' + m.l + '" x2="' + m.l + '" y1="' + m.t + '" y2="' + (ay - 16) + '" stroke="#5A4A38"/>';
      s += '<line x1="' + m.l + '" x2="' + m.l + '" y1="' + (ay - 5) + '" y2="' + ay + '" stroke="#5A4A38"/>';
      s += '<path d="M' + (m.l - 7) + "," + (ay - 13) + "q3.5,-3 7,0t7,0M" + (m.l - 7) + "," + (ay - 7.5) + 'q3.5,-3 7,0t7,0" stroke="#5A4A38" stroke-width="1.2" fill="none"/>';
      // линия: соседние годы — сплошная, через промежуток без значений — пунктир
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1], gap = b.year - a.year > 1;
        s += '<line class="ln" x1="' + X(a.year) + '" y1="' + Y(a.v) + '" x2="' + X(b.year) + '" y2="' + Y(b.v) + '" stroke="#A8402A" stroke-width="2.2" stroke-linecap="round"' + (gap ? ' stroke-dasharray="7 6"' : "") + "/>";
      }
      // точки (все — прогноз, оформление одинаковое) и подписи значений над точками
      pts.forEach(function (p, k) {
        var isLast = k === pts.length - 1;
        s += '<g class="pt" tabindex="0" role="img" data-k="' + k + '" aria-label="' + HA.esc(p.year + " год: " + HA.fmt(p.v, 2) + " млрд долл. США, прогноз НИР") + '">' +
          '<circle cx="' + X(p.year) + '" cy="' + Y(p.v) + '" r="14" fill="transparent"/>' +
          '<circle class="ring" cx="' + X(p.year) + '" cy="' + Y(p.v) + '" r="6" fill="#FAF5E8" stroke="#A8402A" stroke-width="2.4"/>' +
          "</g>";
        var tx = X(p.year) + (isLast ? -12 : 0), ty = Y(p.v) - 16;
        s += '<text x="' + tx + '" y="' + ty + '" text-anchor="' + (isLast ? "end" : "middle") + '" font-family="Old Standard TT, serif" font-size="' + (narrow ? 20 : 24) + '" fill="#33281D"' + halo + ">" + HA.fmt(p.v, 2) + "</text>";
      });
      s += "</svg>";
      host.innerHTML = s;
      host.appendChild(tip);
    }
    draw();
    var t = 0, lastW = 0;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(function () { var w = Math.round(host.getBoundingClientRect().width); if (w !== lastW) { lastW = w; draw(); } }, 120);
    });

    function show(g) {
      var k = +g.getAttribute("data-k"), p = pts[k];
      tip.innerHTML = "<b>" + p.year + NB + 'г.</b><span class="m">' + HA.fmt(p.v, 2) + NB + "млрд" + NB + "долл. США</span><small>прогноз НИР</small>";
      var hb = host.getBoundingClientRect(), gb = g.getBoundingClientRect();
      var x = gb.left - hb.left + gb.width / 2 + 12, y = gb.top - hb.top + gb.height / 2 + 14;
      tip.style.left = Math.max(0, Math.min(hb.width - 230, x)) + "px";
      tip.style.top = y + "px";
      tip.classList.add("on");
    }
    host.addEventListener("pointerover", function (e) { var g = e.target.closest(".pt"); if (g) show(g); });
    host.addEventListener("pointerout", function (e) { if (e.target.closest(".pt")) tip.classList.remove("on"); });
    host.addEventListener("focusin", function (e) { var g = e.target.closest(".pt"); if (g) show(g); });
    host.addEventListener("focusout", function () { tip.classList.remove("on"); });

    HA.$("#forecast-note").innerHTML = '<span aria-hidden="true">*</span> Рассчитано по&nbsp;данным атласа. Шкала начинается с&nbsp;8&nbsp;млрд&nbsp;долл. США (знак&nbsp;≈ на&nbsp;оси).';
  };
})();
