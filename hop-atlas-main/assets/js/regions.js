/* =====================================================================
   Лист IV · Региональные особенности: четыре строки-«ведомости».
   В каждой — мини-силуэт страны гравюрой с точкой региона, название,
   главная мысль — дословная формулировка НИР (одна на регион),
   одна тихая строка «объём · место» и кнопка «Показать на глобусе».
   Крупных цифр нет: у четырёх регионов в формулировках разные
   показатели (проценты альфа-кислот, доля, тонны), сравнивать их
   нельзя — поэтому главным текстом стоит сама формулировка.
   Кнопка есть только там, где глобус стоит рядом со списком регионов
   (широкий экран); на телефоне строка не уносит на верх страницы.
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, D = HA.D, DATA = window.ATLAS_DATA, NB = HA.NB;

  /* силуэт страны: акварель + штриховка + перо + точка региона */
  function silhouette(iso, region, uid) {
    var W = 200, H = 112;
    var world = HA.globe.world.W50 || HA.globe.world.W110;
    var f = world.byId[iso];
    if (!f) return "";
    var geo = f;
    var proj;
    if (iso === "840") {
      // только основная часть США (без Аляски и Гавайев)
      var polys = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates];
      polys = polys.filter(function (pg) { var c = d3.geoCentroid({ type: "Polygon", coordinates: pg }); return c[0] > -126 && c[0] < -65 && c[1] > 23 && c[1] < 50; });
      geo = { type: "Feature", geometry: { type: "MultiPolygon", coordinates: polys } };
      proj = d3.geoConicEqualArea().parallels([29.5, 45.5]).rotate([96, 0]);
    } else if (iso === "643") {
      // Россия целиком, вместе с Чукоткой: центральный меридиан 100° в. д., разрез — на 80° з. д.
      proj = d3.geoConicEqualArea().parallels([50, 70]).rotate([-100, 0]);
    } else {
      var c = d3.geoCentroid(f);
      proj = d3.geoConicEqualArea().parallels([c[1] - 4, c[1] + 4]).rotate([-c[0], 0]);
    }
    proj.fitExtent([[10, 8], [W - 10, H - 8]], geo);
    var path = d3.geoPath(proj);
    var d = path(geo);
    var p = proj([region.lon, region.lat]);
    var id = "sil-" + uid;
    return '<svg viewBox="0 0 ' + W + " " + H + '" aria-hidden="true" focusable="false">' +
      '<defs><clipPath id="' + id + '"><path d="' + d + '"/></clipPath></defs>' +
      '<path d="' + d + '" fill="#CBD39B" transform="translate(1.4 1)" opacity=".55"/>' +
      '<path d="' + d + '" fill="#CBD39B" opacity=".85"/>' +
      '<rect width="' + W + '" height="' + H + '" fill="url(#hatch-ink)" clip-path="url(#' + id + ')" opacity=".55"/>' +
      '<path d="' + d + '" fill="none" stroke="#8F9F55" stroke-width="2.2" stroke-linejoin="round" opacity=".6"/>' +
      '<path d="' + d + '" fill="none" stroke="#33281D" stroke-width="1.1" stroke-linejoin="round"/>' +
      '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="7" fill="rgba(200,149,63,.42)" stroke="#85591A" stroke-width="1.2"/>' +
      '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.8" fill="#33281D"/></svg>';
  }

  HA.initRegions = function (globe) {
    var host = HA.$("#fcards");
    if (!host) return;
    host.innerHTML = DATA.features.map(function (f, i) {
      var r = D.byId[f.region];
      if (!r) return "";
      return '<li class="feat" aria-labelledby="fc-' + i + '">' +
        '<div class="feat__map">' + silhouette(r.iso, r, i) + "</div>" +
        '<div class="feat__head"><p class="feat__c">' + HA.t(f.country) + "</p>" +
        '<h3 id="fc-' + i + '">' + HA.t(f.place) + "</h3></div>" +
        '<blockquote class="quote feat__q">' + HA.t(f.text) + "</blockquote>" +
        '<p class="feat__meta"><span class="nw">' + HA.fmtT(r.t) + "/год</span> · <span class=\"nw\">№" + NB + r.rank + " из&nbsp;" + D.count + "</span></p>" +
        (globe ? '<button class="btn btn--secondary btn--sm feat__go" type="button" data-region="' + r.id + '">Показать на&nbsp;глобусе <svg class="ic" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M7 12.5V2M2.6 6.4 7 2l4.4 4.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' : "") +
        "</li>";
    }).join("");
    // подробные контуры (1:50 млн) — когда подгрузятся
    HA.globe.world.load50(function () {
      HA.$$(".feat", host).forEach(function (row, i) {
        var f = DATA.features[i], r = f && D.byId[f.region];
        if (r) HA.$(".feat__map", row).innerHTML = silhouette(r.iso, r, "h" + i);
      });
    });
    if (!globe) return;
    host.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-region]");
      if (!b) return;
      var id = b.getAttribute("data-region");
      // запоминаем, откуда пришли: в карточке региона будет «Вернуться к особенностям регионов»
      HA.backTarget = b;
      // глобус приколот рядом со списком регионов листа I
      HA.scrollToEl(HA.$("#production"), 8);
      // облёт — когда прокрутка закончится
      var lastY = -1, still = 0;
      var wait = function () {
        var y = window.pageYOffset;
        if (Math.abs(y - lastY) < 1) still++; else still = 0;
        lastY = y;
        if (still >= 6 || HA.reduced()) globe.select(id, { source: "feature", focusCard: true });
        else requestAnimationFrame(wait);
      };
      requestAnimationFrame(wait);
    });
  };
})();
