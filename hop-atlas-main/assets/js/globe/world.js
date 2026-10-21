/* =====================================================================
   Глобус · world.js — геометрия мира.
   110m (лёгкая) — всегда; 50m-lite (заранее упрощённая, ≈230 КБ)
   подгружается в простое и используется в покое при приближении.
   Страны раскрашены в три тона так, чтобы соседи различались;
   страны с регионами атласа — шалфейные.
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA;
  var G = (HA.globe = HA.globe || {});

  function prep(topo) {
    var obj = topo.objects.countries;
    var geoms = obj.geometries;
    var feats = topojson.feature(topo, obj).features;
    var neighbors = topojson.neighbors(geoms);
    var atlas = HA.D.atlasIso;
    var tone = new Array(feats.length);
    // жадная раскраска в 3 тона: соседние страны — разного тона
    var order = feats.map(function (f, i) { return i; }).sort(function (a, b) { return neighbors[b].length - neighbors[a].length; });
    order.forEach(function (i) {
      var id = feats[i].id == null ? "" : String(feats[i].id);
      if (atlas[id]) { tone[i] = 3; return; }
      var used = [0, 0, 0];
      neighbors[i].forEach(function (j) { if (tone[j] != null && tone[j] < 3) used[tone[j]]++; });
      var best = 0;
      for (var k = 0; k < 3; k++) if (used[k] === 0) { best = k; break; } else if (used[k] < used[best]) best = k;
      tone[i] = best;
    });
    var groups = [[], [], [], []];
    var byId = {};
    feats.forEach(function (f, i) {
      groups[tone[i]].push(f);
      if (f.id != null) byId[String(f.id)] = f;
    });
    return {
      groups: groups.map(function (g) { return { type: "FeatureCollection", features: g }; }),
      land: topojson.merge(topo, geoms),
      coast: topojson.mesh(topo, obj, function (a, b) { return a === b; }),
      borders: topojson.mesh(topo, obj, function (a, b) { return a !== b; }),
      byId: byId
    };
  }

  var world = {
    W110: prep(window.WORLD_110M),        // после разбора исходный TopoJSON больше не нужен (см. ниже)
    W50: null,
    loading: false,
    listeners: [],
    /* подгрузка подробной карты: обычный <script>, чтобы работало и с диска */
    load50: function (cb) {
      if (world.W50) { cb && cb(world.W50); return; }
      if (cb) world.listeners.push(cb);
      if (world.loading) return;
      world.loading = true;
      var go = function () {
        var s = document.createElement("script");
        s.src = "assets/vendor/world-50m-lite.js";
        s.async = true;
        s.onload = function () {
          try {
            world.W50 = prep(window.WORLD_50M_LITE);
            window.WORLD_50M_LITE = null;
          } catch (e) { world.W50 = null; }
          var ls = world.listeners.splice(0);
          ls.forEach(function (fn) { if (world.W50) fn(world.W50); });
        };
        s.onerror = function () { world.loading = false; };
        document.body.appendChild(s);
      };
      if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 2500 });
      else setTimeout(go, 900);
    },
    GRAT: d3.geoGraticule().step([15, 15])(),
    GRAT10: d3.geoGraticule().step([10, 10])(),
    EQUATOR: { type: "LineString", coordinates: d3.range(-180, 181, 3).map(function (x) { return [x, 0]; }) }
  };
  window.WORLD_110M = null;
  G.world = world;
})();
