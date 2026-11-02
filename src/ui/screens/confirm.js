import { esc } from '../format.js';

/** 범용 확인 팝업. app.openPopup({ type:'confirm', title, text, ok, cancel, onOk }) */
export function render(app) {
  const p = app.ui.popup;
  return `
    <div class="m-head"><h2>${esc(p.title || '확인')}</h2></div>
    <div class="m-body">
      <div class="ev-text">${esc(p.text)}</div>
      <div class="ev-btns">
        <button class="btn primary" data-action="cf.ok">${esc(p.ok || '확인')}</button>
        <button class="btn plain" data-action="cf.cancel">${esc(p.cancel || '취소')}</button>
      </div>
    </div>`;
}

export const actions = {
  'cf.ok': (app) => {
    const fn = app.ui.popup?.onOk;
    app.ui.popup = null;
    if (fn) fn(app);
    app.save();
    app.render();
  },
  'cf.cancel': (app) => app.closePopup(),
};
