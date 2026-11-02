// V1 목표: 가게(분식집) 개업 후 N주 연속 흑자 → 결산 리포트 생성.
import { D, findBusinessType } from './data.js';
import { clone, pushLog } from './state.js';
import { netWorth } from './economy.js';

export function buildReport(state, weeks) {
  const b = state.business;
  const t = findBusinessType(b.type);
  const rows = b.history.slice(-weeks);
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
    title: `첫 가게, ${weeks}주 연속 흑자`,
    businessType: b.type,
    businessName: b.name,
    hasLabor: !!t.staff,
    fromWeek: rows[0].week,
    toWeek: rows[rows.length - 1].week,
    totals,
    avg,
    weekly: rows.map((r) => ({ week: r.week, net: r.net })),
    assets: netWorth(state),
  };
}

export function checkGoal(state) {
  if (state.goal.achieved || !state.business) return state;
  const B = D.businesses;
  if (B.goalBusinessType && state.business.type !== B.goalBusinessType) return state;
  const need = D.config.goal.profitStreakWeeks;
  if (state.business.profitStreak >= need) {
    const report = buildReport(state, need);
    state.goal.achieved = true;
    state.goal.pendingReport = report;
    state.goal.lastReport = report;
    pushLog(state, { emoji: '🎯', title: `목표 달성: ${need}주 연속 흑자` });
  }
  return state;
}

export function dismissReport(input) {
  if (!input.goal.pendingReport) return input;
  const state = clone(input);
  state.goal.pendingReport = null;
  return state;
}
