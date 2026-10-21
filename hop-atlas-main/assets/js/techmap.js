/* =====================================================================
   Лист VII · Технологическая карта — шесть этапов показаны ОДИН раз:
   • на широком экране — таблица; в первой колонке номер и гравюрная
     виньетка этапа;
   • на телефоне — вертикальная лента этапов (таблица на экране скрыта,
     но остаётся для печати и выгрузки в CSV).
   «Скачать CSV (Excel)» и «Печать» стоят рядом с заголовком листа.
   CSV: разделитель «;», UTF-8 с BOM, выгружается ТОЛЬКО эта таблица.
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, DATA = window.ATLAS_DATA;
  var VIG = ["plough", "poles", "drip", "basket", "kiln", "press"];
  var FILE = "Технологическая карта хмелесырья.csv";

  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  HA.initTechmap = function () {
    var T = DATA.techmap, rows = T.rows, cols = T.columns;
    HA.$("#s7-h").innerHTML = '<span class="sheet-n" aria-hidden="true">VII</span>' + HA.t(T.title);
    HA.$("#techmap-sub").innerHTML = HA.t(T.subtitle);

    /* ---------- таблица (широкий экран, печать) ---------- */
    var table = HA.$("#techmap-table");
    table.innerHTML = '<caption class="sr-only">' + HA.t(T.title) + ". " + HA.t(T.subtitle) + "</caption>" +
      "<thead><tr>" + cols.map(function (c, i) { return '<th scope="col"' + (i === 0 ? ' class="num"' : "") + ">" + HA.t(c) + "</th>"; }).join("") + "</tr></thead>" +
      "<tbody>" + rows.map(function (r, i) {
        return "<tr><td>" + '<span class="tech-n"><span class="tech-vig">' + HA.orn.vignette(VIG[i] || "plough", 40) + "</span><b>" + r.n + "</b></span></td>" +
          '<th scope="row">' + HA.t(r.stage) + "</th><td>" + HA.t(r.req) + "</td><td>" + HA.t(r.tech) + "</td></tr>";
      }).join("") + "</tbody>";

    /* ---------- лента этапов (телефон) ---------- */
    HA.$("#timeline").innerHTML = rows.map(function (r, i) {
      return '<li><span class="node">' + HA.orn.vignette(VIG[i] || "plough", 40) + '<span class="n" aria-hidden="true">' + r.n + "</span></span>" +
        "<div><h3>" + HA.t(r.stage) + "</h3><dl><dt>" + HA.t(cols[2]) + "</dt><dd>" + HA.t(r.req) + "</dd><dt>Техника и&nbsp;материалы</dt><dd>" + HA.t(r.tech) + "</dd></dl></div></li>";
    }).join("");

    /* ---------- CSV для Excel ---------- */
    HA.$("#csv-btn").addEventListener("click", function () {
      var lines = [cols.map(csvCell).join(";")].concat(rows.map(function (r) { return [r.n, r.stage, r.req, r.tech].map(csvCell).join(";"); }));
      var blob = new Blob(["\uFEFF" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = FILE;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
      HA.$("#csv-note").textContent = "Файл «" + FILE + "» скачивается (обычно в папку «Загрузки») и открывается в Excel двойным щелчком.";
    });

    /* ---------- печать только техкарты ---------- */
    HA.$("#print-btn").addEventListener("click", function () {
      document.documentElement.classList.add("print-techmap");
      var off = function () { document.documentElement.classList.remove("print-techmap"); window.removeEventListener("afterprint", off); };
      window.addEventListener("afterprint", off);
      setTimeout(function () { window.print(); setTimeout(off, 1000); }, 30);
    });
  };
})();
