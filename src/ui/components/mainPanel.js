import * as core from '../../core/index.js';
import { esc } from '../format.js';

export function renderMainPanel(app) {
  const s = app.state;
  const ch = app.data.characters;
  const job = core.findJob(s.activity);
  const bizType = core.businessType(s);
  const bizText = bizType ? ` · <span class="sub">${bizType.name} ${s.business.open ? '운영 중' : '휴무'}</span>` : '';
  return `
    <img class="bg" src="${app.asset(ch.background)}" alt="" />
    <img class="char" src="${app.asset(ch.player.genders[s.gender].image)}" alt="" />
    <div class="ph-text">배경 · 주인공 (플레이스홀더)</div>
    <div class="activity-pill">${job.emoji} 현재 활동: <b>${esc(job.shortName)}</b>${bizText}</div>`;
}
