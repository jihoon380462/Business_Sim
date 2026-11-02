import * as core from '../../core/index.js';
import { esc } from '../format.js';

export function renderMainPanel(app) {
  const s = app.state;
  const ch = app.data.characters;
  const main = core.findActivity(s.activity.main);
  const leisure = core.findActivity(s.activity.leisure);
  const study = s.activity.leisure === 'study' ? ` (${app.data.stats.names[s.activity.studyTarget]})` : '';
  const bizType = core.businessType(s);
  const modeLabel = bizType ? app.data.businesses.operationModes[core.operationMode(s)].label : null;
  return `
    <img class="bg" src="${app.asset(ch.background)}" alt="" />
    <img class="char" src="${app.asset(ch.player.genders[s.gender].image)}" alt="" />
    <div class="ph-text">배경 · 주인공 (플레이스홀더)</div>
    <div class="activity-pill" data-action="app.open" data-v="activity">
      <div>${main.emoji} 본업: <b>${esc(main.shortName)}</b></div>
      <div>${leisure.emoji} 여가: <b>${esc(leisure.shortName)}${study}</b></div>
      ${bizType ? `<div class="sub">${bizType.emoji} ${bizType.name} · ${esc(modeLabel)}</div>` : ''}
    </div>`;
}
