#!/usr/bin/env node
/*
 * CI basarisizlik bildiriminin regresyonlari.
 *
 * NEDEN VAR: bu depodaki butun muhafizlar CI'da duruyor, ve o muhafizlarin
 * dustugunu haber veren sey bu bildirim. Bildirimin kendisi sessizce
 * bozulursa, geriye dogrulanmamis bir guvence kaliyor -- tam olarak
 * duzeltmeye calistigimiz hatanin sekli. Alarmi test etmeyen bir sistem,
 * alarmi olmayan bir sistemden daha tehlikelidir, cunku ikincisinde kimse
 * korunuyorum sanmaz.
 *
 * NEDEN KOPYA DEGIL: script'ler workflow YAML'inden OKUNUYOR. Ayri bir
 * kopya tutmak, workflow degistiginde testin eski kopyayi dogrulamaya
 * devam etmesi demekti -- yesil bir test, olmeyen bir alarm.
 *
 * Sahte bir Octokit ile kosuluyor; ag erisimi ve token gerekmiyor.
 */
"use strict";
var fs = require("fs");
var path = require("path");

var KOK = path.dirname(__dirname);
var AKIS = path.join(KOK, ".github", "workflows", "bordro-test.yml");
var hata = 0;

function dogru(ad, k) {
  if (k) console.log("  tamam      " + ad);
  else { hata++; console.error("  BASARISIZ  " + ad); }
}

/* workflow'daki github-script adimlarini cikarir.
   YAML ayristiricisi yok (depoda bagimlilik tutulmuyor); "script: |"
   blogu girintiye gore okunuyor, bu is icin yeterli ve kararli. */
function scriptleri_oku() {
  var satir = fs.readFileSync(AKIS, "utf8").split(/\r?\n/);
  var bulunan = [];
  for (var i = 0; i < satir.length; i++) {
    var m = satir[i].match(/^(\s*)script:\s*\|\s*$/);
    if (!m) continue;
    var girinti = m[1].length;
    var govde = [];
    var j = i + 1;
    for (; j < satir.length; j++) {
      if (satir[j].trim() === "") { govde.push(""); continue; }
      var bu = satir[j].match(/^\s*/)[0].length;
      if (bu <= girinti) break;
      govde.push(satir[j]);
    }
    /* Blogun kendi girintisi kadar sol bosluk atiliyor. */
    var enAz = Infinity;
    govde.forEach(function (s) {
      if (s.trim() !== "") enAz = Math.min(enAz, s.match(/^\s*/)[0].length);
    });
    var kod = govde.map(function (s) { return s.slice(enAz); }).join("\n");

    /* Bu blogun hangi adima ait oldugu, geriye dogru en yakin "if:" ile. */
    var kosul = "";
    for (var k = i; k >= 0 && k > i - 12; k--) {
      var c = satir[k].match(/^\s*if:\s*(.*)$/);
      if (c) { kosul = c[1]; break; }
    }
    bulunan.push({ kosul: kosul, kod: kod });
    i = j - 1;
  }
  return bulunan;
}

function sahte(acikIssuelar, isler) {
  var kayit = { yorum: [], acilan: [], kapanan: [] };
  return {
    kayit: kayit,
    core: { warning: function () {} },
    context: {
      repo: { owner: "onerkoray", repo: "onerkoray.github.io" },
      runId: 123, sha: "abcdef1234567890", serverUrl: "https://github.com",
      payload: { head_commit: { message: "Bir seyler\nikinci satir" } }
    },
    github: {
      rest: {
        actions: {
          listJobsForWorkflowRun: function () {
            return Promise.resolve({ data: { jobs: isler } });
          }
        },
        issues: {
          listForRepo: function () { return Promise.resolve({ data: acikIssuelar }); },
          createComment: function (o) { kayit.yorum.push(o); return Promise.resolve(); },
          create: function (o) { kayit.acilan.push(o); return Promise.resolve(); },
          update: function (o) { kayit.kapanan.push(o); return Promise.resolve(); }
        }
      }
    }
  };
}

function kos(kod, o) {
  var f = new Function("github", "context", "core",
    "return (async () => {" + kod + "})();");
  return f(o.github, o.context, o.core);
}

var ISLER = [{ steps: [
  { name: "Finans kurallari regresyonlari", conclusion: "success" },
  { name: "Dagitim motoru regresyonlari", conclusion: "failure" },
  { name: "Motor testleri", conclusion: "skipped" }
] }];

