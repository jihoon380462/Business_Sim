// 자금 · 생활비 · 대출.
import { D } from './data.js';
import { clone, pushLog } from './state.js';

export function settleLiving(state) {
  const cost = D.config.livingCost;
  state.money -= cost;
  pushLog(state, { emoji: '🏠', title: '생활비', amount: -cost });
  return state;
}

export function settleLoanInterest(state) {
  const p = state.loan.principal;
  if (p <= 0) return state;
  const interest = Math.round(p * D.config.loan.weeklyInterestRate);
  state.money -= interest;
  state.lastInterest = interest;
  pushLog(state, { emoji: '🏦', title: '대출 이자', amount: -interest });
  return state;
}

/** 잔액 음수면 활동을 편의점 알바로 강제 전환. 체력 0이면 전환하지 않음(다음 주 휴식 회복 후 다시 판정). */
export function enforceBroke(state) {
  if (state.money >= 0) return state;
  const forced = D.config.forcedJobWhenBroke;
  if (state.activity === forced) return state;
  if (state.energy <= 0) return state;
  state.activity = forced;
  pushLog(state, { emoji: '⚠️', title: '잔액 부족 — 편의점 알바로 강제 전환' });
  return state;
}

export function loanAvailable(state) {
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

/** 자산 요약: 현금·주식 평가액·부채·순자산 */
export function netWorth(state) {
  let stockValue = 0;
  for (const [id, h] of Object.entries(state.stocks.holdings)) {
    stockValue += h.qty * (state.stocks.prices[id] || 0);
  }
  const debt = state.loan.principal;
  return { cash: state.money, stockValue, debt, net: state.money + stockValue - debt };
}
