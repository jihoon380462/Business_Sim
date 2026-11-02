// 사업체: 개업 · 운영 방침 · 운영 형태(본업 선택에 종속) · 월 정산 · 직원 · 업그레이드.
import { D, findBusinessType } from './data.js';
import { clone, pushLog, addIncome, addExpense, addNotice } from './state.js';
import { randRange } from './rng.js';
import { seasonOf } from './calendar.js';
import { skillRevenueMult, fixedCostMult } from './stats.js';
import { monthlyInterest } from './economy.js';
import { ownerOperates, canDelegate } from './jobs.js';

export function businessType(state) {
  return state.business ? findBusinessType(state.business.type) : null;
}

export function canOpen(state, typeId) {
  const t = findBusinessType(typeId);
  if (!t) return { ok: false, reason: 'unknown' };
  if (state.business && state.business.type === typeId) return { ok: false, reason: 'already' };
  if (t.unlock.requiresBusiness && !(state.business && state.business.type === t.unlock.requiresBusiness)) {
    return { ok: false, reason: 'locked', shortfall: 0 };
  }
  if (state.money < t.openCost) return { ok: false, reason: 'money', shortfall: t.openCost - state.money };
  return { ok: true, reason: null, shortfall: 0 };
}

function newBusiness(typeId, turn, prev) {
  const B = D.businesses;
  return {
    type: typeId,
    name: prev ? prev.name : B.defaultName,
    reputation: prev ? prev.reputation : B.startReputation,
    price: 'mid',
    grade: 1,
    promo: false,
    staff: 0,
    openedTurn: turn,
    lastMonth: null,
    history: [],
    profitStreak: 0,
  };
}

/** 개업(노점) 또는 확장(노점→분식집). 개업하면 본업을 자동으로 "가게 운영"으로 바꾼다. */
export function openBusiness(input, { typeId }) {
  const check = canOpen(input, typeId);
  if (!check.ok) return input;
  const state = clone(input);
  const t = findBusinessType(typeId);
  state.money -= t.openCost;
  const prev = state.business;
  state.business = newBusiness(typeId, state.turn, prev);
  if (!state.businessHistory.includes(typeId)) state.businessHistory.push(typeId);
  if (!prev) {
    state.activity.main = D.jobs.operateId;
    state.activity.prevMain = null;
  }
  if (!t.allowDelegate) state.activity.delegate = false;
  pushLog(state, { emoji: t.emoji, title: prev ? `${t.name}으로 확장` : `${t.name} 개업`, amount: -t.openCost });
  return state;
}

export function setPolicy(input, { price, promo }) {
  if (!input.business) return input;
  const state = clone(input);
  if (price && D.businesses.priceOptions[price]) state.business.price = price;
  if (typeof promo === 'boolean') state.business.promo = promo;
  return state;
}

export function renameBusiness(input, { name }) {
  if (!input.business) return input;
  const trimmed = String(name ?? '').trim().slice(0, D.businesses.nameMaxLength);
  if (!trimmed) return input;
  const state = clone(input);
  state.business.name = trimmed;
  return state;
}

export function upgradeCost(state) {
  const t = businessType(state);
  if (!t) return null;
  const next = state.business.grade + 1;
  const cost = t.upgradeCosts[String(next)];
  return cost == null ? null : { grade: next, cost };
}

export function upgradeIngredients(input) {
  const up = upgradeCost(input);
  if (!up || input.money < up.cost) return input;
  const state = clone(input);
  state.business.grade = up.grade;
  state.money -= up.cost;
  pushLog(state, { emoji: '🧺', title: `재료 등급 ${up.grade}단계 업그레이드`, amount: -up.cost });
  return state;
}

export function canHire(state) {
  const t = businessType(state);
  return !!(t && t.staff && state.business.staff === 0);
}

export function hireStaff(input) {
  if (!canHire(input)) return input;
  const state = clone(input);
  state.business.staff = 1;
  pushLog(state, { emoji: '🧑‍🍳', title: `직원 고용 (${businessType(state).staff.name})` });
  return state;
}

