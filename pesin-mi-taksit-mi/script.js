(function(){
  'use strict';
  const $=id=>document.getElementById(id),M=window.PesinTaksit,R=window.SonucYuzeyi,form=$('pt-form'),out=$('pt-results');
  const labels={cash:'Peşin',A:'Teklif A',B:'Teklif B',C:'Teklif C'};
  let current=null,selected='A';
  const tl=n=>R.fmt(n)+' TL',rate=n=>'%'+R.fmt(n);
  function read(id,optional){const e=$(id);if(optional&&e.value.trim()==='')return null;const v=R.read(e);if(!Number.isFinite(v)||!e.validity.valid){e.setAttribute('aria-invalid','true');throw new Error(e.getAttribute('aria-label')+' alanını kontrol edin.');}e.removeAttribute('aria-invalid');return v;}
  function collect(){
    const offers=[];
    for(const id of ['A','B','C']){
      const active=$('use-'+id).checked;
      document.querySelectorAll('[data-offer="'+id+'"] input:not([type=checkbox]),[data-offer="'+id+'"] select').forEach(e=>{e.disabled=!active;});
      if(active)offers.push({id,total:read(id+'-total'),down:read(id+'-down'),fee:read(id+'-fee'),months:read(id+'-months'),first:read(id+'-first')});
    }
    return {cash:read('pt-cash'),annual:read('pt-return'),inflation:read('pt-inflation'),budget:read('pt-budget',true),offers};
  }
  function thresholdText(t){if(t.kind==='already')return 'Getiri %0 iken de peşinden pahalı değil.';if(t.kind==='never')return 'Bugünkü ödeme peşin fiyatı karşılıyor; sonlu pozitif getiride eşik yok.';if(t.kind==='outside'||t.annual>1e6)return 'Eşik, pratik karşılaştırma aralığının dışında.';return 'Başa baş yıllık net getiri: '+rate(t.annual)+'.';}
  function plan(){
    if(!current)return;const o=current.offers.find(x=>x.id===selected)||current.offers[0];selected=o.id;
    $('pt-plan').innerHTML='<table><caption>'+labels[o.id]+' · aylık ödeme planı</caption><thead><tr><th scope="col">Zaman</th><th scope="col">Kalem</th><th scope="col">Ödeme</th><th scope="col">Bugünkü değer</th><th scope="col">Bugünkü alım gücü</th></tr></thead><tbody>'+o.rows.map(x=>'<tr><th scope="row">'+(x.month===0?'Bugün':x.month+'. ay')+'</th><td>'+x.kind+'</td><td>'+tl(x.payment)+'</td><td>'+tl(x.present)+'</td><td>'+tl(x.real)+'</td></tr>').join('')+'</tbody><tfoot><tr><th scope="row" colspan="2">Toplam</th><td>'+tl(o.total)+'</td><td>'+tl(o.present)+'</td><td>'+tl(o.real)+'</td></tr></tfoot></table>';
  }
  function render(r){
    const winner=r.winners.map(x=>labels[x]).join(' ve '),warning=r.offers.some(o=>r.winners.includes(o.id)&&o.overBudget);
    $('pt-summary').innerHTML='<p class="rs-eyebrow">Seçtiğiniz net getiri varsayımına göre</p><h2 class="pt-winner">'+winner+(r.winners.length>1?' eşit maliyette':' daha düşük bugünkü maliyette')+'</h2>'+R.metrics([['En düşük bugünkü maliyet',tl(r.minimum)],['Peşine göre avantaj',tl(r.saving)],['Karşılaştırma ölçüsü','Aynı ürün · bugünkü TL']])+R.notice('Bu sonuç ödeme tavsiyesi değildir. Getiri gerçekleşmezse sıralama değişebilir. Peşinat ve ilk gün ödemeleri için ayrıca nakit gerekir.')+(warning?'<p class="pt-alert">Maliyeti düşük görünen teklif, belirttiğiniz aylık taksit bütçesini aşıyor.</p>':'');
    $('pt-summary').innerHTML+='<p class="pt-muted">Varsayımlar: yıllık net getiri '+rate(Number($('pt-return').value))+' · yıllık enflasyon '+rate(Number($('pt-inflation').value))+'.</p>';
    $('pt-cards').innerHTML=r.offers.map(o=>'<article class="pt-result-card" data-best="'+r.winners.includes(o.id)+'"><h3>'+labels[o.id]+'</h3><p class="pt-muted">'+o.months+' taksit · ilk ödeme '+(o.first===0?'bugün':o.first+' ay sonra')+'</p><p class="pt-muted">Bugünkü maliyet</p><p class="pt-value">'+tl(o.present)+'</p><dl>'+[['Toplam ödeme',tl(o.total)],['Bugün gereken nakit',tl(o.today)],['En yüksek taksit',tl(o.maxMonthly)],['Peşine göre nominal fark',tl(o.extra)],['Enflasyona göre alım gücü',tl(o.real)]].map(x=>'<div><dt>'+x[0]+'</dt><dd>'+x[1]+'</dd></div>').join('')+'</dl><p class="pt-muted">'+thresholdText(o.threshold)+'</p>'+(o.overBudget?'<p class="pt-alert">Aylık taksit bütçesini aşıyor.</p>':'')+'</article>').join('');
    const bars=[{label:'Peşin',value:r.cash},...r.offers.map(o=>({label:labels[o.id],value:o.present}))],max=Math.max(...bars.map(x=>x.value));
    $('pt-chart').innerHTML=bars.map(x=>'<div class="pt-chart-row"><span>'+x.label+'</span><span class="pt-bar-track" aria-hidden="true"><span class="pt-bar" style="--value:'+x.value/max*100+'%"></span></span><strong>'+tl(x.value)+'</strong></div>').join('');
    $('pt-sensitivity').innerHTML='<table><caption>Net getiri değişirse bugünkü maliyet (TL)</caption><thead><tr><th scope="col">Yıllık net getiri</th><th scope="col">Peşin</th>'+r.offers.map(o=>'<th scope="col">'+labels[o.id]+'</th>').join('')+'</tr></thead><tbody>'+r.sensitivity.map(s=>'<tr><th scope="row">'+rate(s.annual)+'</th><td>'+R.fmt(r.cash)+'</td>'+s.values.map(v=>'<td>'+R.fmt(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
    if(!r.offers.some(o=>o.id===selected))selected=r.offers[0].id;
    $('pt-select').innerHTML=r.offers.map(o=>'<option value="'+o.id+'"'+(o.id===selected?' selected':'')+'>'+labels[o.id]+'</option>').join('');
    plan();out.hidden=false;$('pt-status').textContent='Hesap güncellendi. '+winner+(r.winners.length>1?' eşit maliyette.':' daha düşük bugünkü maliyette.');
  }
  function calculate(){
    try{current=M.compare(collect());render(current);}
    catch(e){current=null;out.hidden=true;for(const id of ['pt-summary','pt-cards','pt-chart','pt-sensitivity','pt-plan'])$(id).innerHTML='';$('pt-status').textContent=e.message;}
  }
  form.addEventListener('submit',e=>{e.preventDefault();calculate();});
  form.addEventListener('input',calculate);form.addEventListener('change',calculate);
  $('pt-select').addEventListener('change',()=>{selected=$('pt-select').value;plan();});
  $('pt-reset').addEventListener('click',()=>{form.reset();selected='A';calculate();});
  $('pt-csv').addEventListener('click',()=>{
    if(!current)return;const o=current.offers.find(x=>x.id===selected)||current.offers[0];
    const lines=[['Peşin mi taksit mi','Teklif '+o.id],['Peşin fiyat TL',R.fmt(current.cash)],['Yıllık net getiri %',$('pt-return').value],['Yıllık enflasyon %',$('pt-inflation').value],['Ay','Kalem','Ödeme TL','Bugünkü değer TL','Bugünkü alım gücü TL'],...o.rows.map(x=>[x.month,x.kind,R.fmt(x.payment),R.fmt(x.present),R.fmt(x.real)])];
    const blob=new Blob(['\ufeff'+lines.map(row=>row.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='pesin-taksit-'+o.id+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  calculate();
})();
