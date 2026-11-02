// 상태 정의 · 초기값 · 직렬화 · 월 결산 요약 누적.
import { D } from './data.js';

export const STATE_VERSION = 2;

/** 새 게임 상태. seed 를 주면 재현 가능. */
export function createInitialState(seed = 1) {
  const cfg = D.config;
  const prices = {};
  const history = {};
  for (const s of D.stocks.symbols) {
    prices[s.id] = s.startPrice;
    history[s.id] = Array(D.stocks.historyLength).fill(s.startPrice);
  }
  return {
    version: STATE_VERSION,
    seed: seed | 0,
    turn: 1, // 1부터 시작하는 절대 개월 수
    time: { year: 1, month: 1 },
    money: cfg.startMoney,
    stats: { ...D.stats.start },
    statsExact: { ...D.stats.start }, // 소수 누적용 (90 이상 절반 상승)
    condition: D.stats.startCondition,
    activity: {
      main: D.jobs.defaultMain,
      leisure: D.jobs.defaultLeisure,
      studyTarget: D.jobs.defaultStudyTarget,
      delegate: false,
      prevMain: null, // 강제 휴식 전의 본업
    },
    gender: cfg.defaultGender,
    loan: { principal: 0 },
    stocks: {
      prices,
      prevPrices: { ...prices },
      history,
      holdings: {}, // id -> { qty, avgCost }
      delisted: [],
    },
    business: null, // business.js 참고
    businessHistory: [],
    events: {
      pending: null, // 선택형 이벤트 대기
      rumor: null, // { symbol, direction, monthsLeft, shock, known, detail }
      delisting: null, // { symbol, monthsLeft }
      cooldowns: {}, // eventId -> 마지막 발생 turn
      flags: {},
    },
    log: [], // 최신이 앞. { id, turn, emoji, title, amount, kind }
    logSeq: 0,
    summary: null, // 직전 월 결산 요약 (ui 팝업용)
    goal: { achieved: false, pendingReport: null, lastReport: null },
    relationships: {}, // V2 예약
  };
}

export function serialize(state) {
  return JSON.stringify(state);
}

/** 구버전(실시간 주 단위) 저장은 호환하지 않는다 → null */
export function deserialize(json) {
  const s = JSON.parse(json);
  return migrate(s);
}

export function migrate(state) {
  if (!state || typeof state.version !== 'number') return null;
  if (state.version !== STATE_VERSION) return null;
  return state;
}

export function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

export function setGender(input, { gender }) {
  if (!D.characters.player.genders[gender]) return input;
  const state = clone(input);
  state.gender = gender;
  return state;
}

/** 알림 피드 한 줄. amount 원 단위(없으면 null). */
export function pushLog(state, { emoji, title, amount = null, kind = null, turn = null }) {
  const max = D.config.logMax;
  state.logSeq += 1;
  state.log.unshift({
    id: state.logSeq,
    turn: turn ?? state.turn,
    emoji,
    title,
    amount,
    kind: kind ?? (amount == null ? 'info' : amount >= 0 ? 'income' : 'expense'),
  });
  if (state.log.length > max) state.log.length = max;
  return state;
}

// ---------- 월 결산 요약 ----------
export function beginSummary(state) {
  state.summary = {
    turn: state.turn,
    income: [], // { label, amount }
    expense: [], // { label, amount } (양수로 기록)
    moneyBefore: state.money,
    moneyAfter: null,
    net: 0,
    statsBefore: { ...state.stats },
    statDelta: {},
    conditionFrom: state.condition,
    conditionTo: null,
    notices: [], // { emoji, text }
  };
}

export function addIncome(state, label, amount) {
  if (!state.summary || amount === 0) return;
  state.summary.income.push({ label, amount });
}

export function addExpense(state, label, amount) {
  if (!state.summary || amount === 0) return;
  state.summary.expense.push({ label, amount: Math.abs(amount) });
}

export function addNotice(state, emoji, text) {
  if (!state.summary) return;
  state.summary.notices.push({ emoji, text });
}

export function endSummary(state) {
  const s = state.summary;
  if (!s) return;
  s.moneyAfter = state.money;
  s.net = state.money - s.moneyBefore;
  s.conditionTo = state.condition;
  for (const k of Object.keys(state.stats)) {
    const d = state.stats[k] - s.statsBefore[k];
    if (d !== 0) s.statDelta[k] = d;
  }
}
