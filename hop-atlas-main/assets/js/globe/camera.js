/* =====================================================================
   Глобус · camera.js — виды облёта и плавные перелёты.
   d3.geoInterpolate + easeCubicInOut, 900–2200 мс в зависимости от дуги;
   на дальнем перелёте зум на середине пути на ~15 % меньше («подъём»).
   Вид «Весь мир» поставлен так, что оба главных района хмеля — запад
   США и Центральная Европа — видны целиком, а между ними Атлантика.
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, G = HA.globe;

  var VIEWS = {
    world:  { center: [-52, 40], z: 1.0, name: "Весь мир", short: "Весь мир" },
    europe: { center: [11.6, 49.4], z: 4.4, name: "Европа", short: "Европа", focus: "hallertau" },
    usa:    { center: [-78, 48], z: 1.3, name: "США и Атлантика", short: "США", focus: "yakima" },
    russia: { center: [32, 52],  z: 1.6, name: "Россия", short: "Россия", focus: "chuvashia", also: "hallertau" }
  };
  var ORDER = ["world", "europe", "usa", "russia"];

  /* opts: fast — не дольше 900 мс; dur — своя длительность; ease: "out" — плавное торможение (вступление) */
  function createFlight(c0, z0, c1, z1, opts) {
    opts = opts || {};
    var ang = d3.geoDistance(c0, c1);
    var dur = HA.clamp(900 + 700 * ang + 280 * Math.abs(Math.log(z1 / z0)), 900, 2200);
    if (opts.fast) dur = Math.min(dur, 900);
    if (opts.dur) dur = opts.dur;
    var dip = ang > 0.35 && !opts.dur ? 0.15 * Math.min(1, ang / 1.2) : 0;
    return { t0: performance.now(), dur: dur, ip: d3.geoInterpolate(c0, c1), z0: z0, z1: z1, dip: dip, ease: opts.ease || "inout", done: opts.done || null };
  }
  function stepFlight(f, now) {
    var u = Math.min(1, (now - f.t0) / f.dur), e = f.ease === "out" ? HA.easeOut(u) : HA.easeInOut(u);
    var c = f.ip(e);
    var z = f.z0 * Math.pow(f.z1 / f.z0, e) * (1 - f.dip * Math.sin(Math.PI * e));
    return { center: c, z: Math.max(0.95, z), done: u >= 1 };
  }

  G.camera = { VIEWS: VIEWS, ORDER: ORDER, createFlight: createFlight, stepFlight: stepFlight };
})();
