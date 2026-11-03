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
const unlockAll = (s) => { s.certs = { iso: true, iatf: true }; s.rep = { 0: 100, 1: 100, 2: 100, 3: 100 }; s.monthIndex = Math.max(1, s.monthIndex); };
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
test('아버지 라인: 첫날 일반 볼트가 출하구에 쌓인다', () => {
  const s = fresh(1);
  runSec(s, 55);
  ok((s.inventory.bolt || 0) >= 8, `inventory ${s.inventory.bolt}`);
  ok(s.month.raw > 0 && s.cash < D.FINANCE.startCash);
});
test('벨트는 막히면 멈추고 입고구도 사지 않는다', () => {
  const s = fresh(1); empty(s);
  S.build(s, 0, 0, 'input', { dir: 0 });
  S.build(s, 1, 0, 'belt', { dir: 0 });
  S.build(s, 2, 0, 'belt', { dir: 0 });
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
test('출하구는 완제품을 계속 받아 섞인 벨트가 막히지 않는다 (남으면 경고)', () => {
  const s = fresh(1); empty(s);
  S.build(s, 0, 0, 'belt', { dir: 0 }); S.build(s, 1, 0, 'output');
  const b = S.tile(s, 0, 0);
  for (let i = 0; i < 3; i++) b.items.push({ it: i % 2 ? 'bolt' : 'bolt88', p: 1 - i * 0.34 });
  s.inventory.bolt88 = 100;
  runSec(s, 3);
  eq(b.items.length, 0, 'belt drained');
  ok(s.toasts.some((t) => t.text.includes('창고')), 'warned');
});
test('입고 품목을 바꾸기 전에 올라간 엉뚱한 재료가 라인을 영원히 막지 않음', () => {
  const s = fresh(5); empty(s); s.cash = 1e9;
  S.build(s, 0, 0, 'input', { dir: 0 });
  S.setInputItem(s, 0, 0, 'wire');
  S.build(s, 1, 0, 'belt', { dir: 0 });
  S.build(s, 2, 0, 'machine', { model: 'lathe_old', dir: 0 });
  S.build(s, 3, 0, 'belt', { dir: 0 }); S.build(s, 4, 0, 'output');
  s.workers = s.workers.slice(0, 1); S.assignWorkers(s);
  runSec(s, 3); // 선재가 벨트에 올라감 (선반은 강봉만 받음)
  S.setInputItem(s, 0, 0, 'bar');
  runSec(s, 20);
  ok(S.tile(s, 2, 0).crafts > 0, '선반이 볼트를 만들어야 함');
  ok(!S.tile(s, 1, 0).items.some((i) => i.it === 'wire'), '선재가 남아 있으면 안 됨');
});
test('성형 라인 전체: 선재 → 헤더 → 전조 → 볼트', () => {
  const s = fresh(2); empty(s); s.cash = 1e9; s.popups = [];
  S.build(s, 0, 0, 'input', { dir: 0 }); S.setInputItem(s, 0, 0, 'wire');
  S.build(s, 1, 0, 'machine', { model: 'header_old', dir: 0 });
  S.build(s, 2, 0, 'machine', { model: 'roll', dir: 0 });
  S.build(s, 3, 0, 'output');
  s.orders = [{ id: 1, client: 'x', tier: 0, item: 'bolt', lots: 500, unitPrice: 90, dueDays: 99, dueDay: 999 }];
  runSec(s, 40);
  ok((s.inventory.bolt || 0) >= 15, `bolt ${s.inventory.bolt}`);
});

console.log('공구·금형');
test('금형이 다 닳으면 알아서 교체(돈·시간), 돈 없으면 멈춤', () => {
  const s = fresh(1); empty(s); s.cash = 1e9;
  S.build(s, 2, 2, 'machine', { model: 'roll', dir: 0 });
  const m = S.tile(s, 2, 2);
  s.workers = s.workers.slice(0, 1); S.assignWorkers(s);
  m.toolUsed = S.toolLife(m); m.inBuf.blank = 2;
  const c = s.cash;
  runSec(s, 0.2);
  eq(m.status, 'tool_change');
  ok(c - s.cash >= D.MACHINE_TYPES.roll.tool.cost, 'charged');
  eq(s.month.tooling, D.MACHINE_TYPES.roll.tool.cost);
  runSec(s, D.MACHINE_TYPES.roll.tool.sec * 2.5);
  ok(m.toolUsed <= 2, `fresh tool ${m.toolUsed}`);
  m.toolUsed = S.toolLife(m); m.crafting = false; m.inBuf.blank = 2; s.cash = 10;
  runSec(s, 1);
  eq(m.status, 'tool_worn');
});
test('선반은 금형이 없고, 헤더·전조기는 있다', () => {
  ok(S.toolCostPerLot('lathe_old') === 0 && S.toolCostPerLot('header_old') > 0 && S.toolCostPerLot('roll') > 0);
});

console.log('길(라우트)');
test('볼트를 만드는 길은 2가지: 절삭 / 성형', () => {
  const rs = S.routesFor('bolt').map((r) => r.map((c) => c.recipe).join('>'));
  eq(rs.length, 2); ok(rs.includes('cut_bolt') && rs.includes('head>roll'), rs.join(' | '));
  eq(S.routesFor('bolt88').length, 2);
});
test('성형이 절삭보다 상자당 원가가 싸다 (재료+공구)', () => {
  const cut = D.ITEMS.bar.cost + S.toolCostPerLot('lathe_old');
  const form = D.ITEMS.wire.cost + S.toolCostPerLot('header_old') + S.toolCostPerLot('roll');
  ok(form < cut, `${form} < ${cut}`);
});
test('생산 능력: 출하구로 이어진 선반 2대면 2배', () => {
  const s = fresh(1); s.cash = 1e9; unlockAll(s);
  const one = S.capacityOf(s, 'bolt');
  S.build(s, 4, 3, 'machine', { model: 'lathe_old', dir: 3 }); // 위쪽 벨트로 내보냄
  s.workers.push({ id: 900, name: 'a', skill: s.workers[1].skill, talent: 1, wage: 3e6, morale: 70 }); S.assignWorkers(s);
  ok(S.capacityOf(s, 'bolt') > one * 1.5, 'two lathes');
  eq(S.capacityOf(s, 'bolt88'), 0);
});

test('출하구로 안 이어진 기계는 그 제품 생산 능력에 안 센다', () => {
  const s = fresh(1); empty(s); unlockAll(s); s.cash = 1e9;
  S.build(s, 0, 0, 'input', { dir: 0 }); S.setInputItem(s, 0, 0, 'wire');
  S.build(s, 1, 0, 'machine', { model: 'header_old', dir: 0 });
  S.build(s, 2, 0, 'machine', { model: 'roll', dir: 0 });
  S.build(s, 3, 0, 'machine', { model: 'heat', dir: 0 });
  S.build(s, 4, 0, 'output');
  s.workers.push({ id: 900, name: 'a', skill: 3, talent: 1, wage: 3e6, morale: 70 }, { id: 901, name: 'b', skill: 3, talent: 1, wage: 3e6, morale: 70 }); S.assignWorkers(s);
  eq(S.capacityOf(s, 'bolt'), 0, '일반 볼트로는 안 나감');
  ok(S.capacityOf(s, 'bolt88') > 0, '고강도는 나감');
  ok(S.estimateDays(s, 'bolt', 10) == null && S.estimateDays(s, 'bolt88', 10) > 0);
});

test('열처리로는 처음부터 "주문 있을 때만": 주문 없으면 분배기가 볼트를 출하구로 보냄', () => {
  const s = fresh(1); empty(s); unlockAll(s); s.cash = 1e9;
  S.build(s, 0, 0, 'belt', { dir: 0 }); S.build(s, 1, 0, 'split', { dir: 0 });
  S.build(s, 2, 0, 'belt', { dir: 0 }); S.build(s, 3, 0, 'output');
  S.build(s, 1, 1, 'machine', { model: 'heat', dir: 0 }); S.build(s, 2, 1, 'belt', { dir: 3 });
  s.workers = s.workers.slice(0, 1); S.assignWorkers(s);
  const h = S.tile(s, 1, 1);
  ok(h.orderOnly, 'default on');
  const feed = () => { const b = S.tile(s, 0, 0); if (!b.items.length || b.items[b.items.length - 1].p > 0.4) b.items.push({ it: 'bolt', p: 0 }); };
  for (let i = 0; i < 200; i++) { feed(); S.tick(s, 0.05, 1); }
  eq(h.crafts, 0, 'no 8.8 orders → heat idle');
  ok((s.inventory.bolt || 0) > 5, 'bolts went to output');
  s.orders = [{ id: 1, client: 'x', tier: 1, item: 'bolt88', lots: 5, unitPrice: 150, dueDays: 9, dueDay: 99 }];
  for (let i = 0; i < 300; i++) { feed(); S.tick(s, 0.05, 1); }
  ok(h.crafts >= 3, `heat works when ordered (${h.crafts})`);
});

test('한 번 풀린 설비는 신뢰가 떨어져도 다시 잠기지 않는다', () => {
  const s = fresh(1); s.rep[0] = 70; S.checkUnlocks(s);
  ok(S.typeUnlocked(s, 'heat'));
  s.rep[0] = 60;
  ok(S.typeUnlocked(s, 'heat') && S.itemUnlocked(s, 'bolt88'));
});
test('주문 있을 때만: 벨트 위에 이미 가는 몫까지 세서 더 만들지 않는다', () => {
  const s = fresh(1); empty(s); unlockAll(s); s.cash = 1e9;
  S.build(s, 0, 0, 'belt', { dir: 0 });
  S.build(s, 1, 0, 'machine', { model: 'heat', dir: 0 });
  for (let x = 2; x < 7; x++) S.build(s, x, 0, 'belt', { dir: 0 });
  S.build(s, 7, 0, 'output');
  s.workers = s.workers.slice(0, 1); S.assignWorkers(s);
  s.orders = [{ id: 1, client: 'x', tier: 1, item: 'bolt88', lots: 5, unitPrice: 150, dueDays: 9, dueDay: 99 }];
  const h = S.tile(s, 1, 0), b = S.tile(s, 0, 0);
  for (let i = 0; i < 800; i++) { if (!b.items.length || b.items[b.items.length - 1].p > 0.4) b.items.push({ it: 'bolt', p: 0 }); S.tick(s, 0.05, 1); }
  ok(h.crafts - s.month.defects <= 7, `made ${h.crafts}`);
});

console.log('기계');
test('작업자 없으면 멈춤, 자동 설비는 혼자 돈다', () => {
  const s = fresh(1); empty(s); s.workers = []; s.cash = 1e9;
  S.build(s, 0, 0, 'machine', { model: 'roll', dir: 0 });
  S.build(s, 2, 0, 'machine', { model: 'roll_auto', dir: 0 });
  const a = S.tile(s, 0, 0), b = S.tile(s, 2, 0);
  a.inBuf.blank = 2; b.inBuf.blank = 2;
  runSec(s, 3);
  eq(a.status, 'no_worker'); ok(b.crafts >= 1 || b.crafting);
  ok(s.achievements.robot);
});
test('고장 → 수리 비용·시간 → 복구', () => {
  const s = fresh(1);
  const m = S.tile(s, 3, 2);
  m.broken = true;
  ok(S.repair(s, 3, 2).ok);
  runSec(s, D.MACHINE_RULES.repairSec + 0.5);
  ok(!m.broken && m.cond >= D.MACHINE_RULES.repairCond);
});
test('방치한 고장은 외부 수리(더 비쌈)', () => {
  const s = fresh(1);
  const m = S.tile(s, 3, 2);
  m.broken = true;
  const c = s.cash;
  runSec(s, D.MACHINE_RULES.autoRepairAfterSec + D.MACHINE_RULES.repairSec + 1);
  ok(!m.broken && s.cash < c);
});
test('숙련공은 느린 공정(병목)에 배치', () => {
  const s = fresh(1); s.cash = 1e9; unlockAll(s);
  S.build(s, 0, 6, 'machine', { model: 'header_old', dir: 0 });
  eq(S.workerOf(s, S.tile(s, 3, 2)).name, '김반장');
});
test('작업자 부족해도 라인이 끊기지 않게: 레시피마다 한 명 먼저', () => {
  const s = fresh(1); s.cash = 1e9; unlockAll(s);
  S.build(s, 3, 5, 'machine', { model: 'lathe_old', dir: 0 });
  S.build(s, 5, 5, 'machine', { model: 'heat', dir: 0 });
  ok(S.tile(s, 5, 5).worker, 'heat manned');
  ok(S.tile(s, 3, 2).worker || S.tile(s, 3, 5).worker, 'one lathe manned');
});
test('기계 정지: 재료 안 받고 작업자 빠짐, 다시 가동', () => {
  const s = fresh(1);
  const w = S.tile(s, 3, 2);
  S.toggleMachine(s, 3, 2);
  eq(w.enabled, false); eq(w.worker, null);
  runSec(s, 3);
  eq(w.status, 'off');
  S.toggleMachine(s, 3, 2);
  ok(w.enabled && w.worker);
});
test('남는 재고 처분: 주문 몫은 남기고 40% 가격', () => {
  const s = fresh(1);
  s.inventory.bolt = 100;
  const demand = S.demandLots(s, 'bolt');
  const c = s.cash;
  ok(S.dumpStock(s, 'bolt').ok);
  eq(s.inventory.bolt, demand);
  eq(s.cash - c, Math.round((100 - demand) * D.ITEMS.bolt.lot * D.ITEMS.bolt.unitPrice * D.LOGISTICS.dumpRate));
});

console.log('경영');
test('주문 출하 → 현금(3차)/외상(2차)', () => {
  const s = fresh(1); s.orders = [];
  s.inventory.bolt = 20;
  s.orders.push({ id: 1, client: 'a', tier: 0, item: 'bolt', lots: 10, unitPrice: 90, dueDays: 5, dueDay: S.absDay(s) + 5 });
  s.orders.push({ id: 2, client: 'b', tier: 1, item: 'bolt', lots: 10, unitPrice: 90, dueDays: 5, dueDay: S.absDay(s) + 5 });
  const c = s.cash;
  runDays(s, 1);
  ok(s.receivables.some((r) => r.client === 'b'), 'receivable');
  ok(s.cash > c - 5e6, 'cash from tier0');
});
test('납기 초과 → 위약금, 오래되면 해지', () => {
  const s = fresh(1); s.orders = [];
  s.orders.push({ id: 1, client: 'a', tier: 0, item: 'bolt88', lots: 10, unitPrice: 150, dueDays: 1, dueDay: S.absDay(s) });
  runDays(s, D.OFFERS.cancelAfterLateDays + 2);
  ok(!s.orders.some((o) => o.id === 1), 'cancelled');
});
test('월말: 월급·유지비·이자·공구비 차감, 기록', () => {
  const s = fresh(1);
  runDays(s, D.TIME.daysPerMonth);
  eq(s.history.length, 1);
  const h = s.history[0];
  eq(h.interest, Math.round(D.FINANCE.startLoan * D.FINANCE.monthlyInterest));
  eq(h.net, h.revenue - h.penalty - h.raw - h.wages - h.otPay - h.overhead - h.interest - h.repairs - h.tooling - h.utility);
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
test('ISO: 불량률 조건 → 1차 협력사', () => {
  const s = fresh(1); s.cash = 1e9; s.monthIndex = 1;
  ok(!S.buyCert(s, 'iso').ok, 'no history');
  s.history.push({ crafts: 100, defects: 1 });
  ok(S.buyCert(s, 'iso').ok);
  ok(S.tierUnlocked(s, 2) && S.modelUnlocked(s, 'header_new') && S.modelUnlocked(s, 'roll_auto'));
});
test('증축: 바닥 넓어지고 기존 배치 유지', () => {
  const s = fresh(1); s.cash = 1e9;
  ok(S.expandFloor(s).ok);
  eq(s.floor.cols, D.FLOOR.levels[2].cols);
  eq(S.tile(s, 3, 2).k, 'machine');
});
test('설비 해금: 처음엔 선반만, 첫 달 결산 뒤 성형, 2차 협력사에 열처리', () => {
  const s = fresh(1); s.cash = 1e9;
  ok(S.modelUnlocked(s, 'lathe_old') && S.splitUnlocked(s));
  ok(!S.modelUnlocked(s, 'header_old') && !S.modelUnlocked(s, 'heat'));
  ok(!S.build(s, 0, 8, 'machine', { model: 'header_old' }).ok, 'locked build refused');
  runDays(s, D.TIME.daysPerMonth);
  ok(S.modelUnlocked(s, 'header_old') && S.modelUnlocked(s, 'roll') && !S.modelUnlocked(s, 'heat'));
  s.rep[0] = 70; S.checkUnlocks(s);
  ok(S.modelUnlocked(s, 'heat') && S.modelUnlocked(s, 'lathe_new') && !S.modelUnlocked(s, 'roll_auto'));
});
test('주문은 해금된 설비로 만들 수 있는 볼트만', () => {
  const s = fresh(5);
  runDays(s, 6);
  ok(s.offers.every((o) => S.itemUnlocked(s, o.item)), s.offers.map((o) => o.item).join());
  ok(s.offers.every((o) => o.item === 'bolt'));
});
test('할 일: 첫날 주문 2개 → 수락 → 선반 2대면 보상', () => {
  const s = fresh(1);
  eq(s.offers.length, 2);
  eq(S.currentQuest(s).id, 'accept');
  S.acceptOffer(s, s.offers[0].id);
  S.checkQuest(s);
  eq(S.currentQuest(s).id, 'split');
  const c = s.cash;
  S.build(s, 2, 4, 'machine', { model: 'lathe_old', dir: 0 });
  S.checkQuest(s);
  ok(s.cash > c - D.MACHINES.lathe_old.price + 2e6, 'reward paid');
  eq(S.currentQuest(s).id, 'ship');
});
test('시작 라인: 입고구가 선반보다 훨씬 빨라 선반 앞에 밀린다', () => {
  const s = fresh(1);
  ok(S.machinePerMin(s, S.tile(s, 3, 2)) < S.inputPerMin() / 3);
});
test('새 게임 첫날 밤에 이미 열린 설비를 "새로 해금"이라고 알리지 않는다', () => {
  const s = fresh(1);
  runDays(s, 1);
  ok(!s.log.some((l) => l.text.includes('분배기')), 'no splitter unlock toast');
});
test('분당 처리량 표기 = 60 × 속도 / 레시피 시간', () => {
  const s = fresh(1);
  const m = S.tile(s, 3, 2);
  ok(Math.abs(S.machinePerMin(s, m) - (60 * S.machineRate(s, m)) / D.RECIPES.cut_bolt.time) < 1e-9);
});
test('철거 환불, 기계 교체(공구 새것)', () => {
  const s = fresh(1); s.cash = 1e9; unlockAll(s);
  const c = s.cash;
  ok(S.removeAt(s, 1, 2).ok && s.cash > c);
  ok(S.upgradeMachine(s, 3, 2, 'lathe_new').ok);
  eq(S.tile(s, 3, 2).model, 'lathe_new');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
