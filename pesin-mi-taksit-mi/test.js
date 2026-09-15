'use strict';
const assert=require('node:assert/strict'),M=require('./motor');
let checks=0;function near(a,b,e=1e-6){assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);checks++;}
const offer=(x={})=>({id:'A',total:12000,down:0,fee:0,months:12,first:1,...x});
const input=(x={})=>({cash:10000,annual:0,inflation:0,budget:null,offers:[offer()],...x});
let r=M.compare(input());near(r.offers[0].present,12000);assert.deepEqual(r.winners,['cash']);
r=M.compare(input({cash:12000}));assert.deepEqual(r.winners,['cash','A']);
// Independent manual discounted sum; effective annual 12.6825% = monthly 1%.
r=M.compare(input({annual:(1.01**12-1)*100}));near(r.offers[0].present,Array.from({length:12},(_,i)=>1000/1.01**(i+1)).reduce((s,n)=>s+n,0));
const b=r.offers[0].threshold;near(M.compare(input({annual:b.annual})).offers[0].present,10000);
near(M.compare(input({annual:25,offers:[offer({first:0})]})).offers[0].present / M.compare(input({annual:25})).offers[0].present,1.25**(1/12));
assert.equal(M.compare(input({offers:[offer({down:10000})]})).offers[0].threshold.kind,'never');
assert.equal(M.compare(input({offers:[offer({total:9000})]})).offers[0].threshold.kind,'already');
assert.equal(M.compare(input({budget:999})).offers[0].overBudget,true);
assert.equal(M.compare(input({budget:1000})).offers[0].overBudget,false);
for(let n=1;n<=60;n++){
  const rows=M.schedule(offer({total:12345.67,down:123.45,fee:67.89,months:n}));
  near(rows.reduce((s,x)=>s+Math.round(x.payment*100),0),1241356,.1);
  for(const x of rows)near(x.payment*100,Math.round(x.payment*100),1e-7);
  const a=M.compare(input({annual:20,offers:[offer({months:n})]})).offers[0];
  assert.ok(a.present<=a.total);assert.ok(a.real===a.total);
  const later=M.compare(input({annual:20,offers:[offer({months:n,first:2})]})).offers[0];assert.ok(later.present<a.present);
  const fee=M.compare(input({annual:20,offers:[offer({months:n,fee:100})]})).offers[0];near(fee.present-a.present,100);
}
for(const bad of [NaN,Infinity,-1,'100'])assert.throws(()=>M.compare(input({cash:bad})));
for(const x of [{months:0},{months:2.5},{months:61},{down:12001},{fee:-1},{first:13},{total:Infinity}])assert.throws(()=>M.compare(input({offers:[offer(x)]})));
assert.throws(()=>M.compare(input({annual:-1})));assert.throws(()=>M.compare(input({budget:0})));assert.throws(()=>M.compare(input({offers:[]})));
const realA=M.compare(input({inflation:40})),realB=M.compare(input({inflation:0}));near(realA.offers[0].present,realB.offers[0].present);assert.ok(realA.offers[0].real<realB.offers[0].real);
console.log(checks+' sayısal kontrol ve geçersiz girdi / eşik / zamanlama testleri geçti.');
