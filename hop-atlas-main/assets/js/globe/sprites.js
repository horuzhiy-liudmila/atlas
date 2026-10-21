/* =====================================================================
   Глобус · sprites.js — растровые заготовки для canvas (рисуются один раз):
   шишка, лист, акварельное пятно-полог, зерно бумаги.
   Контуры берутся из HA.art — те же, что в SVG-орнаментах.
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, G = HA.globe, C = HA.C;
  var SS = 3; // сверхвыборка

  var coneCache = {};
  /* шишка высотой H (тело), подвешена за черешок: ax, ay — точка подвеса */
  function cone(H, tint) {
    var key = H + "|" + (tint || "");
    if (coneCache[key]) return coneCache[key];
    var W = H * 0.64;
    var w = Math.ceil(W + 6), h = Math.ceil(H * 1.32 + 4);
    var c = document.createElement("canvas");
    c.width = w * SS; c.height = h * SS;
    var g = c.getContext("2d");
    g.scale(SS, SS);
    var top = H * 0.24 + 2, cx = w / 2;
    var p = HA.art.conePaths(cx, top, H, W);
    g.lineJoin = "round"; g.lineCap = "round";
    g.strokeStyle = C.ink; g.lineWidth = Math.max(0.6, H / 26);
    g.stroke(new Path2D(p.stem));
    if (H >= 10) { var st = new Path2D(p.stip); g.fillStyle = C.hopWash; g.fill(st); g.lineWidth = Math.max(0.4, H / 40); g.stroke(st); }
    p.scales.forEach(function (s) {
      var path = new Path2D(s.d + "Z");
      g.fillStyle = tint === "ochre" ? (s.side < -0.2 ? "#EBCB86" : s.side > 0.3 ? "#C99A47" : "#DDB063") : HA.art.coneFill(s.side);
      g.fill(path);
      g.strokeStyle = C.inkA(0.85); g.lineWidth = Math.max(0.45, H / 34);
      g.stroke(path);
      if (H >= 12 && tint !== "ochre") {
        g.strokeStyle = s.side < 0.4 ? "rgba(247,244,210,.85)" : "rgba(247,244,210,.45)";
        g.lineWidth = Math.max(0.45, s.w * 0.09); g.stroke(new Path2D(s.hl));
      }
    });
    if (H >= 14) {
      g.strokeStyle = C.inkA(0.4); g.lineWidth = 0.4; g.stroke(new Path2D(p.veins));
      g.fillStyle = HA.art.LUPULIN;
      p.lup.forEach(function (l) { g.beginPath(); g.arc(l.x, l.y, l.r, 0, Math.PI * 2); g.fill(); });
    }
    var out = { c: c, w: w, h: h, ax: cx + W * 0.08, ay: top - H * 0.2 };
    coneCache[key] = out;
    return out;
  }

  var leafCache = {};
  /* лист хмеля размером S (полуширина), черешок в точке (ax, ay), смотрит вверх;
     kind: lobed — трёхлопастный, heart — цельный сердцевидный (верхние листья) */
  function leaf(S, kind) {
    var key = S + "|" + (kind || "lobed");
    if (leafCache[key]) return leafCache[key];
    var w = Math.ceil(S * 2.5), h = Math.ceil(S * 2.6);
    var c = document.createElement("canvas");
    c.width = w * SS; c.height = h * SS;
    var g = c.getContext("2d");
    g.scale(SS, SS);
    g.translate(w / 2, h - 1);
    var d = new Path2D(HA.art.leafOutline(S, S >= 7, kind));
    g.save(); g.translate(S * 0.06, S * 0.05); g.fillStyle = C.leafLight; g.globalAlpha = 0.75; g.fill(d); g.restore();
    g.globalAlpha = 0.88; g.fillStyle = C.leaf; g.fill(d);
    g.globalAlpha = 1; g.strokeStyle = C.inkA(0.78); g.lineWidth = Math.max(0.45, S / 12); g.lineJoin = "round"; g.stroke(d);
    if (S >= 5) { g.strokeStyle = C.inkA(0.42); g.lineWidth = Math.max(0.35, S / 20); g.stroke(new Path2D(HA.art.leafVeins(S))); }
    var out = { c: c, w: w, h: h, ax: w / 2, ay: h - 1 };
    leafCache[key] = out;
    return out;
  }

  /* акварельное пятно: несколько неровных полупрозрачных заливок */
  function blot(seed, rgb) {
    var S = 96, c = document.createElement("canvas");
    c.width = c.height = S;
    var g = c.getContext("2d");
    var rnd = HA.lcg(seed);
    for (var k = 0; k < 7; k++) {
      g.beginPath();
      var n = 26, base = S * (0.26 + 0.12 * rnd());
      for (var i = 0; i <= n; i++) {
        var a = (i / n) * Math.PI * 2, r = base * (0.82 + 0.3 * rnd());
        var x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.closePath();
      g.fillStyle = "rgba(" + rgb + "," + (0.09 + 0.05 * rnd()).toFixed(3) + ")";
      g.fill();
      if (k === 6) { g.strokeStyle = "rgba(" + rgb + ",.26)"; g.lineWidth = 1.5; g.stroke(); }
    }
    return c;
  }

  /* зерно бумаги (для multiply) */
  function grain(S, seed, lo) {
    var c = document.createElement("canvas");
    c.width = c.height = S;
    var g = c.getContext("2d"), im = g.createImageData(S, S), rnd = HA.lcg(seed || 42);
    lo = lo || 200;
    for (var i = 0; i < S * S; i++) {
      var v = lo + rnd() * (255 - lo);
      im.data[i * 4] = v; im.data[i * 4 + 1] = v * 0.975; im.data[i * 4 + 2] = v * 0.92; im.data[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return c;
  }

  G.sprites = {
    cone: cone,
    leaf: leaf,
    BLOT: blot(7, "92,128,44"),
    GRAIN: grain(220, 42, 205)
  };
})();
