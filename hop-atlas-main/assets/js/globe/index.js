/* =====================================================================
   Глобус · index.js — состояние, отрисовка, события, связь с карточкой,
   списком и шагами облёта.
   Только canvas 2D + d3 geoOrthographic (без WebGL): гравюрная графика
   рисуется линиями и работает на слабых компьютерах аудиторий.

   Кадр = копия неподвижной основы (offscreen) + потоки + шпалеры +
   подписи. Основа перерисовывается только при изменениях; рендер
   стоит на паузе вне экрана и на скрытой вкладке. Постоянного
   автоповорота нет: при открытии глобус один раз доворачивается до вида
   «Весь мир» (3,4 с) и дальше движется только по действию человека.
   Пунктир экспорта рисуется только в виде «США и Атлантика»
   (в режиме карты — когда включён слой «Торговые потоки»).
   Если перерисовка основы в движении стабильно дорогая, штриховка
   и зерно упрощаются.

   Зум (колёсико, щипок, «+ / −», клавиши): плавный, к точке под
   курсором — точка глобуса под курсором остаётся на месте, север
   остаётся вверху. Когда колёсико зумит, решает opt.wheel(e):
   на странице — только если глобус «включён» или зажат Ctrl/⌘
   (иначе страница прокручивается дальше, см. stage.js), в режиме
   карты — всегда.

   Режимы: opt.mode = "page" (глобус на странице) | "map" (режим
   карты: палец вращает и по широте, двойное касание приближает,
   Esc закрывает карту, а не карточку).
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, G = HA.globe, C = HA.C, D = HA.D;
  var VIEWS = G.camera.VIEWS;
  var RAD = Math.PI / 180;

  G.create = function (opt) {
    var box = opt.box, canvas = opt.canvas, ringSvg = opt.ring;
    var MAP = opt.mode === "map";
    var MAXK = opt.maxK || 6.5;          // наибольшее приближение (в «видах»: Европа — 4,4)
    var ctx = canvas.getContext("2d");
    var base = document.createElement("canvas"), bctx = base.getContext("2d");
    var prev = document.createElement("canvas"), pctx = prev.getContext("2d");
    var scratch = document.createElement("canvas");
    var proj = d3.geoOrthographic().clipAngle(90);
    var inv = d3.geoOrthographic().clipAngle(90); // обратная проекция: какая точка Земли под курсором
    var gen = d3.geoPath(proj);
    var FLOWS = G.flows.prep(window.ATLAS_DATA.flows);
    var listeners = {};
    var emit = function (n, p) { (listeners[n] || []).forEach(function (fn) { fn(p); }); };

    var W = 0, H = 0, dpr = 1, small = false, R0 = 100, ringPad = 36;
    var ocean = null, shade = null, ringG = null;
    var now0 = performance.now();
    var st = {
      rot: [-VIEWS.world.center[0], -VIEWS.world.center[1], 0],
      z: 1, view: "world", viewSource: "init",
      selected: null, hover: null, focus: null, also: null,
      flight: null, drag: null, vel: [0, 0],
      lastInteract: now0, autoAt: now0 + 3500,
      pointerInside: false, moving: false, stillSince: 0,
      dirty: true, visible: true, docVisible: !document.hidden,
      lens: { cx: 0, cy: 0, R: 0 }, lensAnim: null,
      card: null, cardMode: null,
      clusterK: 1, lod: 110, fade: null,
      quality: "high", lazy: false, emph: null, interacted: false,
      paused: false, focused: false,
      showFlows: false, dashUntil: 0, // пунктир экспорта — только в виде «США»; бежит первые 6 с
      zt: null, za: null,   // плавный зум: целевое приближение и «якорь» (точка экрана + точка Земли под ней)
      pinch: null,          // щипок двумя пальцами
      layer: "production"   // слой режима карты: production | trade
    };
    var perf = { frames: 0, ms: [], base: [], moveBase: [], ticks: 0 };
    var items = [], hits = [], visibleSet = "", lastHmax = 0;

    /* центр каждой страны атласа (по самому большому её контуру — без заморских
       территорий): подписи стараются ставить в сторону своей страны */
    var CENTER = {};
    Object.keys(D.atlasIso).forEach(function (iso) {
      var f = G.world.W110.byId[iso];
      if (!f) return;
      var g = f.geometry, polys = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates], best = null, ba = -1;
      polys.forEach(function (pc) { var poly = { type: "Polygon", coordinates: pc }, a = d3.geoArea(poly); if (a < 2 * Math.PI && a > ba) { ba = a; best = poly; } });
      if (best) CENTER[iso] = d3.geoCentroid(best);
    });

    /* ---------------- Геометрия ---------------- */
    function zoomFor(k) { return k <= 1.0001 ? k : k * Math.max(1, Math.sqrt(290 / R0)); }
    function zmax() { return zoomFor(MAXK); }

    function layout() {
      var b = box.getBoundingClientRect();
      var w = Math.round(b.width), h = Math.round(b.height);
      if (!w || !h) return false;
      var newDpr = Math.min(2, window.devicePixelRatio || 1);
      var changed = w !== W || h !== H || newDpr !== dpr;
      W = w; H = h; dpr = newDpr;
      small = W < 520;
      ringPad = small ? 21 : 38; // на телефоне кольцо без надписи — тоньше, глобус крупнее
      R0 = Math.max(60, Math.min(W, H) / 2 - ringPad);
      if (st.z > zmax()) st.z = zmax();
      if (st.zt != null && st.zt > zmax()) st.zt = zmax();
      if (!changed && ocean) return true;
      [canvas, base, prev, scratch].forEach(function (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
      ringSvg.setAttribute("viewBox", "0 0 " + W + " " + H);
      // на кольце — только название (легенда одна — строка под глобусом); на телефоне кольцо без надписи
      var built = G.ring.build(ringSvg, {
        R0: R0, small: small, vine: !small && opt.vine !== false,
        top: small ? "" : "МИРОВОЕ ПРОИЗВОДСТВО ХМЕЛЯ · " + D.count + " " + HA.plural(D.count, ["РЕГИОН", "РЕГИОНА", "РЕГИОНОВ"]) + " АТЛАСА",
        topShort: small ? "" : "МИРОВОЕ ПРОИЗВОДСТВО ХМЕЛЯ",
        bottom: ""
      });
      ringG = built.g;
      ocean = G.base.makeOcean(R0, dpr, st.quality);
      shade = G.base.makeShade(R0, dpr, st.quality);
      var target = lensTarget();
      st.lens = { cx: target.cx, cy: target.cy, R: target.R };
      st.lensAnim = null;
      placeRing();
      st.dirty = true;
      return true;
    }

    /* линза: без карточки — по центру; с карточкой — отъезжает от неё,
       и кольцо с надписями не уходит под карточку */
    function lensTarget() {
      var L = { cx: W / 2, cy: H / 2, R: R0 };
      var c = st.card;
      if (!c) return L;
      if (st.cardMode === "side") {
        // диск целиком левее карточки; под карточку может зайти только внешняя полоса делений
        var R = Math.min(R0, (c.x0 - 6 - ringPad) / 2);
        R = Math.max(70, R);
        L = { cx: Math.max(R + ringPad, Math.min(W / 2, c.x0 - 6 - R)), cy: H / 2, R: R };
      } else if (st.cardMode === "below") {
        var availH = Math.max(150, c.y0 - 6);
        var R2 = Math.max(60, Math.min(R0, availH / 2 - ringPad));
        L = { cx: W / 2, cy: Math.max(R2 + ringPad, availH / 2), R: R2 };
      }
      return L;
    }
    function animateLens(instant) {
      var t = lensTarget();
      var L = st.lens;
      if (Math.abs(t.cx - L.cx) < 0.5 && Math.abs(t.cy - L.cy) < 0.5 && Math.abs(t.R - L.R) < 0.5) return;
      if (instant || HA.reduced()) { st.lens = t; st.lensAnim = null; placeRing(); st.dirty = true; kick(); return; }
      st.lensAnim = { from: { cx: L.cx, cy: L.cy, R: L.R }, to: t, t0: performance.now(), dur: 400 };
      kick();
    }
    function placeRing() {
      if (!ringG) return;
      var L = st.lens;
      ringG.setAttribute("transform", "translate(" + L.cx.toFixed(1) + " " + L.cy.toFixed(1) + ") scale(" + (L.R / R0).toFixed(4) + ")");
    }

    /* 3D-проекция точки (с подъёмом alt над сферой) */
    var rf = d3.geoRotation(st.rot);
    function proj3(lon, lat, alt) {
      var q = rf([lon, lat]), l = q[0] * RAD, p = q[1] * RAD, cp = Math.cos(p);
      var x = cp * Math.sin(l), y = -Math.sin(p), z = cp * Math.cos(l);
      var k = 1 + (alt || 0), Rs = st.lens.R * st.z;
      return { x: st.lens.cx + Rs * k * x, y: st.lens.cy + Rs * k * y, z: z, vis: z > 0 || k * k * (x * x + y * y) > 1.0005 };
    }

    /* ---------------- Основа (offscreen) ---------------- */
    function renderBase(now) {
      var t0 = performance.now();
      var W50 = G.world.W50;
      // подробная карта (1:50 млн) — в покое при приближении или на большом глобусе режима карты
      var hi = !st.moving && (st.z >= 1.45 || st.lens.R * st.z >= 520) && !!W50;
      var newLod = hi ? 50 : 110;
      if (newLod !== st.lod && newLod === 50 && !HA.reduced()) {
        // плавная смена подробности: старый кадр гаснет за 180 мс
        pctx.setTransform(1, 0, 0, 1, 0, 0);
        pctx.clearRect(0, 0, prev.width, prev.height);
        pctx.drawImage(base, 0, 0);
        st.fade = { t0: now, dur: 180 };
      }
      st.lod = newLod;
      var Wd = hi ? W50 : G.world.W110;
      var L = st.lens;
      // в движении — без адаптивной передискретизации (precision 0), в покое — точно
      proj.scale(L.R * st.z).translate([L.cx, L.cy]).rotate(st.rot).precision(st.moving ? 0 : 0.45);
      var g = bctx;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.save();
      g.beginPath(); g.arc(L.cx, L.cy, L.R, 0, Math.PI * 2); g.clip();
      var s = (L.R / ocean.R) * ocean.S;
      g.drawImage(ocean.c, L.cx - s / 2, L.cy - s / 2, s, s);
      G.base.paintMap(g, gen, Wd, { scratch: scratch, size: [W, H], dpr: dpr, z: st.z, q: st.quality, moving: st.moving });
      // зелёные пятна-пологи регионов
      g.globalCompositeOperation = "multiply";
      var zz = Math.min(2.2, Math.sqrt(st.z));
      D.regions.forEach(function (r) {
        var p = proj3(r.lon, r.lat, 0);
        if (p.z <= 0) return;
        var sz = (16 + 14 * Math.sqrt(r.t / D.max)) * zz;
        g.globalAlpha = Math.min(1, p.z * 3) * 0.9;
        g.drawImage(G.sprites.BLOT, p.x - sz / 2, p.y - sz / 2, sz, sz * (0.55 + 0.45 * p.z));
      });
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      // выбранная страна — двойной охристый контур
      if (st.selected) {
        var r = D.byId[st.selected], pp = proj3(r.lon, r.lat, 0);
        G.base.paintSelection(g, gen, Wd, r, pp.z > 0 ? [pp.x, pp.y] : null);
      }
      var s2 = (L.R / shade.R) * shade.S;
      g.drawImage(shade.c, L.cx - s2 / 2, L.cy - s2 / 2, s2, s2);
      g.restore();
      st.dirty = false;
      var ms = performance.now() - t0;
      perf.base.push(ms); if (perf.base.length > 120) perf.base.shift();
      if (st.moving) adapt(ms);
    }

    /* ---------------- Слабый компьютер: решаем по перерисовкам основы в движении ----------------
       Скользящее окно из 24 перерисовок: медиана > 22 мс → упрощённая штриховка и без зерна,
       автоповорот и пунктир — 15 кадров/с; если и после этого медиана > 30 мс — автоповорот
       выключается (облёт и ручное вращение остаются). */
    function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[s.length >> 1]; }
    function adapt(ms) {
      perf.moveBase.push(ms);
      if (perf.moveBase.length < 24) return;
      var m = median(perf.moveBase);
      perf.moveBase = [];
      if (st.quality === "high" && m > 22) {
        st.quality = "low";
        ocean = G.base.makeOcean(R0, dpr, "low");
        shade = G.base.makeShade(R0, dpr, "low");
        st.dirty = true;
      } else if (st.quality === "low" && m > 30) st.lazy = true;
    }

    /* ---------------- Шпалеры: позиции, «ряд» Европы ---------------- */
    function computeItems() {
      var L = st.lens;
      var zk = HA.clamp((st.z - 1) / 0.6, 0, 1);
      var Hmax = L.R * HA.lerp(0.3, 0.24, zk);
      if (Math.abs(Hmax - lastHmax) > 0.6) { lastHmax = Hmax; emit("scale", { hmax: Hmax, max: D.max }); }
      var out = [];
      var eu = [];
      D.regions.forEach(function (r) {
        var p = proj3(r.lon, r.lat, 0);
        if (p.z <= 0.02) return;
        if (Math.hypot(p.x - L.cx, p.y - L.cy) > L.R - 3) return;
        var isEu = D.europeIds.indexOf(r.id) >= 0;
        // высота жерди строго пропорциональна объёму, без минимума
        var it = { r: r, px: p.x, py: p.y, x: p.x, y: p.y, z: p.z, h: Hmax * r.t / D.max, alpha: Math.min(1, p.z * 3), eu: isEu, cv: null };
        var cc = CENTER[r.iso];
        if (cc) {
          var q = proj3(cc[0], cc[1], 0), vx = q.x - p.x, vy = q.y - p.y, vl = Math.hypot(vx, vy);
          if (q.z > 0 && vl > 8) it.cv = [vx / vl, vy / vl];
        }
        if (isEu) eu.push(it);
        out.push(it);
      });
      // «ряд шпалер»: при малом зуме европейские регионы встают в ряд с шагом 7 px
      var k = st.clusterK;
      var cluster = null;
      if (k > 0.001 && eu.length >= 3) {
        eu.sort(function (a, b) { return a.r.lon - b.r.lon; });
        var mx = eu.reduce(function (s, it) { return s + it.px; }, 0) / eu.length;
        var my = Math.max.apply(null, eu.map(function (it) { return it.py; })) + 9;
        var step = 7;
        var topMin = Infinity;
        var tallest = null;
        eu.forEach(function (it, i) {
          var rx = mx + (i - (eu.length - 1) / 2) * step;
          it.x = HA.lerp(it.px, rx, k); it.y = HA.lerp(it.py, my, k);
          it.clustered = k > 0.5;
          it.rowLead = true;
          topMin = Math.min(topMin, it.y - Math.max(it.h, 8));
          if (!tallest || it.r.t > tallest.r.t) tallest = it;
        });
        // самая высокая шпалера «ряда» (Халлертау) подписана по имени и в мировом виде
        if (tallest && tallest.clustered) tallest.clusterTop = true;
        cluster = { k: k, x: mx, y: my, top: topMin, n: D.europe.length, sum: D.europeSum, ids: eu.map(function (it) { return it.r.id; }) };
      }
      // слой «Торговые потоки» (режим карты): шпалеры бледнее, главное — маршруты
      var quiet = st.layer === "trade";
      out.forEach(function (it) {
        var id = it.r.id;
        it.selected = st.selected === id;
        it.hot = !it.selected && (st.hover === id || st.focus === id || st.also === id);
        it.dim = (!!st.selected || quiet) && !it.selected && !it.hot;
        it.state = it.selected ? "selected" : it.hot ? "hot" : it.dim ? "dim" : "normal";
      });
      out.sort(function (a, b) { return a.y - b.y; });
      return { list: out, cluster: cluster };
    }

    /* ---------------- Кадр ---------------- */
    function frame(now) {
      if (!ocean || !shade || !W || !H) return; // холсты ещё не размечены (или память отдана — окно карты закрыто)
      var t0 = performance.now();
      rf = d3.geoRotation(st.rot);
      if (st.dirty) renderBase(now);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(base, 0, 0);
      if (st.fade) {
        var u = (now - st.fade.t0) / st.fade.dur;
        if (u >= 1) st.fade = null;
        else { ctx.globalAlpha = 1 - u; ctx.drawImage(prev, 0, 0); ctx.globalAlpha = 1; }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var L = st.lens;
      // пунктир экспорта — только в виде «США и Атлантика»; бежит первые 6 с, потом стоит
      var FP = { proj3: proj3, now: now, reduced: HA.reduced() || st.paused || now > st.dashUntil, z: st.z, lens: L, emph: st.emph };
      var flowLabels = st.showFlows ? G.flows.draw(ctx, FLOWS, FP, "lines") : [];
      var res = computeItems();
      items = res.list;
      // линии от фактических точек к «ряду»
      if (res.cluster) {
        ctx.save();
        ctx.beginPath(); ctx.arc(L.cx, L.cy, L.R, 0, Math.PI * 2); ctx.clip();
        items.forEach(function (it) {
          if (!it.rowLead) return;
          ctx.globalAlpha = it.alpha * Math.min(1, res.cluster.k * 1.5);
          ctx.beginPath(); ctx.moveTo(it.px, it.py); ctx.lineTo(it.x, it.y);
          ctx.lineWidth = 0.7; ctx.strokeStyle = C.inkA(0.55); ctx.stroke();
        });
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      ctx.save();
      // в мировом виде высокие шпалеры у края могут заходить на кольцо: надписи на нём
      // стоят правее (см. ring.js), так что знак не перекрывает текст
      ctx.beginPath(); ctx.arc(L.cx, L.cy, L.R + (st.z > 1.05 ? 0 : 18), 0, Math.PI * 2); ctx.clip();
      items.forEach(function (it) {
        it.box = G.trellis.draw(ctx, { x: it.x, y: it.y, h: it.h, t: it.r.t, alpha: it.alpha, state: it.state, seed: it.r.i * 7 + 3, noMarker: true });
        it.top = it.y - it.h;
      });
      // знаки мест — поверх всех шпалер, чтобы соседи не прятались под пологом крупной шпалеры
      var rowMode = res.cluster && st.clusterK > 0.5;
      items.forEach(function (it) {
        ctx.globalAlpha = it.alpha * (it.dim ? 0.6 : 1);
        if (rowMode && it.rowLead) {
          // у «ряда» знак — в настоящей точке региона
          ctx.beginPath(); ctx.arc(it.px, it.py, 2.6, 0, Math.PI * 2); ctx.fillStyle = C.paperA(0.85); ctx.fill();
          ctx.beginPath(); ctx.arc(it.px, it.py, 1.7, 0, Math.PI * 2); ctx.fillStyle = it.selected ? C.ochreInk : C.ink; ctx.fill();
        } else G.trellis.marker(ctx, it.x, it.y, it.selected);
      });
      ctx.globalAlpha = 1;
      ctx.restore();
      if (st.showFlows) G.flows.draw(ctx, FLOWS, FP, "marks");
      var cardBox = st.card && (st.cardMode === "side" || st.cardMode === "below") ? st.card : null;
      hits = G.labels.place(ctx, { items: items, flowLabels: flowLabels, cluster: res.cluster, lens: L, card: cardBox, small: small, z: st.z, W: W, H: H, where: whereFn(), quiet: st.layer === "trade" });
      var ms = performance.now() - t0;
      perf.frames++;
      perf.ms.push(ms); if (perf.ms.length > 240) perf.ms.shift();
      updateVisible(now);
    }

    /* что под точкой экрана: 0 — своя страна региона, 1 — море, 2 — другая страна.
       Нужна подписям: название региона не ставится поверх чужой страны (контур 1:110 млн). */
    function whereFn() {
      var memo = {}, W110 = G.world.W110;
      var pr = d3.geoOrthographic().clipAngle(90).scale(st.lens.R * st.z).translate([st.lens.cx, st.lens.cy]).rotate(st.rot);
      return function (x, y, iso) {
        var key = iso + ":" + Math.round(x / 4) + "," + Math.round(y / 4);
        if (memo[key] != null) return memo[key];
        var ll = Math.hypot(x - st.lens.cx, y - st.lens.cy) < st.lens.R * st.z ? pr.invert([x, y]) : null;
        var v = 1;
        if (ll && isFinite(ll[0])) {
          var own = W110.byId[iso];
          if (own && d3.geoContains(own, ll)) v = 0;
          else if (d3.geoContains(W110.land, ll)) v = 2;
        }
        return (memo[key] = v);
      };
    }

    /* какие регионы сейчас на видимой стороне — для бледных строк списка;
       не чаще раза в 280 мс, но последнее состояние досылается всегда */
    var lastVisCheck = 0, visTimer = 0;
    function updateVisible(now, force) {
      if (!force && now - lastVisCheck < 280) {
        if (!visTimer) visTimer = setTimeout(function () { visTimer = 0; updateVisible(performance.now(), true); }, 300);
        return;
      }
      lastVisCheck = now;
      var ids = items.map(function (it) { return it.r.id; }).sort().join(",");
      if (ids !== visibleSet) { visibleSet = ids; emit("visible", ids ? ids.split(",") : []); }
    }

    /* ---------------- Цикл анимации ---------------- */
    var raf = 0, last = 0, lastDraw = 0;
    function kick() {
      if (raf || !st.visible || !st.docVisible) return;
      raf = requestAnimationFrame(tick);
    }
    /* постоянный автоповорот выключен: подписи не уплывают, пока их читают.
       Глобус «оживает» коротким поворотом при открытии (≤ 3,5 с, см. ниже)
       и движется только по действию человека. Включается опцией auto: true. */
    function autoActive(now) {
      return opt.auto === true && !HA.reduced() && !st.paused && !st.lazy && !st.focused && st.view === "world" && !st.selected && !st.pointerInside && !st.drag && !st.flight &&
        now > st.autoAt && Math.abs(st.z - 1) < 0.02 && !st.card;
    }
    function tick(now) {
      raf = 0;
      perf.ticks++;
      var dt = Math.min(64, last ? now - last : 16); last = now;
      var moving = false, autoOnly = false;
      if (st.flight) {
        var f = G.camera.stepFlight(st.flight, now);
        st.rot = [-f.center[0], -f.center[1], 0]; st.z = f.z;
        moving = true; st.dirty = true;
        if (f.done) { var fl = st.flight; st.flight = null; st.z = fl.z1; if (fl.done) fl.done(); emitZoom(); }
      } else if (st.zt != null && !st.pinch) {
        // плавный зум: приближение догоняет цель (в логарифмах — равномерно на любом масштабе),
        // а точка Земли под курсором остаётся под курсором
        var lz = Math.log(st.z), lt = Math.log(st.zt);
        st.z = Math.abs(lt - lz) < 0.004 ? st.zt : Math.exp(lz + (lt - lz) * (1 - Math.exp(-dt / 85)));
        if (st.za) anchorGeo(st.za.g, st.za.x, st.za.y);
        if (st.z === st.zt) { st.zt = null; st.za = null; emitZoom(); }
        moving = true; st.dirty = true;
      } else if (st.pinch) {
        moving = true;
      } else if (!st.drag) {
        var v = st.vel;
        if (Math.abs(v[0]) + Math.abs(v[1]) > 0.0004) {
          st.rot[0] += v[0] * dt; st.rot[1] = clampLat(st.rot[1] + v[1] * dt);
          var dec = Math.pow(0.92, dt / 16.7); v[0] *= dec; v[1] *= dec;
          moving = true; st.dirty = true;
        } else if (st.vel[0] || st.vel[1]) {
          st.vel = [0, 0];
        } else if (autoActive(now)) {
          st.rot[0] += dt * 0.003; // 3°/с на восток
          st.rot[1] += (-VIEWS.world.center[1] - st.rot[1]) * Math.min(1, dt * 0.0015);
          moving = true; st.dirty = true; autoOnly = true;
        }
      } else moving = !!st.drag.moved;
      // линза (отъезд от карточки)
      if (st.lensAnim) {
        var a = st.lensAnim, u = Math.min(1, (now - a.t0) / a.dur), e = HA.easeOut(u);
        st.lens = { cx: HA.lerp(a.from.cx, a.to.cx, e), cy: HA.lerp(a.from.cy, a.to.cy, e), R: HA.lerp(a.from.R, a.to.R, e) };
        placeRing();
        st.dirty = true; moving = true; autoOnly = false;
        if (u >= 1) st.lensAnim = null;
      }
      // «ряд шпалер» Европы: собирается при зуме < 1.6, раскладывается в приближении
      var kT = st.z < 1.6 ? 1 : 0;
      if (st.clusterK !== kT) {
        autoOnly = false;
        if (HA.reduced()) st.clusterK = kT;
        else st.clusterK = kT > st.clusterK ? Math.min(kT, st.clusterK + dt / 400) : Math.max(kT, st.clusterK - dt / 400);
      }
      if (moving) st.stillSince = now;
      var wasMoving = st.moving;
      st.moving = moving || now - st.stillSince < 200;
      if (wasMoving && !st.moving) { st.dirty = true; updateVisible(now, true); } // остановились — перерисовать подробно
      rf = d3.geoRotation(st.rot); // актуальный поворот — до любых проверок видимости
      var anim = st.moving || st.clusterK !== kT || !!st.fade || !!st.lensAnim;
      var dashes = !HA.reduced() && !st.paused && st.showFlows && now < st.dashUntil && flowsOnScreen();
      // автоповорот и бегущий пунктир — не чаще 30 кадров/с (на слабом компьютере — 15);
      // перетаскивание и облёт — каждый кадр
      var due = now - lastDraw >= (st.quality === "low" ? 66 : 31);
      var draw = autoOnly ? due : (anim || st.dirty || !dashes || due);
      if (draw) { frame(now); lastDraw = now; }
      // кадр мог запустить плавную смену подробности карты — её надо доиграть
      if (anim || dashes || st.dirty || st.fade) kick();
    }
    function flowsOnScreen() {
      // хотя бы одна точка какого-то маршрута на видимой стороне
      for (var i = 0; i < FLOWS.length; i++) {
        var f = FLOWS[i];
        if (f.short && st.z < 1.8) continue;
        for (var u = 0.1; u < 1; u += 0.2) {
          var ll = f.interp(u), p = proj3(ll[0], ll[1], f.alt * Math.sin(Math.PI * u));
          if (p.vis && Math.hypot(p.x - st.lens.cx, p.y - st.lens.cy) < st.lens.R) return true;
        }
      }
      return false;
    }
    function clampLat(p) { return HA.clamp(p, -80, 80); }
    /* любое действие человека откладывает автоповорот на 6 с */
    function touched() { var t = performance.now(); st.lastInteract = t; st.autoAt = Math.max(st.autoAt, t + 6000); }
    function redraw() { st.dirty = true; kick(); }

    /* ---------------- Облёт ---------------- */
    function flyTo(center, z, o) {
      o = o || {};
      st.vel = [0, 0];
      st.zt = null; st.za = null; st.pinch = null;
      var c0 = [-st.rot[0], -st.rot[1]];
      if (HA.reduced() || o.instant) {
        st.flight = null; st.rot = [-center[0], -center[1], 0]; st.z = z; st.dirty = true;
        st.clusterK = z < 1.6 ? 1 : 0;
        if (o.done) o.done();
        emitZoom();
        kick(); return;
      }
      st.flight = G.camera.createFlight(c0, st.z, center, z, o);
      kick();
    }
    /* пунктир экспорта: на странице — только в виде «США и Атлантика»,
       в режиме карты — при слое «Торговые потоки» */
    function flowsWanted(view) { return st.layer === "trade" || (!MAP && view === "usa"); }
    function setFlows(on) {
      if (st.showFlows === on) return;
      st.showFlows = on;
      if (on) st.dashUntil = performance.now() + 6000;
      emit("flows", on);
    }
    function setView(name, o) {
      o = o || {};
      var V = VIEWS[name];
      if (!V) return;
      st.view = name; st.viewSource = o.source || "button";
      st.focus = V.focus || null; st.also = V.also || null;
      setFlows(flowsWanted(name));
      if (st.selected && o.keepSelection !== true) select(null, { silent: true });
      st.lastInteract = performance.now();
      st.autoAt = performance.now() + (name === "world" ? 2500 : 6000);
      flyTo(V.center, zoomFor(V.z), o);
      emit("view", { name: name, source: st.viewSource });
      redraw();
    }
    function select(id, o) {
      o = o || {};
      var prevSel = st.selected;
      st.selected = id;
      if (id) {
        touched();
        var r = D.byId[id];
        if (o.fly !== false) {
          // европейские регионы — в том же приближении, что вид «Европа»
          var zt = Math.max(st.z, zoomFor(D.europeIds.indexOf(id) >= 0 ? VIEWS.europe.z : 2.4));
          flyTo([r.lon, r.lat], Math.min(zt, zmax()), { fast: o.fast });
        }
        if (o.source !== "view") { st.view = null; emit("view", { name: null, source: "select" }); }
      }
      if (prevSel !== id && !o.silent) emit("select", { id: id, source: o.source || "globe", focusCard: !!o.focusCard });
      else if (prevSel !== id && o.silent) emit("select", { id: id, source: "silent" });
      redraw();
    }

    /* ---------------- Зум к точке ----------------
       Приближение меняется плавно (цель st.zt, см. tick), а поворот после
       каждого шага подбирается так, чтобы точка Земли под курсором осталась
       под курсором (метод Ньютона по долготе и широте поворота: север
       остаётся вверху, как и при перетаскивании). */
    function zmin() { return 1; }
    function overGlobe(x, y) { return Math.hypot(x - st.lens.cx, y - st.lens.cy) <= st.lens.R + ringPad; }
    function geoAt(x, y) {
      var L = st.lens;
      if (Math.hypot(x - L.cx, y - L.cy) > L.R * Math.min(1, st.z) - 0.5) return null;
      inv.scale(L.R * st.z).translate([L.cx, L.cy]).rotate(st.rot);
      var g = inv.invert([x, y]);
      return g && isFinite(g[0]) && isFinite(g[1]) ? g : null;
    }
    function anchorGeo(g, sx, sy) {
      for (var it = 0; it < 8; it++) {
        rf = d3.geoRotation(st.rot);
        var p = proj3(g[0], g[1], 0);
        if (p.z < 0.02) break;
        var ex = sx - p.x, ey = sy - p.y;
        if (ex * ex + ey * ey < 0.01) break;
        var h = 0.02;
        st.rot[0] += h; rf = d3.geoRotation(st.rot); var pa = proj3(g[0], g[1], 0); st.rot[0] -= h;
        st.rot[1] += h; rf = d3.geoRotation(st.rot); var pb = proj3(g[0], g[1], 0); st.rot[1] -= h;
        var a = (pa.x - p.x) / h, b = (pb.x - p.x) / h, c = (pa.y - p.y) / h, d = (pb.y - p.y) / h;
        var det = a * d - b * c;
        if (Math.abs(det) < 1e-9) break;
        var d0 = (d * ex - b * ey) / det, d1 = (a * ey - c * ex) / det;
        var m = Math.max(Math.abs(d0), Math.abs(d1));
        if (m > 25) { d0 *= 25 / m; d1 *= 25 / m; }
        st.rot[0] += d0; st.rot[1] = clampLat(st.rot[1] + d1);
      }
      rf = d3.geoRotation(st.rot);
    }
    function zoomState() {
      var z = st.zt != null ? st.zt : st.z, mx = zmax();
      return { z: z, min: zmin(), max: mx, atMin: z <= zmin() + 0.001, atMax: z >= mx - 0.001 };
    }
    var lastZoomKey = "";
    function emitZoom() {
      var s = zoomState(), key = (s.atMin ? 1 : 0) + "" + (s.atMax ? 1 : 0) + Math.round(s.z * 100);
      if (key === lastZoomKey) return;
      lastZoomKey = key;
      emit("zoom", s);
    }
    /* приближение изменилось по воле человека — выбранный «вид» больше не совпадает */
    function viewLost(source) {
      // как и при перетаскивании: кнопка вида гаснет, а пунктир и выделение остаются
      if (st.view) { st.view = null; emit("view", { name: null, source: source || "zoom" }); }
      if (!st.interacted) { st.interacted = true; emit("interact"); }
    }
    /* f — во сколько раз; (sx, sy) — точка холста, которая должна остаться на месте
       (нет точки или она вне линзы — зум к центру); o.instant — без плавности */
    function zoomAt(f, sx, sy, o) {
      o = o || {};
      var from = st.zt != null ? st.zt : st.z;
      var to = HA.clamp(from * f, zmin(), zmax());
      if (Math.abs(to - from) < 1e-4) { emitZoom(); return false; }
      st.flight = null; st.vel = [0, 0];
      var L = st.lens;
      if (sx == null || Math.hypot(sx - L.cx, sy - L.cy) > L.R - 1) { sx = L.cx; sy = L.cy; }
      var g = geoAt(sx, sy);
      if (!g) { sx = L.cx; sy = L.cy; g = [-st.rot[0], -st.rot[1]]; }
      st.za = { x: sx, y: sy, g: g };
      st.zt = to;
      if (o.instant || HA.reduced()) {
        st.z = to; anchorGeo(g, sx, sy);
        st.zt = null; st.za = null;
      }
      viewLost("zoom");
      touched();
      emitZoom();
      st.dirty = true; kick();
      return true;
    }

    /* ---------------- Указатель ---------------- */
    function local(e) {
      var b = canvas.getBoundingClientRect();
      return [(e.clientX - b.left) * (W / b.width), (e.clientY - b.top) * (H / b.height)];
    }
    function pick(x, y, touch) {
      // 1) подписи и метки ранга — точные прямоугольники
      for (var i = hits.length - 1; i >= 0; i--) {
        var h = hits[i];
        if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) {
          if (h.kind === "region") return { kind: "region", id: h.id };
          if (h.kind === "cluster") return { kind: "cluster" };
        }
      }
      // 2) жердь: точка на стволе (±5 px от основания до верхушки); из нескольких — самая высокая
      var stem = null;
      items.forEach(function (it) {
        if (it.clustered) return;
        var top = it.y - Math.max(it.h, 6) - 6;
        if (Math.abs(x - it.x) <= (touch ? 9 : 5) && y >= top && y <= it.y + 5) {
          if (!stem || it.h > stem.h) stem = it;
        }
      });
      if (stem) return { kind: "region", id: stem.r.id };
      // 3) ближайшая шпалера в пределах допуска (на тач-экране — 44 px мишень)
      var tol = touch ? 22 : 12, best = null, bd = 1e9;
      items.forEach(function (it) {
        if (it.clustered) return;
        var top = it.box ? it.box.y0 : it.y - it.h;
        var dx = Math.abs(x - it.x), d;
        if (y >= top - 4 && y <= it.y + 6) d = Math.max(0, dx - (it.box ? Math.max(4, (it.box.x1 - it.box.x0) / 2 - 2) : 4));
        else d = Math.min(Math.hypot(x - it.x, y - it.y), Math.hypot(x - it.x, y - top));
        if (d < tol && d < bd) { bd = d; best = it.r.id; }
      });
      if (best) return { kind: "region", id: best };
      // клик по «ряду» Европы
      var row = items.filter(function (it) { return it.clustered; });
      if (row.length) {
        var x0 = Math.min.apply(null, row.map(function (it) { return it.x; })) - 10, x1 = Math.max.apply(null, row.map(function (it) { return it.x; })) + 10;
        var y0 = Math.min.apply(null, row.map(function (it) { return it.y - Math.max(it.h, 8); })) - 14, y1 = row[0].y + 8;
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return { kind: "cluster" };
      }
      return null;
    }
    /* касания: два пальца — щипок (приближение к точке между пальцами и сдвиг) */
    var touches = {};
    function touchList() { return Object.keys(touches).map(function (k) { return touches[k]; }); }
    function pinchMid(a, b) { return local({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }); }
    function startPinch() {
      var T = touchList(), a = T[0], b = T[1];
      st.drag = null; st.vel = [0, 0]; st.flight = null; st.zt = null; st.za = null;
      canvas.classList.remove("is-dragging");
      var m = pinchMid(a, b);
      var g = geoAt(m[0], m[1]);
      if (!g) { m = [st.lens.cx, st.lens.cy]; g = [-st.rot[0], -st.rot[1]]; }
      st.pinch = { d0: Math.max(12, Math.hypot(a.x - b.x, a.y - b.y)), z0: st.z, g: g };
      emit("engage", { kind: "pinch" });
      kick();
    }
    var lastTap = null, lastPtrType = "mouse";
    canvas.addEventListener("pointerdown", function (e) {
      lastPtrType = e.pointerType || "mouse";
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (e.pointerType === "touch") {
        touches[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (touchList().length === 2) { startPinch(); return; }
        if (st.pinch) return;
      }
      var p = local(e);
      st.drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, id: e.pointerId, touch: e.pointerType !== "mouse", lx: p[0], ly: p[1] };
      touched();
      kick();
    });
    canvas.addEventListener("pointermove", function (e) {
      if (touches[e.pointerId]) touches[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (st.pinch) {
        var T = touchList();
        if (T.length < 2) return;
        var dd = Math.hypot(T[0].x - T[1].x, T[0].y - T[1].y), m = pinchMid(T[0], T[1]);
        st.z = HA.clamp(st.pinch.z0 * dd / st.pinch.d0, zmin(), zmax());
        anchorGeo(st.pinch.g, m[0], m[1]);
        viewLost("pinch");
        touched();
        st.dirty = true; kick();
        return;
      }
      var d = st.drag;
      if (d && d.id === e.pointerId) {
        var dx = e.clientX - d.x, dy = e.clientY - d.y, t = performance.now();
        if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) {
          d.moved = true;
          st.flight = null; st.vel = [0, 0]; st.zt = null; st.za = null;
          try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* без захвата */ }
          canvas.classList.add("is-dragging");
          if (st.view) { st.view = null; emit("view", { name: null, source: "drag" }); }
          emit("engage", { kind: "drag" });
        }
        if (!d.moved) return;
        var k = 180 / (Math.PI * st.lens.R * st.z);
        st.rot[0] += dx * k;
        // на странице палец меняет только долготу (вверх-вниз листается страница);
        // в режиме карты прокручивать нечего — палец вращает глобус во все стороны
        var lat = !d.touch || MAP;
        if (lat) st.rot[1] = clampLat(st.rot[1] - dy * k);
        var dtm = Math.max(8, t - d.t);
        st.vel = [st.vel[0] * 0.4 + (dx * k / dtm) * 0.6, lat ? st.vel[1] * 0.4 + (-dy * k / dtm) * 0.6 : 0];
        d.x = e.clientX; d.y = e.clientY; d.t = t;
        touched();
        st.dirty = true;
        if (!st.interacted) { st.interacted = true; emit("interact"); }
        kick();
      } else if (e.pointerType === "mouse") {
        var p = local(e), hit = pick(p[0], p[1], false);
        var id = hit && hit.kind === "region" ? hit.id : null;
        canvas.classList.toggle("is-pointing", !!hit);
        canvas.classList.toggle("is-free", !hit && overGlobe(p[0], p[1]));
        if (id !== st.hover) { st.hover = id; emit("hover", { id: id, source: "globe" }); kick(); }
      }
    });
    function dropTouch(e) {
      if (!touches[e.pointerId]) return;
      delete touches[e.pointerId];
      if (st.pinch && touchList().length < 2) {
        // щипок закончен; оставшийся палец ничего не нажимает и не тянет
        st.pinch = null; st.drag = null;
        emitZoom(); st.dirty = true; kick();
      }
    }
    function endDrag(e) {
      dropTouch(e);
      var d = st.drag;
      if (!d || d.id !== e.pointerId) return;
      st.drag = null;
      canvas.classList.remove("is-dragging");
      if (!d.moved && e.type === "pointerup") {
        st.vel = [0, 0];
        var p = local(e), hit = pick(p[0], p[1], d.touch), now = performance.now();
        // двойное касание пальцем (в режиме карты — приблизить к этому месту)
        var dbl = d.touch && lastTap && now - lastTap.t < 320 && Math.hypot(p[0] - lastTap.x, p[1] - lastTap.y) < 30;
        lastTap = d.touch && !dbl ? { t: now, x: p[0], y: p[1] } : null;
        if (dbl && MAP) emit("dbl", { x: p[0], y: p[1], id: null, onGlobe: overGlobe(p[0], p[1]) });
        else if (hit && hit.kind === "region") { select(hit.id, { source: "globe" }); if (!st.interacted) { st.interacted = true; emit("interact"); } }
        else if (hit && hit.kind === "cluster") setView("europe", { source: "cluster" });
        else if (st.selected) select(null, { source: "globe" });
        // нажатие на свободное место глобуса: на странице открывает режим карты (см. stage.js)
        else emit("tap", { x: p[0], y: p[1], onGlobe: overGlobe(p[0], p[1]), touch: d.touch });
      } else if (performance.now() - d.t > 90) st.vel = [0, 0];
      if (HA.reduced()) st.vel = [0, 0];
      touched();
      st.dirty = true; kick();
    }
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", function (e) {
      dropTouch(e);
      if (st.drag && st.drag.id === e.pointerId) { st.drag = null; st.vel = [0, 0]; canvas.classList.remove("is-dragging"); kick(); }
    });
    /* двойной щелчок мышью: на странице — открыть карту, в режиме карты — приблизить */
    canvas.addEventListener("dblclick", function (e) {
      if (lastPtrType !== "mouse") return; // двойное касание пальцем обрабатывается выше
      var p = local(e), hit = pick(p[0], p[1], false);
      emit("dbl", { x: p[0], y: p[1], id: hit && hit.kind === "region" ? hit.id : null, onGlobe: overGlobe(p[0], p[1]) });
    });

    /* колёсико и щипок на тачпаде (wheel с ctrlKey). Можно ли зумить, решает opt.wheel(e):
       нет — событие не трогаем, страница прокручивается, глобус сообщает «wheel-pass» (подсказка) */
    canvas.addEventListener("wheel", function (e) {
      var p = local(e);
      if (!overGlobe(p[0], p[1])) return;   // углы рамки — обычная прокрутка страницы
      if (opt.wheel && !opt.wheel(e)) { emit("wheel-pass", { x: p[0], y: p[1] }); return; }
      e.preventDefault();
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      if (!dy) return;
      // щипок на тачпаде приходит как wheel с ctrlKey и маленьким шагом — он точнее колёсика
      var rate = e.ctrlKey && Math.abs(dy) < 40 ? 0.012 : 0.0025;
      var f = HA.clamp(Math.pow(2, -dy * rate), 0.5, 2);
      zoomAt(f, p[0], p[1]);
    }, { passive: false });
    canvas.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { st.pointerInside = true; } });
    canvas.addEventListener("pointerleave", function (e) {
      st.pointerInside = false;
      if (e.pointerType === "mouse" && st.hover && !st.drag) { st.hover = null; canvas.classList.remove("is-pointing"); emit("hover", { id: null, source: "globe" }); }
      touched();
      kick();
    });

    /* пока глобус в фокусе клавиатуры, сам он не вращается */
    canvas.addEventListener("focus", function () { st.focused = true; });
    canvas.addEventListener("blur", function () { st.focused = false; st.autoAt = Math.max(st.autoAt, performance.now() + 3000); kick(); });

    /* ---------------- Клавиатура ---------------- */
    function centerRegion() {
      var best = null, bd = 1e9;
      items.forEach(function (it) { var d = Math.hypot(it.px - st.lens.cx, it.py - st.lens.cy); if (d < bd) { bd = d; best = it.r; } });
      return best;
    }
    var sayT = 0;
    function sayCenter() {
      clearTimeout(sayT);
      sayT = setTimeout(function () {
        var r = centerRegion();
        HA.announce(r ? "Ближе всего к центру: " + r.name + ", " + r.country + ", " + HA.fmt(r.t) + " тонн в год. Enter — открыть карточку." : "Регионов атласа на этой стороне глобуса нет.");
      }, 450);
    }
    function stepRank(d) {
      var cur = st.selected ? D.byId[st.selected].rank : (d > 0 ? 0 : D.count + 1);
      var next = D.ranked[HA.clamp(cur + d, 1, D.count) - 1];
      if (next && next.id !== st.selected) select(next.id, { source: "key", focusCard: false });
    }
    canvas.addEventListener("keydown", function (e) {
      var stp = 10 / Math.sqrt(st.z);
      var m = { ArrowLeft: [stp, 0], ArrowRight: [-stp, 0], ArrowUp: [0, -stp], ArrowDown: [0, stp] }[e.key];
      var k = (e.key || "").toLowerCase();
      if (m) {
        st.flight = null; st.vel = [0, 0]; st.za = null;
        st.rot[0] += m[0]; st.rot[1] = clampLat(st.rot[1] + m[1]);
        if (st.view) { st.view = null; emit("view", { name: null, source: "key" }); }
        sayCenter();
      } else if (e.key === "+" || e.key === "=") { zoomAt(1.4); emit("engage", { kind: "key" }); sayCenter(); }
      else if (e.key === "-" || e.key === "_") { zoomAt(1 / 1.4); emit("engage", { kind: "key" }); sayCenter(); }
      else if (e.key === "PageDown" || k === "n" || k === "т") stepRank(1);
      else if (e.key === "PageUp" || k === "p" || k === "з") stepRank(-1);
      else if (e.key === "Enter" || e.key === " ") {
        var r = centerRegion();
        if (r) select(r.id, { source: "key", focusCard: true });
      } else if (e.key === "Escape") {
        if (MAP) return; // в режиме карты Esc закрывает карту (событие уходит окну карты)
        if (st.selected) select(null, { source: "key" });
        else if (st.view !== "world") setView("world", { source: "key" });
      } else return;
      e.preventDefault();
      touched();
      if (!st.interacted) { st.interacted = true; emit("interact"); }
      redraw();
    });

    /* ---------------- Видимость, размер ---------------- */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        st.visible = en[0].isIntersecting;
        if (st.visible) { last = 0; kick(); }
      }).observe(box);
    }
    document.addEventListener("visibilitychange", function () {
      st.docVisible = !document.hidden;
      if (st.docVisible) { last = 0; kick(); }
    });
    var roT = 0;
    if ("ResizeObserver" in window) {
      new ResizeObserver(function () {
        clearTimeout(roT);
        roT = setTimeout(function () { if (layout()) { st.dirty = true; kick(); } }, 60);
      }).observe(box);
    } else window.addEventListener("resize", function () { if (layout()) redraw(); });

    G.world.load50(function () { st.dirty = true; kick(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { G.labels.resetCache(); redraw(); });
    HA.onReducedChange(function () { st.vel = [0, 0]; redraw(); });

    layout();
    /* вступление: глобус один раз доворачивается до вида «Весь мир» (3,4 с, плавное торможение)
       и останавливается — движение короче 5 с, кнопка «стоп» не нужна */
    if (opt.intro !== false && !HA.reduced()) {
      var wc = VIEWS.world.center, from = [wc[0] + 38, wc[1]];
      st.rot = [-from[0], -from[1], 0];
      st.flight = G.camera.createFlight(from, 1, wc, 1, { dur: 3400, ease: "out" });
    }
    kick();

    /* ---------------- Публичный интерфейс ---------------- */
    var api = {
      on: function (n, fn) { (listeners[n] = listeners[n] || []).push(fn); return api; },
      setView: setView,
      select: select,
      clear: function () { select(null, { source: "api" }); },
      setHover: function (id) { if (st.hover !== id) { st.hover = id; kick(); } },
      setFocus: function (id) { st.focus = id; kick(); },
      emphFlow: function (k) { st.emph = k; kick(); },
      /* rect — прямоугольник карточки в координатах окна; mode: side | below | null */
      setCard: function (rect, mode, instant) {
        if (!rect || !mode) { st.card = null; st.cardMode = null; }
        else {
          var b = canvas.getBoundingClientRect();
          // глобус или карточка скрыты (печать, свёрнутая колонка) — геометрию не трогаем
          if (!b.width || !b.height || !rect.width || !rect.height || !W || !H) return;
          var kx = W / b.width, ky = H / b.height;
          st.card = { x0: (rect.left - b.left) * kx, y0: (rect.top - b.top) * ky, x1: (rect.right - b.left) * kx, y1: (rect.bottom - b.top) * ky };
          st.cardMode = mode;
        }
        animateLens(instant);
        redraw();
      },
      /* кнопка «Остановить вращение»: стоп автоповороту и бегущему пунктиру */
      setPaused: function (p) { st.paused = !!p; if (!p) { st.lazy = false; st.autoAt = performance.now() + 800; } redraw(); },
      /* плавный зум: f — во сколько раз; at — точка окна {clientX, clientY}, которая остаётся на месте */
      zoomBy: function (f, at, o) {
        var p = at ? local(at) : null;
        return zoomAt(f, p ? p[0] : null, p ? p[1] : null, o);
      },
      zoomState: zoomState,
      rotateBy: function (dl, dp) { st.flight = null; st.rot[0] += dl; st.rot[1] = clampLat(st.rot[1] + dp); redraw(); },
      resize: function () { if (layout()) redraw(); },
      /* точка окна над глобусом (вместе с кольцом)? */
      isOver: function (clientX, clientY) { var p = local({ clientX: clientX, clientY: clientY }); return overGlobe(p[0], p[1]); },
      /* камера: поворот, приближение, вид — чтобы режим карты открывался с того же места */
      getCamera: function () { return { rot: st.rot.slice(0, 2), z: st.zt != null ? st.zt : st.z, view: st.view, selected: st.selected }; },
      setCamera: function (c) {
        if (!c) return;
        st.flight = null; st.zt = null; st.za = null; st.vel = [0, 0]; st.pinch = null;
        if (c.rot) st.rot = [c.rot[0], clampLat(c.rot[1]), 0];
        if (c.z) st.z = HA.clamp(c.z, zmin(), zmax());
        st.clusterK = st.z < 1.6 ? 1 : 0;
        if ("view" in c) {
          var V = c.view && VIEWS[c.view];
          st.view = V ? c.view : null;
          st.focus = V ? V.focus || null : null; st.also = V ? V.also || null : null;
          setFlows(flowsWanted(st.view));
          emit("view", { name: st.view, source: "camera" });
        }
        emitZoom();
        redraw();
      },
      /* слой режима карты: production — шпалеры и подписи; trade — маршруты экспорта */
      setLayer: function (name) {
        name = name === "trade" ? "trade" : "production";
        if (st.layer === name) return;
        st.layer = name;
        setFlows(flowsWanted(st.view));
        if (name === "trade") st.dashUntil = performance.now() + 6000;
        emit("layer", name);
        redraw();
      },
      get layer() { return st.layer; },
      /* окно карты закрыто — отдаём память холстов (при следующем открытии всё строится заново) */
      release: function () {
        [canvas, base, prev, scratch].forEach(function (c) { c.width = 1; c.height = 1; });
        W = 0; H = 0; ocean = null; shade = null; st.dirty = true; st.fade = null;
      },
      get state() { return st; },
      get perf() { return perf; },
      get view() { return st.view; },
      get selected() { return st.selected; },
      visibleIds: function () { return visibleSet ? visibleSet.split(",") : []; },
      /* снимок для печати: вид «Весь мир», без выбора */
      snapshot: function () {
        if (!W || !H) return "";
        var keep = { rot: st.rot.slice(), z: st.z, sel: st.selected, lens: st.lens, card: st.card, mode: st.cardMode, k: st.clusterK, moving: st.moving, focus: st.focus, hover: st.hover, flows: st.showFlows };
        st.rot = [-VIEWS.world.center[0], -VIEWS.world.center[1], 0]; st.z = 1; st.selected = null; st.focus = null; st.hover = null;
        st.card = null; st.cardMode = null; st.lens = { cx: W / 2, cy: H / 2, R: R0 }; st.clusterK = 1; st.moving = false; st.showFlows = false; st.dirty = true;
        frame(performance.now());
        var url = "";
        try { url = canvas.toDataURL("image/png"); } catch (err) { url = ""; }
        st.rot = keep.rot; st.z = keep.z; st.selected = keep.sel; st.lens = keep.lens; st.card = keep.card; st.cardMode = keep.mode;
        st.clusterK = keep.k; st.moving = keep.moving; st.focus = keep.focus; st.hover = keep.hover; st.showFlows = keep.flows; st.dirty = true;
        placeRing();
        kick();
        return url;
      }
    };
    return api;
  };
})();
