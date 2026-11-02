// 상태 정의 · 초기값 · 직렬화.
import { D } from './data.js';

export const STATE_VERSION = 1;

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
    week: 1, // 1부터 시작하는 절대 주차
    money: cfg.startMoney,
    energy: cfg.startEnergy,
    activity: D.jobs.defaultActivity,
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
    businessHistory: [], // 보유했던 사업 id 목록 (해금 조건용)
    events: {
      pending: null, // 선택형 이벤트 대기 { eventId, title, text, choices, payload }
      rumor: null, // { symbol, direction, weeksLeft, known }
      delisting: null, // { symbol, weeksLeft }
      cooldowns: {}, // eventId -> 마지막 발생 주차
      flags: {},
    },
    log: [], // 최신이 앞. { id, week, emoji, title, amount, kind }
    logSeq: 0,
    goal: {
      achieved: false,
      pendingReport: null,
      lastReport: null,
    },
    relationships: {}, // V2 예약
  };
}

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(json) {
  const s = JSON.parse(json);
  return migrate(s);
}

export function migrate(state) {
  if (!state || typeof state.version !== 'number') return null;
  // 향후 버전 상승 시 여기서 단계별 변환
  if (state.version !== STATE_VERSION) return null;
  return state;
}

/** 깊은 복제. core 함수는 입력 state 를 바꾸지 않고 복제본을 갱신해 돌려준다. */
export function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

export function setGender(input, { gender }) {
  if (!D.characters.player.genders[gender]) return input;
  const state = clone(input);
  state.gender = gender;
  return state;
}

/** 로그 한 줄 추가. amount 는 원 단위(없으면 null). kind: income|expense|info */
export function pushLog(state, { emoji, title, amount = null, kind = null, week = null }) {
  const max = D.config.logMax;
  state.logSeq += 1;
  state.log.unshift({
    id: state.logSeq,
    week: week ?? state.week,
    emoji,
    title,
    amount,
    kind: kind ?? (amount == null ? 'info' : amount >= 0 ? 'income' : 'expense'),
  });
  if (state.log.length > max) state.log.length = max;
  return state;
}
