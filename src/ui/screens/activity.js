import * as core from '../../core/index.js';
import { man, esc } from '../format.js';

export const title = () => '현재 활동 선택';

export function render(app) {
  const s = app.state;
  const sel = app.ui.scratch.activity ?? s.activity;
  return app.data.jobs.activities
    .map((j) => {
      const can = core.canDoActivity(s, j.id);
      const on = sel === j.id;
      const e = j.energyDelta;
      return `
      <div class="act-card ${on ? 'on' : ''} ${can ? '' : 'off'}" ${can ? `data-action="act.pick" data-v="${j.id}"` : ''}>
        <div class="act-ico">${j.emoji}</div>
        <div class="grow">
          <div class="act-name">${esc(j.name)}</div>
          <div class="act-wage">${j.wage > 0 ? `주급<b>${man(j.wage, { sign: false })}</b>` : '-'}</div>
        </div>
        <div class="act-energy">
          <div class="lbl">⚡ 체력</div>
          <div class="val ${e < 0 ? 'expense' : 'income'}">${e > 0 ? '+' : ''}${e}</div>
          ${can ? '' : '<div class="lbl expense">체력 부족</div>'}
        </div>
        <div class="radio"></div>
      </div>`;
    })
    .join('');
}

export function footer(app) {
  const sel = app.ui.scratch.activity ?? app.state.activity;
  const changed = sel !== app.state.activity;
  return `<button class="btn primary" data-action="act.apply" ${changed ? '' : 'disabled'}>적용</button>`;
}

export const actions = {
  'act.pick': (app, el) => {
    app.ui.scratch.activity = el.dataset.v;
    app.render();
  },
  'act.apply': (app) => {
    const sel = app.ui.scratch.activity;
    if (!sel) return;
    app.dispatch(core.setActivity(app.state, { activityId: sel }));
    app.closeModal();
  },
};
