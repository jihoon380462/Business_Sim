// core 검증 (개정 2: 월 턴제 + 스탯). 실행: node tests/run.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../src/core/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', `${n}.json`), 'utf8'));
const data = {
  config: load('config'), stats: load('stats'), jobs: load('jobs'), stocks: load('stocks'),
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
const approx = (a, b, tol, msg = '') => { if (Math.abs(a - b) > tol) throw new Error(`${msg} expected ≈${b}, got ${a}`); };

const noPending = (s) => (s.events.pending ? core.resolveEvent(s, { choiceId: 'ignore' }) : s);
const run = (s, n, each = (x) => x) => { for (let i = 0; i < n; i++) { s = core.advanceMonth(s); s = each(s); } return s; };
const act = (id) => data.jobs.activities.find((a) => a.id === id);
const richStall = (seed = 1) => { let s = core.createInitialState(seed); s.money = 5000000; return core.openBusiness(s, { typeId: 'stall' }); };
const richSnack = (seed = 1) => { let s = richStall(seed); s.money = 40000000; return core.openBusiness(s, { typeId: 'snackbar' }); };

console.log('core 규칙');
test('src/core 에 document/window/Math.random 참조 없음', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'src/core'))) {
    const src = fs.readFileSync(path.join(ROOT, 'src/core', f), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    ok(!/\bdocument\b|\bwindow\b|Math\.random/.test(src), `${f} has forbidden reference`);
  }
});
test('core 에 밸런스 숫자 리터럴 없음(1만 이상)', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'src/core'))) {
    if (f === 'rng.js') continue;
    const src = fs.readFileSync(path.join(ROOT, 'src/core', f), 'utf8').replace(/\/\/.*$/gm, '');
    const m = (src.match(/(?<![\w.])\d{5,}(?![\w])/g) || []).filter((n) => n !== '10000'); // 10000 = 만 단위 환산(표기), 밸런스 아님
    ok(!m.length, `${f} has large numeric literal: ${m}`);
  }
});
test('advanceMonth 는 입력 state 를 바꾸지 않는다', () => {
  const s = core.createInitialState(7);
  const json = JSON.stringify(s);
  core.advanceMonth(s);
  eq(JSON.stringify(s), json);
});
test('같은 시드 → 같은 결과', () => {
  const a = run(core.createInitialState(123), 24, noPending);
  const b = run(core.createInitialState(123), 24, noPending);
  eq(JSON.stringify(a), JSON.stringify(b));
});

console.log('시간');
test('년차·월·계절·나이', () => {
  eq(core.turnLabel(1), '1년차 1월'); eq(core.turnLabel(13), '2년차 1월'); eq(core.turnLabel(29), '3년차 5월');
  eq(core.seasonOf(1), 'winter'); eq(core.seasonOf(3), 'spring'); eq(core.seasonOf(8), 'summer'); eq(core.seasonOf(11), 'autumn'); eq(core.seasonOf(12), 'winter');
  eq(core.ageAt(1), data.config.startAge); eq(core.ageAt(13), data.config.startAge + 1);
  const s = run(core.createInitialState(1), 13, noPending);
  eq(s.time.year, 2); eq(s.time.month, 2);
});

