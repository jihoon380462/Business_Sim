// core 검증. 실행: node tests/run.js  (DOM 없음, 외부 라이브러리 없음)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../src/core/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', `${n}.json`), 'utf8'));
const data = {
  config: load('config'), jobs: load('jobs'), stocks: load('stocks'),
  businesses: load('businesses'), events: load('events'), characters: load('characters'),
};
core.setData(data);

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass += 1; console.log(`  ✓ ${name}`); }
  catch (e) { fail += 1; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function eq(a, b, msg = '') { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); }
function ok(v, msg = '') { if (!v) throw new Error(msg || 'expected truthy'); }

const runWeeks = (s, n, each = (x) => x) => { for (let i = 0; i < n; i++) { s = core.advanceWeek(s); s = each(s); } return s; };
const noPending = (s) => (s.events.pending ? core.resolveEvent(s, { choiceId: 'ignore' }) : s);

console.log('core 규칙');
test('src/core 에 document/window/Math.random 참조 없음', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'src/core'))) {
    const src = fs.readFileSync(path.join(ROOT, 'src/core', f), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    ok(!/\bdocument\b|\bwindow\b|Math\.random/.test(src), `${f} has forbidden reference`);
  }
});
test('core 에 밸런스 숫자 리터럴 없음(1만 이상)', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'src/core'))) {
    if (f === 'rng.js') continue; // 알고리즘 상수(2^32)만 있음
    const src = fs.readFileSync(path.join(ROOT, 'src/core', f), 'utf8').replace(/\/\/.*$/gm, '');
    const m = src.match(/(?<![\w.])\d{5,}(?![\w])/g);
    ok(!m, `${f} has large numeric literal: ${m}`);
  }
});
test('advanceWeek 는 입력 state 를 바꾸지 않는다', () => {
  const s = core.createInitialState(7);
  const json = JSON.stringify(s);
  core.advanceWeek(s);
  eq(JSON.stringify(s), json);
});
test('같은 시드 → 같은 결과', () => {
  const a = runWeeks(core.createInitialState(123), 30, noPending);
  const b = runWeeks(core.createInitialState(123), 30, noPending);
  eq(JSON.stringify(a), JSON.stringify(b));
});

console.log('시간·돈');
test('주차/년차/계절', () => {
  eq(core.weekLabel(1), '1년차 1주');
  eq(core.weekLabel(53), '2년차 1주');
  eq(core.weekLabel(121), '3년차 17주');
  eq(core.seasonOf(1), 'spring'); eq(core.seasonOf(14), 'summer'); eq(core.seasonOf(40), 'winter'); eq(core.seasonOf(53), 'spring');
});
test('한 주: 주급 + 생활비 반영', () => {
  const s0 = core.createInitialState(1);
  const s1 = core.advanceWeek(s0);
  const job = core.findJob(s0.activity);
  const tip = s1.log.find((l) => l.title === '손님 팁');
  eq(s1.week, 2);
  eq(s1.money, s0.money + job.wage - data.config.livingCost + (tip ? tip.amount : 0));
  eq(s1.energy, s0.energy + job.energyDelta);
});
test('로그는 logMax 이하', () => {
  const s = runWeeks(core.createInitialState(5), 60, noPending);
  ok(s.log.length <= data.config.logMax);
});

console.log('알바·체력');
test('체력 0 → 자동 휴식, 휴식은 체력 회복', () => {
  let s = core.setActivity(core.createInitialState(2), { activityId: 'delivery' });
  const drain = -data.jobs.activities.find((a) => a.id === 'delivery').energyDelta;
  const weeks = Math.floor(data.config.startEnergy / drain) + 1;
  s = runWeeks(s, weeks, noPending);
  eq(s.activity, 'rest', `after ${weeks} weeks of delivery`);
  const e = s.energy;
  s = core.advanceWeek(s);
  ok(s.energy > e, 'rest recovers');
});
test('체력 부족한 알바는 선택 불가', () => {
  let s = core.createInitialState(3);
  s.energy = 20;
  ok(!core.canDoActivity(s, 'delivery'));
  eq(core.setActivity(s, { activityId: 'delivery' }).activity, 'convenience');
  ok(core.canDoActivity(s, 'cafe'));
});
test('잔액 음수 → 편의점 알바 강제', () => {
  let s = core.setActivity(core.createInitialState(4), { activityId: 'rest' });
  s.money = 50000;
  s = core.advanceWeek(s);
  ok(s.money < 0);
  eq(s.activity, 'convenience');
});

