// 시간: advanceWeek. 주차 표기·계절은 calendar.js.
// 타이머·속도는 ui 가 담당한다. core 는 advanceWeek 를 호출받을 뿐이다.
import { clone } from './state.js';
import { settleJob } from './jobs.js';
import { settleBusiness } from './business.js';
import { settleLiving, settleLoanInterest, enforceBroke } from './economy.js';
import { tickStocks } from './stocks.js';
import { rollEvents } from './events.js';
import { checkGoal } from './goal.js';

export { yearOf, weekOfYear, seasonOf, weekLabel } from './calendar.js';

/**
 * 한 주를 정산하고 다음 주로 넘긴다.
 * 순서: 알바 → 사업 → 생활비 → 대출이자 → 잔액 음수 처리 → 주식 변동 → 이벤트 → 목표 판정 → week+1
 */
export function advanceWeek(input) {
  const state = clone(input);
  settleJob(state);
  settleBusiness(state);
  settleLiving(state);
  settleLoanInterest(state);
  enforceBroke(state);
  tickStocks(state);
  rollEvents(state);
  checkGoal(state);
  state.week += 1;
  return state;
}
