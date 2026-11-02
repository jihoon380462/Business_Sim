// 시간: advanceMonth (1턴 = 1개월). 년차·월·계절은 calendar.js.
// ui 의 "다음 달" 버튼이 advanceMonth 를 한 번 호출한다. core 에는 시계·타이머 개념이 없다.
import { clone, beginSummary, endSummary } from './state.js';
import { settleActivities } from './jobs.js';
import { settleBusiness } from './business.js';
import { settleLiving, settleLoanInterest, enforceBroke } from './economy.js';
import { tickStocks } from './stocks.js';
import { rollEvents } from './events.js';
import { checkGoal } from './goal.js';
import { yearOf, monthOf } from './calendar.js';

export { yearOf, monthOf, seasonOf, turnLabel, ageAt } from './calendar.js';

/**
 * 한 달을 정산하고 다음 달로 넘긴다.
 * 순서: 활동(본업·여가) → 사업 → 생활비 → 대출이자 → 잔액 음수 처리 → 주식 변동 → 이벤트 → 목표 판정 → turn+1
 * 결과 요약은 state.summary 에 남는다 (ui 결산 팝업).
 */
export function advanceMonth(input) {
  const state = clone(input);
  beginSummary(state);
  settleActivities(state);
  settleBusiness(state);
  settleLiving(state);
  settleLoanInterest(state);
  enforceBroke(state);
  tickStocks(state);
  rollEvents(state);
  checkGoal(state);
  endSummary(state);
  state.turn += 1;
  state.time = { year: yearOf(state.turn), month: monthOf(state.turn) };
  return state;
}