console.log('주식');
test('매수: 수수료 포함 차감, 평균단가', () => {
  const s0 = core.createInitialState(1);
  const price = s0.stocks.prices.hanbit;
  const s1 = core.buyStock(s0, { symbol: 'hanbit', qty: 10 });
  eq(s1.money, s0.money - Math.round(price * 10 * (1 + data.config.stockFeeRate)));
  eq(s1.stocks.holdings.hanbit.qty, 10);
  eq(s1.stocks.holdings.hanbit.avgCost, price);
});
test('매도: 보유 초과·자금 부족·0주 거부', () => {
  const s0 = core.createInitialState(1);
  eq(core.sellStock(s0, { symbol: 'hanbit', qty: 1 }), s0);
  eq(core.buyStock(s0, { symbol: 'narae', qty: 10000 }), s0);
  eq(core.buyStock(s0, { symbol: 'narae', qty: 0 }), s0);
  const s1 = core.buyStock(s0, { symbol: 'narae', qty: 2 });
  const s2 = core.sellStock(s1, { symbol: 'narae', qty: 2 });
  ok(!s2.stocks.holdings.narae);
  ok(s2.money < s0.money, 'round trip loses fees');
});
test('가격은 매주 변동폭 안에서 움직인다', () => {
  let s = core.createInitialState(9);
  for (let i = 0; i < 20; i++) {
    const prev = { ...s.stocks.prices };
    s = core.advanceWeek(s);
    s = noPending(s);
    for (const sym of data.stocks.symbols) {
      if (core.isDelisted(s, sym.id) || s.events.rumor === null && s.log[0]?.title.startsWith('뉴스')) continue;
      const r = s.stocks.prices[sym.id] / prev[sym.id];
      const limit = sym.weeklyVolatility + Math.abs(sym.drift) + data.events.rumor.shockMax + 0.01;
      ok(Math.abs(r - 1) <= limit, `${sym.id} moved ${r}`);
    }
  }
});
test('소문 → N주 뒤 ±30% 뉴스', () => {
  let s = core.createInitialState(1);
  s.events.pending = { eventId: 'rumor_good', title: '소문', text: '', choices: [], payload: { symbol: 'daeyang', direction: 1, delay: 2, shock: 0.3 } };
  s = core.resolveEvent(s, { choiceId: 'pay' });
  eq(s.money, data.config.startMoney - data.events.rumor.cost);
  ok(s.events.rumor && s.events.rumor.known);
  ok(core.rumorBanner(s).includes('호재'));
  s = core.advanceWeek(s); s = noPending(s);
  ok(s.events.rumor, 'still pending after 1 week');
  const before = s.stocks.prices.daeyang;
  s = core.advanceWeek(s);
  eq(s.events.rumor, null);
  ok(s.stocks.prices.daeyang / before > 1.15, 'jumped');
  ok(s.log.some((l) => l.title.startsWith('뉴스: 대양건설 호재')));
});
test('상장폐지: 예고 후 가격 0, 보유분 소멸, 매매 불가', () => {
  let s = core.buyStock(core.createInitialState(1), { symbol: 'byulbit', qty: 5 });
  s.events.delisting = { symbol: 'byulbit', weeksLeft: 1 };
  s = core.advanceWeek(s);
  ok(core.isDelisted(s, 'byulbit'));
  eq(s.stocks.prices.byulbit, 0);
  ok(!s.stocks.holdings.byulbit);
  eq(core.buyStock(s, { symbol: 'byulbit', qty: 1 }), s);
});

test('상장폐지 예고 주: 즉시 -40%, 매도 가능', () => {
  const dl = data.events.delisting;
  const sym = data.stocks.symbols.find((x) => x.type === 'junk');
  let found = false;
  for (let seed = 1; seed <= 50 && !found; seed++) {
    let s = core.buyStock(core.createInitialState(seed), { symbol: sym.id, qty: 5 });
    s.week = dl.minWeek;
    for (let i = 0; i < 80 && !found; i++) {
      const prevHold = s.stocks.holdings[sym.id]?.qty || 0;
      s = core.advanceWeek(s); s = noPending(s);
      if (s.events.delisting) {
        found = true;
        const r = s.stocks.prices[sym.id] / s.stocks.prevPrices[sym.id];
        ok(r <= (1 + sym.weeklyVolatility + Math.abs(sym.drift)) * (1 - dl.warningDrop) + 0.001, `drop ratio ${r}`);
        ok(!core.isDelisted(s, sym.id) && prevHold === 5, 'still tradable on warning week');
        const sold = core.sellStock(s, { symbol: sym.id, qty: 5 });
        ok(!sold.stocks.holdings[sym.id], 'sold');
      }
    }
  }
  ok(found, 'delisting warning never fired in 50 seeds');
});

