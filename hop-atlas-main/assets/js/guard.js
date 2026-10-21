/* =====================================================================
   Атлас ХПП — «сторож»: подключается первым и запоминает ошибки загрузки
   файлов и ошибки в файле данных assets/data/atlas-data.js.
   Если файл данных не прочитался (например, пропущена запятая),
   main.js покажет вверху страницы понятную плашку с подсказкой.
===================================================================== */
(function () {
  "use strict";
  var errs = (window.__atlasErrors = []);
  window.addEventListener("error", function (e) {
    var t = e.target;
    // не загрузился файл скрипта (нет файла, неверное имя папки)
    if (t && t !== window && t.tagName === "SCRIPT") {
      errs.push({ kind: "load", src: t.getAttribute("src") || "" });
      return;
    }
    // синтаксическая ошибка в файле данных (по http видна строка; с диска браузер строку скрывает)
    if (e.filename && /atlas-data\.js/.test(e.filename)) errs.push({ kind: "data", line: e.lineno || 0, msg: e.message || "" });
  }, true);
})();
