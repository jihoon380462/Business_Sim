import * as core from '../../core/index.js';
import { weekLabel } from '../format.js';
import { APP_VERSION, APP_BUILD } from '../../version.js';

export const title = () => '⚙️ 설정';

export function render(app) {
  const s = app.state;
  const g = app.data.characters.player.genders;
  const other = s.gender === 'm' ? 'f' : 'm';
  return `
    <div class="card">
      <div class="set-row"><span class="lbl">저장</span><span class="muted">자동 저장 · ${weekLabel(s.week)}</span></div>
      <div class="set-row"><span class="lbl">이어하기</span><button class="btn sm auto ghost" data-action="set.continue">마지막 저장 불러오기</button></div>
      <div class="set-row"><span class="lbl">새로하기</span><button class="btn sm auto plain" data-action="set.new">처음부터</button></div>
    </div>
    <div class="card">
      <div class="set-row"><span class="lbl">주인공</span><button class="btn sm auto ghost" data-action="set.gender">${g[s.gender].label} → ${g[other].label}</button></div>
      <div class="set-row off"><span class="lbl">사운드</span><button class="toggle" disabled></button></div>
      <div class="set-row ${s.goal.lastReport ? '' : 'off'}"><span class="lbl">최근 결산</span><button class="btn sm auto plain" data-action="set.report" ${s.goal.lastReport ? '' : 'disabled'}>최근 결산 보기</button></div>
    </div>
    <div class="hint">V1 프로토타입 · 아트는 플레이스홀더<br />버전 <b>v${APP_VERSION}</b> · 빌드 ${APP_BUILD}</div>`;
}

export const actions = {
  'set.continue': (app) => {
    app.openPopup({
      type: 'confirm', title: '이어하기', text: '마지막 자동 저장 시점으로 되돌립니다. 계속?', ok: '불러오기', cancel: '취소',
      onOk: (a) => { a.ui.modal = null; a.continueGame(); },
    });
  },
  'set.new': (app) => {
    app.openPopup({
      type: 'confirm', title: '새로하기', text: '지금 진행 상황을 지우고 처음부터 시작합니다. 계속?', ok: '새로 시작', cancel: '취소',
      onOk: (a) => { a.ui.modal = null; a.newGame(); },
    });
  },
  'set.gender': (app) => {
    app.dispatch(core.setGender(app.state, { gender: app.state.gender === 'm' ? 'f' : 'm' }), { save: true });
  },
  'set.report': (app) => {
    if (!app.state.goal.lastReport) return;
    app.openPopup({ type: 'report', report: app.state.goal.lastReport, reopen: true });
  },
};
