/* Finans araçlarının doğrulanabilir ortak kuralları. Son kontrol: 2026-09-10.
 * Stopaj: GİB GVK geçici 67 oran tablosu, 10041 sayılı Karar.
 * Kira: TBK 344, olağan konut ve çatılı iş yeri yenilemeleri.
 */
(function (root) {
  "use strict";
  function sayi(value, nativeNumber) {
    var s = String(value).trim().replace(/\s/g, "");
    if (!s) return NaN;
    if (!nativeNumber) {
      if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
      else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    }
    return Number(s);
  }
  function pozitif(n, zero) {
    if (!Number.isFinite(n) || (zero ? n < 0 : n <= 0)) throw new Error("Geçerli, negatif olmayan tutarlar girin.");
    return n;
  }
  function tarih(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Geçerli bir hesap açılış tarihi seçin.");
    var d = new Date(s + "T00:00:00Z");
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new Error("Geçersiz tarih.");
    return d;
  }
  function ayEkle(d, months) {
    var end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 1, 0));
    return new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), Math.min(d.getUTCDate(), end.getUTCDate())));
  }
  function mevduat(p, rate, days, start, type) {
    pozitif(p); pozitif(rate, true); pozitif(days);
    if (!Number.isInteger(days) || days > 3650) throw new Error("Vade 1–3650 arasında tam gün olmalı.");
    var d = tarih(start);
    if (start < "2025-07-09") throw new Error("Bu araç 9 Temmuz 2025 ve sonrasında açılan veya yenilenen hesapları kapsar.");
    if (type !== "tl" && type !== "doviz") throw new Error("Hesap türünü seçin.");
    var end = new Date(d.getTime() + days * 86400000);
    var taxPct = type === "doviz" ? 25 : end <= ayEkle(d, 6) ? 17.5 : end <= ayEkle(d, 12) ? 15 : 10;
    var gross = p * rate / 100 * days / 365;
    var tax = gross * taxPct / 100;
    return { gross: gross, tax: tax, net: gross - tax, maturity: p + gross - tax, taxPct: taxPct, end: end.toISOString().slice(0, 10) };
  }
  function kira(rent, tufe, agreed) {
    pozitif(rent); pozitif(tufe, true);
    if (agreed !== null) pozitif(agreed, true);
    var rate = agreed === null ? tufe : Math.min(agreed, tufe);
    return { rate: rate, rent: Math.round(rent * (1 + rate / 100) * 100) / 100, limited: agreed !== null && agreed > tufe };
  }
  function ithalat(price, exchange, shipping, taxes, fees) {
    pozitif(price); pozitif(exchange); pozitif(shipping, true); pozitif(taxes, true); pozitif(fees, true);
    return price * exchange + shipping + taxes + fees;
  }
  var api = { sayi: sayi, mevduat: mevduat, kira: kira, ithalat: ithalat };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Finans = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
