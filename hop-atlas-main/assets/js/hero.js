/* =====================================================================
   Титул: ведомость главных цифр (из данных) со счётчиками и подпись НИР.
   Подпись НИР: на широком экране — полностью, на телефоне — коротко
   (полное название НИР есть в подвале).
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, D = HA.D, DATA = window.ATLAS_DATA;
  var STAR = '<span class="fn" aria-hidden="true" title="Рассчитано по данным атласа">*</span>';

  HA.initHero = function () {
    var meta = DATA.meta;
    var head = "<b>" + HA.esc(meta.head).replace(/ /g, "&nbsp;") + "</b>";
    var full = HA.$("#nir .nir__full"), short = HA.$("#nir .nir__short");
    // неразрывный пробел — ПЕРЕД тире: тире не переносится в начало строки
    if (full) full.innerHTML = "Создано в&nbsp;рамках НИР «" + HA.t(meta.nir) + "». Руководитель&nbsp;— " + head;
    if (short) short.innerHTML = "Создано в&nbsp;рамках НИР, руководитель&nbsp;— " + head;
    var top = D.ranked[0];
    var f2031 = DATA.forecast.points[DATA.forecast.points.length - 1];
    var rows = HA.$$("#ledger .ledger__row");
    var set = function (row, v, dec, label) {
      if (!row) return;
      var el = HA.$(".ledger__v", row);
      el.setAttribute("data-count", v);
      el.setAttribute("data-dec", dec || 0);
      el.textContent = HA.fmt(v, dec || 0);
      if (label != null) HA.$("dt", row).innerHTML = label;
    };
    set(rows[0], D.count, 0, "Регионов в&nbsp;атласе");
    set(rows[1], D.total, 0, "Сумма по&nbsp;" + D.count + " регионам" + STAR);
    set(rows[2], top.t, 0, "Крупнейший регион&nbsp;— " + HA.t(top.name.replace(/ \(.+\)/, "")));
    set(rows[3], f2031.v, 2, "Прогноз мирового рынка на&nbsp;" + f2031.year + "&nbsp;г.");

    /* счётчики: один раз при первом появлении, 1200 мс; при «меньше движения» — сразу итог */
    if (HA.reduced() || !("IntersectionObserver" in window)) return;
    var els = HA.$$("#ledger [data-count]");
    els.forEach(function (el) { el.style.minWidth = el.offsetWidth + "px"; el.style.display = "inline-block"; el.style.textAlign = "right"; });
    var finish = function () {
      els.forEach(function (el) { el.textContent = HA.fmt(+el.getAttribute("data-count"), +el.getAttribute("data-dec") || 0); });
    };
    // страховка: если кадры анимации не идут (вкладка скрыта, печать) — показываем итог
    window.addEventListener("beforeprint", finish);
    var run = function () {
      setTimeout(finish, 1500);
      var t0 = performance.now();
      var step = function (now) {
        var u = Math.min(1, (now - t0) / 1200), e = 1 - Math.pow(1 - u, 3);
        els.forEach(function (el) {
          var to = +el.getAttribute("data-count"), d = +el.getAttribute("data-dec") || 0;
          el.textContent = HA.fmt(u >= 1 ? to : to * e, d);
        });
        if (u < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    var io = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { io.disconnect(); run(); }
    }, { threshold: 0.4 });
    io.observe(HA.$("#ledger"));
  };
})();
