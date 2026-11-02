import * as core from '../../core/index.js';
import { won, man, amountClass, esc } from '../format.js';

export const title = (app) => {
  const t = core.businessType(app.state);
  return t ? `${t.name} 운영` : '🏪 사업 시작하기';
};

// ---------- 대출 카드 (사업 창 공통) ----------
function loanCard(app) {
  const s = app.state;
  const L = app.data.config.loan;
  const avail = core.loanAvailable(s);
  const step = L.step;
  const canBorrow = avail >= step || (avail > 0 && avail < step);
  const canRepay = s.loan.principal > 0 && s.money > 0;
  return `
    <h3 class="sec">🏦 대출</h3>
    <div class="card loan">
      <div class="row">
        <div class="grow"><div class="muted">대출 잔액 / 한도</div><div class="amt num ${s.loan.principal > 0 ? 'expense' : ''}">${won(s.loan.principal)} <span class="muted">/ ${won(L.limit)}</span></div></div>
        <div class="muted">주 이자 ${(L.weeklyInterestRate * 100).toFixed(1)}%</div>
      </div>
      <div class="btns">
        <button class="btn sm primary" data-action="biz.borrow" ${canBorrow ? '' : 'disabled'}>${man(Math.min(step, avail) || step, { sign: false })} 빌리기</button>
        <button class="btn sm ghost" data-action="biz.repay" ${canRepay ? '' : 'disabled'}>${man(Math.min(step, s.loan.principal, Math.max(0, s.money)) || step, { sign: false })} 갚기</button>
      </div>
    </div>`;
}

// ---------- 개업 전 ----------
function renderOpen(app) {
  const s = app.state;
  const sel = app.ui.scratch.bizType || 'stall';
  const cards = app.data.businesses.types.map((t) => {
    const chk = core.canOpen(s, t.id);
    const locked = chk.reason === 'locked';
    const on = sel === t.id && !locked;
    return `
      <div class="biz-card ${on ? 'on' : ''} ${locked ? 'locked' : ''}" ${locked ? '' : `data-action="biz.pick" data-v="${t.id}"`}>
        <img class="biz-thumb" src="${app.asset(t.icon)}" alt="" />
        <div class="grow">
          <div class="biz-name">${esc(t.name)}</div>
          <div class="biz-stat">💵 개업비<b>${man(t.openCost, { sign: false })}</b></div>
          ${locked ? '' : `<div class="biz-stat">📊 예상 주매출<b>${man(t.revenueMin, { sign: false })}~${man(t.revenueMax, { sign: false })}</b></div>`}
        </div>
        ${on ? '<div class="biz-check">✓</div>' : locked ? '<div class="biz-lock">🔒</div>' : ''}
      </div>`;
  });
  const chk = core.canOpen(s, sel);
  const status = chk.reason === 'money' ? `<div class="status-line err">자금이 ${man(chk.shortfall, { sign: false })} 부족합니다</div>` : '<div class="status-line"></div>';
  return `
    ${cards.join('')}
    ${status}
    <button class="btn primary" data-action="biz.openConfirm" ${chk.ok ? '' : 'disabled'}>개업하기</button>
    ${loanCard(app)}`;
}

