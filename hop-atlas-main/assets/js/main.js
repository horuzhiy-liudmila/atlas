/* =====================================================================
   Атлас ХПП — запуск всех модулей. Каждый модуль изолирован: ошибка
   в одном разделе не ломает остальные, а вверху страницы появляется
   понятная плашка (вместо молчаливых пустых блоков).

   Порядок: сразу — шапка, титул, глобус и лист I; листы II–VIII
   строятся по очереди в свободное время браузера (не мешая первому
   экрану) или сразу, как только к ним переходят по оглавлению,
   прокручивают близко или отправляют страницу на печать.
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA || (window.HA = {});
  var failed = [];
  function run(name, fn) {
    try { return fn(); } catch (e) { failed.push(name); if (window.console) console.error("[Атлас] " + name + ":", e); return null; }
  }

  /* ---------- плашка об ошибке (сообщения накапливаются, а не затирают друг друга) ---------- */
  var notes = [], libMissing = false;
  function banner(html) {
    var main = document.getElementById("main") || document.body;
    var el = document.getElementById("atlas-error");
    if (!el) {
      el = document.createElement("div");
      el.id = "atlas-error";
      el.className = "fatal";
      el.setAttribute("role", "alert");
      main.insertBefore(el, main.firstChild);
    }
    notes.push(html);
    el.innerHTML = '<p class="fatal__k">Атлас открылся не полностью</p>' + notes.join("");
  }
  function checkFiles() {
    var errs = window.__atlasErrors || [];
    var load = errs.filter(function (e) { return e.kind === "load"; }).map(function (e) { return e.src; });
    if (!window.ATLAS_DATA || !HA.D) {
      var de = errs.filter(function (e) { return e.kind === "data"; })[0];
      banner("<p><b>Ошибка в&nbsp;файле данных</b> <code>assets/data/atlas-data.js</code>" + (de && de.line ? ", строка&nbsp;" + de.line + " (или строка перед ней)" : "") +
        ". Проверьте рядом с&nbsp;последней правкой запятые, скобки и&nbsp;кавычки: после каждого элемента списка ставится запятая, текст пишется в&nbsp;двойных кавычках \"…\". " +
        "Подробнее — в&nbsp;README, раздел «Если вверху появилась красная плашка».</p>");
      return false;
    }
    if (load.length || !window.d3 || !d3.geoOrthographic || !window.topojson) {
      libMissing = true;
      banner("<p><b>Не найден файл</b> " + (load.length ? load.map(function (s) { return "<code>" + HA.esc(s) + "</code>"; }).join(", ") : "библиотеки в&nbsp;папке <code>assets/vendor</code>") +
        ". Глобус и&nbsp;карты без него не&nbsp;работают. Загрузите на&nbsp;сайт папку <code>assets</code> целиком, ничего в&nbsp;ней не&nbsp;переименовывая.</p>");
    }
    return true;
  }

  /* ---------- листы II–VIII: по очереди, в свободное время ---------- */
  var globe = null;
  var later = [
    ["раздел II", "#s2", function () { HA.initTrade && HA.initTrade(); }],
    ["раздел III", "#s3", function () { HA.initProducts && HA.initProducts(); }],
    ["раздел IV", "#s4", function () { HA.initRegions && HA.initRegions(globe); }],
    ["раздел V", "#s5", function () { HA.initForecast && HA.initForecast(); }],
    ["раздел VI", "#s6", function () { HA.initCalc && HA.initCalc(); }],
    ["раздел VII", "#s7", function () { HA.initTechmap && HA.initTechmap(); }],
    ["раздел VIII", "#s8", function () { HA.initRecs && HA.initRecs(); }]
  ];
  var done = 0, idleId = 0, finished = false;
  function runNext() {
    if (done >= later.length) return false;
    var job = later[done++];
    run(job[0], job[2]);
    run("типографика", function () { HA.typoDOM(document.querySelector(job[1])); });
    return true;
  }
  function finish() {
    if (failed.length && !finished) {
      finished = true;
      banner(libMissing
        ? "<p>Из-за этого не&nbsp;построены: " + failed.map(HA.esc).join(", ") + ".</p>"
        : "<p>Не&nbsp;удалось построить: " + failed.map(HA.esc).join(", ") + ". Обычно это значит, что в&nbsp;файле <code>assets/data/atlas-data.js</code> пропущено или неверно записано значение. Подробности — в&nbsp;консоли браузера (F12).</p>");
    }
  }
  /* построить всё, что ещё не построено, — сразу (переход по оглавлению, печать, ссылка с #якорем) */
  HA.ensureAll = function () {
    if (done >= later.length) return;
    if (idleId && window.cancelIdleCallback) cancelIdleCallback(idleId);
    while (runNext()) { /* по очереди */ }
    finish();
  };
  function schedule() {
    if (done >= later.length) { finish(); return; }
    var go = function () { idleId = 0; runNext(); schedule(); };
    if (window.requestIdleCallback) idleId = requestIdleCallback(go, { timeout: 400 });
    else setTimeout(go, 30);
  }

  function start() {
    if (!checkFiles()) return;
    run("орнаменты", function () { HA.orn.fill(document); });
    run("шапка", function () { HA.initNav(); });
    globe = run("глобус", function () { return HA.initStage(); });
    if (globe) run("раздел I", function () { HA.initProduction(globe); });
    run("режим карты", function () { HA.amap = HA.initAtlasMap && HA.initAtlasMap(globe); });
    run("хмель на кнопке", function () { HA.initVineButtons && HA.initVineButtons(); });
    run("ведомость", function () { HA.initHero && HA.initHero(); });
    run("подвал", function () { HA.initFooter && HA.initFooter(); });
    // перед печатью достраиваем все листы (обработчик — раньше, чем у печати)
    window.addEventListener("beforeprint", HA.ensureAll);
    run("печать", function () { HA.initPrint && HA.initPrint(globe); });
    run("типографика", function () {
      HA.typoDOM(document.querySelector(".masthead"));
      HA.typoDOM(document.getElementById("s1"));
      HA.typoDOM(document.getElementById("team"));
      // статические заголовки и лиды листов II–VIII — тоже
      HA.$$(".sheet-head").forEach(function (h) { HA.typoDOM(h); });
    });

    // к листу ведёт якорь в адресе — строим всё сразу, иначе прокрутка промахнётся
    var hash = location.hash && location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
    if (hash && !document.getElementById("s1").contains(hash)) {
      HA.ensureAll();
      requestAnimationFrame(function () { hash.scrollIntoView(); });
    } else schedule();
    // прокрутили близко к нижним листам раньше, чем они построились
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (en) {
        if (en.some(function (e) { return e.isIntersecting; })) { io.disconnect(); HA.ensureAll(); }
      }, { rootMargin: "150% 0px 150% 0px" });
      HA.$$(".sheet").forEach(function (s) { io.observe(s); });
    }
    window.addEventListener("hashchange", HA.ensureAll);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
