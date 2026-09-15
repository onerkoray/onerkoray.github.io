'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8'),nodes={};
for(const m of html.matchAll(/<\w+\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
  const attrs=Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]));
  const n={id:m[2],type:attrs.type,value:attrs.value||'',checked:/\bchecked\b/.test(m[1]),hidden:/\bhidden\b/.test(m[1]),innerHTML:'',textContent:'',disabled:false,events:{},attrs,
    addEventListener(k,cb){this.events[k]=cb;},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},getAttribute(k){return this.attrs[k]||null;},get valueAsNumber(){return this.value===''?NaN:Number(this.value);},get validity(){const n=this.valueAsNumber;return {valid:Number.isFinite(n)&&n>=Number(attrs.min||0)&&n<=Number(attrs.max||1e9)&&(attrs.step!=='1'||Number.isInteger(n))};}};
  nodes[n.id]=n;
}
let csv='',downloads=0;
const doc={getElementById:id=>nodes[id],createElement:()=>({click(){downloads++;}}),querySelectorAll:selector=>{const id=selector.match(/data-offer="([ABC])"/)[1];return Object.values(nodes).filter(x=>x.id.startsWith(id+'-'));}};
vm.runInNewContext(fs.readFileSync(__dirname+'/script.js','utf8'),{document:doc,window:{PesinTaksit:require('./motor'),SonucYuzeyi:require('../sonuc-yuzeyi')},console,Blob:class{constructor(parts){csv=parts.join('');}},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:cb=>cb()});
const update=()=>nodes['pt-form'].events.input();
assert.equal(nodes['pt-results'].hidden,false);assert.ok(nodes['pt-cards'].innerHTML.includes('Teklif A'));assert.ok(!nodes['pt-cards'].innerHTML.includes('Teklif C'));
nodes['pt-csv'].events.click();assert.equal(downloads,1);assert.ok(csv.includes('"Taksit 12";"8.333,37"'));assert.ok(csv.includes('"Peşin fiyat TL";"90.000,00"'));assert.equal(csv.split('\r\n').length,18);
nodes['pt-cash'].value='';update();assert.equal(nodes['pt-results'].hidden,true);assert.equal(nodes['pt-summary'].innerHTML,'');assert.equal(nodes['pt-plan'].innerHTML,'');
nodes['pt-csv'].events.click();assert.equal(downloads,1);
nodes['pt-cash'].value='90000';nodes['A-months'].value='2.5';update();assert.equal(nodes['pt-results'].hidden,true);
nodes['A-months'].value='12';nodes['pt-budget'].value='100';update();assert.ok(nodes['pt-cards'].innerHTML.includes('bütçesini aşıyor'));
for(const id of ['A','B','C'])nodes['use-'+id].checked=false;update();assert.equal(nodes['pt-results'].hidden,true);
nodes['use-C'].checked=true;update();assert.equal(nodes['pt-results'].hidden,false);assert.ok(nodes['pt-plan'].innerHTML.includes('Teklif C'));assert.equal(nodes['A-total'].disabled,true);
nodes['C-down'].value='999999';update();assert.equal(nodes['pt-results'].hidden,true);
console.log('Arayüz: boş/hatalı girişte eski sonuç silinir, teklif seçimi ve bütçe uyarısı doğrulandı.');
