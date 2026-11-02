// 턴(절대 개월 수) ↔ 년차·월·계절 변환 (순수 계산). turn 은 1부터.
import { D } from './data.js';

export function yearOf(turn) {
  return Math.floor((turn - 1) / D.config.monthsPerYear) + 1;
}

export function monthOf(turn) {
  return ((turn - 1) % D.config.monthsPerYear) + 1;
}

export function seasonOf(turn) {
  return D.config.seasonByMonth[String(monthOf(turn))];
}

/** "3년차 5월" */
export function turnLabel(turn) {
  return `${yearOf(turn)}년차 ${monthOf(turn)}월`;
}

export function ageAt(turn) {
  return D.config.startAge + yearOf(turn) - 1;
}
