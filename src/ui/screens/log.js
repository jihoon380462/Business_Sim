import { won, amountClass, turnLabel, esc } from '../format.js';

export const title = () => '전체 기록';

export function render(app) {
  const rows = app.state.log.map(
    (it) => `<div class="log-row"><span class="w">${turnLabel(it.turn)}</span><span>${it.emoji || ''}</span><span class="t">${esc(it.title)}</span>${it.amount != null ? `<span class="a num ${amountClass(it.amount)}">${won(it.amount, { sign: true })}</span>` : ''}</div>`,
  );
  return `<div class="log-list">${rows.join('') || '<div class="hint">아직 기록이 없습니다</div>'}</div>`;
}

export const actions = {};