// ---------- 운영 중 ----------
function renderManage(app) {
  const s = app.state;
  const b = s.business;
  const t = core.businessType(s);
  const B = app.data.businesses;
  const lw = b.lastWeek;
  const kpi = lw
    ? `<div class="kpi card">
        <div><div class="lbl">지난주 매출</div><div class="val num ${amountClass(lw.revenue)}">${man(lw.revenue)}</div></div>
        <div><div class="lbl">비용</div><div class="val num expense">${man(-(lw.fixed + lw.promo + lw.labor + lw.materials + lw.interest))}</div></div>
        <div><div class="lbl">순익</div><div class="val num ${amountClass(lw.net)}">${man(lw.net)}</div></div>
      </div>`
    : `<div class="card hint">첫 정산은 다음 주에 나옵니다</div>`;

  const editing = app.ui.scratch.editName;
  const nameRow = editing
    ? `<div class="card name-edit"><span class="b">가게 이름</span><input id="biz-name-input" maxlength="${B.nameMaxLength}" value="${esc(b.name)}" data-change="biz.nameCommit" /><button class="btn sm auto primary" data-action="biz.nameCommit">확인</button></div>`
    : `<div class="card name-edit" data-action="biz.nameEdit"><span class="b">가게 이름</span><input readonly value="${esc(b.name)}" /><span>✏️</span></div>`;

  const seg = (opts, cur, action) =>
    `<div class="seg">${opts.map(([v, l]) => `<button class="${cur === v ? 'on' : ''}" data-action="${action}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const up = core.upgradeCost(s);
  const stars = `<div class="stars">${[1, 2, 3].map((g) => `<button class="${g <= b.grade ? 'on' : ''}" data-action="biz.upgrade" data-v="${g}">★</button>`).join('')}
    <span class="muted">${up ? `다음 ${man(up.cost, { sign: false })}` : '최고 등급'}</span></div>`;

  let staff = '';
  if (t.staff) {
    staff = `<h3 class="sec">직원 ${b.staff}명</h3>` + (b.staff > 0
      ? `<div class="staff-card"><img src="${app.asset(t.staff.avatar)}" alt="" /><div class="grow"><div class="b">${esc(t.staff.name)}</div><div class="muted">급여 ${man(t.staff.wage, { sign: false })} · 매출 +${Math.round((t.staff.revenueMult - 1) * 100)}%</div></div><button class="btn danger-text" data-action="biz.fire">해고</button></div>`
      : `<button class="btn ghost" data-action="biz.hire">고용하기 (주 ${man(t.staff.wage, { sign: false })}, 매출 +${Math.round((t.staff.revenueMult - 1) * 100)}%)</button>`);
  }

  let upgrade = '';
  const next = app.data.businesses.types.find((x) => x.unlock.requiresBusiness === b.type);
  if (next) {
    const chk = core.canOpen(s, next.id);
    upgrade = `<button class="btn ${chk.ok ? 'primary' : 'plain'}" data-action="biz.expandConfirm" data-v="${next.id}" ${chk.ok ? '' : 'disabled'}>${next.name}으로 확장 (${man(next.openCost, { sign: false })})</button>
      ${chk.reason === 'money' ? `<div class="status-line err">자금이 ${man(chk.shortfall, { sign: false })} 부족합니다</div>` : ''}`;
  }

  return `
    ${nameRow}
    <div class="card row"><span class="b">평판</span><span class="num"><b>${b.reputation}</b><span class="muted">/${B.reputationMax}</span></span><div class="grow"><div class="bar teal"><i style="width:${(b.reputation / B.reputationMax) * 100}%"></i></div></div></div>
    ${kpi}
    <h3 class="sec">운영 방침</h3>
    <div class="card policy">
      <div class="row"><span class="ico">🏷️</span><span class="lbl">가격</span>${seg(Object.entries(B.priceOptions).map(([k, v]) => [k, v.label]), b.price, 'biz.price')}</div>
      <div class="row"><span class="ico">🧺</span><span class="lbl">재료 등급</span>${stars}</div>
      <div class="row"><span class="ico">📣</span><span class="lbl">홍보</span><button class="toggle ${b.promo ? 'on' : ''}" data-action="biz.promo"></button><span class="muted">${b.promo ? `켬 · 주 ${man(t.promoCost, { sign: false })}` : '끔'}</span></div>
      <div class="row"><span class="ico">🏪</span><span class="lbl">영업 상태</span>${seg([[true, '영업'], [false, '휴무']], b.open, 'biz.open')}</div>
    </div>
    ${staff}
    ${upgrade}
    ${loanCard(app)}`;
}

export function render(app) {
  return app.state.business ? renderManage(app) : renderOpen(app);
}

