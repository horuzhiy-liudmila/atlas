/* =====================================================================
   Лист VIII · Методические рекомендации (полный текст, без сокращений)
   и подвал «Разработчики».
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, DATA = window.ATLAS_DATA;

  /* номер, заголовок и полный текст — без рамок и украшений */
  HA.initRecs = function () {
    var R = DATA.recommendations;
    HA.$("#recs-intro").innerHTML = HA.t(R.intro);
    HA.$("#recs").innerHTML = R.items.map(function (it, i) {
      return '<li class="rec"><h3><span class="rec__n" aria-hidden="true">' + HA.roman(i + 1) + ".</span>" + HA.t(it.title) + "</h3>" +
        "<p>" + HA.t(it.text) + "</p></li>";
    }).join("");
  };

  HA.initFooter = function () {
    var M = DATA.meta;
    HA.$("#devs").innerHTML = M.developers.map(function (d) { return "<li>" + HA.t(d) + "</li>"; }).join("");
    HA.$("#foot-nir").innerHTML = "«" + HA.t(M.nir) + "»";
    HA.$("#foot-head").innerHTML = "Руководитель&nbsp;— " + HA.esc(M.head).replace(/ /g, "&nbsp;");
    HA.$("#foot-year").textContent = M.year;
    var mark = HA.$(".binding__mark");
    if (mark) mark.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">' + HA.art.sealSVG(64, { ink: "#FBF6EA", bg: "none" }) + "</svg>";
  };
})();
