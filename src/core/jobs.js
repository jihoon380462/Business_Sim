// 알바 · 체력.
import { D, findJob } from './data.js';
import { clone, pushLog } from './state.js';
import { chance } from './rng.js';

/** 활동 변경. 체력이 모자라는 알바는 거부. */
export function setActivity(input, { activityId }) {
  const job = findJob(activityId);
  if (!job) return input;
  if (!canDoActivity(input, activityId)) return input;
  const state = clone(input);
  state.activity = activityId;
  return state;
}

export function canDoActivity(state, activityId) {
  const job = findJob(activityId);
  if (!job) return false;
  if (job.energyDelta >= 0) return true;
  return state.energy >= -job.energyDelta;
}

/** 매주 정산: 주급·체력. 체력 부족 또는 0 → 자동 휴식. */
export function settleJob(state) {
  const cfg = D.config;
  const restId = D.jobs.restId;
  let job = findJob(state.activity) || findJob(restId);

  // 체력이 소모량보다 적으면 일을 못 한다 → 휴식으로 전환
  if (job.energyDelta < 0 && state.energy < -job.energyDelta) {
    state.activity = restId;
    job = findJob(restId);
    pushLog(state, { emoji: '😵', title: '체력 부족 — 자동 휴식 전환' });
  }

  if (job.wage > 0) {
    state.money += job.wage;
    pushLog(state, { emoji: '💰', title: '주급', amount: job.wage });
    if (job.tip && chance(state, job.tip.chance)) {
      state.money += job.tip.amount;
      pushLog(state, { emoji: '🪙', title: '손님 팁', amount: job.tip.amount });
    }
  }

  state.energy = Math.max(0, Math.min(cfg.maxEnergy, state.energy + job.energyDelta));

  if (state.energy <= 0 && state.activity !== restId) {
    state.activity = restId;
    pushLog(state, { emoji: '😵', title: '체력 0 — 자동 휴식 전환' });
  }
  return state;
}
