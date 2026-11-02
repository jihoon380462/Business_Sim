import * as core from '../../core/index.js';
import { man, esc, signed } from '../format.js';

export const title = () => '이번 달 활동';

function gainText(app, gains) {
  const names = app.data.stats.names;
  const parts = Object.entries(gains || {}).map(([k, v]) => `${names[k]} +${v}`);
  return parts.join(' · ');
}

function sel(app) {
  const sc = app.ui.scratch;
  const A = app.state.activity;
  return {
    main: sc.main ?? (A.main === app.data.jobs.forcedRestId ? A.prevMain : A.main) ?? app.data.jobs.defaultMain,
    leisure: sc.leisure ?? A.leisure,
    study: sc.study ?? A.studyTarget,
    delegate: sc.delegate ?? A.delegate,
  };
}

export function render(app) {
  const s = app.state;
  const names = app.data.stats.names;
  const cur = sel(app);
  const forced = s.activity.main === app.data.jobs.forcedRestId;

  const mainCards = core.activitiesBySlot('main').map((a) => {
    const chk = core.canChooseMain(s, a.id);
    if (!chk.ok && a.requiresBusiness) return '';
    const on = cur.main === a.id;
    const inc = core.expectedIncome(s, a.id);
    const incLine = a.income > 0
      ? `<div class="act-wage">월 ${man(a.income, { sign: false })} × ${names[a.incomeStat]} <b>≈ ${man(inc, { sign: false })}</b></div>`
      : `<div class="act-wage">가게 매출 × 1.0${s.business && s.business.staff > 0 ? ' (직원 있음 ×1.25)' : ''}</div>`;
    return `
      <div class="act-card ${on ? 'on' : ''}" data-action="act.main" data-v="${a.id}">
        <div class="act-ico">${a.emoji}</div>
        <div class="grow">
          <div class="act-name">${esc(a.name)}</div>
          ${incLine}
          <div class="muted">${gainText(app, a.statGain)}</div>
        </div>
        <div class="act-energy"><div class="lbl">⚡ 컨디션</div><div class="val ${a.conditionDelta < 0 ? 'expense' : 'income'}">${signed(a.conditionDelta)}</div></div>
        <div class="radio"></div>
      </div>`;
  });

  // 위임 (분식집 전용 토글)
  let delegateCard = '';
  if (s.business) {
    const d = core.canDelegate(s);
    const J = app.data.jobs.delegate;
    delegateCard = `
      <div class="act-card toggle-card ${cur.delegate && d.ok ? 'on' : ''} ${d.ok ? '' : 'off'}" ${d.ok ? 'data-action="act.delegate"' : ''}>
        <div class="act-ico">${J.emoji}</div>
        <div class="grow">
          <div class="act-name">${esc(J.name)}</div>
          <div class="muted">${esc(J.description)}</div>
          ${d.ok ? '' : `<div class="lbl expense">${esc(d.reason)}</div>`}
        </div>
        <div class="radio"></div>
      </div>`;
  }

  const leisureCards = core.activitiesBySlot('leisure').map((a) => {
    const on = cur.leisure === a.id;
    let effect = gainText(app, a.statGain);
    if (a.studyGain) effect = `선택 스탯 +${a.studyGain}`;
    const studySeg = a.id === 'study' && on
      ? `<div class="seg study-seg">${app.data.stats.studyTargets.map((t) => `<button data-action="act.study" data-v="${t}" class="${cur.study === t ? 'on' : ''}">${names[t]}</button>`).join('')}</div>`
      : '';
    return `
      <div class="act-card ${on ? 'on' : ''}" data-action="act.leisure" data-v="${a.id}">
        <div class="act-ico">${a.emoji}</div>
        <div class="grow">
          <div class="act-name">${esc(a.name)}</div>
          <div class="act-wage">${a.cost > 0 ? `월 <b class="expense">-${man(a.cost, { sign: false })}</b>` : '비용 없음'}${effect ? ` · <span class="muted">${effect}</span>` : ''}</div>
          ${studySeg}
        </div>
        <div class="act-energy"><div class="lbl">⚡ 컨디션</div><div class="val ${a.conditionDelta < 0 ? 'expense' : 'income'}">${signed(a.conditionDelta)}</div></div>
        <div class="radio"></div>
      </div>`;
  });

  return `
    ${forced ? '<div class="rumor">😵 이번 달은 컨디션 0으로 강제 휴식입니다. 아래 선택은 다음 달부터 적용됩니다.</div>' : ''}
    <h3 class="sec">본업</h3>
    ${mainCards.join('')}
    ${delegateCard}
    <h3 class="sec">여가</h3>
    ${leisureCards.join('')}
    <div class="hint">선택은 바꾸기 전까지 다음 달에도 유지됩니다</div>`;
}

export function footer(app) {
  const cur = sel(app);
  const A = app.state.activity;
  const base = A.main === app.data.jobs.forcedRestId ? A.prevMain : A.main;
  const changed = cur.main !== base || cur.leisure !== A.leisure || cur.study !== A.studyTarget || cur.delegate !== A.delegate;
  return `<button class="btn primary" data-action="act.apply" ${changed ? '' : 'disabled'}>적용</button>`;
}

export const actions = {
  'act.main': (app, el) => { app.ui.scratch.main = el.dataset.v; app.render(); },
  'act.leisure': (app, el) => { app.ui.scratch.leisure = el.dataset.v; app.render(); },
  'act.study': (app, el, ev) => { ev.stopPropagation(); app.ui.scratch.study = el.dataset.v; app.ui.scratch.leisure = 'study'; app.render(); },
  'act.delegate': (app) => { const c = sel(app); app.ui.scratch.delegate = !c.delegate; app.render(); },
  'act.apply': (app) => {
    const cur = sel(app);
    let s = app.state;
    const forced = s.activity.main === app.data.jobs.forcedRestId;
    if (forced) {
      // 강제 휴식 달: 복귀 본업만 기록
      if (core.canChooseMain(s, cur.main).ok) { s = core.clone(s); s.activity.prevMain = cur.main; }
    } else {
      s = core.setActivity(s, { slot: 'main', activityId: cur.main });
    }
    s = core.setActivity(s, { slot: 'leisure', activityId: cur.leisure });
    s = core.setStudyTarget(s, { target: cur.study });
    s = core.setDelegate(s, { delegate: cur.delegate });
    app.dispatch(s);
    app.closeModal();
  },
};
