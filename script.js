/* Koray Öner — kişisel sayfa · tema geçişi ve yıl */
(function () {
  "use strict";
  var KEY = "onerkoray.theme";
  var order = ["auto", "light", "dark"];
  var btn = document.getElementById("themeToggle");

  function apply(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    if (btn) {
      var label = btn.querySelector(".theme-toggle-label");
      if (label) label.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    }
  }

  apply(localStorage.getItem(KEY) || "auto");

  if (btn) {
    btn.addEventListener("click", function () {
      var current = localStorage.getItem(KEY) || "auto";
      var next = order[(order.indexOf(current) + 1) % order.length];
      localStorage.setItem(KEY, next);
      apply(next);
    });
  }

  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  /* Alt sayfalarda (breadcrumb'lı) header menüsüne "Araçlar" kısayolu ekle:
     kullanıcı araç listesine tek tıkla döner, önce ana sayfa tepesine gitmez. */
  (function () {
    var crumb = document.querySelector(".breadcrumb");
    var navList = document.querySelector(".site-nav ul");
    if (!crumb || !navList || navList.querySelector('a[href$="#projects"]')) return;
    var li = document.createElement("li");
    li.innerHTML = '<a href="/#projects">Araçlar</a>';
    var home = navList.querySelector("li"); // "Ana Sayfa" öğesinden sonra
    if (home && home.nextSibling) navList.insertBefore(li, home.nextSibling);
    else navList.appendChild(li);
  })();

  /* ---- Renk paleti seçici (header'a otomatik eklenir) ---- */
  var ACCENT_KEY = "onerkoray.accent";
  var ACCENTS = [
    ["yesil", "#0e7c66", "Yeşil"],
    ["mavi", "#2160b4", "Mavi"],
    ["camgobegi", "#0c7f93", "Camgöbeği"],
    ["turuncu", "#bb5714", "Turuncu"],
    ["gul", "#b0345c", "Gül"]
  ];
  function applyAccent(name) {
    if (name && name !== "yesil") document.documentElement.setAttribute("data-accent", name);
    else document.documentElement.removeAttribute("data-accent");
    document.querySelectorAll(".palette-pop button").forEach(function (b) {
      b.setAttribute("aria-pressed", String((b.getAttribute("data-accent") || "yesil") === (name || "yesil")));
    });
  }
  applyAccent(localStorage.getItem(ACCENT_KEY) || "yesil");

  /* Widget yoksa header'a enjekte et (tüm alt sayfalarda markup gerektirmez) */
  var headerInner = document.querySelector(".site-header .header-inner");
  if (headerInner && !headerInner.querySelector(".palette")) {
    var pal = document.createElement("div");
    pal.className = "palette";
    pal.innerHTML =
      '<button class="theme-toggle palette-toggle" type="button" aria-expanded="false" aria-label="Renk paleti seç">' +
      '<span class="palette-dot" aria-hidden="true"></span><span class="theme-toggle-label">Renk</span></button>' +
      '<div class="palette-pop" hidden>' +
      ACCENTS.map(function (a) {
        return '<button type="button" data-accent="' + a[0] + '" style="--sw:' + a[1] + '" aria-label="' + a[2] + ' tema"></button>';
      }).join("") +
      "</div>";
    var themeBtn = headerInner.querySelector("#themeToggle");
    headerInner.insertBefore(pal, themeBtn);
    applyAccent(localStorage.getItem(ACCENT_KEY) || "yesil");
  }

  var palToggle = document.querySelector(".palette-toggle");
  var palPop = document.querySelector(".palette-pop");
  if (palToggle && palPop) {
    palToggle.addEventListener("click", function () {
      var open = palPop.hidden;
      palPop.hidden = !open;
      palToggle.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", function (e) {
      if (!palPop.hidden && !e.target.closest(".palette")) {
        palPop.hidden = true;
        palToggle.setAttribute("aria-expanded", "false");
      }
    });
    palPop.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        var name = b.getAttribute("data-accent") || "yesil";
        localStorage.setItem(ACCENT_KEY, name);
        applyAccent(name);
      });
    });
  }

  /* ---- Araç dizini: arama + kategori filtresi (ana sayfa) ---- */
  var search = document.getElementById("tool-search-input");
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip[data-filter]"));
  var cards = Array.prototype.slice.call(document.querySelectorAll(".project-card[data-tags]"));
  if (cards.length && (search || chips.length)) {
    var activeCat = "hepsi";
    function applyFilter() {
      var q = search ? search.value.trim().toLocaleLowerCase("tr") : "";
      var visible = 0;
      cards.forEach(function (card) {
        var tags = (card.getAttribute("data-tags") || "").toLocaleLowerCase("tr");
        var cat = card.getAttribute("data-cat") || "";
        var okCat = activeCat === "hepsi" || cat === activeCat;
        var okText = !q || tags.indexOf(q) !== -1 || card.textContent.toLocaleLowerCase("tr").indexOf(q) !== -1;
        var show = okCat && okText;
        card.classList.toggle("is-hidden", !show);
        if (show) visible++;
      });
      var empty = document.getElementById("no-results");
      if (empty) empty.hidden = visible > 0;
    }
    if (search) search.addEventListener("input", applyFilter);
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        activeCat = chip.getAttribute("data-filter");
        chips.forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
        applyFilter();
      });
    });
  }

  /* ---- Jenerik rapor: hesap araçlarına otomatik rapor başlığı + yazdır düğmesi ---- */
  var calcWrap = document.querySelector(".calc .wrap");
  if (calcWrap && !document.getElementById("printBtn")) {
    var h1 = document.querySelector("h1");
    var icon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
    var head = document.createElement("div");
    head.className = "report-head";
    head.setAttribute("aria-hidden", "true");
    head.innerHTML = (icon ? '<img src="' + icon.getAttribute("href") + '" alt="">' : "") +
      '<div><div class="report-title">' + (h1 ? h1.textContent : document.title) + " — Rapor</div>" +
      '<div class="report-meta">' + location.host + location.pathname + ' · Rapor tarihi: <span id="report-date"></span></div></div>';
    calcWrap.insertBefore(head, calcWrap.firstChild);
    var inputsDiv = document.createElement("div");
    inputsDiv.className = "report-inputs";
    inputsDiv.id = "report-inputs";
    inputsDiv.setAttribute("aria-hidden", "true");
    calcWrap.insertBefore(inputsDiv, head.nextSibling);
    var bar = document.createElement("p");
    bar.className = "report-actions no-print";
    bar.innerHTML = '<button type="button" id="printBtn" class="btn btn-primary">🖨 Raporu yazdır / PDF kaydet</button>';
    calcWrap.appendChild(bar);
    var foot = document.createElement("div");
    foot.className = "report-foot";
    foot.setAttribute("aria-hidden", "true");
    foot.textContent = "Bu rapor " + location.host + location.pathname +
      " adresindeki ücretsiz araçla bilgilendirme amaçlı oluşturulmuştur. · © Koray Öner";
    calcWrap.appendChild(foot);
    if (typeof window.buildReportInputs !== "function") {
      window.buildReportInputs = function () {
        var esc = function (s) {
          return String(s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
          });
        };
        var parts = [];
        document.querySelectorAll(".calc input, .calc select").forEach(function (el) {
          if (el.type === "hidden" || el.closest("[hidden]") || !el.value) return;
          var lab = "";
          if (el.id) {
            var l = document.querySelector('label[for="' + el.id + '"]');
            if (l) lab = l.textContent.trim();
          }
          if (!lab && el.closest("label")) lab = el.closest("label").textContent.trim();
          if (el.type === "radio" || el.type === "checkbox") {
            if (!el.checked) return;
            parts.push("<strong>" + esc(lab || el.name || "Seçim") + "</strong>");
          } else {
            parts.push((lab ? "<strong>" + esc(lab) + ":</strong> " : "") + esc(el.value));
          }
        });
        inputsDiv.innerHTML = parts.join(" &nbsp;·&nbsp; ");
      };
    }
  }

  /* ---- Rapor yazdırma (araç sayfaları) ---- */
  var printBtn = document.getElementById("printBtn");
  if (printBtn) {
    printBtn.addEventListener("click", function () {
      var dateEl = document.getElementById("report-date");
      if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString("tr-TR", {
          day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
        });
      }
      if (typeof window.buildReportInputs === "function") window.buildReportInputs();
      window.print();
    });
  }

  /* Header'a kaydırma durumunda gölge ekle */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Scroll ile ortaya çıkma (reveal) animasyonu */
  var reveals = document.querySelectorAll(".reveal");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reveals.length) return;
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
  reveals.forEach(function (el) { io.observe(el); });
})();