export function fireStaff(input) {
  if (!input.business || input.business.staff === 0) return input;
  const state = clone(input);
  state.business.staff = 0;
  state.activity.delegate = false;
  pushLog(state, { emoji: '🧑‍🍳', title: '직원 해고' });
  return state;
}

/** 이번 달 운영 형태: owner | ownerStaff | delegated | closed (본업 선택 + 직원 + 위임 조건에서 파생) */
export function operationMode(state) {
  const b = state.business;
  if (!b) return null;
  const t = findBusinessType(b.type);
  if (ownerOperates(state)) return b.staff > 0 && t.staff ? 'ownerStaff' : 'owner';
  if (state.activity.delegate && canDelegate(state).ok) return 'delegated';
  return 'closed';
}

export function fixedCostOf(state) {
  const t = businessType(state);
  return t ? Math.round(t.fixedCost * fixedCostMult(state)) : 0;
}

/** 월 사업 정산 */
export function settleBusiness(state) {
  const b = state.business;
  if (!b) return state;
  const B = D.businesses;
  const t = findBusinessType(b.type);
  const mode = operationMode(state);
  const modeMult = B.operationModes[mode].revenueMult;
  const interest = monthlyInterest(state);

  let revenue = 0, materials = 0, promo = 0;
  const fixed = fixedCostOf(state);
  const labor = b.staff > 0 && t.staff ? t.staff.wage : 0;
  const ownerPresent = mode === 'owner' || mode === 'ownerStaff';

  if (mode !== 'closed') {
    const base = randRange(state, t.revenueMin, t.revenueMax);
    const season = t.seasonMult[seasonOf(state.turn)] ?? 1;
    const priceMult = B.priceOptions[b.price].revenueMult;
    const repMult = B.reputationRevenueBase + B.reputationRevenueRange * (b.reputation / B.reputationMax);
    // 컨디션 판정은 이달 시작 시점 값 기준 (활동 정산으로 바뀌기 전)
    const condAtStart = state.summary ? state.summary.conditionFrom : state.condition;
    const condMult = ownerPresent && condAtStart <= D.stats.lowConditionThreshold ? D.stats.lowConditionRevenueMult : 1;
    revenue = Math.round(base * season * priceMult * repMult * skillRevenueMult(state) * modeMult * condMult);
    materials = Math.round(revenue * B.ingredientGrades[String(b.grade)].materialRate);
    if (b.promo) promo = t.promoCost;
    let dRep = B.priceOptions[b.price].reputationDelta + B.ingredientGrades[String(b.grade)].reputationDelta;
    if (b.promo) dRep += B.promoReputationDelta;
    if (!ownerPresent) dRep += B.ownerAbsentReputationDelta;
    b.reputation = Math.max(B.reputationMin, Math.min(B.reputationMax, b.reputation + dRep));
    if (condMult < 1) addNotice(state, '🥱', '컨디션이 낮아 가게 매출이 줄었다 (×0.8)');
  } else {
    b.reputation = Math.max(B.reputationMin, b.reputation + B.ownerAbsentReputationDelta);
    addNotice(state, '🚪', `${t.name} 휴무 — 주인 부재 (고정비는 나감, 평판 ${B.ownerAbsentReputationDelta})`);
  }

  const net = revenue - materials - labor - fixed - promo - interest;
  state.money += revenue - materials - labor - fixed - promo; // 이자는 economy 에서 차감

  addIncome(state, `${t.name} 매출`, revenue);
  addExpense(state, '재료비', materials);
  addExpense(state, '인건비', labor);
  addExpense(state, '고정비', fixed);
  addExpense(state, '홍보', promo);

  const rec = { turn: state.turn, mode, revenue, materials, labor, fixed, promo, interest, net };
  b.lastMonth = rec;
  b.history.push(rec);
  while (b.history.length > 36) b.history.shift();
  b.profitStreak = net > 0 ? b.profitStreak + 1 : 0;

  pushLog(state, { emoji: t.emoji, title: mode === 'closed' ? `${t.name} 휴무` : `${t.name} 정산 (${B.operationModes[mode].label})`, amount: revenue - materials - labor - fixed - promo });
  return state;
}
