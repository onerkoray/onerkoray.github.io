(function () {
  'use strict';
  const $=id=>document.getElementById(id), keys=['sabit','fiyat','degisken','komisyon','adet','hedef','kapasite'];
  const money=n=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(n);
  const num=n=>n===null?'Ulaşılamaz':new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0}).format(n);
  const pct=n=>new Intl.NumberFormat('tr-TR',{style:'percent',maximumFractionDigits:1}).format(n);
  let latest=null;
  function rows(id,data) { $(id).innerHTML=data.map(a=>'<tr>'+a.map((c,i)=>i?'<td>'+c+'</td>':'<th scope="row">'+c+'</th>').join('')+'</tr>').join(''); }
  function draw(g,r) {
    const plan=Math.max(g.adet,g.kapasite,1), end=Math.min(1e9,Math.max(5,Math.ceil(Math.max(plan,r.basabas!==null&&r.basabas<=plan*2?r.basabas:0)*1.2)));
    const points=Array.from({length:6},(_,i)=>{const q=Math.round(end*i/5);return {q,...Basabas.hesapla({...g,adet:q})};});
    const max=Math.max(1,...points.map(p=>Math.max(p.gelir,p.toplamGider)))*1.12;
    const x=q=>72+q/end*542,y=v=>245-v/max*210;
    const compact=v=>new Intl.NumberFormat('tr-TR',{notation:'compact',maximumFractionDigits:1}).format(v);
    let svg='';
    for(let i=0;i<=4;i++) {const v=max*i/4;svg+='<line class="axis" x1="72" x2="614" y1="'+y(v)+'" y2="'+y(v)+'"/><text x="64" y="'+(y(v)+4)+'" text-anchor="end">'+compact(v)+'</text>';}
    for(const p of points) svg+='<text x="'+x(p.q)+'" y="268" text-anchor="middle">'+compact(p.q)+'</text>';
    svg+='<text x="72" y="18">TL / ay</text><text x="614" y="291" text-anchor="end">Satış adedi / ay</text>';
    for(const [key,cls] of [['gelir','revenue'],['toplamGider','cost']]) svg+='<polyline class="'+cls+'" points="'+points.map(p=>x(p.q)+','+y(p[key])).join(' ')+'"/>';
    if(r.basabas!==null&&r.basabas<=end) svg+='<line class="threshold" x1="'+x(r.basabas)+'" x2="'+x(r.basabas)+'" y1="30" y2="245"/>';
    $('be-chart').innerHTML=svg;
    $('be-chart-note').textContent=r.basabas!==null&&r.basabas<=end?'Dikey kesikli çizgi, tam adede yuvarlanmış başabaş noktasını gösterir.':'Başabaş noktası bu grafik aralığında bulunmuyor.';
    rows('be-chart-rows',points.map(p=>[num(p.q),money(p.gelir),money(p.toplamGider),money(p.kar)]));
  }
  function calculate(e) {
    if(e)e.preventDefault();
    try {
      const g=Object.fromEntries(keys.map(k=>[k,$(k).valueAsNumber]));
      const r=Basabas.hesapla(g); latest={g,r};
      $('be-error').hidden=true;$('be-result').hidden=false;
      $('be-break').textContent=r.basabas===null?'Ulaşılamaz':num(r.basabas)+' adet';
      $('be-verdict').textContent=r.katki<=0?'Her satışın katkısı '+money(r.katki)+'. Satış artırmak pozitif kâr sağlamaz; fiyat veya birim maliyet değişmelidir.':r.basabas===0?'Sabit gider yok; ilk satıştan itibaren pozitif katkı oluşur.':'Bu satış adedinde '+money(r.basabasCiro)+' aylık ciro oluşur ve giderler karşılanır.';
      $('be-profit').textContent=money(r.kar);$('be-target').textContent=r.hedefAdet===null?'Ulaşılamaz':num(r.hedefAdet)+' adet';
      $('be-margin').textContent=money(r.katki)+' · '+pct(r.katkiOrani);
      $('be-price').textContent=r.hedefFiyat===null?'Hesaplanamaz':money(r.hedefFiyat);
      $('be-capacity').textContent=(r.planKapasiteyiAsiyor?'Planlanan satış, girdiğiniz kapasiteyi aşıyor. ':'')+(r.kapasiteYeterli?'Hedef kâr, '+num(g.kapasite)+' adetlik aylık kapasitenin içinde.':'Hedef kâr bu fiyat ve giderlerle aylık kapasite içinde sağlanamıyor.')+' Kapasitenin tamamında faaliyet kârı: '+money(r.kapasiteKari)+'.';
      $('be-safety').textContent=r.guvenlik===null?'Güvenlik payı bu satış ve katkı düzeyinde tanımlı değil.':'Planın güvenlik payı: '+pct(r.guvenlik)+(r.guvenlik<0?' — satış planı başabaşın altında.':' — diğer varsayımlar sabitken satışın başabaşa kadar azalma payı.');
      rows('be-scenarios',r.senaryolar.map(s=>[(s.yuzde>0?'+':s.yuzde<0?'−':'')+'%'+Math.abs(s.yuzde),money(s.fiyat),num(s.basabas),money(s.kar)]));
      $('be-scenarios').children[2].setAttribute('data-base','');
      $('be-ledger').innerHTML=[['Ciro',r.gelir],['Komisyon',r.komisyon],['Değişken giderler',r.degisken],['Sabit giderler',g.sabit],['Faaliyet kârı / zararı',r.kar]].map(a=>'<div><dt>'+a[0]+'</dt><dd>'+money(a[1])+'</dd></div>').join('');
      draw(g,r);
    }catch(err){latest=null;$('be-error').textContent=err.message;$('be-error').hidden=false;$('be-result').hidden=true;}
  }
  $('be-form').addEventListener('submit',calculate);
  $('be-form').addEventListener('input',()=>{latest=null;$('be-result').hidden=true;$('be-error').hidden=true;});
  const presets={atolye:[60000,500,250,10,400,30000,500],magaza:[35000,800,420,18,300,40000,600],hizmet:[45000,2500,300,0,30,50000,50]};
  document.querySelectorAll('[data-ornek]').forEach(b=>b.addEventListener('click',()=>{keys.forEach((k,i)=>$(k).value=presets[b.dataset.ornek][i]);calculate();}));
  $('be-export').addEventListener('click',()=>{
    if(!latest)return;const {g,r}=latest;
    const data=[['Başabaş ve hedef faaliyet kârı','Aylık / KDV hariç'],...keys.map((k,i)=>[['Aylık sabit gider (TL)','Birim satış fiyatı (TL)','Birim değişken gider (TL)','Komisyon (%)','Planlanan satış (adet)','Hedef faaliyet kârı (TL)','Aylık kapasite (adet)'][i],g[k]]),['Başabaş adedi',r.basabas??'Ulaşılamaz'],['Hedef adedi',r.hedefAdet??'Ulaşılamaz'],['Gerekli birim fiyat',r.hedefFiyat??'Hesaplanamaz'],['Faaliyet kârı',r.kar],[],['Fiyat değişimi (%)','Birim fiyat','Başabaş adedi','Planlanan kâr'],...r.senaryolar.map(s=>[s.yuzde,s.fiyat,s.basabas??'Ulaşılamaz',s.kar])];
    const csv='\uFEFF'+data.map(row=>row.map(v=>'"'+String(typeof v==='number'?v.toLocaleString('tr-TR',{useGrouping:false,maximumFractionDigits:6}):v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='basabas-plani.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  calculate();
})();
