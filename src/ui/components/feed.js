import { man, won, amountClass, turnLabel, esc } from '../format.js';

export function feedCard(app, item, { clickable = true } = {}) {
  const cfg = app.data.config;
  const hasAmt = item.amount != null;
  const big = hasAmt && Math.abs(item.amount) >= cfg.bigMoneyThreshold;
  const cls = hasAmt ? amountClass(item.amount) : '';
  return `
    <div class="feed-card" ${clickable ? 'data-action="app.openLog"' : ''}>
      <div class="feed-ico">${item.emoji || '•'}</div>
      <div class="feed-title">${esc(item.title)}${hasAmt ? `<span class="amt ${cls}">${man(item.amount)}</span>` : ''}</div>
      <div class="feed-right">
        <div class="feed-week">${turnLabel(item.turn)}</div>
        ${hasAmt ? `<div class="feed-amt num ${cls} ${big ? 'big' : ''}">${won(item.amount, { sign: true })}</div>` : ''}
      </div>
    </div>`;
}

export function renderFeed(app) {
  const items = app.state.log.slice(0, app.data.config.feedVisible);
  if (!items.length) {
    return `<div class="feed-card empty">활동을 고르고 "다음 달 ▶"을 누르세요. 매달 결과가 여기에 쌓입니다.</div>`;
  }
  const rows = items.map((it) => feedCard(app, it));
  while (rows.length < app.data.config.feedVisible) rows.push('<div class="feed-card empty"></div>');
  return rows.join('');
}
