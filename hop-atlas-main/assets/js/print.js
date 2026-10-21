/* =====================================================================
   Печать: перед печатью живой глобус и карта потоков заменяются
   снимками (вид «Весь мир»), после печати всё возвращается.
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA;

  HA.initPrint = function (globe) {
    var added = [];
    function shot(where, url, cap, cls) {
      if (!where || !url) return;
      var img = document.createElement("img");
      img.className = "print-shot " + (cls || "");
      img.alt = cap;
      img.src = url;
      var p = document.createElement("p");
      p.className = "print-cap";
      p.textContent = cap;
      where.appendChild(img); where.appendChild(p);
      added.push(img, p);
    }
    var opened = [];
    function before() {
      if (HA.ensureAll) HA.ensureAll();
      // свёрнутые примечания в печати раскрыты
      HA.$$("details:not([open])").forEach(function (d) { d.open = true; opened.push(d); });
      if (added.length) return;
      if (globe) shot(HA.$("#globe-box"), globe.snapshot(), "Глобус атласа, вид «Весь мир»: шпалеры — регионы производства хмеля (высота — объём, т/год).");
      var pl = HA.plateSnapshot && HA.plateSnapshot();
      if (pl) {
        shot(HA.$("#plate-frame"), pl.main, "Карта маршрутов экспорта хмеля (раздел II).");
        shot(HA.$("#plate-frame"), pl.inset, "Врезка: Чехия → Германия.", "print-shot--inset");
      }
    }
    function after() {
      opened.forEach(function (d) { d.open = false; });
      opened = [];
      added.forEach(function (el) { el.remove(); });
      added = [];
    }
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    if (window.matchMedia) {
      var mq = matchMedia("print");
      var on = function (e) { if (e.matches) before(); else after(); };
      if (mq.addEventListener) mq.addEventListener("change", on); else if (mq.addListener) mq.addListener(on);
    }
  };
})();
