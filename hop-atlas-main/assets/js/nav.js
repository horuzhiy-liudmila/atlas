/* =====================================================================
   Шапка: оглавление «Содержание атласа», панель-меню, scrollspy
   (текущий лист подсвечивается и пишется под названием атласа).
   Строка из 9 пунктов показывается, только если она целиком помещается
   в шапку (проверяется измерением, а не шириной окна); иначе — кнопка
   «Содержание» с раскрывающейся панелью. Поэтому шапка не вылезает
   за край экрана ни при каком размере окна и шрифта.
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA;

  HA.initNav = function () {
    var head = HA.$("#masthead"), inner = HA.$(".masthead__in", head);
    var toc = HA.$("#toc"), btn = HA.$(".toc__btn", toc), panel = HA.$("#toc-panel"), list = HA.$(".toc__list", toc);
    var brand = HA.$(".brand", head);
    var links = HA.$$(".toc__list a", toc);
    var cur = HA.$("#cur-sheet");
    var isPanel = function () { return head.classList.contains("is-compact"); };

    /* помещается ли строка оглавления целиком */
    function fit() {
      var wasOpen = toc.classList.contains("is-open");
      head.classList.remove("is-compact");
      var cs = getComputedStyle(inner);
      var avail = inner.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (parseFloat(cs.columnGap) || 0);
      var need = brand.offsetWidth + list.scrollWidth + 4;
      var compact = need > avail;
      head.classList.toggle("is-compact", compact);
      if (!compact && wasOpen) open(false);
    }
    var fitT = 0;
    window.addEventListener("resize", function () { clearTimeout(fitT); fitT = setTimeout(fit, 80); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    fit();

    function open(on) {
      toc.classList.toggle("is-open", on);
      btn.setAttribute("aria-expanded", String(on));
      if (on) {
        var a = HA.$('a[aria-current="true"]', panel) || links[0];
        setTimeout(function () { a.focus(); }, 30);
      }
    }
    btn.addEventListener("click", function () { open(!toc.classList.contains("is-open")); });
    document.addEventListener("click", function (e) {
      if (toc.classList.contains("is-open") && !toc.contains(e.target)) open(false);
    });
    toc.addEventListener("keydown", function (e) {
      if (!toc.classList.contains("is-open")) return;
      if (e.key === "Escape") { open(false); btn.focus(); return; }
      if (e.key === "Tab" && isPanel()) {
        // фокус не уходит из открытой панели
        var f = [btn].concat(links);
        var i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    links.forEach(function (a) {
      a.addEventListener("click", function () {
        // нижние листы могли ещё не построиться — строим до прокрутки, чтобы она не промахнулась
        if (HA.ensureAll) HA.ensureAll();
        if (isPanel()) open(false);
      });
    });

    /* scrollspy: раздел, который пересекает верхнюю треть окна */
    var ids = links.map(function (a) { return a.getAttribute("href").slice(1); });
    var sections = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var current = null;
    function setCurrent(id) {
      if (id === current) return;
      current = id;
      links.forEach(function (a) {
        var on = a.getAttribute("href") === "#" + id;
        if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
        if (on && cur) {
          cur.style.opacity = "0";
          setTimeout(function () { cur.textContent = a.getAttribute("data-sheet"); cur.style.opacity = "1"; }, 120);
        }
      });
    }
    var vis = {};
    function pick() {
      var doc = document.documentElement;
      // в самом низу страницы текущим считается последний пункт (подвал короткий)
      if (window.innerHeight + window.pageYOffset >= doc.scrollHeight - 4) { setCurrent(sections[sections.length - 1].id); return; }
      for (var i = sections.length - 1; i >= 0; i--) {
        if (vis[sections[i].id]) { setCurrent(sections[i].id); return; }
      }
    }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { vis[en.target.id] = en.isIntersecting; });
        pick();
      }, { rootMargin: "-30% 0px -60% 0px" });
      sections.forEach(function (s) { io.observe(s); });
    }
    setCurrent("s1");
    window.addEventListener("scroll", pick, { passive: true });
  };
})();
