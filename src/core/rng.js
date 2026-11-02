// 시드 기반 난수 (mulberry32). Math.random() 금지.
// 난수 상태는 state.seed 에 저장되어 저장/복원·테스트 재현이 가능하다.
// 모든 함수는 state 를 받아 seed 를 갱신한 새 state 와 값을 돌려준다.

function mulberry32(seed) {
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { next: (t >>> 0) | 0, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

/** @returns {[number, number]} [newSeed, value in [0,1)] */
export function nextFloat(seed) {
  const r = mulberry32(seed | 0);
  return [r.next, r.value];
}

/** state.seed 를 전진시키고 [0,1) 값을 돌려준다. state 는 제자리 갱신(이미 복제된 state 전제). */
export function rand(state) {
  const [seed, v] = nextFloat(state.seed);
  state.seed = seed;
  return v;
}

export function randRange(state, min, max) {
  return min + rand(state) * (max - min);
}

export function randInt(state, min, maxInclusive) {
  return min + Math.floor(rand(state) * (maxInclusive - min + 1));
}

export function chance(state, p) {
  return rand(state) < p;
}

export function pick(state, arr) {
  if (!arr.length) return undefined;
  return arr[randInt(state, 0, arr.length - 1)];
}
