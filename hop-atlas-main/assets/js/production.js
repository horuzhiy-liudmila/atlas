/* =====================================================================
   Лист I · Мировое производство: список «Регионы по объёму» (связан
   с глобусом в обе стороны), диаграмма «Топ-6 стран» и свёрнутое
   «Примечание к данным» (расхождения цифр в материалах НИР).
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, D = HA.D, DATA = window.ATLAS_DATA;

  HA.initProduction = function (globe) {
    /* ---------- Регионы по объёму ----------
       Имя кнопки для экранного диктора совпадает с видимым текстом строки
       (номер, название, страна, объём) + «тонн в год». */
    var ol = HA.$("#rlist");
    ol.innerHTML = D.ranked.map(function (r) {
      var withC = r.name.indexOf(r.country) < 0;
      return '<li><button type="button" data-region="' + r.id + '" aria-pressed="false">' +
        '<span class="badge">' + r.rank + "</span>" +
        '<span class="nm">' + HA.t(r.name) + (withC ? "<small>" + HA.t(r.country) + "</small>" : "") + "</span>" +
        '<span class="v">' + HA.fmt(r.t) + '<span class="sr-only"> тонн в год</span></span>' +
        '<span class="bar" aria-hidden="true"><i style="width:' + Math.max(0.8, (r.t / D.max) * 100).toFixed(1) + '%"></i></span>' +
        "</button></li>";
    }).join("");
    HA.$("#rlist-sum").textContent = HA.fmtT(D.total);
    var rows = HA.$$("button", ol);
    ol.addEventListener("click", function (e) {
      var b = e.target.closest("[data-region]");
      if (!b) return;
      globe.select(b.getAttribute("data-region"), { source: "list", focusCard: false });
    });
    ol.addEventListener("mouseover", function (e) {
      var b = e.target.closest("[data-region]");
      globe.setHover(b ? b.getAttribute("data-region") : null);
    });
    ol.addEventListener("mouseleave", function () { globe.setHover(null); });
    ol.addEventListener("focusin", function (e) {
      var b = e.target.closest("[data-region]");
      if (b) globe.setHover(b.getAttribute("data-region"));
    });
    ol.addEventListener("focusout", function () { globe.setHover(null); });
    globe.on("select", function (e) {
      rows.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-region") === e.id)); });
    });
    globe.on("hover", function (e) {
      rows.forEach(function (b) { b.classList.toggle("is-hot", b.getAttribute("data-region") === e.id); });
    });

    /* ---------- Топ-6 стран (тыс. т) ----------
       Бары и ось — в одной системе координат: длина бара = значение / шкала
       от ширины дорожки; подпись значения стоит за концом бара в зарезервированном
       поле справа и не сжимает бар. Нажатие на строку — глобус показывает
       крупнейший регион страны. */
    var T = DATA.top6;
    var box = HA.$("#top6-chart");
    var max = Math.max.apply(null, T.items.map(function (i) { return i.v; }));
    var scaleMax = Math.ceil(max / 10) * 10;
    var html = "";
    T.items.forEach(function (it) {
      var w = (it.v / scaleMax) * 100;
      html += '<button class="row" type="button" data-region="' + it.region + '" aria-pressed="false">' +
        '<span class="ctry">' + HA.t(it.country) + "</span>" +
        '<span class="track"><span class="bar" style="width:' + w.toFixed(2) + '%"></span>' +
        '<span class="val" style="left:' + w.toFixed(2) + '%">' + HA.fmt(it.v, 1) + HA.NB + HA.u("тыс. т") + "</span></span>" +
        '<span class="sr-only"> — показать на глобусе</span></button>';
    });
    html += '<div class="axis-row" aria-hidden="true"><span></span><div class="axis">';
    for (var v = 0; v <= scaleMax; v += 10) html += '<span style="left:' + ((v / scaleMax) * 100).toFixed(2) + '%">' + v + "</span>";
    html += "</div></div>";
    box.innerHTML = html;

    /* ---------- Примечание к данным (свёрнуто) ----------
       Цифры по Чехии в трёх местах НИР разные — показываем как есть. */
    var cz = T.items.filter(function (i) { return i.country === "Чехия"; })[0];
    var zf = D.feature("zatec");
    var note = HA.$("#datanote-text");
    if (note) {
      note.innerHTML = "Значения «Топ-6» приведены так, как в&nbsp;материалах НИР, и&nbsp;не&nbsp;пересчитаны из&nbsp;списка регионов." +
        (cz && D.byId.zatec ? " Поэтому у&nbsp;Чехии здесь " + HA.fmt(cz.v, 1) + HA.NB + HA.u("тыс. т") + ", у&nbsp;Жатца в&nbsp;списке регионов&nbsp;— " + HA.u(HA.fmtT(D.byId.zatec.t)) +
          (zf ? ", а&nbsp;в&nbsp;особенностях региона&nbsp;— «" + HA.t(zf.text.replace(/^[^,]*,\s*/, "").replace(/\.$/, "")) + "»" : "") + "." : "");
    }

    var bars = HA.$$(".row", box);
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-region]");
      if (b) globe.select(b.getAttribute("data-region"), { source: "list" });
    });
    box.addEventListener("mouseover", function (e) {
      var b = e.target.closest("[data-region]");
      globe.setHover(b ? b.getAttribute("data-region") : null);
    });
    box.addEventListener("mouseleave", function () { globe.setHover(null); });
    globe.on("select", function (e) {
      bars.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-region") === e.id)); });
    });
    // рост баров один раз при появлении
    var fig = HA.$("#top6");
    if (!HA.reduced() && "IntersectionObserver" in window) {
      fig.classList.add("is-pre");
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { fig.classList.remove("is-pre"); io.disconnect(); }
      }, { threshold: 0.35 });
      io.observe(fig);
    }
  };
})();
