import * as core from '../../core/index.js';

export function renderNextButton(app) {
  const s = app.state;
  const next = core.turnLabel(s.turn + 1);
  return `<button class="btn primary next-btn" data-action="app.next" ${app.ui.busy ? 'disabled' : ''}>다음 달 ▶ <span class="sub">${next}</span></button>`;
}
