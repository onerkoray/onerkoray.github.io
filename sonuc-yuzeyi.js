/* Ortak sunum, ayrı hesap: buraya tarife veya bordro matematiği girmez. */
(function(root){
  'use strict';
  var nf=new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function fmt(n){return Number.isFinite(n)?nf.format(Math.abs(n)<.005?0:n):'—';}
  function read(e){
    if(!e||!String(e.value).trim())return NaN;
    if(e.type==='number')return Number.isFinite(e.valueAsNumber)?e.valueAsNumber:NaN;
    var s=String(e.value).trim();
    if(!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(s))return NaN;
    var n=Number(s.replace(/\./g,'').replace(',','.'));return Number.isFinite(n)?n:NaN;
  }
  function answer(label,value,note){return '<div class="rs-answer"><p class="rs-eyebrow">'+esc(label)+'</p><strong class="rs-number">'+fmt(value)+' <span class="rs-unit">TL</span></strong>'+(note?'<p class="rs-note">'+esc(note)+'</p>':'')+'</div>';}
  function facts(rows){return '<dl class="rs-facts">'+rows.map(function(r){return '<div><dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd></div>';}).join('')+'</dl>';}
  function metrics(rows){return '<dl class="rs-metrics">'+rows.map(function(r){return '<div><dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd></div>';}).join('')+'</dl>';}
  function notice(s){return '<p class="rs-state">'+esc(s)+'</p>';}
  function validate(form,optional){
    var message='';
    form.querySelectorAll('input[type="number"]').forEach(function(e){
      e.removeAttribute('aria-invalid');
      if(e.closest('[hidden]')||(optional.indexOf(e.id)>=0&&!e.value&&!(e.validity&&e.validity.badInput)))return;
      if(!Number.isFinite(read(e))||(e.validity&&!e.validity.valid)){
        e.setAttribute('aria-invalid','true');
        if(!message)message=(e.getAttribute('aria-label')||'Tutar')+' alanına geçerli bir değer girin.';
      }
    });
    return message;
  }
  function stack(parts){
    var total=parts.reduce(function(sum,p){return sum+p[1];},0);
    if(!(total>0)||parts.some(function(p){return !Number.isFinite(p[1])||p[1]<0;}))return '';
    return '<div class="rs-stack" aria-hidden="true">'+parts.map(function(p,i){return '<span class="rs-segment rs-series-'+(i+1)+'" style="--rs-share:'+(p[1]/total*100)+'%"></span>';}).join('')+'</div><ul class="rs-legend">'+parts.map(function(p,i){return '<li><span class="rs-key rs-series-'+(i+1)+'" aria-hidden="true"></span>'+esc(p[0])+' · %'+new Intl.NumberFormat('tr-TR',{maximumFractionDigits:1}).format(p[1]/total*100)+'</li>';}).join('')+'</ul>';
  }
  var api={esc:esc,fmt:fmt,read:read,answer:answer,facts:facts,metrics:metrics,notice:notice,stack:stack,validate:validate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SonucYuzeyi=api;
})(typeof globalThis!=='undefined'?globalThis:this);
