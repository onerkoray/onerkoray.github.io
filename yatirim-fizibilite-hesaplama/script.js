(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const money = v => new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Math.abs(v)<.5?0:v);
  const percent = v => v === null ? 'Hesaplanamıyor' : new Intl.NumberFormat('tr-TR',{style:'percent',maximumFractionDigits:2}).format(v);
  let latest;
  function read() {
    const raw=$('cash').value.trim().split(/\n/);
    if (raw.some(s => !/^-?\d+(?:[.,]\d+)?$/.test(s.trim()))) throw Error('Her satıra tek yılın tutarını yazın. Binlik ayırıcı kullanmayın; örnek: 350000 veya -50000.');
    if (raw.some(s=>Math.abs(Number(s.trim().replace(',','.')))>1e12)) throw Error('Yıllık nakit akışı 1 trilyon TL sınırını aşamaz.');
    return {investment:$('investment').valueAsNumber,cash:raw.map(s=>Number(s.trim().replace(',','.'))),rate:$('discount').valueAsNumber/100,reinvest:$('reinvest').valueAsNumber/100,terminal:$('terminal').valueAsNumber};
  }
  function table(id, rows) { $(id).innerHTML=rows.map(r=>'<tr>'+r.map((s,i)=>i===0?'<th scope="row">'+s+'</th>':'<td>'+s+'</td>').join('')+'</tr>').join(''); }
  function render() {
    try {
      const p=read(), r=Fizibilite.analyse(p.investment,p.cash,p.rate,p.reinvest,p.terminal);
      latest={p,r}; $('result').hidden=false; $('error').hidden=true;
      $('npv').textContent=money(r.npv);
      $('verdict').textContent=Math.abs(r.npv)<.005?'Bu varsayımlarla yatırım başabaş noktasında.':r.npv>0?'Bu varsayımlarla yatırım, seçtiğiniz getiri eşiğinin üzerinde değer üretiyor.':'Bu varsayımlarla yatırım, seçtiğiniz getiri eşiğini karşılamıyor.';
      $('irr').textContent=percent(r.irr); $('mirr').textContent=percent(r.mirr);
      $('payback').textContent=r.payback===null?'Ufuk içinde yok':r.payback+'. yıl sonu';
      $('d-payback').textContent=r.discountedPayback===null?'Ufuk içinde yok':r.discountedPayback+'. yıl sonu';
      $('irr-note').textContent=r.conventional?'İç verim oranı, net bugünkü değeri sıfırlayan yıllık orandır.':'İç verim oranı gösterilmedi: sonraki yıllarda negatif nakit akışı varsa veya hiç pozitif giriş yoksa tek ve anlamlı bir oran garanti edilemez. NBD ve düzeltilmiş iç verim oranını birlikte inceleyin.';
      table('cash-rows',r.rows.map(row=>[row.year===0?'Başlangıç':row.year+'. yıl',money(row.flow),money(row.pv),money(row.cumulative)]));
      const scenarios=[['Zorlayıcı',.8,1.2,Math.min(2,p.rate+.05)],['Baz',1,1,p.rate],['Olumlu',1.2,.8,Math.max(0,p.rate-.05)]];
      table('scenario-rows',scenarios.map(([name,gain,cost,rate])=>{
        const flows=p.cash.map(v=>v>=0?v*gain:v*cost);
        return [name,percent(rate),money(Fizibilite.analyse(p.investment,flows,rate,p.reinvest,p.terminal).npv)];
      }));
      const values=r.rows.map(row=>row.cumulative), min=Math.min(0,...values), max=Math.max(0,...values), span=max-min||1;
      const x=i=>75+i/p.cash.length*490, y=v=>195-(v-min)/span*160;
      $('npv-chart').innerHTML='<title>Yıllara göre birikimli indirgenmiş nakit akışı</title><line class="axis" x1="75" x2="565" y1="'+y(0)+'" y2="'+y(0)+'"/><text x="68" y="'+(y(0)-7)+'" text-anchor="end">0 TL</text><text x="75" y="20">'+money(max)+'</text><text x="75" y="245">Alt sınır: '+money(min)+'</text><polyline class="curve" points="'+values.map((v,i)=>x(i)+','+y(v)).join(' ')+'"/><text x="75" y="220">Başlangıç</text><text x="565" y="220" text-anchor="end">'+p.cash.length+'. yıl</text>';
      $('status').textContent='Hesap güncellendi. Net bugünkü değer: '+money(r.npv)+'.';
    } catch(e) { latest=null; $('result').hidden=true; $('error').hidden=false; $('error').textContent=e.message; $('status').textContent='Hesaplanamadı. Girdileri kontrol edin.'; }
  }
  $('investment-form').addEventListener('submit',e=>{e.preventDefault();render();});
  $('investment-form').addEventListener('input',()=>{latest=null;$('result').hidden=true;$('status').textContent='Girdiler değişti. Sonuçları güncellemek için Analiz et düğmesine basın.';});
  $('example').addEventListener('click',()=>{$('investment-form').reset();render();});
  $('export').addEventListener('click',()=>{
    if(!latest) return;
    const {p,r}=latest, number=v=>v.toFixed(2).replace('.',',');
    const lines=[['Yatırım fizibilitesi — yıllık nominal TL'],['Başlangıç yatırımı',number(p.investment)],['İskonto oranı (%)',number(p.rate*100)],['Yeniden yatırım oranı (%)',number(p.reinvest*100)],['Son yıl ek değeri',number(p.terminal)],['NBD',number(r.npv)],['IRR (%)',r.irr===null?'Hesaplanamıyor':number(r.irr*100)],['MIRR (%)',r.mirr===null?'Hesaplanamıyor':number(r.mirr*100)],['Yıl','Net nakit akışı (son yıl ek değeri dahil)','Bugünkü değer','Birikimli bugünkü değer'],...r.rows.map(row=>[row.year,number(row.flow),number(row.pv),number(row.cumulative)])];
    const url=URL.createObjectURL(new Blob(['\ufeff'+lines.map(row=>row.join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='yatirim-fizibilitesi.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  render();
}());