console.log('대출');
test('한도 내 대출, 이자 차감, 상환', () => {
  const L = data.config.loan;
  let s = core.createInitialState(1);
  eq(core.loanAvailable(s), 0, 'no business → no loan');
  s.money = 3000000;
  s = core.openBusiness(s, { typeId: 'stall' });
  s = core.borrow(s, { amount: L.limit * 2 });
  eq(s.loan.principal, L.limit);
  eq(core.loanAvailable(s), 0);
  const m = s.money;
  s = core.setActivity(s, { activityId: 'rest' });
  s = core.advanceWeek(s);
  const biz = s.business.lastWeek;
  eq(s.money, m - data.config.livingCost - Math.round(L.limit * L.weeklyInterestRate) + biz.revenue - biz.materials - biz.labor - biz.fixed - biz.promo);
  s = core.repay(s, { amount: 1000000 });
  eq(s.loan.principal, L.limit - 1000000);
});

console.log('사업');
test('노점 개업: 자금 차감, 분식집은 노점 보유 필요', () => {
  let s = core.createInitialState(1);
  eq(core.canOpen(s, 'snackbar').reason, 'locked');
  eq(core.canOpen(s, 'stall').reason, 'money');
  s.money = 3000000;
  ok(core.canOpen(s, 'stall').ok);
  s = core.openBusiness(s, { typeId: 'stall' });
  eq(s.money, 0);
  eq(s.business.type, 'stall');
  eq(core.canOpen(s, 'snackbar').reason, 'money');
});
test('운영 정산: 매출·재료비·고정비·평판 변화, 휴무는 매출 0', () => {
  let s = core.createInitialState(1);
  s.money = 3000000;
  s = core.openBusiness(s, { typeId: 'stall' });
  s = core.setPolicy(s, { price: 'high', promo: true });
  const rep = s.business.reputation;
  s = core.advanceWeek(s);
  const lw = s.business.lastWeek;
  ok(lw.revenue > 0 && lw.materials > 0 && lw.fixed > 0 && lw.promo > 0);
  eq(lw.net, lw.revenue - lw.materials - lw.labor - lw.fixed - lw.promo - lw.interest);
  eq(s.business.reputation, rep + data.businesses.priceOptions.high.reputationDelta + data.businesses.ingredientGrades['1'].reputationDelta + data.businesses.promoReputationDelta);
  s = core.setPolicy(s, { open: false });
  s = core.advanceWeek(s);
  eq(s.business.lastWeek.revenue, 0);
  eq(s.business.lastWeek.fixed, data.businesses.types[0].fixedCost);
});
test('분식집: 직원 고용/해고, 재료 업그레이드, 목표(4주 흑자) → 리포트', () => {
  let s = core.createInitialState(1);
  s.money = 40000000;
  s = core.openBusiness(s, { typeId: 'stall' });
  s = core.openBusiness(s, { typeId: 'snackbar' });
  ok(core.canHire(s));
  s = core.hireStaff(s); eq(s.business.staff, 1);
  s = core.fireStaff(s); eq(s.business.staff, 0);
  s = core.upgradeIngredients(s); eq(s.business.grade, 2);
  s.business.reputation = 80;
  s = runWeeks(s, 4, noPending);
  ok(s.goal.achieved, 'goal achieved');
  const r = s.goal.pendingReport;
  ok(r && r.weekly.length === 4 && r.hasLabor === true);
  eq(r.totals.net, r.weekly.reduce((a, w) => a + w.net, 0));
  s = core.dismissReport(s);
  eq(s.goal.pendingReport, null);
  ok(s.goal.lastReport);
});
test('노점 4주 흑자로는 목표 달성 안 됨', () => {
  let s = core.createInitialState(1);
  s.money = 3000000;
  s = core.openBusiness(s, { typeId: 'stall' });
  s.business.reputation = 100;
  s = runWeeks(s, 6, noPending);
  ok(!s.goal.achieved);
});

console.log('저장');
test('serialize/deserialize 왕복', () => {
  const s = runWeeks(core.createInitialState(11), 10, noPending);
  const back = core.deserialize(core.serialize(s));
  eq(JSON.stringify(back), JSON.stringify(s));
  eq(core.deserialize(JSON.stringify({ foo: 1 })), null);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
