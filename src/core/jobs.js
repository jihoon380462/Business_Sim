// 활동: 본업 1 + 여가 1 슬롯. 매달 결산 때 수입·비용·컨디션·스탯 반영.
import { D, findActivity, findBusinessType } from './data.js';
import { clone, pushLog, addIncome, addExpense, addNotice } from './state.js';
import { chance } from './rng.js';
import { wageMult, changeCondition, gainStats, gainStat } from './stats.js';

/** 본업 카드 선택 가능 여부 */
export function canChooseMain(state, activityId) {
  const a = findActivity(activityId);
  if (!a || a.slot !== 'main' || a.hidden) return { ok: false, reason: 'unknown' };
  if (a.requiresBusiness && !state.business) return { ok: false, reason: 'no_business' };
  return { ok: true, reason: null };
}

/** 위임 가능 여부: 분식집 + 직원 + 경영 ≥ 30 */
export function canDelegate(state) {
  const b = state.business;
  if (!b) return { ok: false, reason: '가게 없음' };
  const t = findBusinessType(b.type);
  if (!t.allowDelegate) return { ok: false, reason: `${t.name}은 위임 불가` };
  if (b.staff === 0) return { ok: false, reason: '직원 필요' };
  const need = D.stats.delegateManagementMin;
  if (state.stats.management < need) return { ok: false, reason: `경영 ${need} 필요 (현재 ${state.stats.management})` };
  return { ok: true, reason: null };
}

export function setActivity(input, { slot, activityId }) {
  const a = findActivity(activityId);
  if (!a || a.slot !== slot || a.hidden) return input;
  if (slot === 'main' && !canChooseMain(input, activityId).ok) return input;
  const state = clone(input);
  state.activity[slot] = activityId;
  if (slot === 'main') state.activity.prevMain = null;
  return state;
}

export function setStudyTarget(input, { target }) {
  if (!D.stats.studyTargets.includes(target)) return input;
  const state = clone(input);
  state.activity.studyTarget = target;
  return state;
}

export function setDelegate(input, { delegate }) {
  if (delegate && !canDelegate(input).ok) return input;
  const state = clone(input);
  state.activity.delegate = !!delegate;
  return state;
}

/** 본업 예상 수입 (스탯 배율 적용, 팁 제외) */
export function expectedIncome(state, activityId) {
  const a = findActivity(activityId);
  if (!a || !a.income) return 0;
  return Math.round(a.income * wageMult(state, a.incomeStat));
}

/** 이번 달 주인이 가게에 있는가 (본업 = 가게 운영) */
export function ownerOperates(state) {
  return state.activity.main === D.jobs.operateId;
}

/** 매달 활동 정산 */
export function settleActivities(state) {
  const A = state.activity;
  const forcedRest = D.jobs.forcedRestId;
  const main = findActivity(A.main) || findActivity(forcedRest);
  const leisure = findActivity(A.leisure) || findActivity(D.jobs.defaultLeisure);

  // 본업 수입
  if (main.income > 0) {
    const pay = Math.round(main.income * wageMult(state, main.incomeStat));
    state.money += pay;
    addIncome(state, main.name, pay);
    pushLog(state, { emoji: '💰', title: `${main.shortName} 월급`, amount: pay });
    if (main.tip && chance(state, main.tip.chance)) {
      state.money += main.tip.amount;
      addIncome(state, '손님 팁', main.tip.amount);
      pushLog(state, { emoji: '🪙', title: '손님 팁', amount: main.tip.amount });
    }
  }
  if (main.conditionDelta) changeCondition(state, main.conditionDelta);
  gainStats(state, main.statGain);

  // 여가
  if (leisure.cost > 0) {
    if (state.money >= leisure.cost) {
      state.money -= leisure.cost;
      addExpense(state, leisure.name, leisure.cost);
      pushLog(state, { emoji: leisure.emoji, title: leisure.name, amount: -leisure.cost });
    } else {
      addNotice(state, '⚠️', `${leisure.name} 비용이 없어 이번 달은 쉬었다`);
      changeCondition(state, findActivity(D.jobs.defaultLeisure).conditionDelta);
      leisureDone(state, null);
      return finishMain(state, main);
    }
  }
  changeCondition(state, leisure.conditionDelta);
  leisureDone(state, leisure);
  return finishMain(state, main);
}

function leisureDone(state, leisure) {
  if (!leisure) return;
  gainStats(state, leisure.statGain);
  if (leisure.studyGain) gainStat(state, state.activity.studyTarget, leisure.studyGain);
}

/** 강제 휴식 복귀 · 컨디션 0 처리 */
function finishMain(state, main) {
  const A = state.activity;
  const forcedRest = D.jobs.forcedRestId;
  // 지난달 강제 휴식이었다면 원래 본업으로 복귀
  if (main.id === forcedRest) {
    const back = A.prevMain && canChooseMain(state, A.prevMain).ok ? A.prevMain : D.jobs.defaultMain;
    A.main = back;
    A.prevMain = null;
    addNotice(state, '🌅', `휴식을 마치고 ${findActivity(back).shortName}으로 복귀`);
  }
  if (state.condition <= 0 && A.main !== forcedRest) {
    A.prevMain = A.main;
    A.main = forcedRest;
    addNotice(state, '😵', '컨디션 0 — 다음 달은 강제 휴식 (수입 없음, 가게 주인 부재)');
    pushLog(state, { emoji: '😵', title: '컨디션 0 — 다음 달 강제 휴식' });
  }
  return state;
}
