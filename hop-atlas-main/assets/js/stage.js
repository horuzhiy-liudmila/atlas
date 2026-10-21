/* =====================================================================
   Сцена глобуса (лист I): глобус, кнопки видов с одной строкой-выводом
   под глобусом, строка условных знаков с живым эталоном высоты
   и карточка региона.

   Строка под глобусом (#view-cap) — одна мысль на вид:
   • пока человек ничего не трогал — как пользоваться глобусом;
   • после первого действия — короткий вывод для текущего вида
     (одна цифра и одна фраза). Числа, которые сайт считает сам,
     помечены «*» (сноска «Рассчитано по данным атласа»).
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, D = HA.D, NB = HA.NB;
  var STAR = '<span class="fn" aria-hidden="true" title="Рассчитано по данным атласа">*</span>';

  function short(name) { return name.replace(/ \(.+\)/, ""); }

  /* выводы для видов — из данных (ничего не вписано вручную) */
  function captions() {
    var top1 = D.ranked[0], top2 = D.ranked[1];
    var V = HA.globe.camera.VIEWS;
    var yak = D.byId[V.usa.focus] || top2;
    var chu = D.byId[V.russia.focus] || D.ranked[D.count - 1];
    var hal = D.byId[V.russia.also] || top1;
    var two = ((top1.t + top2.t) / D.total) * 100;
    var ratio = Math.round(hal.t / chu.t);
    return {
      world: "<b>Весь мир.</b> Две самые высокие шпалеры&nbsp;— " + HA.t(short(top1.name)) + " и&nbsp;" + HA.t(short(top2.name)) +
        ": вместе " + HA.fmt(two, 0) + NB + "%" + STAR + " суммы по&nbsp;" + D.count + " регионам.",
      europe: "<b>Европа.</b> " + D.europe.length + " " + HA.plural(D.europe.length, ["регион", "региона", "регионов"]) +
        " атласа, вместе " + HA.fmt(D.europeSum) + NB + "т/год" + STAR + ". Крупнейший&nbsp;— " + HA.t(short(D.europe[0].name)) + ".",
      usa: "<b>США и&nbsp;Атлантика.</b> " + HA.t(short(yak.name)) + "&nbsp;— " + HA.fmt(yak.t) + NB + "т/год, №" + NB + yak.rank + " из&nbsp;" + D.count +
        "; через океан&nbsp;— встречный экспорт хмеля с&nbsp;Германией.",
      russia: "<b>Россия.</b> " + HA.t(chu.name) + "&nbsp;— " + HA.fmt(chu.t) + NB + "т/год. " + HA.t(short(hal.name)) +
        " производит в&nbsp;" + HA.fmt(ratio) + NB + HA.plural(ratio, ["раз", "раза", "раз"]) + STAR + " больше."
    };
  }

  HA.initStage = function () {
    var box = HA.$("#globe-box");
    if (!box || !window.d3 || !d3.geoOrthographic || !window.topojson || !HA.globe || !HA.globe.create) return null;
    /* колёсико над глобусом на странице: зумит, только если глобус «включён» нажатием
       или зажат Ctrl/⌘ — иначе страница прокручивается дальше и всплывает подсказка
       (щипок на тачпаде приходит как wheel с ctrlKey — он зумит всегда) */
    var engaged = false;
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
    var globe = HA.globe.create({
      box: box, canvas: HA.$("#globe"), ring: HA.$("#globe-ring"),
      wheel: function (e) { return engaged || e.ctrlKey || e.metaKey; }
    });
    box.addEventListener("pointerdown", function () { engaged = true; box.classList.add("is-engaged"); });
    box.addEventListener("pointerleave", function () { engaged = false; box.classList.remove("is-engaged"); });
    var hint = HA.$("#globe-hint"), hintT = 0;
    if (hint) hint.innerHTML = "Чтобы приблизить, нажмите на&nbsp;глобус или удерживайте <b>" + (mac ? "⌘" : "Ctrl") + "</b>. Большая карта&nbsp;— «Открыть атлас».";
    globe.on("wheel-pass", function () {
      if (!hint) return;
      hint.classList.add("is-on");
      clearTimeout(hintT);
      hintT = setTimeout(function () { hint.classList.remove("is-on"); }, 1800);
    });
    HA.debug = { globe: globe }; // для проверки в консоли браузера (отладка)
    setTimeout(function () { var r = HA.$("#globe-ring"); if (r) r.classList.add("is-drawn"); }, 2400);

    /* ---------- кнопки видов и строка-вывод под глобусом ---------- */
    var segBtns = HA.$$(".seg--views button");
    var cap = HA.$("#view-cap"), legendFlow = HA.$("#legend-flow");
    var CAP = captions();
    var touched = false;
    // строка под глобусом: подсказка → вывод для нажатого вида → пусто, когда вид не выбран
    // (глобус повернули рукой или открыта карточка региона — тогда говорит карточка)
    function showCaption(view) {
      if (!cap) return;
      cap.innerHTML = view && CAP[view] ? CAP[view] : "";
      HA.typoDOM(cap);
    }
    segBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        globe.setView(b.getAttribute("data-view"), { source: "button" });
      });
    });
    globe.on("view", function (e) {
      segBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === e.name)); });
      touched = true;
      showCaption(e.name);
    });
    // пунктир экспорта есть на глобусе только в виде «США» — и знак в легенде только тогда
    globe.on("flows", function (on) { if (legendFlow) legendFlow.hidden = !on; });

    /* ---------- живой эталон высоты в легенде ---------- */
    var rBar = HA.$("#ruler-bar"), rVal = HA.$("#ruler-val");
    globe.on("scale", function (e) {
      var perT = e.hmax / e.max;
      var unit = 10000 * perT >= 7 ? 10000 : 5000; // эталон: 10 000 т (на очень маленьком глобусе — 5 000 т)
      if (rBar) rBar.style.height = Math.max(3, unit * perT).toFixed(1) + "px";
      if (rVal) rVal.textContent = HA.fmt(unit) + NB + "т";
    });

    /* ---------- карточка региона ---------- */
    var card = HA.$("#rcard");
    var returnFocus = null;
    var printing = function () { return window.matchMedia && matchMedia("print").matches; };
    function mode() {
      var w = window.innerWidth;
      return w >= 1280 ? "side" : w >= 1024 ? "below" : "sheet";
    }
    function neighbour(r, d) { return D.ranked[r.rank - 1 + d] || null; }
    function render(id, source) {
      var r = D.byId[id], share = (r.t / D.total) * 100;
      var f = D.feature(id);
      var prev = neighbour(r, -1), next = neighbour(r, 1);
      var back = source === "feature" && HA.backTarget && document.body.contains(HA.backTarget);
      card.innerHTML =
        '<div class="rcard__top"><p class="rcard__c">' + HA.t(r.country) + " · №" + NB + r.rank + " из&nbsp;" + D.count + "</p>" +
        '<button class="icon-btn rcard__x" type="button" aria-label="Закрыть карточку"><svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button></div>' +
        '<h3 id="rcard-h" tabindex="-1">' + HA.t(r.name) + "</h3>" +
        '<p class="rcard__v"><span>' + HA.fmt(r.t) + '</span><span class="u">т/год</span></p>' +
        '<p class="rcard__s">' + HA.fmt(share, share < 1 ? 2 : 1) + NB + "%" + STAR + " суммы по&nbsp;" + D.count + " регионам</p>" +
        (f ? '<blockquote class="quote quote--sm">' + HA.t(f.text) + "</blockquote>" : "") +
        (back ? '<p class="rcard__back"><button type="button" class="link-act" data-back="1"><span aria-hidden="true">↓</span> Назад к&nbsp;особенностям</button></p>' : "") +
        '<nav class="rcard__nav" aria-label="Соседние регионы по объёму">' +
        '<button type="button" data-go="' + (prev ? prev.id : "") + '"' + (prev ? "" : " disabled") + ">← №" + NB + (prev ? prev.rank + " " + HA.t(short(prev.name)) : "") + "</button>" +
        '<button type="button" data-go="' + (next ? next.id : "") + '"' + (next ? "" : " disabled") + ">№" + NB + (next ? next.rank + " " + HA.t(short(next.name)) : "") + " →</button></nav>";
      HA.typoDOM(card);
    }
    var stageCol = HA.$(".stage-col");
    function place(instant) {
      if (printing()) return; // в печати карточка и глобус скрыты — геометрию не трогаем
      if (card.hidden) { globe.setCard(null); return; }
      var m = mode();
      if (m === "side") {
        // ≥ 1280: карточка внутри рамки глобуса, глобус отъезжает влево
        card.style.removeProperty("--below-h");
        globe.setCard(card.getBoundingClientRect(), "side", instant);
        return;
      }
      if (m === "below") {
        // 1024–1279: карточка под глобусом; чтобы глобус не стал крошечным, она заходит на строку-вывод и легенду
        var below = Math.max(0, stageCol.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom - 6);
        card.style.setProperty("--below-h", Math.round(below) + "px");
        globe.setCard(card.getBoundingClientRect(), "below", instant);
        return;
      }
      // < 1024: карточка прикреплена к низу окна; если она закрывает глобус — глобус уменьшается над ней
      var cr = card.getBoundingClientRect(), gr = box.getBoundingClientRect();
      if (cr.top < gr.bottom - 8 && cr.bottom > gr.top) globe.setCard(cr, "below", instant);
      else globe.setCard(null, null, instant);
    }
    var head = HA.$(".masthead");
    function revealGlobe() {
      // телефон и планшет: нажали на шпалеру, а глобус почти скрыт карточкой — прокручиваем так, чтобы он встал под шапку
      var cr = card.getBoundingClientRect(), gr = box.getBoundingClientRect(), hh = head ? head.offsetHeight : 56;
      var visible = Math.min(gr.bottom, cr.top) - Math.max(gr.top, hh);
      if (visible < gr.height * 0.55 && gr.top > hh + 4) window.scrollBy({ top: gr.top - hh, behavior: HA.reduced() ? "auto" : "smooth" });
    }
    var lastSource = null;
    globe.on("select", function (e) {
      if (!e.id) {
        if (!card.hidden) {
          card.hidden = true;
          globe.setCard(null);
          if (returnFocus && document.activeElement && card.contains(document.activeElement)) { try { returnFocus.focus(); } catch (err) { /* нет */ } }
        }
        return;
      }
      if (card.hidden && document.activeElement && !card.contains(document.activeElement)) returnFocus = document.activeElement;
      if (e.source !== "card") lastSource = e.source;
      render(e.id, lastSource);
      card.hidden = false;
      requestAnimationFrame(function () { place(); if (mode() === "sheet" && e.source === "globe") revealGlobe(); });
      var r = D.byId[e.id];
      HA.announce(r.name + ", " + r.country + ": " + HA.fmt(r.t) + " тонн в год, " + r.rank + "-е место из " + D.count + ".");
      if (e.focusCard) setTimeout(function () { var h = HA.$("#rcard-h"); if (h) h.focus({ preventScroll: true }); }, 60);
    });
    card.addEventListener("click", function (e) {
      if (e.target.closest(".rcard__x")) { globe.clear(); return; }
      if (e.target.closest("[data-back]")) {
        var t = HA.backTarget;
        HA.backTarget = null;
        globe.clear();
        if (t) {
          HA.scrollToEl(t.closest(".feat") || t, 16);
          setTimeout(function () { try { t.focus({ preventScroll: true }); } catch (err) { /* нет */ } }, HA.reduced() ? 0 : 500);
        }
        return;
      }
      var go = e.target.closest("[data-go]");
      if (go && go.getAttribute("data-go")) globe.select(go.getAttribute("data-go"), { source: "card", focusCard: true });
    });
    card.addEventListener("keydown", function (e) { if (e.key === "Escape") globe.clear(); });
    window.addEventListener("resize", function () { if (!card.hidden) requestAnimationFrame(function () { place(); }); });
    var scrollT = false;
    window.addEventListener("scroll", function () {
      if (card.hidden || mode() !== "sheet" || scrollT) return;
      scrollT = true;
      requestAnimationFrame(function () { scrollT = false; place(true); });
    }, { passive: true });

    /* лист I ушёл с экрана — карточку закрываем (на телефоне она внизу экрана) */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting && globe.selected) globe.clear();
      }, { rootMargin: "0px 0px -35% 0px" }).observe(HA.$("#s1"));
    }
    return globe;
  };
})();