console.log('돈·활동·스탯');
test('한 달: 월급 × 화술 배율, 생활비, 스탯 +1, 결산 요약', () => {
  const s0 = core.createInitialState(1);
  const s1 = core.advanceMonth(s0);
  const job = act('convenience');
  const expectPay = Math.round(job.income * (0.8 + 0.4 * s0.stats.speech / 100));
  const tip = s1.summary.income.find((i) => i.label === '손님 팁');
  const evMoney = s1.summary.income.filter((i) => !['편의점 알바', '손님 팁'].includes(i.label)).reduce((a, i) => a + i.amount, 0)
    - s1.summary.expense.filter((e) => e.label !== '생활비').reduce((a, e) => a + e.amount, 0);
  eq(s1.money, s0.money + expectPay - data.config.livingCost + (tip ? tip.amount : 0) + evMoney);
  eq(s1.stats.speech, s0.stats.speech + 1); eq(s1.stats.skill, s0.stats.skill + 1);
  eq(s1.summary.net, s1.money - s0.money);
  eq(s1.summary.moneyAfter, s1.money);
  eq(s1.summary.statDelta.speech, 1);
  eq(s1.summary.conditionFrom, s0.condition);
});
test('컨디션: 본업 소모 + 여가 회복, 체력(최대치) 상한', () => {
  let s = core.setActivity(core.createInitialState(2), { slot: 'main', activityId: 'delivery' });
  const s1 = core.advanceMonth(s);
  // 60 - 45 + 40 = 55, 체력 62 → 55
  eq(s1.condition, Math.min(s1.stats.stamina, s.condition - 45 + 40));
  eq(s1.stats.stamina, s.stats.stamina + 2);
});
test('컨디션 0 → 다음 달 강제 휴식(수입 0, 가게 부재) → 복귀', () => {
  let s = core.setActivity(core.createInitialState(3), { slot: 'main', activityId: 'delivery' });
  s = core.setActivity(s, { slot: 'leisure', activityId: 'gym' });
  s.condition = 30;
  s = core.advanceMonth(s); // 30 - 45 - 10 → 0
  eq(s.condition, 0);
  eq(s.activity.main, data.jobs.forcedRestId);
  eq(s.activity.prevMain, 'delivery');
  s.activity.leisure = 'rest';
  s = core.advanceMonth(s);
  ok(!s.summary.income.some((i) => i.label === '택배 상하차'), 'no income on forced rest');
  eq(s.activity.main, 'delivery', 'returned to previous main');
});
test('여가 헬스장/공부: 비용·스탯, 90 이상 절반 상승', () => {
  let s = core.setActivity(core.createInitialState(4), { slot: 'leisure', activityId: 'study' });
  s = core.setStudyTarget(s, { target: 'knowledge' });
  const s1 = core.advanceMonth(s);
  eq(s1.stats.knowledge, s.stats.knowledge + 3);
  ok(s1.summary.expense.some((e) => e.label === '공부' && e.amount === act('study').cost));
  s1.statsExact.knowledge = 92; s1.stats.knowledge = 92;
  const s2 = core.advanceMonth(s1);
  eq(s2.statsExact.knowledge, 93.5); eq(s2.stats.knowledge, 93);
});
test('잔액 음수 → 다음 달 편의점 알바 강제', () => {
  let s = core.setActivity(core.createInitialState(5), { slot: 'main', activityId: 'cafe' });
  s.money = 100000;
  s.activity.main = 'cafe';
  s = richStall(5); s.money = 100000; s.activity.main = 'operate';
  s.activity.leisure = 'rest';
  // 노점 휴무(주인 알바 안 감 → operate 이므로 매출 발생). 대신 알바 없이 휴식 강제 상황을 흉내: main 을 강제휴식 아닌 상태에서 돈만 음수로
  s.activity.main = 'cafe'; // 가게는 휴무(고정비), 카페 수입만
  s.money = -2000000;
  s = core.advanceMonth(s);
  eq(s.activity.main, 'convenience');
});

