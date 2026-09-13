(function (root) {
  'use strict';
  function npv(flows, rate) { return flows.reduce((sum, value, year) => sum + value / Math.pow(1 + rate, year), 0); }
  function analyse(investment, cash, rate, reinvest, terminal) {
    if (!Number.isFinite(investment) || investment <= 0 || investment > 1e12 || !Array.isArray(cash) || cash.length < 1 || cash.length > 30 || cash.some(v => !Number.isFinite(v) || Math.abs(v) > 2e12) || !Number.isFinite(rate) || rate < 0 || rate > 2 || !Number.isFinite(reinvest) || reinvest < 0 || reinvest > 2 || !Number.isFinite(terminal) || terminal < 0 || terminal > 1e12) throw new Error('Tutarları ve oranları belirtilen sınırlar içinde girin.');
    const flows = [-investment, ...cash]; flows[flows.length - 1] += terminal;
    const years = cash.length, value = npv(flows, rate);
    const conventional = flows.slice(1).every(v => v >= 0) && flows.some(v => v > 0);
    let irr = null;
    if (conventional) {
      let lo = -0.999999, hi = 1;
      while (npv(flows, hi) > 0 && hi < 1e12) hi *= 2;
      if (npv(flows, lo) >= 0 && npv(flows, hi) <= 0) {
        for (let i = 0; i < 180; i++) { const mid = (lo + hi) / 2; if (npv(flows, mid) > 0) lo = mid; else hi = mid; }
        irr = (lo + hi) / 2;
      }
    }
    let negativePV = 0, positiveFV = 0, sum = 0, discounted = 0, payback = null, discountedPayback = null;
    const rows = flows.map((flow, year) => {
      const pv = flow / Math.pow(1 + rate, year); sum += flow; discounted += pv;
      if (flow < 0) negativePV -= pv; else positiveFV += flow * Math.pow(1 + reinvest, years - year);
      if (year && sum >= -1e-7 && payback === null) payback = year;
      if (year && discounted >= -1e-7 && discountedPayback === null) discountedPayback = year;
      return {year, flow, pv, cumulative: discounted};
    });
    const mirr = positiveFV > 0 ? Math.pow(positiveFV / negativePV, 1 / years) - 1 : null;
    return {npv: value, irr, mirr, conventional, payback, discountedPayback, rows, nominal: sum};
  }
  const api = {npv, analyse};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Fizibilite = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
