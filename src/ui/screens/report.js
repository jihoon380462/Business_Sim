import * as core from '../../core/index.js';
import { won, man, amountClass, turnLabel, esc } from '../format.js';

/** 결산 리포트 창 (SCR-06). app.ui.popup = { type:'report', report, reopen? } */
export function render(app) {
  const r = app.ui.popup.report;
  const T = r.totals, A = r.avg;
  const row = (label, key, neg = true, total = false) => {
    const t = neg ? -T[key] : T[key];
    const a = neg ? -A[key] : A[key];
    return `<tr class="${total ? 'total' : ''}"><td>${label}</td><td class="num ${amountClass(t)}">${won(t, { sign: true })}</td><td class="num ${amountClass(a)}">${won(a, { sign: true })}</td></tr>`;
  };
  const rows = [
    row('매출', 'revenue', false),
    row('재료비', 'materials'),
    r.hasLabor ? row('인건비', 'labor') : '',
    row('고정비', 'fixed'),
    row('대출이자', 'interest'),
    row('순이익', 'net', false, true),
  ].join('');
  const maxAbs = Math.max(1, ...r.monthly.map((w) => Math.abs(w.net)));
  const bars = r.monthly.map((w) => {
    const h = Math.max(4, Math.round((Math.abs(w.net) / maxAbs) * 70));
    return `<div class="rep-bar ${w.net < 0 ? 'neg' : ''}"><span class="v num ${amountClass(w.net)}">${man(w.net)}</span><i style="height:${h}px"></i></div>`;
  });
  const weeks = r.monthly.map((w) => `<span>${core.monthOf(w.turn)}월</span>`);
  const as = r.assets;
  return `
    <div class="m-head"><h2>${esc(r.title)}<span class="sub">개업 ${turnLabel(r.fromTurn)} ~ ${turnLabel(r.toTurn)} · ${esc(r.businessName)}</span></h2></div>
    <div class="m-body">
      <table class="rep-table">
        <thead><tr><th>항목</th><th>${r.monthly.length}개월 합계</th><th>월 평균</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="rep-assets"><div><span class="lbl">현금</span><b class="num">${won(as.cash)}</b></div><div><span class="lbl">부채</span><b class="num">${won(as.debt)}</b></div><div><span class="lbl">순자산</span><b class="num ${as.net < 0 ? 'expense' : ''}">${won(as.net)}</b></div></div>
      <h3 class="sec">월별 순이익</h3>
      <div class="rep-bars">${bars.join('')}</div>
      <div class="rep-weeks">${weeks.join('')}</div>
    </div>
    <div class="m-foot"><button class="btn primary" data-action="rep.close">계속하기</button></div>`;
}

export const actions = {
  'rep.close': (app) => {
    if (app.state.goal.pendingReport) app.state = core.dismissReport(app.state);
    app.ui.popup = null;
    app.save();
    app.checkPending();
    app.render();
  },
};
