'use strict';
const assert=require('assert'),fs=require('fs');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const near=(a,b)=>assert(Math.abs(a-b)<.005,`${a} != ${b}`);
near(1000*1.4*1.2,1680); near((1.4*1.2-1)*100,68);
near(50000*1.0184,50920); near((142.8/105-1)*100,36);
[25,35,45].forEach((rate,i)=>{
 const expenses=40000*(1+rate/100),remain=65000-expenses;
 near(expenses,[50000,54000,58000][i]);near(remain,[15000,11000,7000][i]);
 near((1.3/(1+rate/100)-1)*100,[4,-3.70,-10.34][i]);
});
near(11000/1.35,8148.15);
for(const s of ['1.680','%68','50.920','%36','−%3,70','−%10,34','8.148']) assert(html.includes(s),s);
console.log('Enflasyon yazısındaki sepet, baz etkisi ve bütçe hesapları doğrulandı.');
