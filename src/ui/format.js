// 표기 유틸 (금액·턴). 수치 계산은 하지 않는다.
import { turnLabel as coreTurnLabel } from '../core/index.js';

const fmtInt = (n) => Math.abs(Math.round(n)).toLocaleString('ko-KR');

/** 원 단위: ₩1,000,000 / -₩120,000 */
export function won(n, { sign = false } = {}) {
  const neg = n < 0;
  const body = `₩${fmtInt(n)}`;
  if (neg) return `-${body}`;
  return sign && n > 0 ? `+${body}` : body;
}

/** 만 단위 축약: +20만, -12.6만, +1,520만. 1만 미만은 원 단위. */
export function man(n, { sign = true } = {}) {
  const abs = Math.abs(n);
  let body;
  if (abs >= 10000) {
    const m = abs / 10000;
    body = Number.isInteger(m) ? `${fmtInt(m)}만` : `${(Math.round(m * 10) / 10).toLocaleString('ko-KR')}만`;
  } else {
    body = `${fmtInt(abs)}원`;
  }
  if (n < 0) return `-${body}`;
  return sign && n > 0 ? `+${body}` : body;
}

export function pct(p, digits = 1) {
  const v = (p * 100).toFixed(digits);
  return p > 0 ? `+${v}%` : `${v}%`;
}

export function amountClass(n) {
  if (n > 0) return 'income';
  if (n < 0) return 'expense';
  return '';
}

export function turnLabel(turn) {
  return coreTurnLabel(turn);
}

export function signed(n) {
  return n > 0 ? `+${n}` : `${n}`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const SEASON = {
  spring: { ico: '🌸', txt: '봄' },
  summer: { ico: '☀️', txt: '여름' },
  autumn: { ico: '🍂', txt: '가을' },
  winter: { ico: '❄️', txt: '겨울' },
};
