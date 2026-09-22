'use strict';
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const M = require('./hesap.js');
let tests = 0;
function test(ad, f) { f(); tests++; }
const base = { sabit: 60000, fiyat: 500, degisken: 250, komisyon: 10, adet: 400, hedef: 30000, kapasite: 500 };
test('elle hesaplanmış örnek', () => {
  const r=M.hesapla(base);
  assert.equal(r.katki,200); assert.equal(r.basabas,300); assert.equal(r.hedefAdet,450);
  assert.equal(r.kar,20000); assert.equal(r.gelir,200000); assert.equal(r.toplamGider,180000);
  assert.equal(r.guvenlik,.25); assert.equal(r.hedefFiyat,527.78); assert(r.kapasiteYeterli);
});
test('yukarı yuvarlama',()=>assert.equal(M.hesapla({...base,sabit:60001}).basabas,301));
test('kuruş sınırında fazladan adet yok',()=>assert.equal(M.hesapla({...base,sabit:.3,fiyat:.1,degisken:0,komisyon:0}).basabas,3));
test('komisyon birim katkıya dahil',()=>assert.equal(M.hesapla({...base,komisyon:100}).basabas,null));
test('negatif katkıda satış arttıkça zarar',()=>{const r=M.hesapla({...base,fiyat:100}); assert.equal(r.basabas,null); assert(r.kar < -base.sabit);});
test('sabit gider yok, sıfır satış başabaş',()=>assert.equal(M.hesapla({...base,sabit:0}).basabas,0));
test('sıfır katkı sıfır gider',()=>{const r=M.hesapla({...base,sabit:0,fiyat:250,komisyon:0,hedef:1});assert.equal(r.basabas,0);assert.equal(r.hedefAdet,null);});
test('sıfır satış güvenlik oranı/fiyat üretmez',()=>{const r=M.hesapla({...base,adet:0});assert.equal(r.guvenlik,null);assert.equal(r.hedefFiyat,null);assert.equal(r.kar,-60000);});
test('kapasite sınırı ve aşım',()=>{const r=M.hesapla({...base,kapasite:300});assert(!r.kapasiteYeterli);assert(r.planKapasiteyiAsiyor);});
test('sıfır hedef ve sabit giderde satış yapmadan hedef sağlanır',()=>{const r=M.hesapla({...base,sabit:0,hedef:0,fiyat:100,kapasite:0});assert.equal(r.hedefAdet,0);assert(r.kapasiteYeterli);});
test('geçersiz girdi reddi',()=>{
 for(const key of Object.keys(base)) for(const value of [NaN,Infinity,-1,'100',null,undefined]) assert.throws(()=>M.hesapla({...base,[key]:value}));
 for(const value of [1.001,1e10]) assert.throws(()=>M.hesapla({...base,fiyat:value}));
 assert.throws(()=>M.hesapla({...base,fiyat:0})); assert.throws(()=>M.hesapla({...base,adet:2.5})); assert.throws(()=>M.hesapla({...base,komisyon:101}));
});
// Sınırın iki tarafını kontrol eder: N satış yeterli, N-1 yetersiz olmalı.
for(let i=1;i<=80;i++) test('başabaş/ hedef sınırı '+i,()=>{
 const g={...base,sabit:Number((123.45*i).toFixed(2)),fiyat:25+i*.25,degisken:12.34,komisyon:3.75,hedef:45.67};
 const r=M.hesapla(g);
 for(const [n,target] of [[r.basabas,0],[r.hedefAdet,g.hedef]]) {
  assert(M.hesapla({...g,adet:n}).kar>=target-1e-8);
  assert(M.hesapla({...g,adet:n-1}).kar<target);
 }
 assert(M.hesapla({...g,fiyat:r.hedefFiyat}).kar>=g.hedef-1e-8);
 assert(M.hesapla({...g,fiyat:Number((r.hedefFiyat-.01).toFixed(2))}).kar<g.hedef);
 assert(Math.abs(r.gelir-r.toplamGider-r.kar)<1e-7);
});
test('tarayıcı ve Node aynı motor',()=>{
 const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/hesap.js','utf8'),ctx);
 assert.equal(JSON.stringify(ctx.Basabas.hesapla(base)),JSON.stringify(M.hesapla(base)));
});
console.log(tests+' kontrol geçti.');