export const actions = {
  'biz.pick': (app, el) => { app.ui.scratch.bizType = el.dataset.v; app.render(); },
  'biz.openConfirm': (app) => {
    const id = app.ui.scratch.bizType || 'stall';
    const t = core.findBusinessType(id);
    app.openPopup({
      type: 'confirm', title: '개업', text: `${man(t.openCost, { sign: false })}원을 쓰고 ${t.name}을 엽니다. 계속?`, ok: '개업', cancel: '취소',
      onOk: (a) => { a.state = core.openBusiness(a.state, { typeId: id }); },
    });
  },
  'biz.expandConfirm': (app, el) => {
    const id = el.dataset.v;
    const t = core.findBusinessType(id);
    app.openPopup({
      type: 'confirm', title: '확장', text: `${man(t.openCost, { sign: false })}원을 쓰고 ${t.name}으로 확장합니다. 평판은 유지되고 재료 등급은 1단계로 시작합니다. 계속?`, ok: '확장', cancel: '취소',
      onOk: (a) => { a.state = core.openBusiness(a.state, { typeId: id }); },
    });
  },
  'biz.price': (app, el) => app.dispatch(core.setPolicy(app.state, { price: el.dataset.v })),
  'biz.promo': (app) => app.dispatch(core.setPolicy(app.state, { promo: !app.state.business.promo })),
  'biz.open': (app, el) => app.dispatch(core.setPolicy(app.state, { open: el.dataset.v === 'true' })),
  'biz.upgrade': (app, el) => {
    const g = Number(el.dataset.v);
    const up = core.upgradeCost(app.state);
    if (!up || g !== up.grade) return;
    const short = app.state.money < up.cost;
    app.openPopup({
      type: 'confirm', title: '재료 등급 업그레이드',
      text: short ? `${man(up.cost, { sign: false })}원이 필요합니다. 자금이 ${man(up.cost - app.state.money, { sign: false })} 부족합니다.` : `${man(up.cost, { sign: false })}원을 쓰고 재료 등급을 ${up.grade}단계로 올립니다. 계속?`,
      ok: short ? '확인' : '업그레이드', cancel: '취소',
      onOk: (a) => { if (!short) a.state = core.upgradeIngredients(a.state); },
    });
  },
  'biz.hire': (app) => {
    const t = core.businessType(app.state);
    app.openPopup({
      type: 'confirm', title: '직원 고용', text: `${t.staff.name}을(를) 고용합니다. 매주 급여 ${man(t.staff.wage, { sign: false })}이 나가고 매출이 ${Math.round((t.staff.revenueMult - 1) * 100)}% 오릅니다. 계속?`, ok: '고용', cancel: '취소',
      onOk: (a) => { a.state = core.hireStaff(a.state); },
    });
  },
  'biz.fire': (app) => {
    app.openPopup({
      type: 'confirm', title: '직원 해고', text: '직원을 해고합니다. 계속?', ok: '해고', cancel: '취소',
      onOk: (a) => { a.state = core.fireStaff(a.state); },
    });
  },
  'biz.nameEdit': (app) => {
    app.ui.scratch.editName = true;
    app.render();
    const inp = document.getElementById('biz-name-input');
    if (inp) { inp.focus(); inp.select(); }
  },
  'biz.nameCommit': (app) => {
    const inp = document.getElementById('biz-name-input');
    const name = inp ? inp.value : '';
    app.ui.scratch.editName = false;
    app.dispatch(core.renameBusiness(app.state, { name }));
  },
  'biz.borrow': (app) => {
    const step = app.data.config.loan.step;
    app.dispatch(core.borrow(app.state, { amount: Math.min(step, core.loanAvailable(app.state)) }));
  },
  'biz.repay': (app) => {
    const step = app.data.config.loan.step;
    app.dispatch(core.repay(app.state, { amount: Math.min(step, app.state.loan.principal, app.state.money) }));
  },
};
