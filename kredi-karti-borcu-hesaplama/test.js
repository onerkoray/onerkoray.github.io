const assert = require('node:assert/strict');
const rota = require('./hesap.js');
const kart = require('../makaleler/kredi-karti-asgari-odeme/kart.js');

const temel = { borc: 40000, limit: 50000, butce: 10000, harcama: 0, harcamaAy: 0, hedefAy: 6, ozelOran: null };
const r = rota.analiz(temel);
assert.equal(r.ilkAsgari, 8000);
assert.equal(r.asgariOran, 0.2);
assert.equal(r.ilkOran, kart.bant(40000).akdi);
assert.equal(r.asgariPlan.durum, 'bitti');
assert.equal(r.butcePlan.durum, 'bitti');
assert.ok(r.butcePlan.ay < r.asgariPlan.ay);
assert.ok(r.butcePlan.maliyet < r.asgariPlan.maliyet);
assert.ok(r.hedef && r.hedef.plan.ay <= 6);
assert.equal(rota.simule(r.parametreler, 'butce', r.hedef.butce - .01, 6).durum === 'bitti', false);

for (const plan of [r.asgariPlan, r.butcePlan, r.hedef.plan]) {
  assert.equal(rota.kurus(temel.borc + plan.harcamaToplam + plan.maliyet - plan.odemeToplam), plan.kalan);
  for (const s of plan.satirlar) {
    assert.equal(rota.kurus(s.acilis - s.odeme + s.faiz + s.kkdf + s.bsmv + s.harcama), s.kalan);
    assert.ok(s.odeme + .001 >= s.asgari);
  }
}

const oranDusus = rota.analiz({ ...temel, ozelOran: .02 });
assert.ok(oranDusus.butcePlan.maliyet < r.butcePlan.maliyet);
assert.ok(oranDusus.hedef.butce <= r.hedef.butce);
const bankaUst = rota.analiz({ ...temel, ozelOran: kart.bant(temel.borc).akdi });
assert.ok(bankaUst.butcePlan.satirlar.some(s => s.acilis <= 30000 && s.oran === kart.bant(s.acilis).akdi));
assert.throws(() => rota.analiz({ ...temel, ozelOran: .04 }), /azami/);

const yeniHarcama = rota.analiz({ ...temel, harcama: 2000, harcamaAy: 3, hedefAy: 9 });
assert.equal(yeniHarcama.butcePlan.harcamaToplam, 6000);
assert.ok(yeniHarcama.hedef.butce > r.hedef.butce / 2);
assert.ok(yeniHarcama.asgariPlan.maliyet > r.asgariPlan.maliyet);
assert.equal(rota.kurus(temel.borc + yeniHarcama.butcePlan.harcamaToplam +
  yeniHarcama.butcePlan.maliyet - yeniHarcama.butcePlan.odemeToplam), yeniHarcama.butcePlan.kalan);

const yetersiz = rota.analiz({ ...temel, butce: 5000 });
assert.equal(yetersiz.butcePlan.durum, 'butce-yetersiz');
assert.equal(yetersiz.butcePlan.ay, 1);
const limit = rota.analiz({ ...temel, harcama: 20000, harcamaAy: 1, hedefAy: 3 });
assert.equal(limit.asgariPlan.durum, 'limit-asildi');
assert.equal(limit.butcePlan.durum, 'limit-asildi');
assert.ok(limit.hedef && limit.hedef.plan.durum === 'bitti');

assert.throws(() => rota.analiz({ ...temel, borc: 60000 }), /limit/);
assert.throws(() => rota.analiz({ ...temel, harcama: 100, harcamaAy: 6 }), /Hedef ayda/);
assert.throws(() => rota.analiz({ ...temel, ozelOran: -.01 }), /faiz/);
assert.equal(rota.analiz({ ...temel, ozelOran: 0 }).butcePlan.maliyet, 0);

console.log('Kart Borcu Rotası: oran kaynağı, ödeme yeterliliği, limit, hedef ve muhasebe eşitlikleri geçti.');
