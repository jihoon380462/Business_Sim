// V1 목표: 분식집 개업 후 N개월 연속 흑자 → 결산 리포트 생성.
import { D, findBusinessType } from './data.js';
import { clone, pushLog, addNotice } from './state.js';
import { netWorth } from './economy.js';

export function buildReport(state, months) {
  const b = state.business;
  const t = findBusinessType(b.type);
  const rows = b.history.slice(-months);
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const totals = {
    revenue: sum('revenue'),
    materials: sum('materials'),
    labor: sum('labor'),
    fixed: sum('fixed') + sum('promo'),
    interest: sum('interest'),
    net: sum('net'),
  };
  const n = rows.length || 1;
  const avg = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, Math.round(v / n)]));
  return {
    title: `첫 가게, ${months}개월 연속 흑자`,
    businessType: b.type,
    businessName: b.name,
    hasLabor: !!t.staff,
    fromTurn: rows[0].turn,
    toTurn: rows[rows.length - 1].turn,
    totals,
    avg,
    monthly: rows.map((r) => ({ turn: r.turn, net: r.net })),
    assets: netWorth(state),
  };
}

export function checkGoal(state) {
  if (state.goal.achieved || !state.business) return state;
  const B = D.businesses;
  if (B.goalBusinessType && state.business.type !== B.goalBusinessType) return state;
  const need = D.config.goal.profitStreakMonths;
  if (state.business.profitStreak >= need) {
    const report = buildReport(state, need);
    state.goal.achieved = true;
    state.goal.pendingReport = report;
    state.goal.lastReport = report;
    pushLog(state, { emoji: '🎯', title: `목표 달성: ${need}개월 연속 흑자` });
    addNotice(state, '🎯', `목표 달성: 분식집 ${need}개월 연속 흑자`);
  }
  return state;
}

export function dismissReport(input) {
  if (!input.goal.pendingReport) return input;
  const state = clone(input);
  state.goal.pendingReport = null;
  return state;
}