/* ============================================================================
   Hareket katmanı
   ----------------------------------------------------------------------------
   Kaydırmada belirme ana sayfa dışında hiçbir sayfada yoktu. Burada sayfanın
   TÜRÜNE göre farklı bloklar seçiliyor; her yere aynı efekti uygulamak yazı
   sayfalarında okumayı bölüyordu.

     yazı sayfası  -> yalnızca görsel bloklar (figür, tablo, uyarı kutusu)
     yazı listesi  -> manşet, ayraç ve liste öğeleri (kademeli)
     diğer sayfa   -> hero dışındaki bölümler

   Sınıflar JS tarafından atanır: script çalışmazsa içerik gizlenmez.
   ========================================================================== */
(function () {
  "use strict";

  var azalt = window.matchMedia &&
              window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ana = document.querySelector("main");

  /* ---- 1) Kaydırmada belirme ---- */
  (function () {
    if (azalt || !ana || !("IntersectionObserver" in window)) return;
    // Ana sayfada markup'ta yazılı .reveal düzeni var; ona karışma.
    if (document.querySelector(".reveal")) return;

    var hedefler = [];
    function topla(secici, kok) {
      var l = (kok || ana).querySelectorAll(secici);
      for (var i = 0; i < l.length; i++) {
        if (hedefler.indexOf(l[i]) < 0) hedefler.push(l[i]);
      }
    }

    if (ana.querySelector(".ed-body")) {
      // Yazı sayfası: metin akışına dokunma, yalnızca görsel bloklar.
      topla(".ed-figure, .ed-body > figure, .ed-body > table," +
            " .ed-body > .table-scroll, .ed-body > .legal-note");
    } else if (ana.querySelector(".ed-list, .ed-lead")) {
      // Yazı listesi
      topla(".ed-lead, .ed-rule, .ed-item");
    } else {
      // Araç ve kurumsal sayfalar: hero hariç bölümler
      var bolumler = ana.children;
      for (var i = 0; i < bolumler.length; i++) {
        var b = bolumler[i];
        if (b.tagName !== "SECTION") continue;
        if (b.classList.contains("hero")) continue;
        hedefler.push(b);
      }
    }
    if (!hedefler.length) return;

    document.documentElement.classList.add("js-hrk");

    var yukseklik = window.innerHeight || 800;
    hedefler.forEach(function (el) {
      // Zaten ekranda olan blok gizlenmez: yoksa açılışta görünen içerik
      // önce kaybolup sonra beliriyor — göze çarpan bir titreme.
      if (el.getBoundingClientRect().top < yukseklik * 0.92) return;
      // Kademe sayacı ebeveynin ÜZERİNDE tutulur; düz nesnede DOM düğümünü
      // anahtar yapmak hepsini "[object HTMLElement]" anahtarına çökertiyor
      // ve kademe kardeşler arası değil, sayfa geneli sayaca dönüşüyordu.
      var ebeveyn = el.parentNode;
      var sira = ebeveyn.__hrkSira || 0;
      ebeveyn.__hrkSira = sira + 1;
      if (sira) el.style.setProperty("--hrk-gecikme", Math.min(sira, 4) * 80 + "ms");
      el.classList.add("hrk");
    });

    var gizli = ana.querySelectorAll(".hrk");
    if (!gizli.length) return;

    var io = new IntersectionObserver(function (girisler) {
      girisler.forEach(function (g) {
        if (!g.isIntersecting) return;
        g.target.classList.add("gorunur");
        io.unobserve(g.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });

    for (var j = 0; j < gizli.length; j++) io.observe(gizli[j]);

    // Emniyet: gözlemci hiç tetiklenmezse içerik gizli kalmasın.
    setTimeout(function () {
      var kalan = document.querySelectorAll(".hrk:not(.gorunur)");
      for (var k = 0; k < kalan.length; k++) kalan[k].classList.add("gorunur");
    }, 3000);
  })();

  /* ---- 2) Okuma ilerlemesi (yalnızca yazı sayfaları) ---- */
  (function () {
    var govde = document.querySelector(".ed-body");
    var baslik = document.querySelector(".site-header");
    if (!govde || !baslik) return;

    var cubuk = document.createElement("div");
    cubuk.className = "okuma-cubugu";
    cubuk.setAttribute("aria-hidden", "true");
    baslik.appendChild(cubuk);

    var bekliyor = false;
    function guncelle() {
      bekliyor = false;
      var r = govde.getBoundingClientRect();
      var yol = r.height - window.innerHeight;
      var p = yol <= 0
        ? (r.bottom <= window.innerHeight ? 1 : 0)
        : (-r.top) / yol;
      cubuk.style.transform = "scaleX(" + Math.max(0, Math.min(1, p)) + ")";
    }
    function iste() {
      if (bekliyor) return;
      bekliyor = true;
      requestAnimationFrame(guncelle);
    }
    window.addEventListener("scroll", iste, { passive: true });
    window.addEventListener("resize", iste, { passive: true });
    guncelle();
  })();
})();

/* ============================================================================
   Sonuç nabzı — çıktı değiştiğinde görsel geri bildirim
   ----------------------------------------------------------------------------
   Araçlar anlık hesaplıyor; girdiyi değiştirince sonuç sessizce yer
   değiştiriyordu. Kısa bir halka, çıktının YENİLENDİĞİNİ gösteriyor.

   Metne dokunulmuyor: <output> öğeleri aria-live bölgesi, içeriği oynatmak
   ekran okuyucuya her ara değeri okuturdu. Buradaki hareket tamamen görsel.
   ========================================================================== */
(function () {
  "use strict";
  if (!("MutationObserver" in window)) return;
  var azalt = window.matchMedia &&
              window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (azalt) return;

  var ciktilar = document.querySelectorAll("output, .result");
  if (!ciktilar.length) return;

  // Açılıştaki ilk hesap nabız saymasın: her sayfa yüklenişinde yanıp
  // sönmek geri bildirim değil, gürültü olurdu.
  var hazir = false;
  setTimeout(function () { hazir = true; }, 700);

  ciktilar.forEach(function (el) {
    var sonSefer = 0;
    var gozlemci = new MutationObserver(function () {
      if (!hazir) return;
      var simdi = Date.now();
      if (simdi - sonSefer < 220) return;   // hızlı yazımda spam olmasın
      sonSefer = simdi;
      el.classList.remove("sonuc-nabiz");
      void el.offsetWidth;                  // animasyonu yeniden başlat
      el.classList.add("sonuc-nabiz");
    });
    gozlemci.observe(el, { childList: true, characterData: true, subtree: true });
    el.addEventListener("animationend", function () {
      el.classList.remove("sonuc-nabiz");
    });
  });
})();
