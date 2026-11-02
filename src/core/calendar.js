// 주차 ↔ 년차·계절 변환 (순수 계산)
import { D } from './data.js';

export function yearOf(week) {
  return Math.floor((week - 1) / D.config.weeksPerYear) + 1;
}

export function weekOfYear(week) {
  return ((week - 1) % D.config.weeksPerYear) + 1;
}

export function seasonOf(week) {
  const idx = Math.floor((weekOfYear(week) - 1) / D.config.weeksPerSeason) % D.config.seasons.length;
  return D.config.seasons[idx];
}

/** "3년차 17주" */
export function weekLabel(week) {
  return `${yearOf(week)}년차 ${weekOfYear(week)}주`;
}
