/* SGK idari para cezası — sayfa katmanı.
   Hesap yapmaz: formu okur, SgkCeza çekirdeğine (hesap.js) verir, sonucu
   yazar. Girdiler paylaşılabilsin diye adreste yalnız # ile durur (durum.js). */
(function () {
  "use strict";
  var C = window.SgkCeza, D = window.Durum;
  var form = document.getElementById("pc-form");
  if (!C || !form) return;

  function $(id) { return document.getElementById(id); }
  var nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function tl(v) { return nf.format(v) + " TL"; }
  function tl2(v) { return nf2.format(v).replace(/,00$/, "") + " TL"; }
  function sayi(el) {
    var s = String(el.value).trim().replace(/[\s.]/g, "");
    return /^\d+$/.test(s) ? +s : NaN;
  }
  function tutar(el) {
    var s = String(el.value).trim().replace(/\s/g, "").replace(/TL$/i, "");
    if (!s) return 0;
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  var AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function trTarih(s) { return +s.slice(8) + " " + AY[+s.slice(5, 7) - 1] + " " + s.slice(0, 4); }

  /* Adresteki durum: kısa anahtar → alan. */
  var ALAN = { f: "c-fiil", g: "c-giris", v: "c-verilme", n: "c-sig", d: "c-defter", a: "c-aysay", ga: "c-gay", gb: "c-gbordro",
    e: "c-eksik", p: "c-toplam", o: "c-onceki", t: "c-tarih", k: "c-kend", sg: "c-songun", vt: "c-verilis", tt: "c-teblig" };
  function yukle() {
    if (!D) return;
    var q = D.oku();
    Object.keys(ALAN).forEach(function (k) {
      var v = q.get(k), el = $(ALAN[k]);
      if (v === null || !el) return;
      if (el.tagName === "SELECT" && !el.querySelector('option[value="' + v.replace(/"/g, "") + '"]')) return;
      el.value = v;
    });
    if (q.get("y") === "1") $("c-yalniz").checked = true;
    if (q.get("sg") || q.get("tt")) $("c-tarihler").open = true;
  }
  function kaydet(gor) {
    if (!D) return;
    var q = new URLSearchParams();
    Object.keys(ALAN).forEach(function (k) {
      var el = $(ALAN[k]), kap = el.closest("[data-alan]");
      if (kap && kap.hidden) return;
      if (el.value !== "" && !(k === "o" && el.value === "0")) q.set(k, el.value);
    });
    if (gor.muafiyet && $("c-yalniz").checked) q.set("y", "1");
    D.yaz(q);
  }

  var ETIKET = {
    sig: { kayitDisi: "Kayıt dışı çalıştırılan işçi", meslekKodu: "Meslek kodu yanlış bildirilen sigortalı", gio: "Bildirimi yapılmayan sigortalı", mphbTespit: "Bildirilmeyen sigortalı" },
    ay: { kayitDisi: "Kayıt dışı geçen ay sayısı" },
    tarih: { kayitDisi: "İşe başladığı ay" }
  };
  function alanlar() {
    var fiil = $("c-fiil").value, f = C.FIILLER[fiil];
    var tespit = f.tespitli && $("c-giris").value !== "gec";
    var goster = {
      giris: !!f.tespitli, verilme: !!f.verilme, sigortali: !!f.sigortali, defter: !!f.defter, aySayisi: !!f.aySayisi,
      gecersiz: !!f.gecersiz, muafiyet: !!f.muafiyet, pek: !!f.pek || (!!f.muafiyet && $("c-yalniz").checked),
      onceki: !!f.onceki, kendiliginden: !!f.ceyrek && !tespit, verilisTarihi: !!f.ceyrek && !tespit
    };
    document.querySelectorAll("[data-alan]").forEach(function (x) { x.hidden = !goster[x.getAttribute("data-alan")]; });
    $("c-tarihler").hidden = !!f.birlesik;
    $("c-sig-etiket").textContent = ETIKET.sig[fiil] || "Sigortalı sayısı";
    $("c-aysay-etiket").textContent = ETIKET.ay[fiil] || "Eksik işçiliğin mal edildiği ay sayısı";
    $("c-tarih-etiket").textContent = ETIKET.tarih[fiil] || "Fiilin işlendiği ay";
    $("c-tarih-not").textContent = f.birlesik ? "İşe giriş cezası bu ayın, her dönemin beyanname cezası izleyen ayın asgari ücretiyle hesaplanır." :
      "Ceza o aydaki brüt asgari ücretten hesaplanır: bildirimin yasal süresinin bittiği ay.";
    /* Bölüm numaraları görünen bölümleri sayar. */
    $("c-tarihler-no").textContent = goster.kendiliginden ? "3" : "2";
    return goster;
  }

  function girdi(gor) {
    var t = $("c-tarih").value;
    if (!/^\d{4}-\d{2}$/.test(t)) throw new Error("Fiilin işlendiği ayı seçin.");
    var g = {
      fiil: $("c-fiil").value, iseGiris: $("c-giris").value, defter: $("c-defter").value, verilme: $("c-verilme").value,
      sigortali: gor.sigortali ? sayi($("c-sig")) : 0, aySayisi: gor.aySayisi ? sayi($("c-aysay")) : 0,
      yil: +t.slice(0, 4), ay: +t.slice(5, 7), kendiliginden30: $("c-kend").value === "evet"
    };
    if (gor.onceki) g.onceki = tutar($("c-onceki"));
    if (gor.gecersiz) { g.gecersizAy = sayi($("c-gay")) || 0; g.gecersizBordro = sayi($("c-gbordro")) || 0; }
    if (gor.pek) { g.eksikPek = tutar($("c-eksik")); g.toplamPek = tutar($("c-toplam")); g.yalnizKazanc = true; }
    return g;
  }

  /* Tarihler girildiyse: fiil ayı yasal son günden, 30 gün şartı verilişten. */
  function sureOku(gor) {
    var sg = $("c-songun").value, kend = $("c-kend"), ay = $("c-tarih");
    ay.disabled = false; kend.disabled = false;
    if (!sg || $("c-tarihler").hidden) return null;
    var s = C.sureler({ sonGun: sg, verilis: gor.verilisTarihi ? $("c-verilis").value : "", teblig: $("c-teblig").value });
    ay.value = sg.slice(0, 7); ay.disabled = true;
    if (s.verilis && !s.zamaninda) { kend.value = s.kendiliginden30 ? "evet" : "hayir"; kend.disabled = true; }
    return s;
  }

  var son = null;
  function hesapla() {
    var gor = alanlar();
    var hata = $("c-hata"), kutu = $("pc-sonuc"), g, h, yollar, s;
    try { s = sureOku(gor); g = girdi(gor); h = C.hesapla(g); yollar = C.yollar(g); }
    catch (e) { hata.textContent = e.message; kutu.classList.add("pc-bayat"); son = null; return; }
    hata.textContent = ""; kutu.classList.remove("pc-bayat");
    kaydet(gor);
    var surede = s && s.verilis && s.zamaninda;
    son = { h: h, s: s };

    var rozet = $("o-rozet");
    if (surede) { rozet.textContent = "Süresinde verildi"; rozet.className = "pc-rozet pc-iyi"; }
    else if (h.muafiyet && h.muafiyet.uygun) { rozet.textContent = "15 günde düzeltilirse ceza yok"; rozet.className = "pc-rozet pc-iyi"; }
    else if (h.ceyrek) { rozet.textContent = "İki indirim birlikte"; rozet.className = "pc-rozet pc-iyi"; }
    else if (h.ceyrekUygun) { rozet.textContent = "30 gün geçti"; rozet.className = "pc-rozet pc-kotu"; }
    else { rozet.textContent = ""; rozet.className = "pc-rozet"; }

    var muaf = h.muafiyet && h.muafiyet.uygun;
    $("pc-cevap-bas").textContent = muaf ? "Eksiklik 15 gün içinde düzeltilirse" : "Tebliğden sonra 15 gün içinde öderseniz";
    $("o-pesin").textContent = surede || muaf ? "0 TL" : tl(h.pesin);
    /* Oran kanundaki oran: peşin %25, iki indirim birlikte %81,25. Tutarlardan
       bölmek kuruş atma yüzünden %25,01 gibi sahte bir oran verir. */
    $("o-alt").textContent = surede ? "Bildirge yasal süresi içinde verildiği için ceza doğmaz." :
      muaf ? "Düzeltilmezse tebliğ edilecek ceza " + tl(h.teblig) + "; 15 gün içinde ödenirse " + tl(h.pesin) + "." :
      "Tebliğ edilecek ceza " + tl(h.teblig) + " · indirim " + tl(h.indirim) + " (%" + (h.ceyrek ? "81,25" : "25") + ")";

    var k = [];
    function satir(dt, dd, sn) { k.push("<div" + (sn ? ' class="' + sn + '"' : "") + "><dt>" + dt + "</dt><dd>" + dd + "</dd></div>"); }
    satir("Dayanak", esc(h.bent) + " (5510 s.K.)");
    if (h.kalemler.length > 1) {
      h.kalemler.forEach(function (x) {
        satir(esc(x.ad) + ' <span class="pc-kucuk">' + AY[x.ay - 1] + " " + x.yil + " asgari ücreti</span>", tl(x.teblig));
      });
    } else {
      satir("Brüt asgari ücret", tl2(h.asgari) + ' <span class="pc-kucuk">' + AY[h.ay - 1] + " " + h.yil + "</span>");
      satir("Hesap", '<span class="pc-kucuk">' + esc(h.aciklama) + "</span>");
      if (h.onceki) satir("Önceki ceza düşüldü", tl(h.onceki) + ' <span class="pc-kucuk">kalan ' + tl(h.kalan) + "</span>");
      if (h.tavan !== null) satir("Üst sınır", tl(h.tavan) + (h.tavanUygulandi ? ' <span class="pc-kucuk">uygulandı</span>' : ""));
    }
    satir("Tebliğ edilecek ceza", tl(h.teblig));
    if (h.ceyrekUygun) satir("Kendiliğinden verme indirimi", h.ceyrek ? "dörtte bire iner" : "yok: 30 gün geçti");
    if (h.muafiyet) satir("7144 muafiyeti", h.muafiyet.uygun ? "uygun" : "uygun değil" + ' <span class="pc-kucuk">sınır ' + tl2(Math.min(h.muafiyet.ucteBir, h.muafiyet.yuzdeBir)) + "</span>");
    satir("15 gün içinde ödenirse", tl(h.pesin), "pc-ana");
    satir("15 gün geçerse", tl(h.teblig) + ' <span class="pc-kucuk">+ gecikme cezası ve zammı</span>');
    $("o-kalemler").innerHTML = k.join("");

    var sd = $("o-sureler");
    if (s) {
      var r = [];
      function sr(dt, dd) { r.push("<div><dt>" + dt + "</dt><dd>" + dd + "</dd></div>"); }
      sr("Yasal son gün", trTarih(s.etkin) + (s.kaydirma.length ? ' <span class="pc-kucuk">' + esc(s.kaydirma.join(", ")) + " nedeniyle; asıl " + trTarih(s.sonGun) + "</span>" : ""));
      if (gor.verilisTarihi) sr("30 günlük sürenin son günü", trTarih(s.otuzSon));
      if (s.verilis) sr("Veriliş", s.zamaninda ? "süresinde" : s.gecGun + " gün geç" + (s.kendiliginden30 ? " (30 gün içinde)" : " (30 gün geçti)"));
      if (s.teblig) sr("Ödeme ve itiraz için son gün", trTarih(s.pesinSon) + (s.pesinKaydirma.length ? ' <span class="pc-kucuk">' + esc(s.pesinKaydirma.join(", ")) + "</span>" : ""));
      sr("Zamanaşımı", trTarih(s.zamanasimi) + "'e kadar tebliğ" + (s.zamanasimiDoldu ? ' <span class="pc-kucuk">tebliğ bu tarihten sonra: zamanaşımı dolmuş</span>' : ""));
      sd.innerHTML = '<div class="pc-ara"><dt>Süreler</dt><dd></dd></div>' + r.join("");
      sd.hidden = false;
    } else { sd.hidden = true; sd.innerHTML = ""; }

    var enCok = yollar[yollar.length - 1].tutar || 1;
    var secili = h.muafiyet && h.muafiyet.uygun ? "muaf" : h.ceyrek ? "k30" : (g.fiil === "iseGiris" && g.iseGiris !== "gec" ? g.iseGiris : (h.ceyrekUygun ? "k" : "pesin"));
    $("o-yollar").innerHTML = yollar.map(function (y) {
      var w = Math.max(1.5, y.tutar / enCok * 100);
      return '<li class="pc-yol' + (y.durum === secili ? " pc-secili" : "") + '"><span class="pc-yol-ad">' + esc(y.ad) + (y.odeme === "gec" ? " (+ gecikme)" : "") +
        '</span><span class="pc-yol-tutar">' + tl(y.tutar) + '</span><span class="pc-yol-cubuk" aria-hidden="true"><span style="width:' + w.toFixed(1) + '%"></span></span></li>';
    }).join("");

    var not = [];
    if (h.tavanUygulandi) not.push("Ceza üst sınıra takıldı; bundan sonra eklenen her sigortalı tutarı değiştirmez.");
    if (/^mphb/.test(g.fiil) && g.fiil !== "mphbTespit" && h.sifirBildirge) not.push("Nisan 2026 döneminden itibaren prim günü ve kazancı sıfır olan geç beyannameler de cezalı (SGK 2026/9 sayılı Genelge).");
    if (h.muafiyet && h.muafiyet.uygun) not.push(g.fiil === "pekTespit" ? "SGK önce yazılı ihtar verir; ihtarın tebliğini izleyen 15 gün içinde ek beyanname verilirse ceza uygulanmaz." : "Asıl beyannamenin verildiği günden itibaren 15 gün içinde ek beyanname verilirse ceza uygulanmaz.");
    if (g.fiil === "kayitDisi") not.push("Primler, gecikme zammı ve teşvik kaybı ayrıca doğar; burada yalnız idari para cezası var.");
    if (s && s.eksikTablo.length) not.push(s.eksikTablo.join(", ") + " dinî bayram takvimi Diyanet'te henüz yayımlanmadı; son gün bayrama denk gelirse ilk iş gününe kayar.");
    not.push("İtiraz ederseniz peşin ödeme indirimi gider; ödeyip dava açma hakkı korunur.");
    $("o-not").textContent = not.join(" ");
    $("o-kopyala-durum").textContent = "";
  }

  $("o-kopyala").addEventListener("click", function () {
    if (!son) return;
    var metin = C.dokum(son.h, son.s), durum = $("o-kopyala-durum");
    function bitti() { durum.textContent = "Kopyalandı"; }
    function eski() {
      var t = document.createElement("textarea");
      t.value = metin; t.setAttribute("readonly", ""); t.style.position = "absolute"; t.style.left = "-9999px";
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); bitti(); } catch (e) { durum.textContent = "Kopyalanamadı"; }
      document.body.removeChild(t);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(metin).then(bitti, eski);
    else eski();
  });

  var zaman = null;
  form.addEventListener("input", function () { clearTimeout(zaman); zaman = setTimeout(hesapla, 180); });
  form.addEventListener("change", hesapla);
  form.addEventListener("submit", function (e) { e.preventDefault(); hesapla(); });
  yukle();
  hesapla();
})();
