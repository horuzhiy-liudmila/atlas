/* =====================================================================
   Атлас ХПП — орнаменты и виньетки (inline SVG, «гравюрным пером»).
   Правила: штрих 1–1,25 px чернилами, тени — параллельной штриховкой,
   поверх — одна акварельная подкраска. Колосьев нет: герой сайта — хмель.
   Элементы с атрибутом data-orn="имя" заполняются автоматически.
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, A = HA.art, r2 = A.r2;
  var INK = "#33281D", HOPW = "#B9C67F", OCHW = "#E2C68B", PAPER = "#F4ECD9";

  /* ---------- служебное: штриховка внутри многоугольника ---------- */
  function hatchPoly(id, pts, gap, ang) {
    // clipPath + параллельные линии
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs) - 2, x1 = Math.max.apply(null, xs) + 2, y0 = Math.min.apply(null, ys) - 2, y1 = Math.max.apply(null, ys) + 2;
    var d = "";
    var span = (x1 - x0) + (y1 - y0);
    for (var s = -span; s < span; s += gap) {
      d += "M" + r2(x0 + s) + "," + r2(y1) + "L" + r2(x0 + s + (y1 - y0) * Math.tan(ang || Math.PI / 4)) + "," + r2(y0);
    }
    return '<clipPath id="' + id + '"><path d="M' + pts.map(function (p) { return p.join(","); }).join("L") + 'Z"/></clipPath>' +
      '<path d="' + d + '" clip-path="url(#' + id + ')" stroke="' + INK + '" stroke-width=".45" stroke-opacity=".7" fill="none"/>';
  }
  var hid = 0;
  function nid(p) { hid++; return p + hid; }

  /* ---------- Виньетки этапов и разделов (48×48) ---------- */
  var V = {};
  // 1. Плуг и борозды
  V.plough = function () {
    return '<path d="M3 27.5H45" stroke-opacity=".45"/>' +
      '<path d="M1 46 15.5 28M9.5 46 19 28M18 46 22.5 28M26.5 46 26 28M35 46 29.5 28M43.5 46 33 28" stroke-width=".9"/>' +
      '<path d="M6 40.5 17 33.5M4 35.8 13 30.8M12.5 44 20 31" stroke-width=".45" stroke-opacity=".6"/>' +
      '<path d="M24 36.5 41.5 31.5" stroke-width="1.5"/>' +
      '<path d="M39.5 32 45.5 19.5M36.3 33 41.6 21.2" stroke-width="1.15"/>' +
      '<path d="M44.6 19.4 46.6 18.8M40.8 21 42.6 20.6"/>' +
      '<path d="M24 36.5 19.2 41.3 29.6 39.4 27.6 35.5Z" fill="' + OCHW + '"/>' +
      '<path d="M21.5 40.4 27.8 36.6M23.4 40.6 28.6 37.7" stroke-width=".5"/>' +
      '<path d="M30.4 35 32 38.8 27.6 39.4" stroke-width=".8"/>';
  };
  // 2. Шпалерные столбы с проволокой, высота 6–7 м
  V.poles = function () {
    return '<path d="M12 45V6.5M38 45V6.5" stroke-width="1.6"/>' +
      '<path d="M8.5 7.2H41.5" stroke-width=".9"/>' +
      '<path d="M16 7.5 18 44.5M23 7.5 23.5 44.5M29 7.5 28.2 44.5M34 7.5 32.6 44.5" stroke-width=".5" stroke-opacity=".75"/>' +
      '<path d="M18 44.5c-1.6-2.6.8-3.7-.2-6.3M23.5 44.5c1.6-2.4-.8-3.6.4-6M28.2 44.5c-1.4-2.4.8-3.8-.3-6.4M32.6 44.5c1.4-2.5-.6-3.4.3-5.8" stroke="#5C7A2B" stroke-width=".9"/>' +
      '<path d="M3 45.5H45" stroke-opacity=".6"/>' +
      '<path d="M4.5 7V45M3 7.5H6M3 44.5H6" stroke-width=".6"/>' +
      '<path d="M12 45 8 47M38 45 42 47" stroke-width=".6"/>';
  };
  // 3. Капельная линия с листом
  V.drip = function () {
    return '<path d="M3 18.5H45M3 21.5H45" stroke-width=".9"/>' +
      '<path d="M14 21.5v2.5M26 21.5v2.5M38 21.5v2.5" stroke-width="1"/>' +
      '<path d="M14 27.6c-1.3 1.8-1.6 2.8-1.6 3.4a1.6 1.6 0 0 0 3.2 0c0-.6-.3-1.6-1.6-3.4ZM26 29.5c-1.1 1.5-1.3 2.4-1.3 2.9a1.3 1.3 0 0 0 2.6 0c0-.5-.2-1.4-1.3-2.9ZM38 27.6c-1.3 1.8-1.6 2.8-1.6 3.4a1.6 1.6 0 0 0 3.2 0c0-.6-.3-1.6-1.6-3.4Z" fill="#D3DED5" stroke-width=".7"/>' +
      '<path d="M3 41H45" stroke-opacity=".7"/><path d="M6 43.5h5M15 43h7M27 43.6h6M37 43.2h6" stroke-width=".5" stroke-opacity=".6"/>' +
      '<path d="M26 41c.6-4-.4-7.6-2.6-10.6" stroke="#5C7A2B" stroke-width="1"/>' +
      '<g>' + A.leafSVG(23.6, 31, -38, 4.2, { ink: INK, sw: 0.6, teeth: false }) + "</g>";
  };
  // 4. Корзина с шишками
  V.basket = function () {
    var cones = A.coneSVG(17, 13, 12, 7.6, { ink: INK, sw: 0.55 }) + A.coneSVG(24.5, 10.5, 13, 8.3, { ink: INK, sw: 0.55 }) + A.coneSVG(31.6, 13.4, 12, 7.6, { ink: INK, sw: 0.55 });
    return '<g stroke="none">' + cones + "</g>" +
      '<path d="M8 24H40L36.5 44H11.5Z" fill="' + OCHW + '" fill-opacity=".6"/>' +
      '<path d="M8 24H40L36.5 44H11.5Z"/>' +
      '<path d="M8.7 28H39.3M9.4 32H38.6M10.1 36H37.9M10.8 40H37.2" stroke-width=".6"/>' +
      '<path d="M14 24 15 44M20 24 20.5 44M26 24 25.8 44M32 24 31.6 44" stroke-width=".45" stroke-opacity=".7"/>' +
      '<path d="M8 24c0-6 32-6 32 0" stroke-width=".8" stroke-opacity=".8"/>' +
      '<path d="M6.5 24H41.5" stroke-width="1.4"/>';
  };
  // 5. Хмелесушилка: сушильный дом с конусной крышей и флюгером-колпаком
  V.kiln = function () {
    var id = nid("kh");
    return hatchPoly(id, [[30, 44], [30, 26], [33, 26], [33, 44]], 1.6) +
      '<path d="M14.5 44V25.5H30V44" fill="' + PAPER + '"/>' +
      '<path d="M12.5 25.5 22.2 7.5 32 25.5Z" fill="' + OCHW + '" fill-opacity=".7"/>' +
      '<path d="M22.2 7.5 26.6 15.6M22.2 7.5 24.1 17M22.2 7.5 21 18" stroke-width=".45" stroke-opacity=".7"/>' +
      '<path d="M20.2 8.2 21.4 3.2H24.6L25.3 6.4 22.8 8.4" fill="' + PAPER + '" stroke-width=".9"/>' +
      '<path d="M24.6 3.2 27.4 4.6" stroke-width=".8"/>' +
      '<path d="M30 44V31L38 26.5 46 31V44" fill="' + PAPER + '"/>' +
      '<path d="M28.5 31.8 38 26.2 47.5 31.8" stroke-width="1.1"/>' +
      '<path d="M20 44V36.5H24.5V44M35.5 37.5H40.5V41.5H35.5Z" stroke-width=".8"/>' +
      '<path d="M2 44.5H46.5" stroke-width="1"/>';
  };
  // 6. Пресс и мешок гранул
  V.press = function () {
    return '<path d="M5 43V10M23 43V10M3.5 10H24.5M3.5 14H24.5" stroke-width="1.2"/>' +
      '<path d="M14 14V27" stroke-width="1.4"/><path d="M12.4 16.5 15.6 18M12.4 19.5 15.6 21M12.4 22.5 15.6 24" stroke-width=".6"/>' +
      '<path d="M9 5.5H19M14 5.5V10" stroke-width="1.1"/><circle cx="9" cy="5.5" r="1.3"/><circle cx="19" cy="5.5" r="1.3"/>' +
      '<path d="M8 27H20V31H8Z" fill="' + OCHW + '" fill-opacity=".6"/>' +
      '<path d="M8 36H20V43H8Z" fill="' + HOPW + '" fill-opacity=".55"/>' +
      '<path d="M2 43.5H26"/>' +
      '<path d="M29.5 43.5c-1.2-7 .2-14.5 3.6-18.6l-1.6-3.4h9.8l-1.6 3.4c3.4 4.1 4.8 11.6 3.6 18.6Z" fill="' + HOPW + '" fill-opacity=".45"/>' +
      '<path d="M31.5 21.5c1.8 1.2 6.2 1.2 8 0" stroke-width=".8"/>' +
      '<path d="M33 30.5h6.2M32.4 34h7.4M32.6 37.4h7" stroke-width=".45" stroke-opacity=".7"/>' +
      '<path d="M44.3 44.3h1.8v-1.2h-1.8ZM42.8 41.2h1.8V40h-1.8ZM45.2 39.8h1.8v-1.2h-1.8Z" stroke-width=".6"/>';
  };
  function vignette(name, size, opt) {
    opt = opt || {};
    var body = V[name] ? V[name]() : "";
    var stroke = opt.ink || INK;
    return '<svg viewBox="0 0 48 48" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false" class="vig vig-' + name + '">' +
      '<g fill="none" stroke="' + stroke + '" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">' + body + "</g></svg>";
  }

  /* ---------- Разделитель: ◆ — шишка с двумя листьями — ◆ ---------- */
  function divider() {
    return '<svg viewBox="0 0 96 26" aria-hidden="true" focusable="false">' +
      '<path d="M8 13l3-3 3 3-3 3ZM82 13l3-3 3 3-3 3Z" fill="' + INK + '"/>' +
      A.leafSVG(44, 12, -112, 6.2, { ink: INK, sw: 0.6, teeth: false }) +
      A.leafSVG(52, 12, 112, 6.2, { ink: INK, sw: 0.6, teeth: false }) +
      '<g>' + A.coneSVG(48, 8.2, 14, 9, { ink: INK, sw: 0.65 }) + "</g></svg>";
  }

  /* ---------- Значки легенды ---------- */
  var ICONS = {
    trellis: function () { return '<svg viewBox="0 0 26 32" aria-hidden="true" focusable="false">' + HA.globe.trellis.iconSVG(26, 32) + "</svg>"; },
    flow: function () {
      return '<svg viewBox="0 0 34 24" aria-hidden="true" focusable="false"><path d="M3 20Q15 2 30 15" fill="none" stroke="#F4ECD9" stroke-width="4.2"/>' +
        '<path d="M3 20Q15 2 30 15" fill="none" stroke="#A8402A" stroke-width="2" stroke-dasharray="4.5 3"/><path d="M31.5 16.4 24.2 15.6 28.6 10Z" fill="#A8402A"/></svg>';
    }
  };

  /* ---------- Ботанический лист Humulus lupulus (раздел III) ----------
     bare — только растение, без латинских выносок (небольшой рисунок рядом с таблицей) */
  function botanical(bare) {
    var s = "";
    var stem = "M70 500C104 452 76 404 116 362S182 306 172 258 156 182 216 152 290 118 268 74 302 22 350 16";
    // тот же стебель — кубическими сегментами (S развёрнут): по нему ставятся узлы,
    // чтобы листья и шишки крепились ровно к стеблю
    var SEG = [[[70, 500], [104, 452], [76, 404], [116, 362]], [[116, 362], [156, 320], [182, 306], [172, 258]],
      [[172, 258], [162, 210], [156, 182], [216, 152]], [[216, 152], [276, 122], [290, 118], [268, 74]], [[268, 74], [246, 30], [302, 22], [350, 16]]];
    function bez(c, t) { var u = 1 - t; return [u * u * u * c[0][0] + 3 * u * u * t * c[1][0] + 3 * u * t * t * c[2][0] + t * t * t * c[3][0], u * u * u * c[0][1] + 3 * u * u * t * c[1][1] + 3 * u * t * t * c[2][1] + t * t * t * c[3][1]]; }
    function at(T) { // T: 0…5 вдоль стебля
      var i = Math.min(4, Math.floor(T)), t = T - i, p = bez(SEG[i], t), q = bez(SEG[i], Math.min(1, t + 0.01)), q0 = bez(SEG[i], Math.max(0, t - 0.01));
      return { x: p[0], y: p[1], a: Math.atan2(q[1] - q0[1], q[0] - q0[0]) };
    }
    var r2 = A.r2;
    s += '<path class="b-stem" d="' + stem + '" fill="none" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>';
    s += '<path d="' + stem + '" fill="none" stroke="' + INK + '" stroke-width=".55" stroke-opacity=".5" transform="translate(2.4 1.2)"/>';
    // шероховатость стебля — волоски-шипики, растут из стебля под углом вверх
    var hairs = "";
    for (var hT = 0.15; hT < 4.9; hT += 0.21) { var hp = at(hT), ha = hp.a - 0.7; hairs += "M" + r2(hp.x) + "," + r2(hp.y) + "l" + r2(Math.cos(ha) * 4.5) + "," + r2(Math.sin(ha) * 4.5); }
    s += '<path d="' + hairs + '" stroke="' + INK + '" stroke-width=".55" stroke-opacity=".55" stroke-linecap="round"/>';
    var leaves = "", cones = "", stalks = "";
    var LEAF = function (x, y, rot, size) { return A.leafSVG(x, y, rot, size, { ink: INK, sw: 1, fill: "#B9C67F", washLight: "#DFE3B8", fillOpacity: 0.62 }); };
    var anchors = {};
    /* узел: пара супротивных листьев на черешках + (необязательно) гроздь шишек из пазухи */
    function node(T, size, cone) {
      var p = at(T);
      [-1, 1].forEach(function (sd, j) {
        var pa = p.a + sd * 1.15, pl = size * 0.55;             // черешок — под углом к стеблю
        var ex = p.x + Math.cos(pa) * pl, ey = p.y + Math.sin(pa) * pl;
        stalks += "M" + r2(p.x) + "," + r2(p.y) + "Q" + r2(p.x + Math.cos(pa) * pl * 0.5 + Math.cos(p.a) * 2) + "," + r2(p.y + Math.sin(pa) * pl * 0.5 + Math.sin(p.a) * 2) + " " + r2(ex) + "," + r2(ey);
        var rot = (pa + Math.PI / 2) * 180 / Math.PI;             // лист смотрит вдоль черешка
        var sz = size * (j ? 1.06 : 0.94);
        leaves += LEAF(ex, ey, rot, sz);
        if (!anchors.leaf && size > 28 && sd === -1) anchors.leaf = [ex + Math.cos(pa) * sz * 1.2, ey + Math.sin(pa) * sz * 1.2];
      });
      if (cone) {
        // плодоножки выходят из пазухи (точка узла), свисают и держат шишки
        cone.forEach(function (c) {
          var H = c[0], dx = c[1], dy = c[2];
          var ex = p.x + dx, ey = p.y + dy;                       // конец плодоножки = черешок шишки
          stalks += "M" + r2(p.x) + "," + r2(p.y) + "C" + r2(p.x + dx * 0.4) + "," + r2(p.y + dy * 0.1) + " " + r2(ex) + "," + r2(ey - dy * 0.6) + " " + r2(ex) + "," + r2(ey);
          var W = H * 0.64, top = ey + H * 0.24;                  // coneSVG: черешок шишки начинается в (cx + 0,1W, top − 0,24H)
          var cx = ex - W * 0.1;
          cones += "<g>" + A.coneSVG(cx, top, H, W, { ink: INK, sw: 0.9 }) + "</g>";
          if (!anchors.cone && H > 40) anchors.cone = [cx, top + H * 0.55];
        });
      }
      return p;
    }
    node(0.62, 30, [[46, 14, 12], [38, -10, 18]]);
    var mid = node(1.55, 28, null);
    node(2.55, 22, [[40, 10, 14]]);
    node(3.6, 16, null);
    node(4.35, 13, [[28, 8, 10], [22, 22, 6]]);
    anchors.stem = (function () { var q = at(2.05); return [q.x, q.y]; })();
    s += '<path d="' + stalks + '" fill="none" stroke="' + INK + '" stroke-width=".95" stroke-linecap="round"/>';
    s += leaves + cones;
    if (bare) return '<svg viewBox="40 0 330 520" aria-hidden="true" focusable="false">' + s + "</svg>";
    // подписи с выносками: точка стоит на самом органе (шишка, пластинка листа, стебель),
    // линия выходит из конца подчёркивания слова и не проходит через буквы
    var ann = 'font-family="Old Standard TT, serif" font-style="italic" font-size="15" fill="#5A4A38"';
    var cap = 'font-family="PT Serif, serif" font-size="11.5" letter-spacing="1.6" fill="#6E5C46"';
    var lead = function (d, dot) {
      return '<path d="' + d + '" fill="none" stroke="#5A4A38" stroke-width=".75"/>' +
        '<circle cx="' + dot[0] + '" cy="' + dot[1] + '" r="2.6" fill="#FAF5E8" stroke="#5A4A38" stroke-width=".8"/><circle cx="' + dot[0] + '" cy="' + dot[1] + '" r="1.1" fill="#5A4A38"/>';
    };
    // шишка — нижняя шишка грозди
    var c0 = anchors.cone, l0 = anchors.leaf, t0 = anchors.stem;
    s += lead("M" + r2(c0[0]) + "," + r2(c0[1]) + "L222 404H292", c0);
    s += "<text " + ann + ' x="226" y="398">strobilus</text><text ' + cap + ' x="226" y="418">ШИШКА</text>';
    // лист — пластинка левого листа средней пары
    s += lead("M6 226H52L" + r2(l0[0]) + "," + r2(l0[1]), l0);
    s += "<text " + ann + ' x="8" y="220">folium</text><text ' + cap + ' x="8" y="240">ЛИСТ</text>';
    // вьющийся стебель — точка на линии стебля (изгиб между парами листьев), подпись слева — на свободном поле
    s += lead("M6 156H140L" + r2(t0[0]) + "," + r2(t0[1]), t0);
    s += "<text " + ann + ' x="8" y="150">caulis volubilis</text><text ' + cap + ' x="8" y="172">ВЬЮЩИЙСЯ СТЕБЕЛЬ</text>';
    return '<svg viewBox="0 0 400 520" role="img" aria-labelledby="plant-t" focusable="false"><title id="plant-t">Ботанический рисунок хмеля обыкновенного: вьющийся стебель, супротивные листья с пильчатым краем, шишки</title>' + s + "</svg>";
  }

  /* ---------- Автозаполнение ---------- */
  function fill(root) {
    HA.$$("[data-orn]", root).forEach(function (el) {
      var n = el.getAttribute("data-orn"), size = +el.getAttribute("data-size") || 48;
      if (n === "divider") el.innerHTML = divider();
      else if (n === "seal") el.innerHTML = '<svg viewBox="0 0 ' + size + " " + size + '" aria-hidden="true" focusable="false">' + A.sealSVG(size, { bg: "#F4ECD9" }) + "</svg>";
      else if (n === "botanical") el.innerHTML = botanical(false);
      else if (n === "botanical-bare") el.innerHTML = botanical(true);
      else if (n.indexOf("icon-") === 0) el.innerHTML = ICONS[n.slice(5)] ? ICONS[n.slice(5)](el.getAttribute("data-n")) : "";
      else if (V[n]) el.innerHTML = vignette(n, size);
    });
  }

  HA.orn = { vignette: vignette, divider: divider, icons: ICONS, botanical: botanical, fill: fill };
})();
