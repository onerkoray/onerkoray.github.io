(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const money = n => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
  const compact = n => new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  const presets = {
    atolye: { satis: [100,100,100,100,100,100,100,100,100,100,100,100], acilisNakit:100000, maliyetYuzde:60, sabitGider:20000, stokAy:1, tahsilatAy:2, odemeAy:0 },
    magaza: { satis:[80,90,95,100,110,130,140,150,160,170,180,200], acilisNakit:180000, maliyetYuzde:65, sabitGider:35000, stokAy:2, tahsilatAy:1, odemeAy:1 },
    hizmet: { satis:[70,70,80,80,85,90,90,90,95,100,110,120], acilisNakit:50000, maliyetYuzde:20, sabitGider:50000, stokAy:0, tahsilatAy:2, odemeAy:1 }
  };
  let latest = null;
  const months = $('satis-inputlari');
  months.innerHTML = Array.from({length:12}, (_,i) => '<label for="satis-'+(i+1)+'">'+(i+1)+'. ay<input id="satis-'+(i+1)+'" type="number" min="0" max="10000000000" step="0.01" value="100000" required></label>').join('');
  function getInput() {
    return {
      satislar: Array.from({length:12}, (_,i) => $('satis-'+(i+1)).valueAsNumber),
      ...Object.fromEntries(['acilisNakit','maliyetYuzde','sabitGider','stokAy','tahsilatAy','odemeAy'].map(k => [k, $(k).valueAsNumber]))
    };
  }
  function table(id, data) {
    $(id).innerHTML = data.map(row => '<tr>'+row.map((v,i) => i ? '<td>'+v+'</td>' : '<th scope="row">'+v+'</th>').join('')+'</tr>').join('');
  }
  function chart(plan, late) {
    const svg = $('kopru-chart');
    const all = [...plan.iz.map(p=>p.nakit), ...late.iz.map(p=>p.nakit), 0];
    const low = Math.min(...all), high = Math.max(...all);
    const pad = Math.max(5000,(high-low)*.12), min = low-pad, max=high+pad;
    const x = i => 62+i/12*624, y = v => 238-(v-min)/(max-min)*195;
    let h = '';
    for (let i=0;i<=4;i++) {const v=min+(max-min)*i/4;h+='<line class="grid" x1="62" x2="686" y1="'+y(v)+'" y2="'+y(v)+'"/><text x="55" y="'+(y(v)+4)+'" text-anchor="end">'+compact(v)+'</text>';}
    h+='<line class="zero" x1="62" x2="686" y1="'+y(0)+'" y2="'+y(0)+'"/>';
    for(let i=0;i<=12;i+=2) h+='<text x="'+x(i)+'" y="269" text-anchor="middle">'+i+'</text>';
    h+='<polyline class="late" points="'+late.iz.map(p=>x(p.ay)+','+y(p.nakit)).join(' ')+'"/>';
    h+='<polyline class="base" points="'+plan.iz.map(p=>x(p.ay)+','+y(p.nakit)).join(' ')+'"/>';
    h+='<text x="686" y="288" text-anchor="end">Ay</text>';
    svg.innerHTML = h;
  }
  function calculate(e) {
    if(e) e.preventDefault();
    try {
      const g=getInput(), out=NakitKoprusu.senaryolar(g), r=out.plan;
      latest={g,out};$('kopru-error').hidden=true;$('kopru-result').hidden=false;
      $('gereken').textContent=money(r.gereken);
      $('ilave').textContent=money(r.ilave);
      $('kar').textContent=money(r.kar);
      $('dip').textContent=r.enDusukAy===0?'Başlangıç (0. ay)':r.enDusukAy+'. ay';
      $('kapanis').textContent=money(r.kapanis);
      $('aciklama').textContent=r.ilave>0?'Başlangıçtaki '+money(g.acilisNakit)+' nakde ek olarak '+money(r.ilave)+' tampon gerekir. '+(r.ilkAcik===0?'Stok ödemesi başlangıçta açığa düşürüyor.':'Mevcut nakitle ilk açık '+r.ilkAcik+'. ayda oluşuyor.'):'Girdiğiniz '+money(g.acilisNakit)+' nakit, seçilen plana göre 12 ay boyunca negatif bakiyeyi önlüyor.';
      $('ayrim').textContent='Bu planın nakit dönüşüm döngüsü yaklaşık '+r.nakitDongusuGun+' gün. Kâr tahakkuk esaslıdır; tahsilat ve ödeme vadesi kasayı değiştirir.';
      table('senaryolar',out.senaryolar.map(s=>[s.ad,money(s.gereken),money(s.ilave),money(s.kar)]));
      table('aylik',r.aylar.map(a=>[a.ay+'. ay',money(a.satis),money(a.tahsilat),money(a.tedarik),money(a.sabit),money(a.netAkis),money(a.kapanis)]));
      $('devreden').textContent='Başlangıç öncesi stok ödemesi: '+money(r.hazirlik)+'. 12. ay sonrasında tahsil edilecek alacak: '+money(r.alacak)+'; ödenecek tedarikçi borcu: '+money(r.borc)+'. Bunlar 12 aylık kapanışa dahil edilmez.';
      chart(r,out.senaryolar[1]);
    } catch(err) {latest=null;$('kopru-result').hidden=true;$('kopru-error').textContent=err.message;$('kopru-error').hidden=false;}
  }
  $('kopru-form').addEventListener('submit',calculate);
  $('kopru-form').addEventListener('input',()=>{$('kopru-result').hidden=true;$('kopru-error').hidden=true;latest=null;});
  document.querySelectorAll('[data-ornek]').forEach(button=>button.addEventListener('click',()=>{
    const p=presets[button.dataset.ornek];
    ['acilisNakit','maliyetYuzde','sabitGider','stokAy','tahsilatAy','odemeAy'].forEach(k=>$(k).value=p[k]);
    p.satis.forEach((n,i)=>$('satis-'+(i+1)).value=n*1000);
    calculate();
  }));
  $('csv-indir').addEventListener('click',()=>{
    if(!latest)return;
    const {g,out}=latest,r=out.plan;
    const data=[['Nakit Köprüsü','12 aylık plan'],['Başlangıç nakdi',g.acilisNakit],['Değişken maliyet (%)',g.maliyetYuzde],['Sabit gider',g.sabitGider],['Stok hazırlığı (ay)',g.stokAy],['Tahsilat vadesi (ay)',g.tahsilatAy],['Tedarikçi vadesi (ay)',g.odemeAy],['Gereken sermaye',r.gereken],['İlave sermaye',r.ilave],['Faaliyet kârı',r.kar],[],['Ay','Satış','Tahsilat','Tedarik ödemesi','Sabit ödeme','Net akış','Kapanış'],...r.aylar.map(a=>[a.ay,a.satis,a.tahsilat,a.tedarik,a.sabit,a.netAkis,a.kapanis]),[],['Senaryo','Gereken sermaye','İlave ihtiyaç','Kâr'],...out.senaryolar.map(s=>[s.ad,s.gereken,s.ilave,s.kar])];
    const csv='\uFEFF'+data.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='nakit-koprusu.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  calculate();
})();
