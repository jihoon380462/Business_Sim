import * as core from '../../core/index.js';
import { won, esc, signed, amountClass } from '../format.js';

/** 월 결산 요약 팝업 (UI_SPEC 13.6) */
export function render(app) {
  const s = app.state;
  const m = s.summary;
  if (!m) return '<div class="m-body"><div class="hint">결산 없음</div></div>';
  const names = app.data.stats.names;
  const row = (it, sign) => `<tr><td>${esc(it.label)}</td><td class="num ${sign > 0 ? 'income' : 'expense'}">${won(it.amount * sign, { sign: true })}</td></tr>`;
  const incomeRows = m.income.map((it) => row(it, 1)).join('') || '<tr><td class="muted">수입 없음</td><td></td></tr>';
  const expenseRows = m.expense.map((it) => row(it, -1)).join('');
  const statLine = Object.entries(m.statDelta).map(([k, v]) => `${names[k]} ${signed(v)}`).join(' · ');
  const notices = m.notices.map((n) => `<div class="notice-row"><span>${n.emoji}</span><span>${esc(n.text)}</span></div>`).join('');
  return `
    <div class="m-head"><h2>${core.turnLabel(m.turn)} 결산</h2></div>
    <div class="m-body">
      <table class="rep-table sum-table">
        <tbody>
          <tr class="grp"><td colspan="2">수입</td></tr>${incomeRows}
          <tr class="grp"><td colspan="2">지출</td></tr>${expenseRows}
          <tr class="total"><td>이번 달 순변동</td><td class="num ${amountClass(m.net)}">${won(m.net, { sign: true })}</td></tr>
          <tr><td class="muted">현재 자금</td><td class="num b ${m.moneyAfter < 0 ? 'expense' : ''}">${won(m.moneyAfter)}</td></tr>
        </tbody>
      </table>
      <div class="card flat sum-stats">
        <div>스탯 ${statLine ? `<b>${statLine}</b>` : '<span class="muted">변화 없음</span>'}</div>
        <div>컨디션 <b class="num">${m.conditionFrom} → ${m.conditionTo}</b></div>
      </div>
      ${notices ? `<div class="notices">${notices}</div>` : ''}
    </div>
    <div class="m-foot"><button class="btn primary" data-action="sum.close">확인</button></div>`;
}

export const actions = {
  'sum.close': (app) => {
    app.ui.popup = null;
    app.checkPending();
    app.render();
  },
};
