import * as core from '../../core/index.js';
import { won, pct, amountClass, esc } from '../format.js';

export const title = () => '📊 주식';

function sparkline(history, up) {
  const w = 64, h = 28, pad = 2;
  const min = Math.min(...history), max = Math.max(...history);
  const span = max - min || 1;
  const pts = history.map((v, i) => {
    const x = pad + (i / (history.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y];
  });
  const line = pts.map((p) => p.join(',')).join(' ');
  const area = `${pad},${h} ${line} ${w - pad},${h}`;
  const color = up ? 'var(--green)' : 'var(--red)';
  return `<svg class="stk-chart" viewBox="0 0 ${w} ${h}"><polygon points="${area}" fill="${color}" opacity=".15"/><polyline points="${line}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
}

export function render(app) {
  const s = app.state;
  const sc = app.ui.scratch;
  const banner = core.rumorBanner(s);
  const pf = core.portfolio(s);
  const rows = app.data.stocks.symbols.map((sym) => {
    const dead = core.isDelisted(s, sym.id);
    const price = s.stocks.prices[sym.id];
    const chg = core.monthlyChangePct(s, sym.id);
    const hist = s.stocks.history[sym.id];
    const up = hist[hist.length - 1] >= hist[0];
    const open = sc.stock === sym.id && !dead;
    const h = s.stocks.holdings[sym.id];
    let ext = '';
    if (open) {
      const qty = Math.max(1, sc.qty || 1);
      const maxBuy = core.maxBuyQty(s, sym.id);
      const held = h ? h.qty : 0;
      const buy = core.buyCost(s, sym.id, qty);
      const sell = core.sellProceeds(s, sym.id, qty);
      ext = `
        <div class="stk-ext">
          <div class="muted">보유 ${held}주 · 평균 ${h ? won(h.avgCost) : '-'}${h ? ` · 평가 ${won(held * price)}` : ''}</div>
          <div class="trade">
            <div class="stepper">
              <button data-action="stk.qty" data-v="-1" ${qty <= 1 ? 'disabled' : ''}>−</button>
              <div class="q num">${qty}</div>
              <button data-action="stk.qty" data-v="1">+</button>
              <button class="max" data-action="stk.qty" data-v="max">MAX</button>
            </div>
          </div>
          <div class="trade">
            <button class="btn primary" data-action="stk.buy" ${qty > maxBuy ? 'disabled' : ''}>매수 ${won(buy.total)}</button>
            <button class="btn ghost" data-action="stk.sell" ${held < qty ? 'disabled' : ''}>매도 ${won(sell.total)}</button>
          </div>
          <div class="hint">수수료 ${(app.data.config.stockFeeRate * 100).toFixed(1)}% 포함 · 가격은 매달 바뀝니다</div>
        </div>`;
    }
    return `
      <div class="stk ${open ? 'on' : ''} ${dead ? 'dead' : ''}" ${dead ? '' : `data-action="stk.toggle" data-v="${sym.id}"`}>
        <div class="stk-row">
          <div class="stk-name">${esc(sym.name)}${dead ? '<span class="tag">상장폐지</span>' : ''}${h && !open ? `<div class="muted">보유 ${h.qty}주</div>` : ''}</div>
          <div class="stk-price num">${dead ? '-' : won(price)}</div>
          <div class="stk-pct num ${amountClass(chg)}">${dead ? '' : pct(chg)}</div>
          ${dead ? '' : sparkline(hist, up)}
        </div>
        ${ext}
      </div>`;
  });
  return `
    ${banner ? `<div class="rumor">📣 <span>${esc(banner)}</span></div>` : ''}
    <div class="card pf">
      <span class="lbl">내 평가액</span>
      <span class="val num">${won(pf.value)}</span>
      ${pf.cost > 0 ? `<span class="pct num ${amountClass(pf.pct)}">(${pct(pf.pct)})</span>` : ''}
    </div>
    ${rows.join('')}`;
}

export const actions = {
  'stk.toggle': (app, el, ev) => {
    if (ev.target.closest('.stk-ext')) return;
    const id = el.dataset.v;
    app.ui.scratch.stock = app.ui.scratch.stock === id ? null : id;
    app.ui.scratch.qty = 1;
    app.render();
  },
  'stk.qty': (app, el) => {
    const id = app.ui.scratch.stock;
    const cur = app.ui.scratch.qty || 1;
    if (el.dataset.v === 'max') {
      const held = app.state.stocks.holdings[id]?.qty || 0;
      app.ui.scratch.qty = Math.max(1, core.maxBuyQty(app.state, id), held);
    } else {
      app.ui.scratch.qty = Math.max(1, cur + Number(el.dataset.v));
    }
    app.render();
  },
  'stk.buy': (app) => {
    app.dispatch(core.buyStock(app.state, { symbol: app.ui.scratch.stock, qty: app.ui.scratch.qty || 1 }));
  },
  'stk.sell': (app) => {
    app.dispatch(core.sellStock(app.state, { symbol: app.ui.scratch.stock, qty: app.ui.scratch.qty || 1 }));
  },
};