(async function () {
  console.log("Workflow'dan cikarma");
  var hepsi = scriptleri_oku();
  dogru("iki github-script blogu bulundu", hepsi.length === 2);
  var bildir = hepsi.filter(function (s) { return /failure\(\)/.test(s.kosul); })[0];
  var kapat = hepsi.filter(function (s) { return /success\(\)/.test(s.kosul); })[0];
  dogru("dusme adimi bulundu", !!bildir && bildir.kod.indexOf("issues.create") > 0);
  dogru("kapatma adimi bulundu", !!kapat && kapat.kod.indexOf('state: "closed"') > 0);
  dogru("ikisi de yalnizca push'ta calisiyor",
    /event_name == 'push'/.test(bildir.kosul) && /event_name == 'push'/.test(kapat.kosul));
  if (!bildir || !kapat) { console.error("\nScriptler okunamadi."); process.exit(1); }

  console.log("\nIlk dusus — issue ACILIR");
  var o1 = sahte([], ISLER);
  await kos(bildir.kod, o1);
  dogru("bir issue acildi", o1.kayit.acilan.length === 1);
  dogru("yorum atilmadi", o1.kayit.yorum.length === 0);
  dogru("etiket dogru", (o1.kayit.acilan[0].labels || [])[0] === "ci-kirmizi");
  /* Issue'nun tek isi bu: HANGI adim dustu. Yalnizca "bir sey bozuldu"
     demek, elle bakmaktan kurtarmiyor. */
  dogru("dusen adimin adi yaziyor",
    /Dagitim motoru regresyonlari/.test(o1.kayit.acilan[0].body));
  dogru("gecen adim yazilmiyor",
    !/Finans kurallari/.test(o1.kayit.acilan[0].body));
  dogru("calisma baglantisi var",
    /actions\/runs\/123/.test(o1.kayit.acilan[0].body));
  dogru("commit ozeti tek satira indirilmis",
    /abcdef1 — Bir seyler/.test(o1.kayit.acilan[0].body) &&
    !/ikinci satir/.test(o1.kayit.acilan[0].body));

  console.log("\nIkinci dusus — YENI issue acilmaz");
  /* Kendini tekrarlayan bildirim gurultuye doner, gurultu okunmaz;
     yani bildirim yokmus gibi olur. Acik issue en fazla bir. */
  var o2 = sahte([{ number: 7 }], ISLER);
  await kos(bildir.kod, o2);
  dogru("yeni issue acilmadi", o2.kayit.acilan.length === 0);
  dogru("mevcut issue'ya yorum dusuldu",
    o2.kayit.yorum.length === 1 && o2.kayit.yorum[0].issue_number === 7);

  console.log("\nAdim adi okunamazsa bile bildirir");
  /* actions:read izni bir gun geri alinirsa alarm SUSMAMALI, yalnizca
     daha az sey soylemeli. */
  var o3 = sahte([], ISLER);
  o3.github.rest.actions.listJobsForWorkflowRun = function () {
    return Promise.reject(new Error("403"));
  };
  await kos(bildir.kod, o3);
  dogru("issue yine aciliyor", o3.kayit.acilan.length === 1);
  dogru("okunamadigini soyluyor", /okunamadı/.test(o3.kayit.acilan[0].body));

  console.log("\nYesile donus — issue KAPANIR");
  var o4 = sahte([{ number: 7 }], ISLER);
  await kos(kapat.kod, o4);
  dogru("kapatildi", o4.kayit.kapanan.length === 1 &&
    o4.kayit.kapanan[0].state === "closed");
  dogru("kapanmadan once haber verildi", o4.kayit.yorum.length === 1);

  console.log("\nZaten yesilken yapacak is yok");
  var o5 = sahte([], ISLER);
  await kos(kapat.kod, o5);
  dogru("hicbir cagri yapilmadi",
    o5.kayit.kapanan.length === 0 && o5.kayit.yorum.length === 0);

  console.log("\nEtiket hic olusmamissa kapatma patlamaz");
  var o6 = sahte([], ISLER);
  o6.github.rest.issues.listForRepo = function () {
    return Promise.reject(new Error("404"));
  };
  await kos(kapat.kod, o6);
  dogru("sessizce gecti", true);

  if (hata) { console.error("\n" + hata + " kontrol basarisiz."); process.exit(1); }
  console.log("\nButun bildirim kontrolleri gecti.");
}()).catch(function (e) {
  console.error("\nBeklenmeyen hata: " + e.stack);
  process.exit(1);
});
