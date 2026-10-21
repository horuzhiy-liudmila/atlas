/* =====================================================================
   Режим карты «Атлас» — полноэкранная интерактивная карта.

   Открывается кнопкой «Открыть атлас» (или двойным щелчком по глобусу):
   глобус с текущего поворота плавно «разворачивается» в плоскую карту
   мира — переход проекций d3 (ортографическая → Natural Earth),
   как будто разворачивают лист старинного атласа. Закрытие — обратно
   в шар. При «уменьшить движение» — без анимации.

   Внутри: зум колёсиком к курсору, перетаскивание, «+ / −», виды,
   слои «Производство / Торговые потоки», список 18 регионов с поиском
   и сортировкой. Наведение — всплывающая карточка; щелчок — подробная
   панель региона или страны (только данные НИР; производные величины
   помечены «*»).

   Закрывается крестиком, Esc и кнопкой «Назад» браузера.
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, G = HA.globe, C = HA.C, D = HA.D, NB = HA.NB;
  var DATA = window.ATLAS_DATA;
  var STAR = '<span class="fn" aria-hidden="true" title="Рассчитано по данным атласа">*</span>';
  var LON0 = 10;                     // центр плоской карты по долготе: от Америки до Новой Зеландии
  var KMAX = 14;

  /* виды плоской карты: центр и приближение (k = 1 — весь мир) */
  var VIEWS = {
    world:  { c: [LON0, 12], k: 1 },
    europe: { c: [12, 49], k: 5.2, focus: "hallertau" },
    usa:    { c: [-55, 45], k: 1.9, focus: "yakima" },
    russia: { c: [34, 52], k: 3.2, focus: "chuvashia" }
  };

  function short(name) { return name.replace(/ \(.+\)/, ""); }
  function share(t) { return (t / D.total) * 100; }
  function fmtShare(p) { return HA.fmt(p, p < 1 ? 2 : 1) + NB + "%"; }

  /* ---------- данные по странам (только из атласа) ---------- */
  var COUNTRIES = {};
  D.ranked.forEach(function (r) {
    var c = COUNTRIES[r.country] || (COUNTRIES[r.country] = { name: r.country, iso: r.iso, regions: [], sum: 0 });
    c.regions.push(r); c.sum += r.t;
  });
  var TOP6 = {};
  ((DATA.top6 && DATA.top6.items) || []).forEach(function (it, i) { TOP6[it.country] = { v: it.v, rank: i + 1 }; });
  var FLOWS = DATA.flows || [];
  function flowsOf(country) { return FLOWS.filter(function (f) { return f.from === country || f.to === country; }); }
  var MAXFLOW = FLOWS.reduce(function (m, f) { return Math.max(m, f.musd); }, 1);

  /* ---------- проекция-«разворот»: ортографическая ↔ Natural Earth ---------- */
  var orthoRaw = d3.geoOrthographicRaw, neRaw = d3.geoNaturalEarth1Raw;
  /* «Разворот» в две фазы:
     1) t < SPLIT — шар: угловое расстояние от центра сжимается (× s, s: 1 → 0,5),
        граница видимости растёт до 180°, и весь мир собирается на видимой
        стороне шара без «складок»;
     2) t ≥ SPLIT — весь мир уже на диске; диск плавно переходит в плоскую
        карту Natural Earth (разрез по линии перемены дат делает d3). */
  var SPLIT = 0.5;
  function phase(t) {
    // кусочно-линейно: общее «плавно-разгон-торможение» задаёт время (easeInOut),
    // поэтому на стыке фаз движение не замирает
    if (t < SPLIT) return { s: 1 - 0.5 * (t / SPLIT), w: 0 };
    return { s: 0.5, w: (t - SPLIT) / (1 - SPLIT) };
  }
  function morphRaw(t) {
    if (t <= 0) return orthoRaw;
    if (t >= 1) return neRaw;
    var ph = phase(t), s = ph.s, w = ph.w;
    return function (l, p) {
      // точка на угловом расстоянии d от центра → d·s в том же направлении (ортографически)
      var cp = Math.cos(p), x = cp * Math.sin(l), y = Math.sin(p);
      var d = Math.acos(Math.max(-1, Math.min(1, cp * Math.cos(l)))), sd = Math.sin(d);
      var k = sd > 1e-9 ? Math.sin(d * s) / sd : s;
      if (!w) return [x * k, y * k];
      var b = neRaw(l, p);
      return [x * k + (b[0] - x * k) * w, y * k + (b[1] - y * k) * w];
    };
  }
  function clipFor(t) { return t >= SPLIT ? null : Math.min(179.9, 90 / phase(t).s); }
  var mut = d3.geoProjectionMutator(morphRaw);

  HA.initAtlasMap = function (globe) {
    var root = HA.$("#amap");
    if (!root || !d3.geoProjectionMutator || !d3.geoNaturalEarth1Raw) return null;
    var stage = HA.$("#amap-stage"), canvas = HA.$("#amap-canvas"), ctx = canvas.getContext("2d");
    var tip = HA.$("#amap-tip"), listEl = HA.$("#amap-list"), detail = HA.$("#amap-detail"), listView = HA.$("#amap-listview");
    var qIn = HA.$("#amap-q"), legend = HA.$("#amap-legend"), side = HA.$("#amap-side");
    var base = document.createElement("canvas"), bctx = base.getContext("2d");
    var scratch = document.createElement("canvas");
    var qprev = document.createElement("canvas"), qctx = qprev.getContext("2d"); // последний «облегчённый» кадр — растворяется в подробный
    var proj = mut(1).clipAngle(null).precision(0.4);
    var gen = d3.geoPath(proj);

    var W = 0, H = 0, dpr = 1, S1 = 100;
    // SW×SH — область карты; во время разворота холст на весь экран (W×H), а область карты
    // смещена на (OX, OY) — так глобус начинает ровно поверх глобуса страницы и не обрезается
    var SW = 0, SH = 0, OX = 0, OY = 0;
    var bg = HA.$(".amap__bg", root), bar = HA.$(".amap__bar", root), pageBox = HA.$("#globe-box");
    var oceanTex = null, shadeTex = null;
    var st = {
      open: false, t: 1, rot: [-LON0, 0], s: 100, tr: [0, 0], clip: null,
      k: 1, tx: 0, ty: 0, anim: null, morph: null,
      layer: "production", hover: null, hoverC: null, hoverF: null, sel: null, selC: null,
      drag: null, dirty: true, moving: false, stillAt: 0, sort: "t", q: "", dash0: 0, view: "world"
    };
    var items = [], labelsHit = [], flowPaths = [];
    var pushed = false, returnFocus = null;

    /* ---------- размер ---------- */
    function fitScale(w, h) {
      // Natural Earth: ширина ≈ 2 × 2,74, высота ≈ 2 × 1,42 (в единицах радиуса)
      return Math.max(60, Math.min((w - 24) / (2 * 2.74), (h - 24) / (2 * 1.42)));
    }
    function layout(full) {
      var b = stage.getBoundingClientRect();
      var sw = Math.round(b.width), sh = Math.round(b.height);
      if (!sw || !sh) return false;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      st.full = !!full;
      canvas.classList.toggle("is-full", st.full);
      if (st.full) { W = window.innerWidth; H = window.innerHeight; OX = Math.round(b.left); OY = Math.round(b.top); }
      else { W = sw; H = sh; OX = 0; OY = 0; }
      SW = sw; SH = sh;
      [canvas, base, scratch, qprev].forEach(function (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      S1 = fitScale(SW, SH);
      st.dirty = true;
      return true;
    }

    /* «весь мир»: на широком экране — карта целиком; на узком (телефон) — во всю высоту,
       по ширине листается пальцем */
    function worldK() {
      if (SW >= 600) return 1;
      return HA.clamp((SH - 24) / (2 * 1.42 * S1), 1, 2.4);
    }
    /* камера плоской карты: k и сдвиг (tx, ty) от центра */
    function applyFlat() {
      st.t = 1; st.rot = [-LON0, 0]; st.clip = null;
      st.s = S1 * st.k; st.tr = [OX + SW / 2 + st.tx, OY + SH / 2 + st.ty];
    }
    function setProj() {
      proj = mut(st.t).rotate([st.rot[0], st.rot[1], 0]).scale(st.s).translate(st.tr);
      proj.clipAngle(st.clip);
      proj.precision(st.moving ? 0.9 : 0.4);
      gen = d3.geoPath(proj);
    }
    /* сдвиг, при котором точка ll стоит в центре при приближении k */
    function centerOn(ll, k) {
      var p = mut(1).rotate([-LON0, 0, 0]).scale(S1 * k).translate([SW / 2, SH / 2])(ll);
      return { k: k, tx: SW / 2 - p[0], ty: SH / 2 - p[1] };
    }
    function clampPan() {
      var mw = 2 * 2.74 * S1 * st.k, mh = 2 * 1.42 * S1 * st.k;
      var lx = Math.max(0, (mw - SW) / 2 + SW * 0.2), ly = Math.max(0, (mh - SH) / 2 + SH * 0.2);
      st.tx = HA.clamp(st.tx, -lx, lx); st.ty = HA.clamp(st.ty, -ly, ly);
    }

    /* контур видимой части Земли. На плоской карте — «Sphere»; во время разворота
       d3 строит его для промежуточной проекции неверно, поэтому обводим сами:
       точки на границе видимости (угол clip от центра) → проекция */
    function outline() {
      if (st.clip == null) return G.base.pathOf(gen, { type: "Sphere" });
      var rot = d3.geoRotation([st.rot[0], st.rot[1], 0]), c = (st.clip - 0.05) * Math.PI / 180;
      var path = new Path2D(), first = true;
      for (var i = 0; i <= 360; i += 2) {
        var b = i * Math.PI / 180;
        var phi = Math.asin(Math.sin(c) * Math.cos(b)), lam = Math.atan2(Math.sin(b) * Math.sin(c), Math.cos(c));
        var p = proj(rot.invert([lam * 180 / Math.PI, phi * 180 / Math.PI]));
        if (!p || !isFinite(p[0])) continue;
        if (first) { path.moveTo(p[0], p[1]); first = false; } else path.lineTo(p[0], p[1]);
      }
      path.closePath();
      return path;
    }

    /* ---------- основа: море, суша, сетка ---------- */
    function renderBase() {
      setProj();
      var g = bctx;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      var sphere = outline();
      // море: акварель + горизонтальная гравюрная штриховка
      g.save();
      g.clip(sphere);
      var gr = g.createRadialGradient(W * 0.42, H * 0.38, 10, W / 2, H / 2, Math.max(W, H) * 0.75);
      gr.addColorStop(0, C.sea[0]); gr.addColorStop(0.6, C.sea[1]); gr.addColorStop(1, C.sea[2]);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = "rgba(52,78,84,.10)"; g.lineWidth = 0.6;
      g.beginPath();
      for (var y = 0; y < H; y += 3.4) { g.moveTo(0, y); g.lineTo(W, y); }
      g.stroke();
      // начало разворота: море — та же текстура, что у глобуса на странице, и гаснет к середине
      var globeA = st.t < SPLIT && oceanTex ? 1 - st.t / SPLIT : 0;
      if (globeA > 0) {
        var os = (st.s / oceanTex.R) * oceanTex.S;
        g.globalAlpha = globeA; g.drawImage(oceanTex.c, st.tr[0] - os / 2, st.tr[1] - os / 2, os, os); g.globalAlpha = 1;
      }
      var hi = !st.moving && st.k >= 2.2 && G.world.W50;
      G.base.paintMap(g, gen, hi ? G.world.W50 : G.world.W110, {
        scratch: scratch, size: [W, H], dpr: dpr, z: Math.min(3, st.k), q: st.morph ? "low" : "high", moving: st.moving,
        gratGeo: st.k >= 3 ? G.world.GRAT10 : G.world.GRAT
      });
      // страна под курсором / выбранная — охристый контур
      var Wd = hi ? G.world.W50 : G.world.W110;
      [st.selC, st.hoverC].forEach(function (name, i) {
        var c = name && COUNTRIES[name], f = c && Wd.byId[c.iso];
        if (!f) return;
        var p = G.base.pathOf(gen, f);
        g.fillStyle = i === 0 ? "rgba(200,149,63,.22)" : "rgba(200,149,63,.13)"; g.fill(p);
        g.lineJoin = "round"; g.strokeStyle = C.ochreInk; g.lineWidth = i === 0 ? 1.4 : 1; g.stroke(p);
      });
      if (globeA > 0 && shadeTex) {
        var ss = (st.s / shadeTex.R) * shadeTex.S;
        g.globalAlpha = globeA; g.drawImage(shadeTex.c, st.tr[0] - ss / 2, st.tr[1] - ss / 2, ss, ss); g.globalAlpha = 1;
      }
      g.restore();
      // рамка листа
      g.strokeStyle = C.inkA(0.7); g.lineWidth = 1.1; g.stroke(sphere);
      st.dirty = false;
    }

    /* ---------- шпалеры и подписи ---------- */
    function hmax() { return HA.clamp(SH * 0.15, 48, 120); }
    function computeItems() {
      var Hm = hmax();
      var out = [];
      D.ranked.forEach(function (r) {
        var p = proj([r.lon, r.lat]);
        if (!p || !isFinite(p[0])) return;
        if (st.clip != null && d3.geoDistance([r.lon, r.lat], [-st.rot[0], -st.rot[1]]) > st.clip * Math.PI / 180) return;
        var state = r.id === st.sel ? "selected" : r.id === st.hover ? "hot" : "normal";
        if (st.layer === "trade" && state === "normal") state = "dim";
        if (st.selC && r.country === st.selC && state === "normal") state = "hot";
        out.push({ r: r, x: p[0], y: p[1], h: Hm * r.t / D.max, state: state });
      });
      out.sort(function (a, b) { return a.y - b.y; });
      return out;
    }
    function drawItems(now) {
      items = computeItems();
      items.forEach(function (it) {
        var g = grow(it.r.rank, now);
        it.g = g;
        if (g <= 0.01) return;
        it.box = G.trellis.draw(ctx, { x: it.x, y: it.y, h: it.h * g, t: it.r.t, alpha: Math.min(1, g * 1.6), state: it.state, seed: it.r.i * 7 + 3 });
      });
      items.forEach(function (it) {
        if (it.g <= 0.01) return;
        ctx.globalAlpha = Math.min(1, it.g * 2);
        // знак региона на карте — крупнее, с бумажным ореолом: точка видна поверх кроны и заливок
        var sel = it.state === "selected", hot = it.state === "hot";
        ctx.beginPath(); ctx.arc(it.x, it.y, 6.6, 0, Math.PI * 2); ctx.fillStyle = C.paperA(0.85); ctx.fill();
        ctx.beginPath(); ctx.arc(it.x, it.y, 4.6, 0, Math.PI * 2); ctx.fillStyle = C.paper; ctx.fill();
        ctx.lineWidth = 1.4; ctx.strokeStyle = sel || hot ? C.ochreInk : C.ink; ctx.stroke();
        ctx.beginPath(); ctx.arc(it.x, it.y, 1.9, 0, Math.PI * 2); ctx.fillStyle = sel ? C.ochreInk : C.ink; ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
    function rr(g, x, y, w, h) { g.beginPath(); g.rect(x, y, w, h); }
    function drawLabels() {
      labelsHit = [];
      if (st.t < 0.98) return;
      var placed = flowPaths.map(function (fp) { return fp.box; });
      // подписи не закрывают знаки регионов и жерди
      var obst = [];
      items.forEach(function (it) {
        obst.push({ x0: it.x - 7, y0: it.y - 7, x1: it.x + 7, y1: it.y + 7 });
        if (it.box && it.box.full) obst.push({ x0: it.x - 3, y0: it.box.top - 4, x1: it.x + 3, y1: it.y });
      });
      // сколько подписей: в мировом виде — крупнейшие, при приближении — все видимые
      var n = st.layer === "trade" ? 3 : st.k >= 3 ? 99 : st.k >= 1.8 ? 9 : 6;
      var cand = items.slice().sort(function (a, b) {
        var pa = a.state === "selected" ? 3 : a.state === "hot" ? 2 : 0, pb = b.state === "selected" ? 3 : b.state === "hot" ? 2 : 0;
        return pb - pa || b.r.t - a.r.t;
      }).filter(function (it, i) { return i < n || it.state === "selected" || it.state === "hot"; });
      ctx.textBaseline = "alphabetic";
      cand.forEach(function (it) {
        if (it.x < OX - 40 || it.x > OX + SW + 40 || it.y < OY - 10 || it.y > OY + SH + 60) return;
        var name = short(it.r.name), val = HA.fmt(it.r.t) + NB + "т";
        ctx.font = "italic 15px 'Old Standard TT', serif";
        var w1 = ctx.measureText(name).width;
        ctx.font = "13px 'PT Serif', serif";
        var w2 = ctx.measureText(val).width;
        var bw = Math.max(w1, w2) + 12, bh = 36;
        // кандидаты: вокруг знака на двух расстояниях (близко — без выноски, дальше — с выноской)
        var tries = [];
        [14, 40, 70].forEach(function (d) {
          [[1, -0.5], [-1, -0.5], [1, 0.4], [-1, 0.4], [0, 1], [0, -1.6], [1, -1.4], [-1, -1.4]].forEach(function (v) {
            tries.push([v[0] > 0 ? d : v[0] < 0 ? -bw - d : -bw / 2, v[1] * d * 0.8 - bh / 2 + (v[1] > 0 ? bh / 2 : v[1] < -1 ? -bh / 2 : 0)]);
          });
        });
        for (var i = 0; i < tries.length; i++) {
          var bx = it.x + tries[i][0], by = it.y + tries[i][1];
          var box = { x0: bx, y0: by, x1: bx + bw, y1: by + bh };
          if (box.x0 < OX + 4 || box.x1 > OX + SW - 4 || box.y0 < OY + 4 || box.y1 > OY + SH - 4) continue;
          var hit = function (b) { return b.x0 < box.x1 + 3 && b.x1 > box.x0 - 3 && b.y0 < box.y1 + 2 && b.y1 > box.y0 - 2; };
          if (placed.some(hit) || obst.some(hit)) continue;
          placed.push(box);
          var hot = it.state === "selected" || it.state === "hot";
          // выноска: от края подписи к знаку региона
          var ex = HA.clamp(it.x, bx, bx + bw), ey = HA.clamp(it.y, by, by + bh);
          if (Math.hypot(ex - it.x, ey - it.y) > 9) {
            ctx.strokeStyle = C.paperA(0.9); ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(it.x, it.y); ctx.stroke();
            ctx.strokeStyle = hot ? C.ochreInk : C.inkA(0.75); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(it.x, it.y); ctx.stroke();
          }
          ctx.fillStyle = hot ? "rgba(250,245,232,.97)" : "rgba(250,245,232,.9)";
          rr(ctx, bx, by, bw, bh); ctx.fill();
          ctx.strokeStyle = hot ? C.ochreInk : C.inkA(0.45); ctx.lineWidth = hot ? 1.2 : 0.8; ctx.stroke();
          ctx.font = "italic 15px 'Old Standard TT', serif"; ctx.fillStyle = C.ink;
          ctx.fillText(name, bx + 6, by + 15);
          ctx.font = "13px 'PT Serif', serif"; ctx.fillStyle = C.hopInk;
          ctx.fillText(val, bx + 6, by + 30);
          labelsHit.push({ id: it.r.id, x0: bx, y0: by, x1: bx + bw, y1: by + bh });
          break;
        }
      });
    }

    /* ---------- торговые потоки ---------- */
    function drawFlows(now) {
      flowPaths = [];
      if (st.layer !== "trade" || st.t < 0.98) return;
      FLOWS.forEach(function (f, idx) {
        var ip = d3.geoInterpolate(f.a, f.b), pts = [];
        for (var i = 0; i <= 48; i++) {
          var p = proj(ip(i / 48));
          if (!p) continue;
          pts.push(p);
        }
        if (pts.length < 2) return;
        // встречные маршруты Германия ⇄ США идут рядом: сдвиг вбок по направлению движения
        var reverse = FLOWS.some(function (o) { return o !== f && o.from === f.to && o.to === f.from; });
        var off = reverse ? 5 : 0, arch = 0.18;
        var a = pts[0], b = pts[pts.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        var nx = -dy / L, ny = dx / L;
        var path = pts.map(function (p, i) {
          var u = i / (pts.length - 1), lift = Math.sin(Math.PI * u) * L * arch * (reverse ? 1 : 0.6);
          return [p[0] + nx * (off + lift), p[1] + ny * (off + lift)];
        });
        var w = 1.4 + 4.2 * f.musd / MAXFLOW;
        var hot = st.hoverF === idx;
        ctx.save();
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.strokeStyle = hot ? C.vermInk : C.verm; ctx.globalAlpha = hot ? 1 : 0.85;
        ctx.lineWidth = w + (hot ? 1 : 0);
        ctx.setLineDash([w * 2.6, w * 1.7]);
        ctx.lineDashOffset = HA.reduced() ? 0 : -((now - st.dash0) / 40) % 1000;
        ctx.beginPath(); path.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke();
        ctx.setLineDash([]);
        // стрелка у покупателя
        var e1 = path[path.length - 1], e0 = path[path.length - 4] || path[0];
        var ang = Math.atan2(e1[1] - e0[1], e1[0] - e0[0]), ah = 7 + w * 1.4;
        ctx.beginPath();
        ctx.moveTo(e1[0], e1[1]);
        ctx.lineTo(e1[0] - ah * Math.cos(ang - 0.42), e1[1] - ah * Math.sin(ang - 0.42));
        ctx.lineTo(e1[0] - ah * Math.cos(ang + 0.42), e1[1] - ah * Math.sin(ang + 0.42));
        ctx.closePath(); ctx.fillStyle = C.vermInk; ctx.globalAlpha = 1; ctx.fill();
        // подпись у середины
        var m = path[Math.round(path.length / 2)];
        var txt = f.from + " → " + f.to + " · " + HA.fmtAuto(f.musd) + NB + "млн" + NB + "$";
        ctx.font = (hot ? "bold " : "") + "13px 'PT Serif', serif";
        var tw = ctx.measureText(txt).width + 10;
        // короткий маршрут (Чехия → Германия) — подпись ниже линии, длинные — над дугой
        var below = L < 120 || (reverse && f.from === "США");
        var lx = HA.clamp(m[0] - tw / 2, OX + 4, OX + SW - tw - 4), ly = HA.clamp(below ? m[1] + 12 + (L < 120 ? 22 : 0) : m[1] - 30, OY + 4, OY + SH - 24);
        ctx.restore();
        flowPaths.push({ idx: idx, pts: path, txt: txt, hot: hot, box: { x0: lx, y0: ly, x1: lx + tw, y1: ly + 20 }, anchor: m });
      });
    }

    function drawFlowLabels() {
      flowPaths.forEach(function (fp) {
        var b = fp.box;
        ctx.save();
        ctx.font = (fp.hot ? "bold " : "") + "13px 'PT Serif', serif";
        // выноска от подписи к линии
        ctx.strokeStyle = C.inkA(0.45); ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(HA.clamp(fp.anchor[0], b.x0 + 6, b.x1 - 6), fp.anchor[1] < b.y0 ? b.y0 : b.y1); ctx.lineTo(fp.anchor[0], fp.anchor[1]); ctx.stroke();
        ctx.fillStyle = "rgba(250,245,232,.96)"; rr(ctx, b.x0, b.y0, b.x1 - b.x0, 20); ctx.fill();
        ctx.strokeStyle = fp.hot ? C.vermInk : C.inkA(0.35); ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = C.vermInk; ctx.fillText(fp.txt, b.x0 + 5, b.y0 + 14);
        ctx.restore();
      });
    }

    /* бумага окна, шапка и «передача» глобуса со страницы — по ходу разворота */
    function sm(a, b, x) { var v = HA.clamp((x - a) / (b - a), 0, 1); return v * v * (3 - 2 * v); }
    function chrome(t, u, dir, el, pop) {
      // «всплытие» в центре: бумага закрывает страницу быстрее, глобус проявляется, а не подменяет
      bg.style.opacity = (pop ? (dir > 0 ? sm(0, 0.16, u) : 1 - sm(0.8, 1, u)) : sm(0.08, 0.62, t)).toFixed(3);
      var b = sm(0.5, 0.95, t);
      bar.style.opacity = b.toFixed(3);
      bar.style.transform = "translateY(" + ((1 - b) * -14).toFixed(1) + "px)";
      if (dir > 0) {
        // первые 180 мс (при всплытии — 320 мс) глобус окна проявляется, затем глобус страницы гаснет
        canvas.style.opacity = HA.clamp(el / (pop ? 320 : 180), 0, 1).toFixed(3);
        if ((pop || el > 140) && pageBox) pageBox.classList.add("is-handoff");
      } else {
        // обратно: глобус страницы проявляется под концом сворачивания, холст гаснет
        if (u > 0.78 && pageBox) pageBox.classList.remove("is-handoff");
        canvas.style.opacity = HA.clamp((1 - u) / (pop ? 0.22 : 0.16), 0, 1).toFixed(3);
      }
    }
    function chromeDone() { bg.style.opacity = ""; bar.style.opacity = ""; bar.style.transform = ""; canvas.style.opacity = ""; }

    /* «квинтик» — мягче кубического: без резкого разгона и без «удара» в конце */
    function ease5(x) { return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2; }
    function easeBack(x) { var c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
    /* «прорастание» шпалер: 0..1 для региона ранга rank (крупные — раньше); подписи — после */
    function grow(rank, now) {
      var sp = st.sprout;
      if (st.morph && (!sp || sp.dir > 0)) return 0;
      if (!sp) return 1;
      if (sp.dir > 0) { var x = HA.clamp((now - sp.t0 - (rank - 1) * 45) / 520, 0, 1); return x >= 1 ? 1 : Math.max(0, easeBack(x)); }
      return 1 - HA.clamp((now - sp.t0) / 260, 0, 1);
    }
    function labelsAlpha(now) {
      var sp = st.sprout;
      if (st.morph && (!sp || sp.dir > 0)) return 0;
      if (!sp) return 1;
      if (sp.dir > 0) return HA.clamp((now - sp.t0 - 650) / 350, 0, 1);
      return 1 - HA.clamp((now - sp.t0) / 180, 0, 1);
    }

    /* ---------- кадр ---------- */
    var raf = 0;
    function kick() { if (!raf && st.open) raf = requestAnimationFrame(tick); }
    function tick(now) {
      raf = 0;
      var again = false;
      if (st.morph) {
        var m = st.morph;
        // отсчёт — с первого кадра (тяжёлая подготовка не «съедает» начало анимации)
        if (!m.t0) m.t0 = now + (m.delay || 0);
        var u = HA.clamp((now - m.t0) / m.dur, 0, 1);
        // хореография: камера (центр, масштаб, поворот) — плавно всю дорогу; форма листа
        // начинает расправляться чуть позже и успевает к концу — шар сперва «приподнимается»
        var eCam = ease5(u), eShape = ease5(HA.clamp((u - 0.1) / 0.9, 0, 1));
        var tc = m.dir > 0 ? eCam : 1 - eCam, t = m.dir > 0 ? eShape : 1 - eShape;
        st.t = t;
        var lon = m.rot0[0] + (m.rot1[0] - m.rot0[0]) * tc, lat = m.rot0[1] + (m.rot1[1] - m.rot0[1]) * tc;
        st.rot = [lon, lat];
        // масштаб — в логарифмах, с лёгким «вдохом» в начале (шар приподнимается к зрителю)
        var lift = 1 + 0.07 * Math.sin(Math.PI * HA.clamp(tc / 0.45, 0, 1));
        st.s = Math.exp(Math.log(m.s0) + (Math.log(m.s1) - Math.log(m.s0)) * tc) * lift;
        st.tr = [m.c0[0] + (m.c1[0] - m.c0[0]) * tc, m.c0[1] + (m.c1[1] - m.c0[1]) * tc];
        st.clip = clipFor(t);
        st.moving = true; st.dirty = true; again = true;
        if (now >= m.t0) chrome(t, u, m.dir, now - m.t0, m.pop);
        if (u >= 1) { st.morph = null; if (m.done) m.done(); }
      } else if (st.anim) {
        var a = st.anim, v = Math.min(1, (now - a.t0) / a.dur), ev = HA.easeInOut(v);
        st.k = Math.exp(Math.log(a.k0) + (Math.log(a.k1) - Math.log(a.k0)) * ev);
        // сдвиг пересчитываем через «точку в центре», чтобы при смене k карта не уплывала
        var c = d3.geoInterpolate(a.c0, a.c1)(ev), q = centerOn(c, st.k);
        st.tx = q.tx; st.ty = q.ty;
        applyFlat(); st.moving = true; st.dirty = true; again = true;
        if (v >= 1) { st.anim = null; }
      } else if (st.t === 1) applyFlat();
      if (again) st.stillAt = now;
      else if (st.moving && now - st.stillAt > 160) { st.moving = false; st.dirty = true; }
      if (st.dirty) renderBase();
      else setProj();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(base, 0, 0);
      if (st.qfade) {
        var qa = 1 - HA.clamp((now - st.qfade) / 380, 0, 1);
        if (qa > 0) { ctx.globalAlpha = qa; ctx.drawImage(qprev, 0, 0); ctx.globalAlpha = 1; again = true; } else st.qfade = 0;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawItems(now);
      drawFlows(now);
      var la = labelsAlpha(now);
      if (la > 0) { ctx.globalAlpha = la; drawLabels(); drawFlowLabels(); ctx.globalAlpha = 1; } else labelsHit = [];
      var dashing = st.layer === "trade" && !HA.reduced() && now - st.dash0 < 12000;
      var sprouting = st.sprout && now - st.sprout.t0 < 1400;
      if (again || st.moving || dashing || sprouting) kick();
    }

    /* ---------- попадание ---------- */
    function local(e) { var b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; }
    function pickRegion(x, y) {
      for (var i = labelsHit.length - 1; i >= 0; i--) { var h = labelsHit[i]; if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return h.id; }
      var best = null, bd = 13;
      items.forEach(function (it) {
        var top = it.y - Math.max(it.h, 8) - 6, d;
        if (y >= top && y <= it.y + 6 && Math.abs(x - it.x) <= 7) d = Math.abs(x - it.x) * 0.5;
        else d = Math.hypot(x - it.x, y - it.y);
        if (d < bd || (d === bd && best && it.r.t > best.r.t)) { bd = d; best = it; }
      });
      return best ? best.r.id : null;
    }
    function pickFlow(x, y) {
      var best = null, bd = 8;
      flowPaths.forEach(function (fp) {
        var b = fp.box;
        if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) { best = fp.idx; bd = 0; return; }
        for (var i = 1; i < fp.pts.length; i++) {
          var a = fp.pts[i - 1], c = fp.pts[i], dx = c[0] - a[0], dy = c[1] - a[1], l2 = dx * dx + dy * dy || 1;
          var u = HA.clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1);
          var d = Math.hypot(x - a[0] - u * dx, y - a[1] - u * dy);
          if (d < bd) { bd = d; best = fp.idx; }
        }
      });
      return best;
    }
    function pickCountry(x, y) {
      if (st.t < 1) return null;
      if (!proj.invert) return null;
      var ll = proj.invert([x, y]);
      if (!ll || !isFinite(ll[0])) return null;
      var Wd = G.world.W110, hit = null;
      Object.keys(COUNTRIES).some(function (name) {
        var f = Wd.byId[COUNTRIES[name].iso];
        if (f && d3.geoContains(f, ll)) { hit = name; return true; }
        return false;
      });
      return hit;
    }

    /* ---------- всплывающая карточка ---------- */
    function showTip(html, x, y) {
      tip.innerHTML = html; HA.typoDOM(tip); tip.hidden = false;
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      x -= OX; y -= OY; // холст — на весь экран, справка — внутри области карты
      var lx = x + 18, ly = y + 16;
      if (lx + tw > SW - 8) lx = x - tw - 14;
      if (ly + th > SH - 8) ly = y - th - 12;
      tip.style.transform = "translate(" + Math.round(Math.max(8, lx)) + "px," + Math.round(Math.max(8, ly)) + "px)";
    }
    function hideTip() { tip.hidden = true; }
    function tipRegion(r) {
      return '<p class="amap__tip-k">' + HA.t(r.country) + " · №" + NB + r.rank + " из&nbsp;" + D.count + "</p>" +
        '<p class="amap__tip-h">' + HA.t(r.name) + "</p>" +
        '<p class="amap__tip-v">' + HA.fmt(r.t) + ' <span class="u">т/год</span></p>' +
        '<p class="amap__tip-s">' + fmtShare(share(r.t)) + STAR + " суммы по&nbsp;" + D.count + " регионам</p>" +
        '<p class="amap__tip-act">Нажмите&nbsp;— подробнее</p>';
    }
    function tipCountry(c) {
      var t6 = TOP6[c.name];
      return '<p class="amap__tip-k">Страна атласа</p><p class="amap__tip-h">' + HA.t(c.name) + "</p>" +
        '<p class="amap__tip-s">' + c.regions.length + " " + HA.plural(c.regions.length, ["регион", "региона", "регионов"]) + " атласа · " + HA.fmt(c.sum) + NB + "т/год" + STAR + "</p>" +
        (t6 ? '<p class="amap__tip-s">Топ-6 стран, 2025: №' + NB + t6.rank + ", " + HA.fmtAuto(t6.v) + NB + "тыс." + NB + "т</p>" : "") +
        '<p class="amap__tip-act">Нажмите&nbsp;— подробнее</p>';
    }
    function tipFlow(f) {
      return '<p class="amap__tip-k">Экспорт хмеля</p><p class="amap__tip-h">' + HA.t(f.from) + " → " + HA.t(f.to) + "</p>" +
        '<p class="amap__tip-v amap__tip-v--money">' + HA.fmtAuto(f.musd) + ' <span class="u">млн долл. США</span></p>';
    }

    /* ---------- подробная панель ---------- */
    function bars(rows, max, cls) {
      return '<ul class="amap__bars ' + (cls || "") + '">' + rows.map(function (r) {
        return '<li' + (r.me ? ' class="is-me"' : "") + '><span class="amap__bars-n">' + r.label + '</span><span class="amap__bars-t"><i style="width:' + Math.max(1.5, 100 * r.v / max).toFixed(1) + '%"></i></span><span class="amap__bars-v">' + r.text + "</span></li>";
      }).join("") + "</ul>";
    }
    function flowsBlock(country) {
      var fs = flowsOf(country);
      if (!fs.length) return "";
      return '<h4 class="amap__sub">Экспорт хмеля с&nbsp;участием страны</h4>' +
        bars(fs.map(function (f) { return { label: HA.t(f.from) + " → " + HA.t(f.to), v: f.musd, text: HA.fmtAuto(f.musd) + NB + "млн" + NB + "$" }; }), MAXFLOW, "amap__bars--money");
    }
    function renderRegion(id) {
      var r = D.byId[id], c = COUNTRIES[r.country], f = D.feature(id), t6 = TOP6[r.country];
      var nb = [D.ranked[r.rank - 2], r, D.ranked[r.rank]].filter(Boolean);
      // по кругу: после последнего — первый, перед первым — последний (кнопки всегда активны)
      var prev = D.ranked[(r.rank - 2 + D.count) % D.count], next = D.ranked[r.rank % D.count];
      var navHtml = '<nav class="amap__nav" aria-label="Соседние регионы по объёму">' +
        '<button type="button" class="btn btn--secondary btn--sm" data-go="' + (prev ? prev.id : "") + '"' + (prev ? "" : " disabled") + ">← №" + NB + (prev ? prev.rank : "") + "</button>" +
        '<button type="button" class="btn btn--secondary btn--sm" data-go="' + (next ? next.id : "") + '"' + (next ? "" : " disabled") + ">№" + NB + (next ? next.rank : "") + " →</button></nav>";
      detail.innerHTML =
        '<div class="amap__dtop"><button type="button" class="link-act" data-back="1"><span aria-hidden="true">←</span> Все регионы</button>' +
        '<button class="icon-btn" type="button" data-unsel="1" aria-label="Снять выбор"><svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button></div>' +
        navHtml +
        '<p class="amap__kick">' + HA.t(r.country) + " · №" + NB + r.rank + " из&nbsp;" + D.count + "</p>" +
        '<h3 class="amap__dh" id="amap-dh" tabindex="-1">' + HA.t(r.name) + "</h3>" +
        '<p class="amap__big">' + HA.fmt(r.t) + ' <span class="u">т/год</span></p>' +
        '<p class="amap__note">' + fmtShare(share(r.t)) + STAR + " суммы по&nbsp;" + D.count + " регионам атласа · координаты " + HA.fmt(r.lat, 2) + "°, " + HA.fmt(r.lon, 2) + "°</p>" +
        (f ? '<h4 class="amap__sub">Особенность региона (НИР)</h4><blockquote class="quote quote--sm">' + HA.t(f.text) + "</blockquote>" : "") +
        '<h4 class="amap__sub">Соседи по&nbsp;объёму</h4>' +
        bars(nb.map(function (x) { return { label: "№" + NB + x.rank + " " + HA.t(short(x.name)), v: x.t, text: HA.fmt(x.t) + NB + "т", me: x.id === r.id }; }), D.max) +
        '<h4 class="amap__sub">Страна: ' + HA.t(r.country) + "</h4>" +
        '<p class="amap__note">' + c.regions.length + " " + HA.plural(c.regions.length, ["регион", "региона", "регионов"]) + " атласа, вместе " + HA.fmt(c.sum) + NB + "т/год" + STAR +
        (t6 ? ". В&nbsp;топ-6 стран 2025&nbsp;г.&nbsp;— №" + NB + t6.rank + ", " + HA.fmtAuto(t6.v) + NB + "тыс." + NB + "т" : "") + ".</p>" +
        (c.regions.length > 1 ? '<p><button type="button" class="link-act" data-country="' + HA.esc(r.country) + '">Все регионы страны <span aria-hidden="true">→</span></button></p>' : "") +
        flowsBlock(r.country);
      HA.typoDOM(detail);
    }
    function renderCountry(name) {
      var c = COUNTRIES[name], t6 = TOP6[name];
      detail.innerHTML =
        '<div class="amap__dtop"><button type="button" class="link-act" data-back="1"><span aria-hidden="true">←</span> Все регионы</button>' +
        '<button class="icon-btn" type="button" data-unsel="1" aria-label="Снять выбор"><svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button></div>' +
        '<p class="amap__kick">Страна атласа</p>' +
        '<h3 class="amap__dh" id="amap-dh" tabindex="-1">' + HA.t(name) + "</h3>" +
        '<p class="amap__big">' + HA.fmt(c.sum) + STAR + ' <span class="u">т/год</span></p>' +
        '<p class="amap__note">сумма по&nbsp;' + c.regions.length + " " + HA.plural(c.regions.length, ["региону", "регионам", "регионам"]) + " атласа · " + fmtShare(share(c.sum)) + STAR + " суммы по&nbsp;" + D.count + " регионам</p>" +
        (t6 ? '<p class="amap__note">Топ-6 стран по&nbsp;производству, 2025&nbsp;г.: №' + NB + t6.rank + ", " + HA.fmtAuto(t6.v) + NB + "тыс." + NB + "т</p>" : "") +
        '<h4 class="amap__sub">Регионы страны</h4>' +
        bars(c.regions.map(function (x) { return { label: '<button type="button" class="amap__lnk" data-go="' + x.id + '">' + HA.t(short(x.name)) + "</button>", v: x.t, text: HA.fmt(x.t) + NB + "т" }; }), D.max) +
        flowsBlock(name);
      HA.typoDOM(detail);
    }
    function showDetail(on) {
      detail.hidden = !on; listView.hidden = on;
      root.classList.toggle("has-detail", on);
      if (on) side.scrollTop = 0;
    }

    /* ---------- список ---------- */
    function renderList() {
      var q = st.q.trim().toLowerCase();
      var arr = D.ranked.slice();
      if (st.sort === "name") arr.sort(function (a, b) { return a.name.localeCompare(b.name, "ru"); });
      if (st.sort === "country") arr.sort(function (a, b) { return a.country.localeCompare(b.country, "ru") || b.t - a.t; });
      if (q) arr = arr.filter(function (r) { return (r.name + " " + r.country).toLowerCase().indexOf(q) >= 0; });
      listEl.innerHTML = arr.length ? arr.map(function (r) {
        return '<li><button type="button" data-id="' + r.id + '"' + (r.id === st.sel ? ' aria-current="true"' : "") + '>' +
          '<span class="amap__li-n">' + r.rank + "</span>" +
          '<span class="amap__li-t"><b>' + HA.t(short(r.name)) + "</b><small>" + HA.t(r.country) + "</small></span>" +
          '<span class="amap__li-v">' + HA.fmt(r.t) + NB + "т</span>" +
          '<span class="amap__li-bar" aria-hidden="true"><i style="width:' + Math.max(1, 100 * r.t / D.max).toFixed(1) + '%"></i></span></button></li>';
      }).join("") : '<li class="amap__empty">Ничего не найдено. Попробуйте другое название.</li>';
      HA.typoDOM(listEl);
    }

    /* ---------- действия ---------- */
    function flyTo(c, k, dur) {
      if (st.t === 1) { applyFlat(); setProj(); }
      var from = (proj.invert && proj.invert([OX + SW / 2, OY + SH / 2])) || VIEWS.world.c;
      k = HA.clamp(k, 1, KMAX);
      if (HA.reduced()) { var q = centerOn(c, k); st.k = k; st.tx = q.tx; st.ty = q.ty; applyFlat(); st.dirty = true; kick(); return; }
      st.anim = { t0: performance.now(), dur: dur || 900, k0: st.k, k1: k, c0: from, c1: c };
      kick();
    }
    function setView(name) {
      var V = VIEWS[name]; if (!V) return;
      st.view = name;
      if (name === "world") { flyTo([LON0 + 12, worldK() > 1 ? 0 : 12], worldK()); HA.$$(".amap__views button", root).forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === name)); }); return; }
      HA.$$(".amap__views button", root).forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === name)); });
      flyTo(V.c, V.k);
    }
    function viewLost() {
      if (!st.view) return;
      st.view = null;
      HA.$$(".amap__views button", root).forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    }
    function selectRegion(id, o) {
      o = o || {};
      st.sel = id; st.selC = null;
      if (id) {
        var r = D.byId[id];
        renderRegion(id); showDetail(true);
        if (o.fly !== false) {
          var p = proj([r.lon, r.lat]);
          var vis = p && p[0] > OX + SW * 0.12 && p[0] < OX + SW * 0.88 && p[1] > OY + SH * 0.15 && p[1] < OY + SH * 0.9;
          var kk = D.europeIds.indexOf(id) >= 0 ? Math.max(st.k, 5) : Math.max(st.k, 2.4);
          if (!vis || st.k < kk * 0.8) { flyTo([r.lon, r.lat], kk); viewLost(); }
        }
        HA.announce(r.name + ", " + r.country + ": " + HA.fmt(r.t) + " тонн в год, " + r.rank + "-е место из " + D.count + ".");
        if (o.focus) setTimeout(function () { var h = HA.$("#amap-dh"); if (h) h.focus({ preventScroll: true }); }, 30);
      } else showDetail(false);
      renderList();
      st.dirty = true; kick();
    }
    function selectCountry(name, o) {
      o = o || {};
      st.sel = null; st.selC = name;
      renderCountry(name); showDetail(true);
      var c = COUNTRIES[name], f = G.world.W110.byId[c.iso];
      if (f && o.fly !== false) {
        var cen = d3.geoCentroid(f), b = d3.geoBounds(f);
        var span = Math.max(8, Math.min(60, Math.abs(b[1][0] - b[0][0])));
        // США: регионы на западе — центрируем по регионам, а не по стране
        if (c.regions.length) cen = [d3.mean(c.regions, function (r) { return r.lon; }), d3.mean(c.regions, function (r) { return r.lat; })];
        flyTo(cen, HA.clamp(110 / span, 1.4, 6)); viewLost();
      }
      HA.announce(name + ": " + c.regions.length + " " + HA.plural(c.regions.length, ["регион", "региона", "регионов"]) + " атласа.");
      if (o.focus) setTimeout(function () { var h = HA.$("#amap-dh"); if (h) h.focus({ preventScroll: true }); }, 30);
      renderList();
      st.dirty = true; kick();
    }
    function clearSel() { st.sel = null; st.selC = null; showDetail(false); renderList(); st.dirty = true; kick(); }

    function zoomAt(f, x, y) {
      var k1 = HA.clamp(st.k * f, 1, KMAX);
      if (Math.abs(k1 - st.k) < 1e-4) return;
      st.anim = null;
      if (x == null) { x = OX + SW / 2; y = OY + SH / 2; }
      // точка под курсором остаётся на месте: T' = p − (p − T)·k'/k
      var T = [OX + SW / 2 + st.tx, OY + SH / 2 + st.ty], r = k1 / st.k;
      var nT = [x - (x - T[0]) * r, y - (y - T[1]) * r];
      st.k = k1; st.tx = nT[0] - OX - SW / 2; st.ty = nT[1] - OY - SH / 2;
      clampPan(); applyFlat();
      st.moving = true; st.stillAt = performance.now(); st.dirty = true;
      viewLost(); kick();
    }
    function setLayer(name) {
      st.layer = name;
      HA.$$(".amap__layers button", root).forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-layer") === name)); });
      if (name === "trade") st.dash0 = performance.now();
      updateLegend();
      st.dirty = true; kick();
    }
    function updateLegend() {
      legend.innerHTML = st.layer === "trade"
        ? '<span class="legend-line__ic" data-orn="icon-flow"></span><span>Пунктир со&nbsp;стрелкой&nbsp;— экспорт хмеля, толщина&nbsp;— сумма, млн&nbsp;долл. США</span>'
        : '<span class="legend-line__ic" data-orn="icon-trellis"></span><span>Высота шпалеры&nbsp;— объём производства, т/год; насечка&nbsp;— 10&nbsp;000&nbsp;т.<span class="amap__legend-x"> Наведите на&nbsp;шпалеру или страну&nbsp;— появится справка, нажмите&nbsp;— подробности.</span></span>';
      if (HA.orn && HA.orn.fill) HA.orn.fill(legend);
    }

    /* ---------- события холста ---------- */
    canvas.addEventListener("wheel", function (e) {
      if (!st.open || st.morph) return;
      e.preventDefault();
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      var rate = e.ctrlKey && Math.abs(dy) < 40 ? 0.012 : 0.0028;
      var p = local(e);
      zoomAt(HA.clamp(Math.pow(2, -dy * rate), 0.5, 2), p[0], p[1]);
      hideTip();
    }, { passive: false });
    var touches = {}, pinch = null;
    function tlist() { return Object.keys(touches).map(function (k) { return touches[k]; }); }
    canvas.addEventListener("pointerdown", function (e) {
      if (st.morph || (e.pointerType === "mouse" && e.button !== 0)) return;
      if (e.pointerType === "touch") {
        touches[e.pointerId] = { x: e.clientX, y: e.clientY };
        var T = tlist();
        if (T.length === 2) { st.drag = null; pinch = { d: Math.hypot(T[0].x - T[1].x, T[0].y - T[1].y), k: st.k }; return; }
      }
      st.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    });
    canvas.addEventListener("pointermove", function (e) {
      if (touches[e.pointerId]) touches[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (pinch) {
        var T = tlist(); if (T.length < 2) return;
        var d = Math.hypot(T[0].x - T[1].x, T[0].y - T[1].y), m = local({ clientX: (T[0].x + T[1].x) / 2, clientY: (T[0].y + T[1].y) / 2 });
        zoomAt((pinch.k * d / pinch.d) / st.k, m[0], m[1]);
        return;
      }
      var dr = st.drag;
      if (dr && dr.id === e.pointerId) {
        if (!dr.moved && Math.hypot(e.clientX - dr.sx, e.clientY - dr.sy) > 4) {
          dr.moved = true; st.anim = null; canvas.classList.add("is-dragging");
          try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* без захвата */ }
          hideTip(); viewLost();
        }
        if (!dr.moved) return;
        st.tx += e.clientX - dr.x; st.ty += e.clientY - dr.y; dr.x = e.clientX; dr.y = e.clientY;
        clampPan(); applyFlat();
        st.moving = true; st.stillAt = performance.now(); st.dirty = true; kick();
        return;
      }
      if (e.pointerType !== "mouse" || st.t < 1) return;
      var p = local(e);
      var fi = st.layer === "trade" ? pickFlow(p[0], p[1]) : null;
      var id = fi == null ? pickRegion(p[0], p[1]) : null;
      var cn = fi == null && !id ? pickCountry(p[0], p[1]) : null;
      if (fi !== st.hoverF || id !== st.hover || cn !== st.hoverC) {
        var baseChange = cn !== st.hoverC;
        st.hoverF = fi; st.hover = id; st.hoverC = cn;
        if (baseChange) st.dirty = true;
        kick();
      }
      canvas.classList.toggle("is-pointing", fi != null || !!id || !!cn);
      if (fi != null) showTip(tipFlow(FLOWS[fi]), p[0], p[1]);
      else if (id) showTip(tipRegion(D.byId[id]), p[0], p[1]);
      else if (cn) showTip(tipCountry(COUNTRIES[cn]), p[0], p[1]);
      else hideTip();
    });
    function up(e) {
      delete touches[e.pointerId];
      if (pinch && tlist().length < 2) { pinch = null; st.drag = null; return; }
      var dr = st.drag;
      if (!dr || dr.id !== e.pointerId) return;
      st.drag = null; canvas.classList.remove("is-dragging");
      if (dr.moved || e.type !== "pointerup") return;
      var p = local(e);
      var id = pickRegion(p[0], p[1]);
      if (id) { selectRegion(id); return; }
      var fi = st.layer === "trade" ? pickFlow(p[0], p[1]) : null;
      if (fi != null) { selectCountry(FLOWS[fi].from); return; }
      var cn = pickCountry(p[0], p[1]);
      if (cn) { selectCountry(cn); return; }
      if (st.sel || st.selC) clearSel();
    }
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerleave", function () {
      if (st.hover || st.hoverC || st.hoverF != null) { st.hover = null; st.hoverC = null; st.hoverF = null; st.dirty = true; kick(); }
      hideTip();
    });
    canvas.addEventListener("dblclick", function (e) { var p = local(e); zoomAt(2, p[0], p[1]); });
    canvas.addEventListener("keydown", function (e) {
      var step = 60;
      var m = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
      if (m) { st.anim = null; st.tx += m[0]; st.ty += m[1]; clampPan(); applyFlat(); st.dirty = true; viewLost(); kick(); }
      else if (e.key === "+" || e.key === "=") zoomAt(1.5);
      else if (e.key === "-" || e.key === "_") zoomAt(1 / 1.5);
      else return;
      e.preventDefault();
    });

    /* ---------- панель, список, кнопки ---------- */
    root.addEventListener("click", function (e) {
      var b;
      if ((b = e.target.closest("[data-close]"))) { close(); return; }
      if ((b = e.target.closest(".amap__views button"))) { setView(b.getAttribute("data-view")); return; }
      if ((b = e.target.closest(".amap__layers button"))) { setLayer(b.getAttribute("data-layer")); return; }
      if ((b = e.target.closest(".amap__sort button"))) {
        st.sort = b.getAttribute("data-sort");
        HA.$$(".amap__sort button", root).forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
        renderList(); return;
      }
      if ((b = e.target.closest("[data-zoom]"))) {
        var z = b.getAttribute("data-zoom");
        if (z === "reset") setView("world"); else zoomAt(z === "in" ? 1.6 : 1 / 1.6);
        return;
      }
      var kb = e.detail === 0; // нажатие с клавиатуры — фокус переводим на заголовок панели
      if ((b = e.target.closest("[data-id]"))) { selectRegion(b.getAttribute("data-id"), { focus: kb }); return; }
      if ((b = e.target.closest("[data-go]"))) { if (b.getAttribute("data-go")) selectRegion(b.getAttribute("data-go"), { focus: kb }); return; }
      if ((b = e.target.closest("[data-country]"))) { selectCountry(b.getAttribute("data-country"), { focus: kb }); return; }
      if (e.target.closest("[data-back]")) { showDetail(false); var f = listEl.querySelector('[aria-current="true"]') || qIn; if (f) f.focus({ preventScroll: true }); return; }
      if (e.target.closest("[data-unsel]")) { clearSel(); qIn.focus({ preventScroll: true }); }
    });
    listEl.addEventListener("pointerover", function (e) {
      var b = e.target.closest("[data-id]"); var id = b ? b.getAttribute("data-id") : null;
      if (id !== st.hover) { st.hover = id; kick(); }
    });
    listEl.addEventListener("pointerleave", function () { if (st.hover) { st.hover = null; kick(); } });
    qIn.addEventListener("input", function () { st.q = qIn.value; renderList(); });
    qIn.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { var b = listEl.querySelector("[data-id]"); if (b) { e.preventDefault(); selectRegion(b.getAttribute("data-id"), { focus: true }); } }
    });

    /* ---------- открыть / закрыть ---------- */
    function globeStart() {
      // откуда «вырастает» карта: центр и радиус глобуса на странице (в координатах окна карты)
      var gc = globe && globe.getCamera ? globe.getCamera() : null;
      var gb = HA.$("#globe-box"), sb = stage.getBoundingClientRect();
      var st0 = globe && globe.state;
      if (!gb || !st0 || !gc) return null;
      var b = gb.getBoundingClientRect();
      var L = st0.lens;
      var R = L.R * Math.min(2.2, gc.z);
      var cx = b.left + L.cx - (st.full ? 0 : sb.left), cy = b.top + L.cy - (st.full ? 0 : sb.top);
      // глобус страницы виден не целиком (страница прокручена, узкое окно) — подхватывать
      // его «обрубок» некрасиво: атлас всплывает целым глобусом в центре окна карты
      var pad = 6, gx = b.left + L.cx, gy = b.top + L.cy;
      var whole = gx - R >= -pad && gy - R >= -pad && gx + R <= window.innerWidth + pad && gy + R <= window.innerHeight + pad;
      if (!whole) {
        R = Math.min(SW, SH) * 0.36;
        return { rot: [gc.rot[0], gc.rot[1]], s: R, c: [OX + SW / 2, OY + SH / 2], pop: true };
      }
      return { rot: [gc.rot[0], gc.rot[1]], s: R, c: [cx, cy], pop: false };
    }
    function lonNear(target, from) { var d = target - from; while (d > 180) d -= 360; while (d < -180) d += 360; return from + d; }
    var lastOpener = null;
    function open(opener) {
      if (st.open) return;
      lastOpener = opener || document.activeElement;
      returnFocus = lastOpener;
      root.hidden = false;
      document.documentElement.classList.add("amap-lock");
      st.open = true;
      var anim = !HA.reduced() && !!globe;
      layout(true);
      st.k = 1; st.tx = 0; st.ty = 0; st.view = "world";
      HA.$$(".amap__views button", root).forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === "world")); });
      var s0 = globeStart();
      if (globe && globe.selected) { st.sel = globe.selected; }
      renderList();
      if (st.sel) { renderRegion(st.sel); showDetail(true); } else showDetail(false);
      updateLegend();
      if (!pushed && window.history && history.pushState) { try { history.pushState({ amap: 1 }, "", "#atlas"); pushed = true; } catch (err) { pushed = false; } }
      root.classList.add("is-open");
      if (!anim || !s0) {
        chromeDone();
        st.sprout = { t0: -1e9, dir: 1 };
        applyFlat(); st.dirty = true; root.classList.add("is-flat"); kick();
      } else {
        root.classList.remove("is-flat");
        // текстуры моря и тени — как у глобуса страницы, чтобы первый кадр совпал с ним
        oceanTex = G.base.makeOcean(Math.round(s0.s), dpr, "high");
        shadeTex = G.base.makeShade(Math.round(s0.s), dpr, "high");
        var rot1 = [-LON0, 0];
        st.morph = {
          t0: 0, dur: 2000, dir: 1,
          rot0: s0.rot, rot1: [lonNear(rot1[0], s0.rot[0]), rot1[1]],
          s0: s0.pop ? s0.s * 0.78 : s0.s, s1: S1, c0: s0.c, c1: [OX + SW / 2, OY + SH / 2], pop: s0.pop,
          done: function () {
            oceanTex = null; shadeTex = null;
            // облегчённая картинка разворота плавно уступает подробной (волны у берегов, вторая акварель)
            qctx.setTransform(1, 0, 0, 1, 0, 0); qctx.clearRect(0, 0, qprev.width, qprev.height); qctx.drawImage(base, 0, 0);
            st.qfade = performance.now();
            chromeDone();
            applyFlat(); st.dirty = true; root.classList.add("is-flat");
            // лист лёг — шпалеры «прорастают» по очереди, от крупных к мелким, потом подписи
            st.sprout = { t0: performance.now(), dir: 1 };
            if (worldK() > 1 && !st.sel) setView("world");
            kick();
          }
        };
        st.t = 0; st.rot = s0.rot; st.s = s0.s; st.tr = s0.c; st.clip = 90;
        chrome(0, 0, 1, 0, s0.pop);
        kick();
      }
      // фокус — на заголовок окна (без рамки); дальше Tab ведёт к кнопкам и карте
      setTimeout(function () { var h = HA.$("#amap-h"); try { h.focus({ preventScroll: true }); } catch (err) { /* нет */ } }, HA.reduced() ? 0 : 200);
      HA.announce("Открыт атлас: интерактивная карта мира с 18 регионами производства хмеля. Escape — закрыть.");
    }
    function finishClose() {
      st.open = false; st.morph = null; st.anim = null;
      root.classList.remove("is-open", "is-flat", "is-closing");
      root.hidden = true;
      oceanTex = null; shadeTex = null;
      chromeDone();
      if (pageBox) pageBox.classList.remove("is-handoff");
      document.documentElement.classList.remove("amap-lock");
      hideTip();
      // выбор на карте → на глобусе страницы
      if (globe && st.sel && globe.selected !== st.sel) globe.select(st.sel, { source: "map", fly: true });
      if (returnFocus && document.body.contains(returnFocus)) { try { returnFocus.focus({ preventScroll: true }); } catch (err) { /* нет */ } }
    }
    function close(fromHistory) {
      if (!st.open) return;
      if (!fromHistory && pushed) { pushed = false; history.back(); return; } // popstate вызовет close(true)
      pushed = false;
      if (location.hash === "#atlas" && history.replaceState) { try { history.replaceState(null, "", location.pathname + location.search); } catch (err) { /* нет */ } }
      if (HA.reduced() || !globe || st.t < 1) { finishClose(); return; }
      var s0 = globeStart();
      if (!s0) { finishClose(); return; }
      root.classList.add("is-closing"); root.classList.remove("is-flat");
      hideTip();
      st.anim = null;
      oceanTex = G.base.makeOcean(Math.round(s0.s), dpr, "high");
      shadeTex = G.base.makeShade(Math.round(s0.s), dpr, "high");
      var c = [OX + SW / 2 + st.tx, OY + SH / 2 + st.ty];
      // сначала шпалеры и подписи «уходят в землю» (0,28 с), затем лист сворачивается в шар
      st.sprout = { t0: performance.now(), dir: -1 };
      st.morph = {
        t0: 0, delay: 280, dur: 1500, dir: -1,
        rot0: s0.rot, rot1: [lonNear(-LON0, s0.rot[0]), 0],
        s0: s0.pop ? s0.s * 0.78 : s0.s, s1: S1 * st.k, c0: s0.c, c1: c, pop: s0.pop,
        done: finishClose
      };
      kick();
    }
    window.addEventListener("popstate", function () { if (st.open) close(true); });
    root.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); if (st.sel || st.selC) clearSel(); else close(); return; }
      if (e.key !== "Tab") return;
      // фокус не уходит из окна карты
      var f = HA.$$('button:not([disabled]), input, [tabindex="0"]', root).filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    var roT = 0;
    window.addEventListener("resize", function () {
      if (!st.open) return;
      clearTimeout(roT);
      roT = setTimeout(function () { if (layout(true)) { if (st.t === 1) { clampPan(); applyFlat(); } kick(); } }, 80);
    });
    G.world.load50(function () { if (st.open) { st.dirty = true; kick(); } });

    /* ---------- кнопки «Открыть атлас» на странице ---------- */
    HA.$$("[data-open-atlas]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); open(b); });
    });
    if (globe) globe.on("dbl", function () { open(HA.$("#globe")); });
    if (location.hash === "#atlas") setTimeout(function () { open(null); }, 300);

    return { open: open, close: close, get isOpen() { return st.open; }, state: st };
  };
})();
