/* =====================================================================
   Атлас ХПП — общие утилиты, производные величины и палитра.
   Все модули сайта — обычные скрипты (без import/export), чтобы сайт
   открывался и с диска двойным щелчком по index.html (file://).
   Общее пространство имён — window.HA.
===================================================================== */
(function () {
  "use strict";
  var HA = (window.HA = window.HA || {});
  var DATA = window.ATLAS_DATA;
  var NB = "\u00A0";
  HA.NB = NB;

  /* ---------- Движение: учитываем настройку «уменьшить движение» ---------- */
  var mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  HA.reduced = function () { return !!(mq && mq.matches); };
  HA.onReducedChange = function (fn) {
    if (!mq) return;
    if (mq.addEventListener) mq.addEventListener("change", fn);
    else if (mq.addListener) mq.addListener(fn);
  };

  /* ---------- Числа по-русски (форматтеры кешируются: fmt зовётся в каждом кадре) ---------- */
  var NF = {};
  function nf(d) {
    return NF[d] || (NF[d] = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d }));
  }
  HA.fmt = function (n, d) {
    d = d || 0;
    if (n == null || !isFinite(n)) return "—";
    return nf(d).format(Number(n)).replace(/[\s\u00A0\u202F]/g, NB).replace("-", "−");
  };
  /* сколько знаков после запятой нужно, чтобы показать число без потерь (не больше maxD) */
  HA.decimals = function (n, maxD) {
    var d = 0;
    while (d < maxD && Math.abs(Math.round(n * Math.pow(10, d)) - n * Math.pow(10, d)) > 1e-7) d++;
    return d;
  };
  /* автоматическое число знаков: 55,7 · 274 · 8,52 */
  HA.fmtAuto = function (n, maxD) {
    maxD = maxD == null ? 2 : maxD;
    if (n == null || !isFinite(n)) return "—";
    return HA.fmt(n, HA.decimals(n, maxD));
  };
  /* число без скрытого округления: если до maxD знаков не помещается — со знаком «≈» */
  HA.fmtExact = function (n, maxD) {
    maxD = maxD == null ? 2 : maxD;
    if (n == null || !isFinite(n)) return "—";
    return HA.decimals(n, maxD + 1) > maxD ? "≈" + NB + HA.fmt(n, maxD) : HA.fmt(n, HA.decimals(n, maxD));
  };
  HA.fmtT = function (n) { return HA.fmt(n) + NB + "т"; };
  HA.plural = function (n, forms) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  };
  HA.roman = function (n) {
    return ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII"][n] || String(n);
  };
  /* единица измерения прямым PT Serif: в курсиве кириллическая «т» похожа на латинскую «m» */
  HA.u = function (unit) { return '<span class="u">' + HA.esc(unit).replace(/ /g, NB) + "</span>"; };

  /* ---------- Русская типографика ----------
     неразрывный пробел перед единицами, «%» и тире, после однобуквенных
     предлогов и союзов; «тыс. тонн», «млн долл. США» не разрываются. */
  var UNIT = "(?:т(?![а-яё])|т\\/|тонн|тыс\\.|млн|млрд|га(?![а-яё])|см(?![а-яё])|м(?![а-яё])|°|раз|гг?\\.(?![а-яё])|год(?:а|у|ы|ов|ам)?(?![а-яё])|%)";
  var reUnit = new RegExp("(\\d)[ \\u00A0]?(?=%)|(\\d)[ \\u00A0](?=" + UNIT + ")", "gi");
  function typoText(s) {
    var out = String(s)
      .replace(reUnit, function (m, a, b) { return (a || b) + NB; })
      .replace(/(тыс\.|млн|млрд|долл\.|руб\.)[ \u00A0](?=[а-яёА-ЯЁ])/g, "$1" + NB)
      .replace(/ —/g, NB + "—")
      .replace(/№ /g, "№" + NB)
      .replace(/(\d)-(\d)/g, "$1–$2");
    /* дважды — чтобы схватить цепочки вроде «и в» */
    for (var k = 0; k < 2; k++) {
      out = out.replace(/(^|[\s(«„\u00A0])([вВиИсСкКоОуУаАяЯ]|до|на|по|от|за|из|не|без|под|над|для|при) /g, "$1$2" + NB);
    }
    return out;
  }
  var reHyph = /(^|[^0-9A-Za-zА-Яа-яЁё-])((?:[0-9A-Za-zА-Яа-яЁё]{1,3}-[0-9A-Za-zА-Яа-яЁё]+|[0-9A-Za-zА-Яа-яЁё]+-[0-9A-Za-zА-Яа-яЁё]{1,3}))(?![0-9A-Za-zА-Яа-яЁё-])/g;
  HA.typo = function (s) {
    if (s == null) return "";
    /* слова через дефис с короткой частью («ИТ-решений», «Топ-6») не переносим по дефису */
    return typoText(s).replace(reHyph, '$1<span class="nw">$2</span>');
  };
  HA.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  HA.t = function (s) { return HA.typo(HA.esc(s)); };
  /* та же типографика для готовой разметки — проход по текстовым узлам
     (статический текст index.html и строки, собранные в модулях) */
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, TITLE: 1 };
  HA.typoDOM = function (root) {
    if (!root || !document.createTreeWalker) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n, list = [];
    while ((n = w.nextNode())) {
      if (n.parentNode && !SKIP[n.parentNode.nodeName] && /[ \u00A0—№-]/.test(n.nodeValue)) list.push(n);
    }
    list.forEach(function (t) {
      var v = t.nodeValue, nv = typoText(v);
      if (nv !== v) t.nodeValue = nv;
      // тире в начале узла, а пробел перед ним — в конце предыдущего: делаем его неразрывным
      if (/^—/.test(nv)) {
        var p = t.previousSibling;
        while (p && p.nodeType === 1 && p.lastChild) p = p.lastChild;
        if (p && p.nodeType === 3 && / $/.test(p.nodeValue)) p.nodeValue = p.nodeValue.replace(/ $/, NB);
      }
    });
  };

  /* ---------- DOM ---------- */
  HA.$ = function (s, r) { return (r || document).querySelector(s); };
  HA.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  HA.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  HA.lerp = function (a, b, t) { return a + (b - a) * t; };
  HA.easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  HA.easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  /* детерминированный генератор (тот же алгоритм, что d3.randomLcg) — для текстур бумаги и акварели */
  HA.lcg = function (seed) {
    var eps = 1 / 0x100000000;
    var state = (0 <= seed && seed < 1 ? seed / eps : Math.abs(seed)) | 0;
    return function () { state = (Math.imul(0x19660D, state) + 0x3C6EF35F) | 0; return eps * (state >>> 0); };
  };
  HA.range = function (n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; };

  /* голосовые объявления для экранного диктора */
  var liveTimer = 0;
  HA.announce = function (msg) {
    var el = document.getElementById("live");
    if (!el) return;
    clearTimeout(liveTimer);
    el.textContent = "";
    liveTimer = setTimeout(function () { el.textContent = msg; }, 60);
  };

  /* прокрутка к элементу с учётом липкой шапки */
  HA.scrollToEl = function (el, extra) {
    if (!el) return;
    var head = document.querySelector(".masthead");
    var off = (head ? head.offsetHeight : 64) + (extra == null ? 12 : extra);
    var y = el.getBoundingClientRect().top + window.pageYOffset - off;
    window.scrollTo({ top: Math.max(0, y), behavior: HA.reduced() ? "auto" : "smooth" });
  };

  /* ---------- Палитра (зеркало CSS-токенов для canvas) ---------- */
  HA.C = {
    paper: "#F4ECD9", paper2: "#ECE1C8", paper3: "#E3D5B6", card: "#FAF5E8",
    ink: "#33281D", ink2: "#5A4A38", ink3: "#6E5C46",
    inkA: function (a) { return "rgba(51,40,29," + a + ")"; },
    paperA: function (a) { return "rgba(244,236,217," + a + ")"; },
    hop: "#56742A", hopInk: "#465F21", hopWash: "#B9C67F", hopPale: "#DFE3B8",
    sage: "#CBD39B", sageEdge: "#8F9F55",
    verm: "#A8402A", vermInk: "#93361F",
    ochre: "#C8953F", ochreInk: "#85591A",
    sea: ["#E8EDE1", "#D3DED5", "#BCCDC6", "#A7BDB6"],
    land: ["#EAD7AC", "#E8D0B0", "#E2D6A9"],
    landEdge: ["#C9A65F", "#C7A27E", "#BBA866"],
    vine: "#5C7A2B", leaf: "#9DB35A", leafLight: "#C5D189",
    cone: "#CFD47E", coneLight: "#E7E6AE", coneDark: "#A7B552",
    onDark: "#FBF6EA"
  };

  /* ---------- Производные величины (считаются из данных) ----------
     Если файл данных не загрузился (например, в нём пропущена запятая),
     HA.D не создаётся — main.js покажет понятное сообщение об ошибке. */
  if (!DATA || !DATA.regions || !DATA.regions.length) { HA.D = null; return; }
  var regions = DATA.regions.map(function (r, i) { return Object.assign({}, r, { i: i }); });
  var ranked = regions.slice().sort(function (a, b) { return b.t - a.t; });
  ranked.forEach(function (r, k) { r.rank = k + 1; });
  var byId = {};
  regions.forEach(function (r) { byId[r.id] = r; });
  var total = regions.reduce(function (s, r) { return s + r.t; }, 0);
  var max = ranked[0].t;
  /* европейские регионы (без России): для «ряда шпалер» и шага облёта */
  var EU_COUNTRIES = ["Германия", "Чехия", "Польша", "Словения", "Франция", "Великобритания", "Австрия", "Бельгия", "Нидерланды", "Испания", "Португалия", "Италия", "Швейцария", "Словакия", "Венгрия", "Хорватия", "Сербия", "Румыния", "Болгария", "Дания", "Ирландия"];
  var europe = ranked.filter(function (r) { return EU_COUNTRIES.indexOf(r.country) >= 0; });
  var europeSum = europe.reduce(function (s, r) { return s + r.t; }, 0);
  var featureByRegion = {};
  (DATA.features || []).forEach(function (f) { featureByRegion[f.region] = f; });
  var isoSet = {};
  regions.forEach(function (r) { isoSet[r.iso] = true; });

  HA.D = {
    meta: DATA.meta,
    regions: regions,          // в порядке источника
    ranked: ranked,            // по убыванию объёма
    byId: byId,
    total: total,
    max: max,
    europe: europe,
    europeIds: europe.map(function (r) { return r.id; }),
    europeSum: europeSum,
    feature: function (id) { return featureByRegion[id] || null; },
    atlasIso: isoSet,
    count: regions.length
  };
})();
