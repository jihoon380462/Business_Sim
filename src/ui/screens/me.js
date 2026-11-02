import * as core from '../../core/index.js';
import { esc, signed } from '../format.js';

export const title = () => '🧍 나';

export function render(app) {
  const s = app.state;
  const S = app.data.stats;
  const delta = s.summary?.statDelta || {};
  const open = app.ui.scratch.statOpen;
  const max = core.maxCondition(s);
  const low = core.isLowCondition(s);
  const g = app.data.characters.player.genders[s.gender];
  const rows = S.order.map((k) => `
    <div class="stat-row" data-action="me.toggle" data-v="${k}">
      <div class="row">
        <span class="stat-name">${S.names[k]}</span>
        <div class="grow"><div class="bar teal"><i style="width:${s.stats[k]}%"></i></div></div>
        <span class="stat-val num">${s.stats[k]}</span>
        <span class="stat-delta num ${delta[k] > 0 ? 'income' : delta[k] < 0 ? 'expense' : ''}">${delta[k] ? signed(delta[k]) : ''}</span>
      </div>
      ${open === k ? `<div class="muted stat-desc">${esc(S.descriptions[k])}</div>` : ''}
    </div>`);
  return `
    <div class="card row">
      <img class="portrait" src="${app.asset(g.image)}" alt="" />
      <div class="grow">
        <div class="b">주인공 (${g.label})</div>
        <div class="muted">${core.turnLabel(s.turn)} · 나이 ${core.ageAt(s.turn)}세</div>
      </div>
    </div>
    <div class="card">
      <div class="row"><span class="b">⚡ 컨디션</span><span class="num ${low ? 'expense' : ''}"><b>${s.condition}</b><span class="muted">/${max}</span></span></div>
      <div class="bar ${low ? 'low' : ''}"><i style="width:${max ? (s.condition / max) * 100 : 0}%"></i></div>
      <div class="muted" style="margin-top:4px">최대치 = 체력 스탯. 0이 되면 다음 달 강제 휴식.</div>
    </div>
    <h3 class="sec">스탯 <span class="muted" style="font-weight:400">· 지난달 변화</span></h3>
    <div class="card stats">${rows.join('')}</div>
    <div class="hint">줄을 탭하면 쓰임이 보입니다 · 경력·자격은 V2</div>`;
}

export const actions = {
  'me.toggle': (app, el) => {
    const k = el.dataset.v;
    app.ui.scratch.statOpen = app.ui.scratch.statOpen === k ? null : k;
    app.render();
  },
};
