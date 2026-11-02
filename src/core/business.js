// 사업체: 개업 · 운영 방침 · 매주 정산 · 직원 · 업그레이드.
import { D, findBusinessType } from './data.js';
import { clone, pushLog } from './state.js';
import { randRange } from './rng.js';
import { seasonOf } from './calendar.js';

export function businessType(state) {
  return state.business ? findBusinessType(state.business.type) : null;
}

/** 개업 가능 여부와 사유 */
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

function newBusiness(typeId, week, prev) {
  const B = D.businesses;
  return {
    type: typeId,
    name: prev ? prev.name : B.defaultName,
    reputation: prev ? prev.reputation : B.startReputation,
    price: 'mid',
    grade: 1,
    promo: false,
    open: true,
    staff: 0,
    openedWeek: week,
    lastWeek: null,
    history: [],
    profitStreak: 0,
  };
}

/** 개업 (노점) 또는 확장 (노점→분식집). 자금 차감. */
export function openBusiness(input, { typeId }) {
  const check = canOpen(input, typeId);
  if (!check.ok) return input;
  const state = clone(input);
  const t = findBusinessType(typeId);
  state.money -= t.openCost;
  const prev = state.business;
  state.business = newBusiness(typeId, state.week, prev);
  if (!state.businessHistory.includes(typeId)) state.businessHistory.push(typeId);
  pushLog(state, { emoji: t.emoji, title: prev ? `${t.name}으로 확장` : `${t.name} 개업`, amount: -t.openCost });
  return state;
}

export function setPolicy(input, { price, promo, open }) {
  if (!input.business) return input;
  const state = clone(input);
  const b = state.business;
  if (price && D.businesses.priceOptions[price]) b.price = price;
  if (typeof promo === 'boolean') b.promo = promo;
  if (typeof open === 'boolean') b.open = open;
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
  pushLog(state, { emoji: '🧑‍🍳', title: '직원 해고' });
  return state;
}

/** 매주 사업 정산 */
export function settleBusiness(state) {
  const b = state.business;
  if (!b) return state;
  const B = D.businesses;
  const t = findBusinessType(b.type);
  const cfg = D.config;
  const interest = Math.round(state.loan.principal * cfg.loan.weeklyInterestRate);

  let revenue = 0;
  let materials = 0;
  let labor = 0;
  let promo = 0;
  const fixed = t.fixedCost;

  if (b.open) {
    const base = randRange(state, t.revenueMin, t.revenueMax);
    const season = t.seasonMult[seasonOf(state.week)] ?? 1;
    const priceMult = B.priceOptions[b.price].revenueMult;
    const repMult = B.reputationRevenueBase + B.reputationRevenueRange * (b.reputation / B.reputationMax);
    const staffMult = b.staff > 0 && t.staff ? t.staff.revenueMult : 1;
    revenue = Math.round(base * season * priceMult * repMult * staffMult);
    materials = Math.round(revenue * B.ingredientGrades[String(b.grade)].materialRate);
    if (b.promo) promo = t.promoCost;
    // 평판 변화
    let dRep = B.priceOptions[b.price].reputationDelta + B.ingredientGrades[String(b.grade)].reputationDelta;
    if (b.promo) dRep += B.promoReputationDelta;
    b.reputation = Math.max(B.reputationMin, Math.min(B.reputationMax, b.reputation + dRep));
  } else {
    state.energy = Math.min(cfg.maxEnergy, state.energy + B.closedEnergyRecovery);
  }
  if (b.staff > 0 && t.staff) labor = t.staff.wage;

  const net = revenue - materials - labor - fixed - promo - interest;
  state.money += revenue - materials - labor - fixed - promo; // 이자는 economy 에서 차감

  const rec = { week: state.week, revenue, materials, labor, fixed, promo, interest, net };
  b.lastWeek = rec;
  b.history.push(rec);
  while (b.history.length > 52) b.history.shift();
  b.profitStreak = net > 0 ? b.profitStreak + 1 : 0;

  const title = b.open ? `${t.name} 정산` : `${t.name} 휴무`;
  pushLog(state, { emoji: t.emoji, title, amount: revenue - materials - labor - fixed - promo });
  return state;
}