console.log('주식');
test('매수/매도 수수료, 거부 조건', () => {
  const s0 = core.createInitialState(1);
  const price = s0.stocks.prices.hanbit;
  const s1 = core.buyStock(s0, { symbol: 'hanbit', qty: 10 });
  eq(s1.money, s0.money - Math.round(price * 10 * (1 + data.config.stockFeeRate)));
  eq(core.sellStock(s0, { symbol: 'hanbit', qty: 1 }), s0);
  eq(core.buyStock(s0, { symbol: 'narae', qty: 100000 }), s0);
  const s2 = core.sellStock(s1, { symbol: 'hanbit', qty: 10 });
  ok(!s2.stocks.holdings.hanbit && s2.money < s0.money);
});
test('월 변동폭 안에서 움직인다', () => {
  let s = core.createInitialState(9);
  for (let i = 0; i < 12; i++) {
    const prev = { ...s.stocks.prices };
    s = core.advanceMonth(s); s = noPending(s);
    for (const sym of data.stocks.symbols) {
      if (core.isDelisted(s, sym.id) || s.events.delisting) continue;
      const r = s.stocks.prices[sym.id] / prev[sym.id];
      const limit = sym.monthlyVolatility + Math.abs(sym.drift) + data.events.rumor.shockMax + 0.02;
      ok(Math.abs(r - 1) <= limit, `${sym.id} moved ${r}`);
    }
  }
});
test('소문: 지식에 따른 정보량, N개월 뒤 뉴스', () => {
  const mk = (knowledge) => {
    let s = core.createInitialState(1);
    s.stats.knowledge = knowledge;
    s.events.pending = { eventId: 'rumor_good', title: '소문', text: '', choices: [], payload: { symbol: 'daeyang', direction: 1, delay: 2, shock: 0.3 } };
    return core.resolveEvent(s, { choiceId: 'pay' });
  };
  ok(!/개월/.test(mk(10).events.rumor.detail) && /호재/.test(mk(10).events.rumor.detail), 'direction only');
  ok(/2개월/.test(mk(40).events.rumor.detail) && !/%/.test(mk(40).events.rumor.detail), 'with timing');
  ok(/\+30%/.test(mk(70).events.rumor.detail), 'with magnitude');
  let s = mk(10);
  eq(s.money, data.config.startMoney - data.events.rumor.cost);
  s = core.advanceMonth(s); s = noPending(s);
  ok(s.events.rumor, 'still pending after 1 month');
  const before = s.stocks.prices.daeyang;
  s = core.advanceMonth(s);
  eq(s.events.rumor, null);
  ok(s.stocks.prices.daeyang / before > 1.05, 'jumped');
  ok(s.summary.notices.some((n) => n.text.startsWith('뉴스: 대양건설 호재')));
});
test('상장폐지: 예고 달 -40% 즉시·매도 가능, 다음 달 0원·소멸', () => {
  const dl = data.events.delisting;
  const sym = data.stocks.symbols.find((x) => x.type === 'junk');
  let found = false;
  for (let seed = 1; seed <= 40 && !found; seed++) {
    let s = core.buyStock(core.createInitialState(seed), { symbol: sym.id, qty: 5 });
    s.turn = dl.minMonth;
    for (let i = 0; i < 40 && !found; i++) {
      s = core.advanceMonth(s); s = noPending(s);
      if (s.events.delisting) {
        found = true;
        const r = s.stocks.prices[sym.id] / s.stocks.prevPrices[sym.id];
        ok(r <= (1 + sym.monthlyVolatility + Math.abs(sym.drift)) * (1 - dl.warningDrop) + 0.001, `drop ratio ${r}`);
        ok(core.sellStock(s, { symbol: sym.id, qty: 5 }).stocks.holdings[sym.id] === undefined, 'sellable');
        s = core.advanceMonth(s);
        ok(core.isDelisted(s, sym.id)); eq(s.stocks.prices[sym.id], 0); ok(!s.stocks.holdings[sym.id]);
      }
    }
  }
  ok(found, 'delisting never fired');
});

console.log('대출');
test('노점 개업 후 해금, 월 이자 × 화술 할인, 상환', () => {
  const L = data.config.loan;
  let s = core.createInitialState(1);
  eq(core.loanAvailable(s), 0);
  s = richStall(1);
  s = core.borrow(s, { amount: L.limit * 2 });
  eq(s.loan.principal, L.limit);
  approx(core.effectiveLoanRate(s), L.monthlyInterestRate * (1 - 0.4 * s.stats.speech / 100), 1e-9);
  const s1 = core.advanceMonth(s);
  ok(s1.summary.expense.some((e) => e.label === '대출 이자' && e.amount === Math.round(L.limit * core.effectiveLoanRate(s))));
  const s2 = core.repay(s1, { amount: 1000000 });
  eq(s2.loan.principal, L.limit - 1000000);
});

