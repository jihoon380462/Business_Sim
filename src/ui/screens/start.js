import { turnLabel, won } from '../format.js';

/** 재진입 시: 이어하기 / 새로하기 */
export function render(app) {
  const s = app.state;
  return `
    <div class="m-head"><h2>저장된 게임이 있습니다</h2></div>
    <div class="m-body">
      <div class="ev-text">${turnLabel(s.turn)} · 자금 ${won(s.money)}</div>
      <div class="ev-btns">
        <button class="btn primary" data-action="st.continue">이어하기</button>
        <button class="btn plain" data-action="st.new">새로하기</button>
      </div>
    </div>`;
}

export const actions = {
  'st.continue': (app) => { app.ui.popup = null; app.continueGame(); app.checkPending(); app.render(); },
  'st.new': (app) => {
    app.openPopup({
      type: 'confirm', title: '새로하기', text: '저장된 진행 상황을 지우고 처음부터 시작합니다. 계속?', ok: '새로 시작', cancel: '취소',
      onOk: (a) => a.newGame(),
    });
  },
};
