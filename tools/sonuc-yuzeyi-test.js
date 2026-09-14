/* Sonuçların doğru motora ait olması ve geçersiz girdide eski cevabın
   kaybolması, piksel düzeninden bağımsız regresyonlardır. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const R=require('../sonuc-yuzeyi.js');
const B=require('../bordro/motor.js'),O=require('../otv-hesaplama/tarife.js'),M=require('../mtv-hesaplama/tarife.js');
const root=path.join(__dirname,'..');let checks=0;
function ok(value){assert.ok(value);checks++;}
function setup(slug,engine){
  const html=fs.readFileSync(path.join(root,slug,'index.html'),'utf8'),nodes={};
  function attrs(text){return Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));}
  for(const m of html.matchAll(/<(\w+)\b([^>]*\bid="[^"]+"[^>]*)>/g)){
    const a=attrs(m[2]);nodes[a.id]={id:a.id,type:a.type||'',attributes:a,value:a.value||'',hidden:/\bhidden\b/.test(m[2]),innerHTML:'',textContent:'',events:{},
      addEventListener(t,cb){this.events[t]=cb;},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},getAttribute(k){return this.attributes[k]||null;},
      focus(){},closest(){return null;},querySelectorAll(){return this.controls||[];},get options(){return [...this.innerHTML.matchAll(/<option/g)];},
      get valueAsNumber(){return this.value===''?NaN:Number(this.value);},get validity(){const v=this.valueAsNumber;return {valid:!this.value||Number.isFinite(v)&&(!a.min||v>=Number(a.min))&&(!a.max||v<=Number(a.max))&&(a.step==='any'||Number.isInteger(v)),badInput:false};}};
    if(m[1]==='select'){
      const rest=html.slice(m.index+m[0].length).split('</select>')[0];
      const opt=[...rest.matchAll(/<option\b([^>]*)>/g)];const chosen=opt.find(o=>/selected/.test(o[1]))||opt[0];
      if(chosen)nodes[a.id].value=attrs(chosen[1]).value||'';
    }
  }
  for(const m of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/g)){
    const id=attrs(m[1]).id;if(nodes[id])nodes[id].controls=[...m[2].matchAll(/<input\b[^>]*\bid="([^"]+)"/g)].map(x=>nodes[x[1]]).filter(e=>e.type==='number');
  }
  const hiddenParents={'otv-hacim':'hacim-wrap','otv-ekw':'ekw-wrap','otv-co2':'co2-wrap','otv-menzil':'menzil-wrap','otv-kw':'kw-wrap','oto-hacim':'oto-hacim-alan','oto-kw':'oto-kw-alan','oto-deger':'oto-deger-alan','oto-kasko':'oto-kasko-alan','moto-hacim':'moto-hacim-alan','moto-kw':'moto-kw-alan'};
  for(const [id,parent] of Object.entries(hiddenParents))if(nodes[id])nodes[id].closest=()=>nodes[parent].hidden?nodes[parent]:null;
  const tabs=Object.values(nodes).filter(n=>n.attributes.role==='tab');
  const document={getElementById:id=>nodes[id]||null,querySelector:()=>tabs.find(t=>t.getAttribute('aria-selected')==='true'),querySelectorAll:s=>s.includes('role=')?tabs:Object.values(nodes).filter(n=>n.controls)};
  vm.runInNewContext(fs.readFileSync(path.join(root,slug,'script.js'),'utf8'),{window:{...engine,SonucYuzeyi:R},document,Intl,Number,Array,isFinite,isNaN,parseInt,parseFloat,Math});
  return {nodes,input(id,value){nodes[id].value=String(value);nodes[id].events.input.call(nodes[id]);},click(id){nodes[id].events.click.call(nodes[id]);}};
}
assert.equal(R.read({type:'text',value:'50.000,25'}),50000.25);
assert.equal(R.read({type:'number',value:'150.5',valueAsNumber:150.5}),150.5);
for(const value of ['','123abc','1.2.3','Infinity'])ok(Number.isNaN(R.read({type:'text',value})));
ok(!R.answer('<etiket>',-1e-9,'').includes('-0,00'));ok(R.answer('<etiket>',1,'').includes('&lt;etiket&gt;'));
const stack=R.stack([['A',1],['B',999]]);ok(stack.includes('--rs-share:0.1%'));ok(!stack.includes('brand'));
let ui=setup('maas-hesaplama',{Bordro:B});
for(const year of B.yillar()){
  ui.nodes['in-year'].value=String(year);ui.input('in-gross','50000');
  const result=B.hesaplaYil(50000,year,{agiOrani:.5});ok(ui.nodes.summary.innerHTML.includes(R.fmt(result.aylar[0].net)));
  ok(ui.nodes.table.innerHTML.includes(R.fmt(result.aylar[11].net)));
}
ui.nodes['rs-month'].value='11';ui.nodes['rs-month'].events.change.call(ui.nodes['rs-month']);ok(ui.nodes.summary.innerHTML.includes('Aralık'));
ui.input('in-gross','');ok(ui.nodes.results.hidden&&ui.nodes.summary.innerHTML==='');
ui.input('in-gross','50000');ui.click('tab-2');ok(ui.nodes.results.hidden);ui.input('in-net','60000');ok(!ui.nodes.results.hidden);ui.input('in-net','abc');ok(ui.nodes.results.hidden);
ui=setup('otv-hesaplama',{OtvTarife:O});
ui.input('otv-matrah','800000.5');let r=O.hesapla({tur:'icten',hacim:1400,matrah:800000.5});ok(ui.nodes['otv-out'].innerHTML.includes(R.fmt(r.toplam)));
ui.input('otv-matrah',O.ICTEN_1400.esik[0]+1);ok(ui.nodes['otv-out'].innerHTML.includes('rs-threshold'));ui.input('otv-matrah','');ok(!ui.nodes['otv-out'].innerHTML.includes('rs-number'));
ui=setup('mtv-hesaplama',{MtvTarife:M});ui.input('oto-model','2023');r=M.hesapla({tur:'otomobil',tescil:'yeni',yakit:'icten',bant:1,modelYili:2023,deger:900000,kasko:NaN});ok(ui.nodes['oto-out'].innerHTML.includes(R.fmt(r.vergi)));ok((ui.nodes['oto-out'].innerHTML.match(/rs-time-year/g)||[]).length===8);
ui.input('oto-model','');ok(!ui.nodes['oto-out'].innerHTML.includes('rs-number'));ui.input('oto-model','2023');ok(ui.nodes['oto-out'].innerHTML.includes('rs-time'));ui.input('moto-model','2050');ok(!ui.nodes['moto-out'].innerHTML.includes('rs-number'));
// Ownership guard: no pilot may quietly acquire another tool's stylesheet.
for(const slug of ['maas-hesaplama','otv-hesaplama','mtv-hesaplama']){
  const html=fs.readFileSync(path.join(root,slug,'index.html'),'utf8');
  const styles=[...html.matchAll(/rel="stylesheet" href="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
  assert.deepEqual(styles,['../style.css','../arac-bilesenleri.css']);checks++;
}
console.log(checks+' sonuç yüzeyi kontrolü geçti.');
