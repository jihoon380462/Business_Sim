import * as core from '../../core/index.js';
import { won, SEASON } from '../format.js';

export function renderTopbar(app) {
  const s = app.state;
  const max = core.maxCondition(s);
  const low = core.isLowCondition(s);
  const season = SEASON[core.seasonOf(s.turn)];
  return `
    <div class="tb-card">
      <div class="tb-label">💵 보유 자금</div>
      <div class="tb-value num ${s.money < 0 ? 'neg' : ''}">${won(s.money)}</div>
    </div>
    <div class="tb-card">
      <div class="tb-label">📅 날짜</div>
      <div class="tb-week">${core.turnLabel(s.turn)}</div>
    </div>
    <div class="tb-card">
      <div class="tb-label">⚡ 컨디션</div>
      <div class="tb-energy num ${low ? 'expense' : ''}">${s.condition}<small>/${max}</small></div>
      <div class="bar ${low ? 'low' : ''}"><i style="width:${max ? (s.condition / max) * 100 : 0}%"></i></div>
    </div>
    <div class="tb-card tb-season">
      <div class="ico">${season.ico}</div>
      <div class="txt">${season.txt}</div>
    </div>`;
}
