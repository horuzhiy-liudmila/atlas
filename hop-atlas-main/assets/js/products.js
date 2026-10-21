/* =====================================================================
   Лист III · Хмелепродукты: структура «Мир — РФ» таблицей с барами.
   Каждая строка — один продукт, рядом две доли: в мире и в России
   (сравнивать удобно по строке, легенда не нужна). Бары — гравюрная
   штриховка хмелевого цвета; 0 % — пустая дорожка с подписью.
   Ниже — дословная формулировка НИР.
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, DATA = window.ATLAS_DATA, NB = HA.NB;

  HA.initProducts = function () {
    var table = HA.$("#products-table");
    if (!table) return;
    var P = DATA.products.items;
    var cols = [{ key: "world", name: "В мире" }, { key: "rf", name: "В России" }];
    var cell = function (v, name) {
      return '<td class="ptable__c" data-label="' + name + '"><span class="ptable__cell"><span class="ptable__track" aria-hidden="true"><i style="width:' + Math.max(0, Math.min(100, v)) + '%"></i></span>' +
        '<span class="ptable__v">' + HA.fmtAuto(v, 1) + NB + "%</span></span></td>";
    };
    table.innerHTML = '<caption class="chart__cap">Структура хмелепродуктов, %</caption>' +
      '<thead><tr><th scope="col"><span class="sr-only">Продукт</span></th>' + cols.map(function (c) { return '<th scope="col">' + c.name + "</th>"; }).join("") + "</tr></thead>" +
      "<tbody>" + P.map(function (p) {
        return '<tr><th scope="row">' + HA.t(p.type) + "</th>" + cell(p.world, cols[0].name) + cell(p.rf, cols[1].name) + "</tr>";
      }).join("") + "</tbody>";
    HA.$("#products-text").innerHTML = HA.t(DATA.products.text);

    // бары растут один раз при появлении
    if (!HA.reduced() && "IntersectionObserver" in window) {
      table.classList.add("is-pre");
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { table.classList.remove("is-pre"); io.disconnect(); }
      }, { threshold: 0.3 });
      io.observe(table);
    }
  };
})();
