/* =====================================================================
   Лист VI · Калькулятор ёмкости рынка — помещается в один экран.
   Формула (как в НИР): Площадь × Урожайность × Цена × Зональный коэффициент.
   Слева: округ (первым, его не надо искать прокруткой), затем три поля;
   у каждого поле ввода и ползунок в одной строке, они синхронны.
   Справа: крупный результат и одна строка формулы — подставленные числа,
   под каждым подписано, что это (так формула записана один раз).
   Диапазоны ползунков — интерфейсные (для удобства), в поле можно
   ввести любое неотрицательное число.
   Скрытых округлений нет: поле, формула и результат показывают одно
   и то же число; если число приходится округлить для показа, перед ним
   стоит «≈».
===================================================================== */
(function () {
  "use strict";
  var HA = window.HA, DATA = window.ATLAS_DATA, NB = HA.NB;
  var WARN = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 1.6 15 14H1Z" fill="#A8402A"/><path d="M8 6v4" stroke="#FBF6EA" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="12" r=".95" fill="#FBF6EA"/></svg>';
  var LIMIT = 1e15;      // больше — уже не «число для расчёта»: точность JavaScript заканчивается
  var IN_DEC = 6;        // в поле — до 6 знаков после запятой без округления

  /* «1,55», «1.55», «1 550,5» → число; пусто или мусор → NaN */
  function parseNum(s) {
    s = String(s).replace(/[\s\u00A0\u202F]/g, "").replace(",", ".");
    if (s === "" || !/^\d*\.?\d+$|^\d+\.$/.test(s)) return NaN;
    return parseFloat(s);
  }
  /* число для поля ввода: столько знаков, сколько есть (до 6), разряды — обычным пробелом */
  function plain(v) { return HA.fmtAuto(v, IN_DEC).replace(/\u00A0/g, " "); }
  /* число для формулы и результата: точно, а если нужно округлить — со знаком «≈» */
  function exact(v, d) {
    var s = HA.fmtExact(v, d == null ? IN_DEC : d);
    // за пределами 2^53 последние цифры у компьютера уже неточные — честно ставим «≈»
    return Math.abs(v) > 9007199254740991 && s.charAt(0) !== "≈" ? "≈" + NB + s : s;
  }

  HA.initCalc = function () {
    var form = HA.$("#calc");
    if (!form) return;
    var CFG = DATA.calculator;
    HA.$("#calc-text").innerHTML = HA.t(CFG.text);
    var fields = [
      { id: "area", label: "Площадь хмельников", unit: "га", def: CFG.defaults.area, ui: CFG.ui.area },
      { id: "yield", label: "Урожайность", unit: "т/га", def: CFG.defaults.yield, ui: CFG.ui.yield },
      { id: "price", label: "Средняя цена", unit: "тыс. руб./т", def: CFG.defaults.price, ui: CFG.ui.price }
    ];
    var html = '<div class="calc__fields">';
    // округ — первым: от него зависит коэффициент
    html += '<fieldset class="zones"><legend id="zones-l">Федеральный округ</legend><div class="seg" role="radiogroup" aria-labelledby="zones-l">';
    CFG.zones.forEach(function (z) {
      var on = z.id === CFG.defaults.zone;
      html += '<button type="button" role="radio" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-zone="' + z.id + '">' + HA.t(z.short) + "<small>×" + HA.fmt(z.k, 1) + "</small></button>";
    });
    html += "</div></fieldset>";
    fields.forEach(function (f) {
      html += '<div class="field" id="f-' + f.id + '">' +
        '<label class="field__lbl" for="in-' + f.id + '">' + HA.t(f.label) + ", " + HA.t(f.unit) + "</label>" +
        '<div class="field__row">' +
        '<div class="field__in"><input id="in-' + f.id + '" name="' + f.id + '" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="' + plain(f.def) + '" aria-describedby="err-' + f.id + " out-" + f.id + '"></div>' +
        '<div class="range" style="--p:0%">' +
        '<input type="range" id="rg-' + f.id + '" name="' + f.id + '-range" min="' + f.ui.min + '" max="' + f.ui.max + '" step="' + f.ui.step + '" value="' + f.def + '" aria-label="' + HA.esc(f.label) + ', ползунок">' +
        '<span class="range__bubble" aria-hidden="true"></span></div></div>' +
        '<p class="field__out" id="out-' + f.id + '"><svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 1.5 8 5 2 8.5Z" fill="currentColor"/></svg>больше шкалы ползунка&nbsp;— в&nbsp;расчёте число из&nbsp;поля</p>' +
        '<p class="field__err" id="err-' + f.id + '" aria-live="polite">' + WARN + "<span>Введите неотрицательное число</span></p></div>";
    });
    html += "</div>";
    html += '<div class="calc__result" id="calc-result" aria-labelledby="res-l">' +
      '<p class="calc__lbl" id="res-l">' + HA.t(CFG.resultLabel) + "</p>" +
      '<p class="calc__big"><span id="res-v">—</span><span class="u">тыс.&nbsp;руб.</span></p>' +
      '<p class="calc__alt" id="res-alt"></p>' +
      '<div class="formula" id="formula" aria-label="Формула с подставленными числами"></div>' +
      '<p class="calc__note">Диапазоны ползунков&nbsp;— для удобства: в&nbsp;поле можно ввести любое неотрицательное число.</p></div>';
    form.innerHTML = html;

    var state = { area: CFG.defaults.area, yield: CFG.defaults.yield, price: CFG.defaults.price, zone: CFG.defaults.zone };
    var zoneOf = function (id) { return CFG.zones.filter(function (z) { return z.id === id; })[0]; };
    var big = HA.$(".calc__big", form), resEl = HA.$("#res-v");

    function setRange(f, v) {
      var rg = HA.$("#rg-" + f.id), box = rg.parentNode;
      var cl = Math.min(f.ui.max, Math.max(f.ui.min, isFinite(v) ? v : f.ui.min));
      rg.value = cl;
      var p = ((cl - f.ui.min) / (f.ui.max - f.ui.min)) * 100;
      box.style.setProperty("--p", p.toFixed(2) + "%");
      HA.$(".range__bubble", box).textContent = HA.fmtAuto(+rg.value, 2) + NB + f.unit.replace(/ /g, NB);
      HA.$("#f-" + f.id).classList.toggle("is-out", isFinite(v) && v > f.ui.max);
    }
    /* крупный результат: до 2 знаков после запятой; если пришлось округлить — «≈» */
    function bigText(v) { return exact(v, 2); }
    var animT = 0, shown = null;
    function showResult(v) {
      big.classList.toggle("is-long", v != null && bigText(v).length > 13);
      big.classList.toggle("is-huge", v != null && bigText(v).length > 22);
      if (v == null) { cancelAnimationFrame(animT); resEl.textContent = "—"; shown = null; return; }
      var from = shown == null ? v : shown;
      shown = v;
      if (HA.reduced() || from === v || !isFinite(from) || Math.abs(v) > 1e12) { cancelAnimationFrame(animT); resEl.textContent = bigText(v); return; }
      cancelAnimationFrame(animT);
      var t0 = performance.now();
      var step = function (now) {
        var u = Math.min(1, (now - t0) / 400), e = 1 - Math.pow(1 - u, 3);
        resEl.textContent = u >= 1 ? bigText(v) : HA.fmt(from + (v - from) * e, 0);
        if (u < 1) animT = requestAnimationFrame(step);
      };
      animT = requestAnimationFrame(step);
    }
    /* итог для экранного диктора — один раз, когда человек перестал менять поля */
    var sayT = 0, said = "";
    function say(v) {
      clearTimeout(sayT);
      sayT = setTimeout(function () {
        var msg = v == null ? "Расчёт недоступен: исправьте поле с ошибкой." : "Ёмкость рынка: " + bigText(v) + " тысяч рублей.";
        if (msg !== said) { said = msg; HA.announce(msg); }
      }, 600);
    }
    function compute(changed) {
      var ok = fields.every(function (f) { return isFinite(state[f.id]) && state[f.id] >= 0 && state[f.id] <= LIMIT; });
      var z = zoneOf(state.zone);
      var fx = function (k, val, unit, cap) {
        return '<span class="f' + (changed === k ? " flash" : "") + '" data-k="' + k + '"><b>' + val + (unit ? '<span class="u">' + unit + "</span>" : "") + "</b><small>" + cap + "</small></span>";
      };
      var show = function (f) { var v = state[f.id]; return isFinite(v) && v >= 0 && v <= LIMIT ? exact(v) : "?"; };
      var res = ok ? state.area * state.yield * state.price * z.k : null;
      if (res != null && !isFinite(res)) res = null;
      // одна строка: числа, под каждым — что это; так формула НИР записана один раз
      HA.$("#formula").innerHTML = '<span class="op"></span>' +
        fx("area", show(fields[0]), "га", "площадь") + '<span class="op">×</span>' +
        fx("yield", show(fields[1]), "т/га", "урожайность") + '<span class="op">×</span>' +
        fx("price", show(fields[2]), "тыс.&nbsp;руб./т", "цена") + '<span class="op">×</span>' +
        fx("zone", HA.fmt(z.k, 1), "", "зональный коэффициент") +
        '<span class="op">=</span><span class="f eq"><b>' + (res == null ? "—" : bigText(res)) + '<span class="u">тыс.&nbsp;руб.</span></b><small>ёмкость рынка</small></span>';
      if (res != null) {
        HA.$("#res-alt").innerHTML = res < 10 ? "" : exact(res / 1000, 2).replace(/^(?!≈)/, "=" + NB) + NB + "млн&nbsp;руб.";
      } else {
        var tooBig = fields.some(function (f) { return state[f.id] > LIMIT; }) || (ok && res == null);
        HA.$("#res-alt").innerHTML = tooBig ? "Число слишком большое для расчёта&nbsp;— уменьшите значение в&nbsp;поле с&nbsp;красной рамкой." : "Исправьте поле с&nbsp;красной рамкой&nbsp;— и&nbsp;расчёт появится.";
      }
      showResult(res);
      if (changed) say(res);
      if (changed) setTimeout(function () { var el = HA.$('#formula [data-k="' + changed + '"]'); if (el) el.classList.remove("flash"); }, 600);
    }

    fields.forEach(function (f) {
      var inp = HA.$("#in-" + f.id), rg = HA.$("#rg-" + f.id), wrap = HA.$("#f-" + f.id), err = HA.$("#err-" + f.id + " span");
      setRange(f, state[f.id]);
      inp.addEventListener("input", function () {
        var v = parseNum(inp.value);
        var tooBig = /^\s*[\d\s\u00A0]+([.,]\d*)?\s*$/.test(inp.value) && (!isFinite(v) || v > LIMIT);
        var bad = !isFinite(v) || v < 0 || v > LIMIT;
        wrap.classList.toggle("is-err", bad);
        inp.setAttribute("aria-invalid", String(bad));
        err.textContent = tooBig ? "Слишком большое число: введите не больше " + HA.fmt(LIMIT) : "Введите неотрицательное число";
        state[f.id] = bad ? (tooBig ? Infinity : NaN) : v;
        if (!bad) setRange(f, v);
        compute(f.id);
      });
      // ушли из поля — показываем то же число, что в расчёте (без округления до шага ползунка)
      inp.addEventListener("blur", function () {
        var v = state[f.id];
        if (isFinite(v) && v >= 0 && HA.decimals(v, IN_DEC + 1) <= IN_DEC) inp.value = plain(v);
      });
      rg.addEventListener("input", function () {
        var v = +rg.value;
        state[f.id] = v;
        inp.value = plain(v);
        wrap.classList.remove("is-err");
        inp.setAttribute("aria-invalid", "false");
        setRange(f, v);
        compute(f.id);
      });
      var box = rg.parentNode;
      rg.addEventListener("pointerdown", function () { box.classList.add("is-drag"); });
      window.addEventListener("pointerup", function () { box.classList.remove("is-drag"); });
    });

    var zbtns = HA.$$("[data-zone]", form);
    function setZone(id, focus) {
      state.zone = id;
      zbtns.forEach(function (b) {
        var on = b.getAttribute("data-zone") === id;
        b.setAttribute("aria-checked", String(on));
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      compute("zone");
    }
    zbtns.forEach(function (b, i) {
      b.addEventListener("click", function () { setZone(b.getAttribute("data-zone")); });
      b.addEventListener("keydown", function (e) {
        var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        var j = (i + d + zbtns.length) % zbtns.length;
        setZone(zbtns[j].getAttribute("data-zone"), true);
      });
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    compute(null);
  };
})();
