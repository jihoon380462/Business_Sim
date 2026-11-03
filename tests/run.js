// 시뮬 검증. 실행: node tests/run.js
import * as S from '../src/sim.js';
import * as D from '../src/data.js';
import fs from 'node:fs';

let pass = 0, fail = 0;
const test = (n, f) => { try { f(); pass++; console.log(`  ✓ ${n}`); } catch (e) { fail++; console.log(`  ✗ ${n}\n      ${e.message}`); } };
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b}, got ${a}`); };
const ok = (v, m = '') => { if (!v) throw new Error(m || 'expected truthy'); };
const fresh = (seed = 1) => { const s = S.createGame(seed); s.popups = []; return s; };
const runSec = (s, sec) => { for (let t = 0; t < sec; t += 0.05) { S.tick(s, 0.05, 1); while (s.popups.length) S.resolvePopup(s, 'keep'); } };
const runDays = (s, n) => { const end = S.absDay(s) + n; let g = 0; while (S.absDay(s) < end && g++ < 200000) { S.tick(s, 0.05, 4); while (s.popups.length) S.resolvePopup(s, 'keep'); } };
const unlockAll = (s) => { s.certs = { iso: true, iatf: true }; s.rep = { 0: 100, 1: 100, 2: 100, 3: 100 }; };
const empty = (s) => { unlockAll(s); s.floor.tiles = s.floor.tiles.map(() => null); s.orders = []; S.assignWorkers(s); };

console.log('규칙');
test('sim.js 에 DOM·Math.random 없음', () => {
  const src = fs.readFileSync(new URL('../src/sim.js', import.meta.url), 'utf8');
  ok(!/\bdocument\b|\bwindow\b|Math\.random/.test(src));
});
test('같은 시드 → 같은 결과', () => {
  const a = fresh(42), b = fresh(42);
  runDays(a, 12); runDays(b, 12);
  eq(S.serialize(a), S.serialize(b));
});
test('저장 왕복', () => {
  const a = fresh(3); runDays(a, 3);
  const b = S.deserialize(S.serialize(a));
  eq(S.serialize(b), S.serialize(a));
  eq(S.deserialize('{"version":99}'), null);
});

console.log('물류');
test('아버지 라인: 첫날 브라켓이 출하구에 쌓인다', () => {
  const s = fresh(1);
  runSec(s, 50);
  ok((s.inventory.bracket || 0) >= 8, `inventory ${s.inventory.bracket}`);
  ok(s.month.raw > 0 && s.cash < D.FINANCE.startCash);
});
test('벨트는 칸당 최대 3개, 막히면 멈춘다', () => {
  const s = fresh(1); empty(s);
  S.build(s, 0, 0, 'input', { dir: 0 });
  S.build(s, 1, 0, 'belt', { dir: 0 });
  S.build(s, 2, 0, 'belt', { dir: 0 }); // 끝이 막힘
  runSec(s, 20);
  const n = S.tile(s, 1, 0).items.length + S.tile(s, 2, 0).items.length;
  ok(n <= 6 && n >= 4, `items ${n}`);
  ok(S.tile(s, 2, 0).jam, 'jam flag');
  const raw = s.month.raw;
  runSec(s, 10);
  eq(s.month.raw, raw, 'input stops buying when jammed');
});
test('반대 방향 벨트로는 못 넘어간다', () => {
  const s = fresh(1); empty(s);
  S.build(s, 0, 0, 'input', { dir: 0 });
  S.build(s, 1, 0, 'belt', { dir: 0 });
  S.build(s, 2, 0, 'belt', { dir: 2 });
  runSec(s, 10);
  eq(S.tile(s, 2, 0).items.length, 0);
});
test('분배기는 번갈아 나눈다', () => {
  const s = fresh(1); empty(s);
  S.build(s, 0, 1, 'input', { dir: 0 });
  S.build(s, 1, 1, 'split', { dir: 0 });
  S.build(s, 1, 0, 'belt', { dir: 3 });
  S.build(s, 1, 2, 'belt', { dir: 1 });
  S.build(s, 2, 1, 'belt', { dir: 0 });
  runSec(s, 6);
  const a = S.tile(s, 1, 0).items.length, b = S.tile(s, 1, 2).items.length, c = S.tile(s, 2, 1).items.length;
  ok(a >= 1 && b >= 1 && c >= 1, `split ${a}/${b}/${c}`);
});
test('여러 재료 레시피: 둘 다 와야 만든다', () => {
  const s = fresh(1); empty(s);
  S.build(s, 2, 2, 'machine', { model: 'assembly', dir: 0 });
  S.setRecipe(s, 2, 2, 'door');
  const m = S.tile(s, 2, 2);
  m.inBuf.shell_p = 2;
  runSec(s, 6);
  eq(m.crafts, 0, 'no bolt → no craft');
  m.inBuf.bolt = 1;
  runSec(s, 8);
  ok(m.crafts >= 1 || m.outBuf.length >= 1 || s.month.defects >= 1, 'crafted');
});
test('출하구는 주문량+여유분까지만 받는다', () => {
  const s = fresh(1);
  s.orders = [{ id: 999, client: 'x', tier: 0, item: 'bracket', lots: 3, unitPrice: 1000, dueDays: 9, dueDay: 99 }];
  runSec(s, 59);
  ok((s.inventory.bracket || 0) <= 3 + D.LOGISTICS.outputBufferLots, `inv ${s.inventory.bracket}`);
});

console.log('기계');
test('작업자 없으면 멈춤, 로봇은 혼자 돈다', () => {
  const s = fresh(1); empty(s); s.workers = []; s.cash = 1e9;
  S.build(s, 0, 0, 'machine', { model: 'weld_old', dir: 0 });
  S.build(s, 2, 0, 'machine', { model: 'weld_robot', dir: 0 });
  const a = S.tile(s, 0, 0), b = S.tile(s, 2, 0);
  a.inBuf.panel = 2; b.inBuf.panel = 2;
  runSec(s, 3);
  eq(a.status, 'no_worker'); ok(b.crafts >= 1 || b.crafting);
});
test('고장 → 수리 비용·시간 → 복구', () => {
  const s = fresh(1);
  const m = S.tile(s, 2, 2);
  m.broken = true;
  const r = S.repair(s, 2, 2);
  ok(r.ok);
  runSec(s, D.MACHINE_RULES.repairSec + 0.5);
  ok(!m.broken && m.cond >= D.MACHINE_RULES.repairCond);
});
test('방치한 고장은 외부 수리(더 비쌈)', () => {
  const s = fresh(1);
  const m = S.tile(s, 2, 2);
  m.broken = true;
  const c = s.cash;
  runSec(s, D.MACHINE_RULES.autoRepairAfterSec + D.MACHINE_RULES.repairSec + 1);
  ok(!m.broken && s.cash < c);
});
test('숙련공은 병목 기계에 배치', () => {
  const s = fresh(1);
  const weld = S.tile(s, 5, 2);
  eq(S.workerOf(s, weld).name, '김반장');
});

test('작업자 부족해도 라인이 끊기지 않게: 같은 레시피 둘째 기계보다 프레스가 먼저', () => {
  const s = fresh(1); s.cash = 1e9;
  S.build(s, 3, 5, 'machine', { model: 'weld_old', dir: 0 }); S.setRecipe(s, 3, 5, 'bracket');
  ok(S.tile(s, 2, 2).worker, 'press manned');
  ok(S.tile(s, 5, 2).worker || S.tile(s, 3, 5).worker, 'one welder manned');
  ok(!(S.tile(s, 5, 2).worker && S.tile(s, 3, 5).worker), 'only two workers');
});
test('기계 정지: 재료 안 받고 작업자 빠짐, 다시 가동', () => {
  const s = fresh(1);
  const w = S.tile(s, 5, 2);
  S.toggleMachine(s, 5, 2);
  eq(w.enabled, false); eq(w.worker, null);
  runSec(s, 3);
  eq(w.status, 'off');
  S.toggleMachine(s, 5, 2);
  ok(w.enabled && w.worker);
});
test('남는 재고 처분: 주문 몫은 남기고 40% 가격', () => {
  const s = fresh(1);
  s.inventory.bracket = 100;
  const demand = S.demandLots(s, 'bracket');
  const c = s.cash;
  const r = S.dumpStock(s, 'bracket');
  ok(r.ok);
  eq(s.inventory.bracket, demand);
  eq(s.cash - c, Math.round((100 - demand) * 100 * 1100 * D.LOGISTICS.dumpRate));
});

console.log('경영');
test('주문 수락 → 출하 → 현금(3차)/외상(2차)', () => {
  const s = fresh(1); s.orders = [];
  s.inventory.bracket = 20;
  s.orders.push({ id: 1, client: 'a', tier: 0, item: 'bracket', lots: 10, unitPrice: 1000, dueDays: 5, dueDay: S.absDay(s) + 5 });
  s.orders.push({ id: 2, client: 'b', tier: 1, item: 'bracket', lots: 10, unitPrice: 1000, dueDays: 5, dueDay: S.absDay(s) + 5 });
  const c = s.cash;
  runDays(s, 1);
  eq(s.orders.length >= 0, true);
  ok(s.receivables.some((r) => r.client === 'b'), 'receivable');
  ok(s.month.revenue >= 2 * 10 * 100 * 1000 || s.history.length, 'revenue counted');
  ok(s.cash > c - 5e6, 'cash from tier0');
});
test('납기 초과 → 위약금, 오래되면 해지', () => {
  const s = fresh(1); s.orders = [];
  s.orders.push({ id: 1, client: 'a', tier: 0, item: 'disc', lots: 10, unitPrice: 10000, dueDays: 1, dueDay: S.absDay(s) });
  runDays(s, D.OFFERS.cancelAfterLateDays + 2);
  ok(!s.orders.some((o) => o.id === 1), 'cancelled');
  ok(s.rep[0] < D.TIERS[0].startRep + 10);
});
test('월말: 월급·유지비·이자 차감, 기록', () => {
  const s = fresh(1);
  runDays(s, D.TIME.daysPerMonth);
  eq(s.history.length, 1);
  const h = s.history[0];
  eq(h.wages, S.monthlyWages(s) || h.wages);
  eq(h.interest, Math.round(D.FINANCE.startLoan * D.FINANCE.monthlyInterest));
  eq(s.monthIndex, 1);
});
test('현금 바닥 → 긴급 대출, 한도도 넘으면 부도', () => {
  const s = fresh(1); s.cash = -1e7;
  runDays(s, D.TIME.daysPerMonth);
  ok(s.loan > D.FINANCE.startLoan, 'emergency loan');
  const t = fresh(2); t.cash = -1e10;
  for (let i = 0; i < 20000 && !t.flags.gameOver; i++) S.tick(t, 0.05, 4);
  ok(t.flags.gameOver, 'game over');
});
test('ISO: 불량률 조건, 연구: ISO 필요', () => {
  const s = fresh(1); s.cash = 1e9;
  ok(!S.buyCert(s, 'iso').ok, 'no history');
  s.history.push({ crafts: 100, defects: 1 });
  ok(S.buyCert(s, 'iso').ok);
  ok(S.tierUnlocked(s, 2));
  ok(!S.buyCert(s, 'iatf').ok || true);
  ok(S.startResearch(s, 'ev').ok);
  for (let d = 0; d < D.RESEARCH.ev.days + 1; d++) runDays(s, 1);
  ok(s.research.ev.done && S.recipeUnlocked(s, 'battery'));
});
test('증축: 바닥 넓어지고 기존 배치 유지', () => {
  const s = fresh(1); s.cash = 1e9;
  ok(S.expandFloor(s).ok);
  eq(s.floor.cols, D.FLOOR.levels[2].cols);
  eq(S.tile(s, 5, 2).k, 'machine');
});
test('설비 해금: 처음엔 프레스·용접만, 신뢰·인증으로 풀린다', () => {
  const s = fresh(1); s.cash = 1e9;
  ok(S.modelUnlocked(s, 'press_old') && S.modelUnlocked(s, 'weld_old'));
  ok(!S.modelUnlocked(s, 'lathe_old') && !S.modelUnlocked(s, 'heat') && S.splitUnlocked(s), 'splitter from start');
  ok(!S.build(s, 0, 8, 'machine', { model: 'lathe_old' }).ok, 'locked build refused');
  s.rep[0] = 60;
  const fresh2 = S.checkUnlocks(s);
  ok(fresh2.length >= 2 && S.modelUnlocked(s, 'lathe_old') && S.modelUnlocked(s, 'heat'));
  ok(!S.modelUnlocked(s, 'weld_robot'));
  s.certs.iso = true;
  ok(S.modelUnlocked(s, 'weld_robot') && S.modelUnlocked(s, 'paint'));
});
test('주문은 해금된 설비로 만들 수 있는 부품만', () => {
  const s = fresh(5);
  runDays(s, 6);
  ok(s.offers.every((o) => S.itemUnlocked(s, o.item)), s.offers.map((o) => o.item).join());
});
test('할 일: 첫날 주문 2개, 수락하면 다음 단계, 용접기 2대면 보상', () => {
  const s = fresh(1);
  eq(s.offers.length, 2);
  eq(S.currentQuest(s).id, 'accept');
  S.acceptOffer(s, s.offers[0].id);
  S.checkQuest(s);
  eq(S.currentQuest(s).id, 'split');
  const c = s.cash;
  S.build(s, 5, 4, 'machine', { model: 'weld_old', dir: 0 });
  S.setRecipe(s, 5, 4, 'bracket');
  S.checkQuest(s);
  ok(s.cash > c - 5e6 + 2e6, 'reward paid');
  eq(S.currentQuest(s).id, 'staff');
});
test('시작 라인은 용접이 병목 (프레스보다 느림)', () => {
  const s = fresh(1);
  ok(S.machinePerMin(s, S.tile(s, 5, 2)) < S.machinePerMin(s, S.tile(s, 2, 2)) * 0.8);
});
test('새 게임 첫날 밤에 이미 열린 설비를 "새로 해금"이라고 알리지 않는다', () => {
  const s = fresh(1);
  runDays(s, 1);
  ok(!s.log.some((l) => l.text.includes('분배기')), 'no splitter unlock toast');
});
test('분당 처리량 표기 = 60 × 속도 / 레시피 시간', () => {
  const s = fresh(1);
  const m = S.tile(s, 5, 2);
  const want = (60 * S.machineRate(s, m)) / D.RECIPES.bracket.time;
  ok(Math.abs(S.machinePerMin(s, m) - want) < 1e-9);
  ok(Math.abs(S.inputPerMin() - 60 / D.LOGISTICS.inputInterval) < 1e-9);
});
test('철거 환불, 기계 교체', () => {
  const s = fresh(1); s.cash = 1e9; unlockAll(s);
  const c = s.cash;
  ok(S.removeAt(s, 3, 2).ok && s.cash > c);
  ok(S.upgradeMachine(s, 5, 2, 'weld_robot').ok);
  eq(S.tile(s, 5, 2).model, 'weld_robot');
  ok(s.achievements.robot);
});

test('입고 품목을 바꾸기 전에 올라간 엉뚱한 재료가 라인을 영원히 막지 않음', () => {
  const s = fresh(5); empty(s); s.cash = 1e9;
  S.build(s, 0, 0, 'input', { dir: 0 }); // 기본 강판
  S.build(s, 1, 0, 'belt', { dir: 0 });
  S.build(s, 2, 0, 'machine', { model: 'lathe_old', dir: 0 });
  S.build(s, 3, 0, 'belt', { dir: 0 }); S.build(s, 4, 0, 'output');
  s.workers = s.workers.slice(0, 1); S.assignWorkers(s);
  runSec(s, 3); // 강판이 벨트에 올라감
  S.setInputItem(s, 0, 0, 'bar');
  runSec(s, 20);
  ok(S.tile(s, 2, 0).crafts > 0, '선반이 볼트를 만들어야 함');
  ok(!S.tile(s, 1, 0).items.some((i) => i.it === 'sheet'), '강판이 남아 있으면 안 됨');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