console.log('사업');
test('개업: 자금 차감, 본업이 가게 운영으로, 분식집은 노점 필요', () => {
  let s = core.createInitialState(1);
  eq(core.canOpen(s, 'snackbar').reason, 'locked');
  eq(core.canOpen(s, 'stall').reason, 'money');
  s = richStall(1);
  eq(s.money, 2000000); eq(s.activity.main, 'operate');
  eq(core.operationMode(s), 'owner');
});
test('운영 형태: 주인 알바 가면 노점 휴무(고정비·평판 -2), 분식집 위임은 조건부', () => {
  let s = core.setActivity(richStall(1), { slot: 'main', activityId: 'cafe' });
  eq(core.operationMode(s), 'closed');
  const rep = s.business.reputation;
  s = core.advanceMonth(s);
  eq(s.business.lastMonth.revenue, 0);
  eq(s.business.lastMonth.fixed, core.fixedCostOf(s));
  eq(s.business.reputation, rep + data.businesses.ownerAbsentReputationDelta);
  let t = richSnack(1);
  eq(core.canDelegate(t).ok, false);
  t = core.hireStaff(t);
  eq(core.operationMode(t), 'ownerStaff');
  eq(core.canDelegate(t).ok, false, 'management too low');
  t.stats.management = 30;
  ok(core.canDelegate(t).ok);
  t = core.setDelegate(t, { delegate: true });
  t = core.setActivity(t, { slot: 'main', activityId: 'cafe' });
  eq(core.operationMode(t), 'delegated');
  const t1 = core.advanceMonth(t);
  ok(t1.business.lastMonth.revenue > 0 && t1.business.lastMonth.mode === 'delegated');
  ok(t1.summary.income.some((i) => i.label === '카페 알바'), 'alba income while delegated');
});
test('매출 공식: 기술 배율·고정비 경영 할인·컨디션 30 이하 ×0.8', () => {
  let s = richStall(1);
  s.stats.management = 50;
  eq(core.fixedCostOf(s), Math.round(act('operate') ? data.businesses.types[0].fixedCost * (1 - 0.15 * 0.5) : 0));
  s.condition = 20;
  const s1 = core.advanceMonth(s);
  ok(s1.summary.notices.some((n) => n.text.includes('×0.8')));
  const lw = s1.business.lastMonth;
  eq(lw.net, lw.revenue - lw.materials - lw.labor - lw.fixed - lw.promo - lw.interest);
});
test('목표: 분식집 3개월 연속 흑자 → 리포트(3개월, 인건비 행)', () => {
  let s = core.hireStaff(richSnack(1));
  s.business.reputation = 80;
  s = run(s, 3, noPending);
  ok(s.goal.achieved);
  const r = s.goal.pendingReport;
  eq(r.monthly.length, 3); ok(r.hasLabor);
  eq(r.totals.net, r.monthly.reduce((a, m) => a + m.net, 0));
  eq(core.dismissReport(s).goal.pendingReport, null);
});
test('노점 흑자는 목표 아님', () => {
  let s = richStall(1); s.business.reputation = 100;
  s = run(s, 4, noPending);
  ok(!s.goal.achieved);
});

console.log('저장');
test('serialize/deserialize 왕복, 구버전은 null', () => {
  const s = run(core.createInitialState(11), 6, noPending);
  eq(JSON.stringify(core.deserialize(core.serialize(s))), JSON.stringify(s));
  eq(core.deserialize(JSON.stringify({ version: 1, week: 3 })), null);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
