// 주인공 스탯 5개 · 컨디션 · 배율 공식 · 상승 처리.
import { D } from './data.js';

function mult(spec, statValue) {
  return spec.base + spec.range * (statValue / D.stats.max);
}

/** 알바 수입 배율 = 0.8 + 0.4 × 스탯/100 */
export function wageMult(state, statId) {
  if (!statId) return 1;
  return mult(D.stats.wageMult, state.stats[statId]);
}

export function skillRevenueMult(state) {
  return mult(D.stats.skillRevenueMult, state.stats.skill);
}

export function fixedCostMult(state) {
  return mult(D.stats.fixedCostMult, state.stats.management);
}

export function loanRateMult(state) {
  return mult(D.stats.loanRateMult, state.stats.speech);
}

export function maxCondition(state) {
  return state.stats.stamina;
}

export function isLowCondition(state) {
  return state.condition <= D.stats.lowConditionThreshold;
}

/** 컨디션 가감 후 [0, 체력] 으로 고정 */
export function changeCondition(state, delta) {
  state.condition = Math.max(0, Math.min(maxCondition(state), state.condition + delta));
  return state;
}

/** 스탯 상승. 90 이상이면 절반 속도. 소수는 statsExact 에 누적, 표시값은 내림. */
export function gainStat(state, statId, amount) {
  if (!amount || !(statId in state.stats)) return state;
  const S = D.stats;
  let exact = state.statsExact[statId] ?? state.stats[statId];
  const eff = exact >= S.slowAbove ? amount * S.slowFactor : amount;
  exact = Math.min(S.max, Math.max(S.min, exact + eff));
  state.statsExact[statId] = Math.round(exact * 1000) / 1000;
  state.stats[statId] = Math.floor(state.statsExact[statId]);
  // 체력이 올라도 컨디션은 그대로, 내려가면 상한에 맞춤
  if (statId === 'stamina') state.condition = Math.min(state.condition, maxCondition(state));
  return state;
}

export function gainStats(state, gains) {
  for (const [k, v] of Object.entries(gains || {})) gainStat(state, k, v);
  return state;
}

/** 소문 정보량 단계: 'direction' | 'timing' | 'magnitude' */
export function rumorDetailLevel(state) {
  const k = state.stats.knowledge;
  const R = D.stats.rumorKnowledge;
  if (k >= R.withMagnitude) return 'magnitude';
  if (k >= R.withTiming) return 'timing';
  return 'direction';
}
