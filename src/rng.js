// 시드 난수 (mulberry32). state.seed 를 전진시킨다. Math.random() 금지 (재현·테스트용).
export function rand(state) {
  let t = (state.seed + 0x6D2B79F5) | 0;
  state.seed = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const range = (s, a, b) => a + rand(s) * (b - a);
export const int = (s, a, b) => a + Math.floor(rand(s) * (b - a + 1));
export const chance = (s, p) => rand(s) < p;
export const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
export function weighted(s, entries) {
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (total <= 0) return entries[0]?.[0];
  let r = rand(s) * total;
  for (const [v, w] of entries) { r -= w; if (r <= 0) return v; }
  return entries[entries.length - 1][0];
}
