import * as core from '../../core/index.js';
import { won, SEASON } from '../format.js';

export function renderTopbar(app) {
  const s = app.state;
  const cfg = app.data.config;
  const segs = cfg.gaugeSegments;
  const filled = Math.min(segs, Math.floor((app.ui.accum / cfg.weekDurationMs) * segs));
  const gauge = Array.from({ length: segs }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('');
  const season = SEASON[core.seasonOf(s.week)];
  const low = s.energy <= cfg.lowEnergyThreshold;
  return `
    <div class="tb-card">
      <div class="tb-label">💵 보유 자금</div>
      <div class="tb-value num ${s.money < 0 ? 'neg' : ''}">${won(s.money)}</div>
    </div>
    <div class="tb-card">
      <div class="tb-week">📅 ${core.weekLabel(s.week)}</div>
      <div class="gauge">${gauge}</div>
    </div>
    <div class="tb-card">
      <div class="tb-label">⚡ 체력</div>
      <div class="tb-energy num">${s.energy}<small>/${cfg.maxEnergy}</small></div>
      <div class="bar ${low ? 'low' : ''}"><i style="width:${(s.energy / cfg.maxEnergy) * 100}%"></i></div>
    </div>
    <div class="tb-card tb-season">
      <div class="ico">${season.ico}</div>
      <div class="txt">${season.txt}</div>
    </div>`;
}
