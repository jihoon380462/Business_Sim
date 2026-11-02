// 자금 · 생활비 · 대출.
import { D } from './data.js';
import { clone, pushLog, addExpense, addNotice } from './state.js';
import { loanRateMult } from './stats.js';

export function settleLiving(state) {
  const cost = D.config.livingCost;
  state.money -= cost;
  addExpense(state, '생활비', cost);
  pushLog(state, { emoji: '🏠', title: '생활비', amount: -cost });
  return state;
}

/** 월 이자율 = 기본 × (1 − 0.4 × 화술/100) */
export function effectiveLoanRate(state) {
  return D.config.loan.monthlyInterestRate * loanRateMult(state);
}

export function monthlyInterest(state) {
  return Math.round(state.loan.principal * effectiveLoanRate(state));
}

export function settleLoanInterest(state) {
  if (state.loan.principal <= 0) return state;
  const interest = monthlyInterest(state);
  state.money -= interest;
  addExpense(state, '대출 이자', interest);
  pushLog(state, { emoji: '🏦', title: '대출 이자', amount: -interest });
  return state;
}

/** 잔액 음수면 다음 달 본업을 편의점 알바로 강제. 강제 휴식이 잡혀 있으면 휴식 우선. */
export function enforceBroke(state) {
  if (state.money >= 0) return state;
  const forced = D.config.forcedJobWhenBroke;
  const A = state.activity;
  if (A.main === forced || A.main === D.jobs.forcedRestId) return state;
  A.main = forced;
  A.prevMain = null;
  addNotice(state, '⚠️', '잔액 부족 — 다음 달 본업이 편의점 알바로 강제 전환');
  pushLog(state, { emoji: '⚠️', title: '잔액 부족 — 편의점 알바로 강제 전환' });
  return state;
}

export function loanUnlocked(state) {
  return !D.config.loan.requiresBusiness || !!state.business;
}

export function loanAvailable(state) {
  if (!loanUnlocked(state)) return 0;
  return Math.max(0, D.config.loan.limit - state.loan.principal);
}

export function borrow(input, { amount }) {
  const state = clone(input);
  const amt = Math.min(Math.max(0, Math.floor(amount)), loanAvailable(state));
  if (amt <= 0) return state;
  state.loan.principal += amt;
  state.money += amt;
  pushLog(state, { emoji: '🏦', title: '대출 실행', amount: amt });
  return state;
}

export function repay(input, { amount }) {
  const state = clone(input);
  const amt = Math.min(Math.max(0, Math.floor(amount)), state.loan.principal, Math.max(0, state.money));
  if (amt <= 0) return state;
  state.loan.principal -= amt;
  state.money -= amt;
  pushLog(state, { emoji: '🏦', title: '대출 상환', amount: -amt });
  return state;
}

export function netWorth(state) {
  let stockValue = 0;
  for (const [id, h] of Object.entries(state.stocks.holdings)) stockValue += h.qty * (state.stocks.prices[id] || 0);
  const debt = state.loan.principal;
  return { cash: state.money, stockValue, debt, net: state.money + stockValue - debt };
}
