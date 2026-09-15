/* Peşin/taksit: aylık nakit akışlarının bugünkü değeri. MIT — Koray Öner. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PesinTaksit=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const cents=n=>Math.round(n*100), money=n=>n/100;
  function number(v,min,max,label,integer){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))throw new Error(label+' geçerli aralıkta olmalı.');return v;}
  function schedule(o){
    number(o.total,.01,1e9,'Taksitli fiyat');number(o.down,0,o.total,'Peşinat');number(o.fee,0,1e8,'Ek ücret');
    number(o.months,1,60,'Taksit sayısı',true);number(o.first,0,12,'İlk ödeme ayı',true);
    const total=cents(o.total),down=cents(o.down),fee=cents(o.fee),remaining=total-down;
    const regular=Math.floor(remaining/o.months),rows=[{month:0,payment:money(down+fee),kind:'Peşinat ve ücret'}];
    for(let k=0;k<o.months;k++)rows.push({month:o.first+k,payment:money(k===o.months-1?remaining-regular*(o.months-1):regular),kind:'Taksit '+(k+1)});
    return rows;
  }
  function pv(rows,monthly){return rows.reduce((s,x)=>s+x.payment/Math.pow(1+monthly,x.month),0);}
  function threshold(rows,cash){
    const total=pv(rows,0),today=rows.filter(x=>x.month===0).reduce((s,x)=>s+x.payment,0);
    if(total<=cash+.000001)return {kind:'already',annual:0};
    if(today>=cash-.000001)return {kind:'never',annual:null};
    let lo=0,hi=1;
    while(pv(rows,hi)>cash&&hi<1048576)hi*=2;
    if(pv(rows,hi)>cash)return {kind:'outside',annual:null};
    for(let k=0;k<100;k++){const mid=(lo+hi)/2;if(pv(rows,mid)>cash)lo=mid;else hi=mid;}
    const annual=(Math.pow(1+(lo+hi)/2,12)-1)*100;
    return Number.isFinite(annual)?{kind:'rate',annual}:{kind:'outside',annual:null};
  }
  function compare(input){
    number(input.cash,.01,1e9,'Peşin fiyat');number(input.annual,0,200,'Yıllık net getiri');number(input.inflation,0,200,'Yıllık enflasyon');
    if(input.budget!==null)number(input.budget,.01,1e9,'Aylık taksit bütçesi');
    if(!Array.isArray(input.offers)||!input.offers.length||input.offers.length>3)throw new Error('Bir ila üç teklif seçin.');
    const cash=money(cents(input.cash)),monthly=Math.pow(1+input.annual/100,1/12)-1,inflation=Math.pow(1+input.inflation/100,1/12)-1;
    const offers=input.offers.map((o,index)=>{
      const rows=schedule(o),byMonth=new Map();for(const row of rows)byMonth.set(row.month,(byMonth.get(row.month)||0)+row.payment);
      const present=pv(rows,monthly),real=pv(rows,inflation),total=rows.reduce((s,x)=>s+x.payment,0);
      const maxMonthly=Math.max(0,...rows.filter(x=>x.kind.startsWith('Taksit')).map(x=>x.payment));
      return {index,id:o.id,months:o.months,first:o.first,total,present,real,advantage:cash-present,extra:total-cash,today:byMonth.get(0)||0,maxMonthly,
        overBudget:input.budget!==null&&maxMonthly>input.budget+.005,threshold:threshold(rows,cash),
        rows:rows.map(x=>({...x,present:x.payment/Math.pow(1+monthly,x.month),real:x.payment/Math.pow(1+inflation,x.month)}))};
    });
    const minimum=Math.min(cash,...offers.map(o=>o.present)),winners=[];
    if(Math.abs(cash-minimum)<.005)winners.push('cash');for(const o of offers)if(Math.abs(o.present-minimum)<.005)winners.push(o.id);
    const rates=[0,input.annual/2,input.annual,Math.min(200,input.annual*1.5)];
    const sensitivity=[...new Set(rates)].map(annual=>({annual,values:offers.map(o=>pv(o.rows,Math.pow(1+annual/100,1/12)-1))}));
    return {cash,monthly,offers,winners,minimum,saving:cash-minimum,sensitivity};
  }
  return {compare,schedule,pv,threshold};
});
