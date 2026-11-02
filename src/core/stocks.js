// 주식 시장 시뮬레이션 · 매매.
import { D, findStock } from './data.js';
import { clone, pushLog } from './state.js';
import { randRange } from './rng.js';

export function isDelisted(state, id) {
  return state.stocks.delisted.includes(id);
}

/** 매주 가격 변동 + 예정된 뉴스(소문 결과)·상장폐지 적용 */
export function tickStocks(state) {
  const S = state.stocks;
  S.prevPrices = { ...S.prices };
  for (const sym of D.stocks.symbols) {
    if (isDelisted(state, sym.id)) continue;
    const change = randRange(state, -sym.weeklyVolatility, sym.weeklyVolatility) + sym.drift;
    let price = Math.max(100, Math.round(S.prices[sym.id] * (1 + change)));
    S.prices[sym.id] = price;
  }

  // 소문 → 뉴스
  const rumor = state.events.rumor;
  if (rumor) {
    rumor.weeksLeft -= 1;
    if (rumor.weeksLeft <= 0) {
      const sym = findStock(rumor.symbol);
      if (sym && !isDelisted(state, sym.id)) {
        const mult = 1 + rumor.direction * rumor.shock;
        S.prices[sym.id] = Math.max(100, Math.round(S.prices[sym.id] * mult));
        const pct = Math.round(rumor.shock * 100);
        pushLog(state, {
          emoji: rumor.direction > 0 ? '📈' : '📉',
          title: rumor.direction > 0 ? `뉴스: ${sym.name} 호재, +${pct}%` : `뉴스: ${sym.name} 악재, -${pct}%`,
        });
      }
      state.events.rumor = null;
    }
  }

  // 상장폐지 예고 → 실행
  const dl = state.events.delisting;
  if (dl) {
    dl.weeksLeft -= 1;
    if (dl.weeksLeft <= 0) {
      const sym = findStock(dl.symbol);
      if (sym && !isDelisted(state, sym.id)) {
        S.delisted.push(sym.id);
        S.prices[sym.id] = 0;
        const h = S.holdings[sym.id];
        const lost = h ? h.qty * h.avgCost : 0;
        delete S.holdings[sym.id];
        pushLog(state, { emoji: '💀', title: `${sym.name} 상장폐지`, amount: lost > 0 ? -lost : null, kind: lost > 0 ? 'expense' : 'info' });
      }
      state.events.delisting = null;
    }
  }

  for (const sym of D.stocks.symbols) {
    const h = S.history[sym.id];
    h.push(S.prices[sym.id]);
    while (h.length > D.stocks.historyLength) h.shift();
  }
  return state;
}

export function fee(amount) {
  return Math.round(amount * D.config.stockFeeRate);
}

export function buyCost(state, id, qty) {
  const gross = state.stocks.prices[id] * qty;
  return { gross, fee: fee(gross), total: gross + fee(gross) };
}

export function sellProceeds(state, id, qty) {
  const gross = state.stocks.prices[id] * qty;
  return { gross, fee: fee(gross), total: gross - fee(gross) };
}

export function maxBuyQty(state, id) {
  const price = state.stocks.prices[id];
  if (!price || state.money <= 0) return 0;
  return Math.floor(state.money / (price * (1 + D.config.stockFeeRate)));
}

export function buyStock(input, { symbol, qty }) {
  qty = Math.floor(qty);
  if (qty <= 0 || isDelisted(input, symbol)) return input;
  const { total } = buyCost(input, symbol, qty);
  if (total > input.money) return input;
  const state = clone(input);
  const sym = findStock(symbol);
  const price = state.stocks.prices[symbol];
  const h = state.stocks.holdings[symbol] || { qty: 0, avgCost: 0 };
  const newQty = h.qty + qty;
  h.avgCost = Math.round((h.avgCost * h.qty + price * qty) / newQty);
  h.qty = newQty;
  state.stocks.holdings[symbol] = h;
  state.money -= total;
  pushLog(state, { emoji: '📊', title: `매수 ${sym.name} ${qty}주`, amount: -total });
  return state;
}

export function sellStock(input, { symbol, qty }) {
  qty = Math.floor(qty);
  const h = input.stocks.holdings[symbol];
  if (!h || qty <= 0 || qty > h.qty || isDelisted(input, symbol)) return input;
  const { total } = sellProceeds(input, symbol, qty);
  const state = clone(input);
  const sym = findStock(symbol);
  const hh = state.stocks.holdings[symbol];
  hh.qty -= qty;
  if (hh.qty === 0) delete state.stocks.holdings[symbol];
  state.money += total;
  pushLog(state, { emoji: '📊', title: `매도 ${sym.name} ${qty}주`, amount: total });
  return state;
}

/** 보유 평가액과 매입가 대비 수익률 */
export function portfolio(state) {
  let value = 0;
  let cost = 0;
  for (const [id, h] of Object.entries(state.stocks.holdings)) {
    value += h.qty * (state.stocks.prices[id] || 0);
    cost += h.qty * h.avgCost;
  }
  const pct = cost > 0 ? (value - cost) / cost : 0;
  return { value, cost, pct };
}

export function weeklyChangePct(state, id) {
  const prev = state.stocks.prevPrices[id];
  const cur = state.stocks.prices[id];
  if (!prev) return 0;
  return (cur - prev) / prev;
}
