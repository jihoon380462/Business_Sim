import * as core from '../../core/index.js';
import { esc } from '../format.js';

/** 선택형 이벤트 팝업. 선택 전까지 닫을 수 없다. */
export function render(app) {
  const p = app.state.events.pending;
  if (!p) return '<div class="m-body"><div class="hint">…</div></div>';
  const R = app.data.events.rumor;
  const btns = p.choices.map((c, i) => {
    const disabled = c.id === 'pay' && app.state.money < R.cost;
    return `<button class="btn ${i === 0 ? 'primary' : 'plain'}" data-action="ev.choose" data-v="${c.id}" ${disabled ? 'disabled' : ''}>${esc(c.label)}${disabled ? ' (자금 부족)' : ''}</button>`;
  });
  return `
    <div class="m-head"><h2>${p.emoji || ''} ${esc(p.title)}</h2></div>
    <div class="m-body">
      <div class="ev-text">${esc(p.text)}</div>
      <div class="ev-btns">${btns.join('')}</div>
    </div>`;
}

export const actions = {
  'ev.choose': (app, el) => {
    app.state = core.resolveEvent(app.state, { choiceId: el.dataset.v });
    app.ui.popup = null;
    app.save();
    app.checkPending();
    app.render();
  },
};
