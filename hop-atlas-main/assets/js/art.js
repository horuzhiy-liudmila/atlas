/* =====================================================================
   Атлас ХПП — общие рисованные элементы: шишка и лист хмеля.
   Одни и те же контуры используются на canvas (глобус) и в SVG
   (орнаменты, виньетки, ботанический лист).

   Ботаника Humulus lupulus:
   • лист — 3 лопасти, сердцевидное основание, ПИЛЬЧАТЫЙ край, зубцы
     смотрят к вершине лопасти, жилки пальчатые из одной точки;
   • шишка — веретено из черепитчатых прицветников рядами,
     кончики заострены, сверху короткий черешок;
   • лоза вьётся по часовой стрелке (если смотреть сверху).
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA;
  var r2 = function (v) { return Math.round(v * 100) / 100; };

  /* ---------------- Шишка ----------------
     cx — ось, top — верх тела шишки, H — высота, W — ширина.
     Шишка хмеля — яйцевидное «веретено» из черепитчатых прицветников:
     они сидят мутовками вокруг оси, кончиками вниз; соседние мутовки
     смещены на полшага, поэтому ряды «сцепляются». Видна передняя
     половина: боковые прицветники сжаты перспективой и темнее
     (свет слева сверху). В пазухах — золотистые крупинки лупулина.
     Нижние ряды рисуются первыми — верхние перекрывают их основания. */
  function conePaths(cx, top, H, W) {
    var n = H < 16 ? 5 : H < 30 ? 7 : 9;             // число мутовок
    var m = H < 16 ? 4 : 6;                          // прицветников в мутовке (по кругу)
    var step = H / (n + 0.9), L = step * 2.05;
    var scales = [], veins = "", lup = [];
    for (var i = 0; i < n; i++) {
      var u = (i + 0.55) / n;
      // профиль: узко у черешка, шире всего на ~40 % высоты, к низу — сужение к кончику
      var f = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.82)), 0.62);
      var hw = (W / 2) * Math.max(i === 0 ? 0.2 : 0.3, f), y0 = top + i * step;
      var off = i % 2 ? 0.5 : 0;
      var row = [];
      for (var k = 0; k < m; k++) {
        var th = (2 * Math.PI * (k + off)) / m - Math.PI / 2 + 0.18; // угол вокруг оси
        var cz = Math.cos(th);                                     // > 0 — обращён к нам
        if (cz < 0.08) continue;
        var sx = Math.sin(th);
        var x = cx + hw * sx, w = (2 * Math.PI / m) * hw * (0.36 + 0.7 * cz);
        // мутовка видна чуть сверху: основания передних прицветников выше боковых — ряд дугой;
        // верхняя мутовка сходится к черешку куполом
        var y = y0 - cz * step * (i === 0 ? 0.55 : 0.32);
        var Li = L * (0.82 + 0.22 * cz) * (i === n - 1 ? 0.95 : 1);
        var tilt = sx * w * 0.18;
        var tx = x + tilt, ty = y + Li;
        var d = "M" + r2(x - w / 2) + "," + r2(y) +
          "C" + r2(x - w * 0.64) + "," + r2(y + Li * 0.42) + " " + r2(tx - w * 0.3) + "," + r2(y + Li * 0.9) + " " + r2(tx) + "," + r2(ty) +
          "C" + r2(tx + w * 0.3) + "," + r2(y + Li * 0.9) + " " + r2(x + w * 0.64) + "," + r2(y + Li * 0.42) + " " + r2(x + w / 2) + "," + r2(y) +
          // основание прицветника — скруглённое (у верхней мутовки оно видно)
          "Q" + r2(x) + "," + r2(y - w * 0.34) + " " + r2(x - w / 2) + "," + r2(y);
        // светлая кромка слева (бумажный край прицветника на свету)
        var hl = "M" + r2(x - w * 0.36) + "," + r2(y + Li * 0.1) +
          "C" + r2(x - w * 0.46) + "," + r2(y + Li * 0.46) + " " + r2(tx - w * 0.22) + "," + r2(y + Li * 0.82) + " " + r2(tx - w * 0.04) + "," + r2(ty - Li * 0.05);
        // свет: −1 (лево, светлее) … +1 (право, темнее); верхние мутовки чуть светлее
        var shade = HA.clamp(sx * 0.85 + (1 - cz) * 0.35 - (1 - u) * 0.15, -1, 1);
        row.push({ ri: i, cz: cz, side: shade, d: d, hl: hl, x: x, w: w, y: y, L: Li });
        veins += "M" + r2(x + tilt * 0.2) + "," + r2(y + Li * 0.3) + "Q" + r2(x + tilt * 0.55) + "," + r2(y + Li * 0.62) + " " + r2(tx) + "," + r2(ty - Li * 0.14);
        if (i > 1 && i < n - 1 && i % 2 === 0 && cz > 0.7 && w > 4) {
          // лупулин — мелкие золотистые крупинки у основания, едва выглядывают
          lup.push({ x: x + w * 0.3, y: y + Li * 0.1, r: Math.max(0.35, w * 0.035) });
          lup.push({ x: x + w * 0.38, y: y + Li * 0.16, r: Math.max(0.3, w * 0.025) });
        }
      }
      // в мутовке сначала боковые, затем передние (передние перекрывают)
      row.sort(function (a, b2) { return a.cz - b2.cz; });
      scales.push(row);
    }
    // нижние мутовки — первыми
    var flat = [];
    for (var r = scales.length - 1; r >= 0; r--) flat = flat.concat(scales[r]);
    var stem = "M" + r2(cx + W * 0.1) + "," + r2(top - H * 0.24) +
      "C" + r2(cx - W * 0.12) + "," + r2(top - H * 0.16) + " " + r2(cx + W * 0.06) + "," + r2(top - H * 0.08) + " " + r2(cx) + "," + r2(top - step * 0.3);
    // два прилистника у основания шишки
    // два маленьких прилистника у основания шишки — свисают по бокам
    var sy = top - step * 0.5;
    var stip = "M" + r2(cx) + "," + r2(sy) + "Q" + r2(cx - W * 0.2) + "," + r2(sy - H * 0.03) + " " + r2(cx - W * 0.24) + "," + r2(sy + H * 0.07) + "Q" + r2(cx - W * 0.1) + "," + r2(sy + H * 0.05) + " " + r2(cx) + "," + r2(sy) + "Z" +
      "M" + r2(cx) + "," + r2(sy) + "Q" + r2(cx + W * 0.2) + "," + r2(sy - H * 0.03) + " " + r2(cx + W * 0.24) + "," + r2(sy + H * 0.07) + "Q" + r2(cx + W * 0.1) + "," + r2(sy + H * 0.05) + " " + r2(cx) + "," + r2(sy) + "Z";
    return { scales: flat, veins: veins, stem: stem, stip: stip, lup: lup };
  }

  /* цвет прицветника по освещённости: светло-лимонный → хмелевой → тенистый */
  var CONE_FILL = { light: "#ECEDB6", mid: "#CDD57F", dark: "#97AA4A" };
  function mixHex(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) + ((((pb >> 16) & 255) - ((pa >> 16) & 255)) * t));
    var g = Math.round(((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t));
    var bl = Math.round((pa & 255) + (((pb & 255) - (pa & 255)) * t));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }
  function coneFill(side) { return side < 0 ? mixHex(CONE_FILL.mid, CONE_FILL.light, Math.min(1, -side)) : mixHex(CONE_FILL.mid, CONE_FILL.dark, Math.min(1, side)); }
  var LUPULIN = "#E2B33C";

  /* SVG-разметка шишки. opt: {sw, ink, flat, fill} */
  function coneSVG(cx, top, H, W, opt) {
    opt = opt || {};
    var sw = opt.sw || 0.8, ink = opt.ink || "currentColor";
    var c = conePaths(cx, top, H, W);
    var s = '<path d="' + c.stem + '" fill="none" stroke="' + ink + '" stroke-width="' + r2(sw) + '" stroke-linecap="round"/>';
    if (H > 10) s += '<path d="' + c.stip + '" fill="#B9C67F" stroke="' + ink + '" stroke-width="' + r2(sw * 0.6) + '" stroke-linejoin="round"/>';
    c.scales.forEach(function (sc) {
      var fill = opt.fill || (opt.flat ? CONE_FILL.mid : coneFill(sc.side));
      s += '<path d="' + sc.d + 'Z" fill="' + fill + '" stroke="' + ink + '" stroke-width="' + r2(sw * 0.75) + '" stroke-linejoin="round"/>';
      if (H > 12 && !opt.flat) s += '<path d="' + sc.hl + '" fill="none" stroke="#F7F4D2" stroke-opacity="' + (sc.side < 0.4 ? 0.85 : 0.45) + '" stroke-width="' + r2(Math.max(0.5, sc.w * 0.09)) + '" stroke-linecap="round"/>';
    });
    if (H > 14) {
      s += '<path d="' + c.veins + '" fill="none" stroke="' + ink + '" stroke-width="' + r2(sw * 0.38) + '" stroke-opacity=".45"/>';
      c.lup.forEach(function (l) { s += '<circle cx="' + r2(l.x) + '" cy="' + r2(l.y) + '" r="' + r2(l.r) + '" fill="' + LUPULIN + '" fill-opacity=".8"/>'; });
    }
    return s;
  }

  /* ---------------- Лист хмеля ----------------
     Контур в единичных координатах: черешок крепится к стеблю в (0,0),
     лист смотрит вверх (−y). Левая половина от выемки основания
     до вершины средней лопасти, правая — зеркальная.
     Метки: t — вершина лопасти, s — пазуха, b — основание.            */
  var HALF = [
    [0, -0.55, "b"], [-0.16, -0.40], [-0.42, -0.38], [-0.68, -0.52], [-0.88, -0.76], [-1.0, -1.04], [-1.04, -1.32, "t"],
    [-0.86, -1.26], [-0.7, -1.22], [-0.6, -1.24, "s"], [-0.58, -1.5], [-0.48, -1.8], [-0.32, -2.04], [-0.15, -2.2], [0, -2.32, "t"]
  ];
  /* верхние листья хмеля часто цельные, сердцевидные — второй контур */
  var HEART = [
    [0, -0.52, "b"], [-0.2, -0.38], [-0.5, -0.4], [-0.76, -0.6], [-0.92, -0.92], [-0.9, -1.3], [-0.72, -1.64], [-0.44, -1.94], [-0.18, -2.16], [0, -2.3, "t"]
  ];
  function mirror(half) { return half.concat(half.slice(0, -1).reverse().map(function (p) { return [-p[0], p[1], p[2]]; })); }
  // полный обход: левая половина вверх, затем правая вниз
  var OUTLINES = { lobed: mirror(HALF), heart: mirror(HEART) };

  function catmull(pts, seg) {
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (var k = 0; k < seg; k++) {
        var t = k / seg, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
        ]);
      }
    }
    out.push(pts[pts.length - 1].slice(0, 2));
    return out;
  }

  /* Контур листа размера s (s ≈ полуширина). teeth — пильчатый край. */
  var leafCache = {};
  function leafOutline(s, teeth, kind) {
    kind = kind || "lobed";
    var key = s + "|" + teeth + "|" + kind;
    if (leafCache[key]) return leafCache[key];
    var OUTLINE = OUTLINES[kind] || OUTLINES.lobed;
    // делим контур на рёбра между помеченными точками
    var edges = [], cur = [OUTLINE[0]];
    for (var i = 1; i < OUTLINE.length; i++) {
      cur.push(OUTLINE[i]);
      if (OUTLINE[i][2]) { edges.push(cur); cur = [OUTLINE[i]]; }
    }
    var d = "";
    var cxm = 0, cym = -1.3; // примерный центр листа — для направления наружу
    edges.forEach(function (e, ei) {
      var ascending = !!(e[e.length - 1][2] === "t"); // идём к вершине лопасти
      var pts = catmull(e, 5);
      if (ei === 0) d += "M" + r2(pts[0][0] * s) + "," + r2(pts[0][1] * s);
      if (!teeth) {
        for (var k = 1; k < pts.length; k++) d += "L" + r2(pts[k][0] * s) + "," + r2(pts[k][1] * s);
        return;
      }
      // равномерные зубцы вдоль ребра
      var len = 0, acc = [0];
      for (var k2 = 1; k2 < pts.length; k2++) { len += Math.hypot(pts[k2][0] - pts[k2 - 1][0], pts[k2][1] - pts[k2 - 1][1]); acc.push(len); }
      var nT = Math.max(2, Math.round(len / 0.13));
      var at = function (u) {
        var L = u * len, j = 1;
        while (j < acc.length - 1 && acc[j] < L) j++;
        var t = (L - acc[j - 1]) / ((acc[j] - acc[j - 1]) || 1);
        return [pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * t, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * t];
      };
      // у основания (первое и последнее ребро) зубцы мельче
      var amp = (ei === 0 || ei === edges.length - 1) ? 0.035 : 0.06;
      for (var q = 0; q < nT; q++) {
        var a = at(q / nT), b = at((q + 1) / nT);
        var fx = ascending ? 0.78 : 0.22;
        var mx = a[0] + (b[0] - a[0]) * fx, my = a[1] + (b[1] - a[1]) * fx;
        var dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1;
        var nx = dy / dl, ny = -dx / dl;
        if ((mx + nx * 0.05 - cxm) * (mx + nx * 0.05 - cxm) + (my + ny * 0.05 - cym) * (my + ny * 0.05 - cym) <
            (mx - cxm) * (mx - cxm) + (my - cym) * (my - cym)) { nx = -nx; ny = -ny; }
        d += "L" + r2((mx + nx * amp) * s) + "," + r2((my + ny * amp) * s) + "L" + r2(b[0] * s) + "," + r2(b[1] * s);
      }
    });
    d += "Z";
    leafCache[key] = d;
    return d;
  }
  /* жилки: средняя и две боковые из одной точки, вторичные — короче */
  function leafVeins(s) {
    var P = function (x, y) { return r2(x * s) + "," + r2(y * s); };
    return "M" + P(0, 0) + "L" + P(0, -0.5) +           // черешок
      "M" + P(0, -0.5) + "Q" + P(0.02, -1.4) + " " + P(0, -2.2) +
      "M" + P(0, -0.52) + "Q" + P(-0.46, -0.84) + " " + P(-0.94, -1.3) +
      "M" + P(0, -0.52) + "Q" + P(0.46, -0.84) + " " + P(0.94, -1.3) +
      "M" + P(0, -0.54) + "Q" + P(-0.36, -0.56) + " " + P(-0.6, -0.6) +
      "M" + P(0, -0.54) + "Q" + P(0.36, -0.56) + " " + P(0.6, -0.6) +
      "M" + P(-0.4, -0.9) + "L" + P(-0.36, -1.18) + "M" + P(0.4, -0.9) + "L" + P(0.36, -1.18) +
      "M" + P(0, -1.3) + "Q" + P(-0.14, -1.42) + " " + P(-0.26, -1.66) + "M" + P(0, -1.3) + "Q" + P(0.14, -1.42) + " " + P(0.26, -1.66) +
      "M" + P(0, -1.7) + "Q" + P(-0.1, -1.8) + " " + P(-0.18, -1.98) + "M" + P(0, -1.7) + "Q" + P(0.1, -1.8) + " " + P(0.18, -1.98);
  }

  /* SVG-разметка листа: x,y — точка крепления черешка, rot — поворот (град). */
  function leafSVG(x, y, rot, s, opt) {
    opt = opt || {};
    var ink = opt.ink || "currentColor", sw = opt.sw || 0.8;
    var teeth = opt.teeth !== false && s >= 7;
    var d = leafOutline(s, teeth, opt.kind);
    var g = '<g transform="translate(' + r2(x) + " " + r2(y) + ") rotate(" + r2(rot) + ')">';
    if (opt.wash !== false) {
      g += '<path d="' + d + '" fill="' + (opt.washLight || "#C5D189") + '" fill-opacity=".7" transform="translate(' + r2(s * 0.05) + " " + r2(s * 0.04) + ')"/>';
      g += '<path d="' + d + '" fill="' + (opt.fill || "#9DB35A") + '" fill-opacity="' + (opt.fillOpacity || 0.72) + '"/>';
      // объём: правая половина листа в тени (свет слева сверху), у основания — темнее
      if (s >= 5) {
        g += '<path d="' + d + '" fill="#5E7A2A" fill-opacity=".22" clip-path="inset(0 0 0 50%)" style="clip-path:polygon(0 -300%,300% -300%,300% 300%,0 300%)"/>';
        g += '<ellipse cx="0" cy="' + r2(-s * 0.7) + '" rx="' + r2(s * 0.42) + '" ry="' + r2(s * 0.3) + '" fill="#4F6B22" fill-opacity=".14"/>';
      }
    }
    g += '<path d="' + d + '" fill="none" stroke="' + ink + '" stroke-width="' + r2(sw) + '" stroke-linejoin="round"/>';
    // жилки — светлые (как на живом листе), поверх — тонкая тень
    if (s >= 6) {
      g += '<path d="' + leafVeins(s) + '" fill="none" stroke="#E4E9B8" stroke-width="' + r2(sw * 1.1) + '" stroke-opacity=".75" stroke-linecap="round"/>';
      g += '<path d="' + leafVeins(s) + '" fill="none" stroke="' + ink + '" stroke-width="' + r2(sw * 0.35) + '" stroke-opacity=".35" stroke-linecap="round"/>';
    }
    return g + "</g>";
  }

  /* Знак-печать: шишка в двойном круге (логотип, favicon, подвал) */
  function sealSVG(size, opt) {
    opt = opt || {};
    var ink = opt.ink || "#33281D", bg = opt.bg || "none", c = size / 2;
    var s = '<circle cx="' + c + '" cy="' + c + '" r="' + r2(c - 1) + '" fill="' + bg + '" stroke="' + ink + '" stroke-width="1.1"/>';
    s += '<circle cx="' + c + '" cy="' + c + '" r="' + r2(c - 3.6) + '" fill="none" stroke="' + ink + '" stroke-width=".55"/>';
    // насечки по кольцу
    var t = "";
    for (var k = 0; k < 40; k++) {
      var a = (k / 40) * Math.PI * 2;
      t += "M" + r2(c + Math.cos(a) * (c - 3.6)) + "," + r2(c + Math.sin(a) * (c - 3.6)) + "L" + r2(c + Math.cos(a) * (c - 2.2)) + "," + r2(c + Math.sin(a) * (c - 2.2));
    }
    s += '<path d="' + t + '" stroke="' + ink + '" stroke-width=".4"/>';
    var H = size * 0.48, W = H * 0.62;
    s += leafSVG(c - 1, c - H * 0.36, -52, size * 0.085, { ink: ink, sw: 0.6, teeth: false });
    s += leafSVG(c + 1, c - H * 0.38, 50, size * 0.075, { ink: ink, sw: 0.6, teeth: false });
    s += '<g>' + coneSVG(c, c - H * 0.36, H, W, { ink: ink, sw: 0.7 }) + "</g>";
    return s;
  }

  HA.art = {
    conePaths: conePaths,
    LUPULIN: LUPULIN,
    coneFill: coneFill,
    coneSVG: coneSVG,
    leafOutline: leafOutline,
    leafVeins: leafVeins,
    leafSVG: leafSVG,
    sealSVG: sealSVG,
    r2: r2
  };
})();
