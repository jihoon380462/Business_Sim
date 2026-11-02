// 아버지의 공장 — 시뮬레이션 (DOM 없음). 상태는 순수 데이터, tick 이 제자리에서 갱신한다.
import * as D from './data.js';
import { rand, range, int, chance, pick, weighted } from './rng.js';

export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];
export const opp = (d) => (d + 2) % 4;

// ============================================================ 상태
export function createGame(seed = Date.now()) {
  const lv = D.FLOOR.levels[1];
  const s = {
    version: 1,
    seed: seed | 0,
    monthIndex: 0, day: 1, clock: D.TIME.workStart, phase: 'work', nightLeft: 0,
    overtime: false,
    cash: D.FINANCE.startCash,
    loan: D.FINANCE.startLoan,
    receivables: [],            // { amount, client, month }
    floorLevel: 1,
    floor: { cols: lv.cols, rows: lv.rows, tiles: Array(lv.cols * lv.rows).fill(null) },
    nextId: 1,
    workers: [], candidates: [],
    inventory: {},
    orders: [], offers: [],
    rep: { 0: D.TIERS[0].startRep, 1: D.TIERS[1].startRep, 2: D.TIERS[2].startRep, 3: D.TIERS[3].startRep },
    certs: {}, research: {},
    month: newMonthStats(),
    history: [],
    news: null,                 // 이번 달 소식 효과
    achievements: {},
    flags: {},
    popups: [],                 // 화면을 멈추고 띄울 카드
    toasts: [],                 // 멈추지 않는 알림
    fx: [],                     // 연출 이벤트 (저장 안 함)
    log: [],
  };
  for (const w of D.START_WORKERS) s.workers.push({ id: s.nextId++, ...w, machine: null, advisor: false });
  // 아버지가 깔아 둔 브라켓 라인
  const y = 2;
  place(s, 0, y, { k: 'input', dir: 0, item: 'sheet', t: 0, on: true });
  place(s, 1, y, belt(0));
  place(s, 2, y, newMachine(s, 'press_old', 0, 'panel', 58));
  place(s, 3, y, belt(0));
  place(s, 4, y, belt(0));
  place(s, 5, y, newMachine(s, 'weld_old', 0, 'bracket', 63));
  place(s, 6, y, belt(0));
  place(s, 7, y, { k: 'output' });
  assignWorkers(s);
  refreshCandidates(s);
  s.flags.unlocked = {};
  for (const type of Object.keys(D.UNLOCKS.types)) if (typeUnlocked(s, type)) s.flags.unlocked[type] = true;
  startMonth(s, true);
  s.quest = 0;
  // 첫날부터 고를 주문 두 개
  for (let i = 0; i < 2; i++) { const o = makeOffer(s, 0, 'bracket', 0.6 + i * 0.3); o.expires = absDay(s) + 3; s.offers.push(o); }
  return s;
}

function newMonthStats() {
  return { revenue: 0, raw: 0, penalty: 0, crafts: 0, defects: 0, shippedLots: 0, otPay: 0, repairs: 0, built: 0 };
}

function belt(dir) { return { k: 'belt', dir, items: [] }; }

function newMachine(s, model, dir, recipe = null, cond = 100) {
  return { k: 'machine', id: s.nextId++, model, dir, recipe, inBuf: {}, outBuf: [], prog: 0, crafting: false, cond, broken: false, brokenSec: 0, repairLeft: 0, serviceLeft: 0, worker: null, status: 'idle', crafts: 0 };
}

export const idx = (s, x, y) => y * s.floor.cols + x;
export const inside = (s, x, y) => x >= 0 && y >= 0 && x < s.floor.cols && y < s.floor.rows;
export const tile = (s, x, y) => (inside(s, x, y) ? s.floor.tiles[idx(s, x, y)] : null);
function place(s, x, y, t) { s.floor.tiles[idx(s, x, y)] = t; }

// ============================================================ 날짜
export const absDay = (s) => s.monthIndex * D.TIME.daysPerMonth + s.day;
export const yearOf = (s) => Math.floor(s.monthIndex / 12) + 1;
export const monthOf = (s) => (s.monthIndex % 12) + 1;
export function dateLabel(s) { return `${yearOf(s)}년차 ${monthOf(s)}월 ${s.day}일`; }
export function clockLabel(s) {
  const h = Math.floor(s.clock); const m = Math.floor((s.clock - h) * 60 / 10) * 10;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export const endHour = (s) => (s.overtime ? D.TIME.overtimeEnd : D.TIME.workEnd);

// ============================================================ 계산 도우미
export function machineDef(m) { return D.MACHINES[m.model]; }
export function workerOf(s, m) { return m.worker ? s.workers.find((w) => w.id === m.worker) : null; }
export function machineRate(s, m) {
  const def = machineDef(m);
  const w = workerOf(s, m);
  const wf = def.auto ? 1 : w ? D.WORKERS.skillFactor.base + D.WORKERS.skillFactor.per * w.skill : 0;
  const cf = m.cond >= D.MACHINE_RULES.condSlowBelow ? 1 : 0.6 + 0.4 * (m.cond / D.MACHINE_RULES.condSlowBelow);
  return def.speed * wf * cf;
}
/** 분당 처리량 (상자/분, 1배속 실제 1분 기준 = 근무일 하루). 재료가 끊김 없이 들어온다고 가정 */
export function machinePerMin(s, m) {
  if (!m.recipe) return 0;
  const r = D.RECIPES[m.recipe];
  const rate = machineRate(s, m);
  if (!rate) return 0;
  return (60 * rate) / r.time;
}
/** 레시피를 기본 속도(×1.0)로 돌릴 때 분당 처리량 */
export const recipePerMin = (rid, speed = 1) => (60 * speed) / D.RECIPES[rid].time;
export const inputPerMin = () => 60 / D.LOGISTICS.inputInterval;
export const beltPerMin = () => (60 * D.LOGISTICS.beltSpeed) / D.LOGISTICS.beltSpacing;

// ---------- 해금 ----------
function condMet(s, c) {
  if (!c) return true;
  if (c.rep && s.rep[c.rep[0]] < c.rep[1]) return false;
  if (c.tier != null && !tierUnlocked(s, c.tier)) return false;
  if (c.cert && !s.certs[c.cert]) return false;
  return true;
}
export function typeUnlocked(s, type) { return condMet(s, D.UNLOCKS.types[type]); }
export function modelUnlocked(s, model) { return typeUnlocked(s, D.MACHINES[model].type) && condMet(s, D.UNLOCKS.models[model]); }
export function splitUnlocked(s) { return condMet(s, D.UNLOCKS.split); }
/** 새로 풀린 설비를 알리고 기록 */
export function checkUnlocks(s) {
  s.flags.unlocked = s.flags.unlocked || {};
  const fresh = [];
  for (const type of Object.keys(D.UNLOCKS.types)) {
    if (!s.flags.unlocked[type] && typeUnlocked(s, type)) { s.flags.unlocked[type] = true; if (D.UNLOCKS.types[type]) fresh.push(D.MACHINE_TYPES[type].name); }
  }
  for (const model of Object.keys(D.UNLOCKS.models)) {
    if (!s.flags.unlocked[model] && modelUnlocked(s, model)) { s.flags.unlocked[model] = true; fresh.push(D.MACHINES[model].name); }
  }
  if (!s.flags.unlocked.split && splitUnlocked(s)) { s.flags.unlocked.split = true; fresh.push('분배기'); }
  for (const n of fresh) toast(s, '🔓', `새 설비 해금: ${n}`);
  if (fresh.length) log(s, '🔓', `새 설비 해금: ${fresh.join(', ')}`);
  return fresh;
}
/** 다음에 풀릴 설비 안내 */
export function nextUnlocks(s) {
  const out = [];
  for (const [type, c] of Object.entries(D.UNLOCKS.types)) if (c && !typeUnlocked(s, type)) out.push({ name: D.MACHINE_TYPES[type].name, icon: D.MACHINE_TYPES[type].icon, hint: c.hint });
  if (!splitUnlocked(s)) out.push({ name: '분배기', icon: '🔀', hint: D.UNLOCKS.split.hint });
  return out;
}
export function defectRate(s, m) {
  if (!m.recipe) return 0;
  const r = D.RECIPES[m.recipe];
  const w = workerOf(s, m);
  const sk = machineDef(m).auto ? 0.8 : w ? D.WORKERS.defectSkill.base - D.WORKERS.defectSkill.per * w.skill : 1.6;
  return r.defect * sk * (1 + (100 - m.cond) / 80);
}
export function recipeUnlocked(s, rid) {
  const r = D.RECIPES[rid];
  return !r.ev || !!s.research.ev?.done;
}
export function recipesFor(type) { return Object.entries(D.RECIPES).filter(([, r]) => r.machine === type).map(([id]) => id); }

/** 열린 주문 중 이 부품의 미출하 로트 */
export function demandLots(s, item) { return s.orders.filter((o) => o.item === item).reduce((a, o) => a + o.lots, 0); }
function outputAccepts(s, item) {
  if (!D.ITEMS[item].final) return false;
  return (s.inventory[item] || 0) < demandLots(s, item) + D.LOGISTICS.outputBufferLots;
}

export function machinesList(s) { return s.floor.tiles.filter((t) => t && t.k === 'machine'); }
export function machineValue(s) { return machinesList(s).reduce((a, m) => a + machineDef(m).price * (0.3 + 0.7 * m.cond / 100), 0); }
export function loanLimit(s) { return D.FINANCE.baseLimit + machineValue(s) * D.FINANCE.assetLimitRate; }
export function monthlyWages(s) { return s.workers.reduce((a, w) => a + (w.advisor ? Math.round(w.wage * D.STORY.advisorWageRate) : w.wage), 0); }
export function monthlyOverhead(s) { return D.FLOOR.overheadBase + D.FLOOR.overheadPerTile * s.floor.cols * s.floor.rows; }
export function netWorth(s) {
  const rec = s.receivables.reduce((a, r) => a + r.amount, 0);
  return s.cash + rec + machineValue(s) - s.loan;
}
export function tierUnlocked(s, t) {
  const need = D.TIERS[t].need;
  if (!need) return true;
  if (need.cert && !s.certs[need.cert]) return false;
  if (need.rep && s.rep[need.rep[0]] < need.rep[1]) return false;
  return true;
}

/** 이 부품을 만들려면 필요한 기계 종류 / 레시피 체인 */
export function chainFor(item) {
  const out = [];
  const walk = (it, mult) => {
    const r = D.RECIPES[it];
    if (!r) return;
    out.push({ recipe: it, machine: r.machine, mult });
    for (const [inp, n] of Object.entries(r.in)) walk(inp, mult * n);
  };
  walk(item, 1);
  return out;
}
export function canProduce(s, item) {
  const types = new Set(machinesList(s).map((m) => machineDef(m).type));
  return chainFor(item).every((c) => types.has(c.machine) && recipeUnlocked(s, c.recipe));
}
function refLotsPerDay(item) {
  const worst = Math.max(...chainFor(item).map((c) => D.RECIPES[c.recipe].time * c.mult));
  return (D.OFFERS.refLotsPerDay * 2.4) / worst;
}
/** 체인의 모든 설비가 해금됐는가 */
export function itemUnlocked(s, item) {
  return chainFor(item).every((c) => typeUnlocked(s, c.machine) && recipeUnlocked(s, c.recipe));
}

// ============================================================ 직원
export function assignWorkers(s) {
  for (const w of s.workers) w.machine = null;
  const ms = machinesList(s).filter((m) => !machineDef(m).auto);
  for (const m of ms) m.worker = null;
  // 느린 공정(레시피 시간이 긴 기계)에 숙련공 우선
  ms.sort((a, b) => (b.recipe ? D.RECIPES[b.recipe].time / machineDef(b).speed : 0) - (a.recipe ? D.RECIPES[a.recipe].time / machineDef(a).speed : 0) || a.id - b.id);
  const pool = s.workers.filter((w) => !w.advisor).sort((a, b) => b.skill - a.skill);
  for (const m of ms) {
    if (!m.recipe) continue;
    const w = pool.shift();
    if (!w) break;
    m.worker = w.id; w.machine = m.id;
  }
}

function makeCandidate(s) {
  const W = D.WORKERS;
  const skill = Math.round(range(s, 1, 3.2) * 10) / 10;
  const talent = Math.round(range(s, 0.6, 1.5) * 10) / 10;
  const wage = Math.round((W.wageBase + W.wagePerSkill * skill) / 100000) * 100000;
  return { id: s.nextId++, name: pick(s, W.surnames) + pick(s, W.given), age: int(s, 22, 56), skill, talent, wage, morale: 70, machine: null, advisor: false };
}
export function refreshCandidates(s) {
  s.candidates = Array.from({ length: D.WORKERS.candidates }, () => makeCandidate(s));
}

// ============================================================ 플레이어 행동 (모두 성공 여부 반환)
const fail = (msg) => ({ ok: false, msg });
const okr = (msg) => ({ ok: true, msg });

function spend(s, amount, what) {
  if (s.cash < amount) return false;
  s.cash -= amount;
  if (what) s.month.built += amount;
  return true;
}

export function buildCost(s, kind, model) {
  const L = D.LOGISTICS;
  if (kind === 'belt') return L.beltCost;
  if (kind === 'split') return L.splitterCost;
  if (kind === 'input') return L.inputCost;
  if (kind === 'output') return L.outputCost;
  if (kind === 'machine') {
    const def = D.MACHINES[model];
    const disc = def.auto && s.news?.robotDiscount ? 1 - s.news.robotDiscount : 1;
    return Math.round(def.price * disc);
  }
  return 0;
}

export function build(s, x, y, kind, { dir = 0, model = null } = {}) {
  if (!inside(s, x, y)) return fail('공장 밖');
  if (tile(s, x, y)) return fail('이미 무언가 있음');
  if (kind === 'machine' && !modelUnlocked(s, model)) return fail('아직 해금 안 됨');
  if (kind === 'split' && !splitUnlocked(s)) return fail('아직 해금 안 됨');
  const cost = buildCost(s, kind, model);
  if (!spend(s, cost, true)) return fail('자금 부족');
  let t;
  if (kind === 'belt') t = belt(dir);
  else if (kind === 'split') t = { k: 'split', dir, hold: null, rr: 0 };
  else if (kind === 'input') t = { k: 'input', dir, item: 'sheet', t: 0, on: true };
  else if (kind === 'output') t = { k: 'output' };
  else if (kind === 'machine') {
    const type = D.MACHINES[model].type;
    const rs = recipesFor(type).filter((r) => recipeUnlocked(s, r));
    t = newMachine(s, model, dir, rs[0] || null, 100);
    if (D.MACHINES[model].auto) unlock(s, 'robot');
  } else return fail('알 수 없음');
  place(s, x, y, t);
  if (kind === 'machine') assignWorkers(s);
  return okr();
}

export function setBeltDir(s, x, y, dir) {
  const t = tile(s, x, y);
  if (!t || t.k !== 'belt') return fail('');
  t.dir = dir;
  return okr();
}

export function rotate(s, x, y) {
  const t = tile(s, x, y);
  if (!t || t.k === 'output') return fail('');
  t.dir = (t.dir + 1) % 4;
  return okr();
}

export function removeAt(s, x, y) {
  const t = tile(s, x, y);
  if (!t) return fail('');
  let refund;
  if (t.k === 'machine') refund = Math.round(machineDef(t).price * D.MACHINE_RULES.sellRate * Math.max(0.3, t.cond / 100));
  else refund = Math.round(buildCost(s, t.k === 'split' ? 'split' : t.k) * D.LOGISTICS.removeRefund);
  s.cash += refund;
  place(s, x, y, null);
  if (t.k === 'machine') assignWorkers(s);
  return okr(refund);
}

export function setRecipe(s, x, y, recipe) {
  const m = tile(s, x, y);
  if (!m || m.k !== 'machine') return fail('');
  if (recipe && (D.RECIPES[recipe].machine !== machineDef(m).type || !recipeUnlocked(s, recipe))) return fail('불가');
  m.recipe = recipe; m.inBuf = {}; m.crafting = false; m.prog = 0;
  assignWorkers(s);
  return okr();
}

export function setInputItem(s, x, y, item) {
  const t = tile(s, x, y);
  if (!t || t.k !== 'input' || !D.ITEMS[item]?.raw) return fail('');
  t.item = item;
  return okr();
}
export function toggleInput(s, x, y) {
  const t = tile(s, x, y);
  if (!t || t.k !== 'input') return fail('');
  t.on = !t.on;
  return okr();
}

export function repair(s, x, y) {
  const m = tile(s, x, y);
  if (!m || m.k !== 'machine' || !m.broken || m.repairLeft > 0) return fail('');
  const cost = Math.round(machineDef(m).price * D.MACHINE_RULES.repairCostRate);
  if (!spend(s, cost)) return fail('자금 부족');
  s.month.repairs += cost;
  m.repairLeft = D.MACHINE_RULES.repairSec;
  return okr(cost);
}

export function service(s, x, y) {
  const m = tile(s, x, y);
  if (!m || m.k !== 'machine' || m.serviceLeft > 0 || m.broken) return fail('');
  const cost = Math.round(machineDef(m).price * D.MACHINE_RULES.serviceCostRate);
  if (!spend(s, cost)) return fail('자금 부족');
  s.month.repairs += cost;
  m.serviceLeft = D.MACHINE_RULES.serviceSec;
  return okr(cost);
}

export function upgradeMachine(s, x, y, model) {
  const m = tile(s, x, y);
  if (!m || m.k !== 'machine') return fail('');
  if (D.MACHINES[model].type !== machineDef(m).type || model === m.model) return fail('');
  if (!modelUnlocked(s, model)) return fail('아직 해금 안 됨');
  const refund = Math.round(machineDef(m).price * D.MACHINE_RULES.sellRate * Math.max(0.3, m.cond / 100));
  const cost = buildCost(s, 'machine', model) - refund;
  if (!spend(s, Math.max(0, cost), true)) return fail('자금 부족');
  m.model = model; m.cond = 100; m.broken = false; m.repairLeft = 0; m.serviceLeft = 0;
  if (D.MACHINES[model].auto) unlock(s, 'robot');
  assignWorkers(s);
  return okr();
}

export function acceptOffer(s, offerId) {
  const i = s.offers.findIndex((o) => o.id === offerId);
  if (i < 0) return fail('');
  s.flags.acceptedAny = true;
  const o = s.offers.splice(i, 1)[0];
  s.orders.push({ ...o, dueDay: absDay(s) + o.dueDays, acceptedDay: absDay(s) });
  return okr();
}
export function declineOffer(s, offerId) {
  s.offers = s.offers.filter((o) => o.id !== offerId);
  return okr();
}

export function hire(s, candId) {
  const c = s.candidates.find((w) => w.id === candId);
  if (!c) return fail('');
  if (!spend(s, D.WORKERS.hireFee)) return fail('자금 부족');
  s.candidates = s.candidates.filter((w) => w.id !== candId);
  s.workers.push(c);
  assignWorkers(s);
  if (s.workers.length >= 10) unlock(s, 'staff10');
  return okr();
}
export function fire(s, workerId) {
  const w = s.workers.find((x) => x.id === workerId);
  if (!w) return fail('');
  const sev = Math.round(w.wage * 1);
  s.cash -= sev;
  s.workers = s.workers.filter((x) => x.id !== workerId);
  for (const o of s.workers) o.morale = Math.max(0, o.morale - 4);
  assignWorkers(s);
  return okr(sev);
}
export function payBonus(s) {
  const cost = Math.round(monthlyWages(s) * D.WORKERS.bonusRate);
  if (!spend(s, cost)) return fail('자금 부족');
  for (const w of s.workers) w.morale = Math.min(100, w.morale + D.WORKERS.bonusMorale);
  return okr(cost);
}
export function setOvertime(s, on) { s.overtime = !!on; return okr(); }

export function borrow(s, amount) {
  const room = loanLimit(s) - s.loan;
  const a = Math.min(amount, room);
  if (a <= 0) return fail('한도 초과');
  s.loan += a; s.cash += a;
  return okr(a);
}
export function repay(s, amount) {
  const a = Math.min(amount, s.loan, Math.max(0, s.cash));
  if (a <= 0) return fail('');
  s.loan -= a; s.cash -= a;
  if (s.loan === 0) unlock(s, 'debt_free');
  checkEnding(s);
  return okr(a);
}

export function lastMonthDefect(s) {
  const h = s.history[s.history.length - 1];
  if (!h || !h.crafts) return null;
  return h.defects / h.crafts;
}
export function certStatus(s, id) {
  const c = D.CERTS[id];
  if (s.certs[id]) return { ok: false, reason: '보유 중', done: true };
  if (c.need && !s.certs[c.need]) return { ok: false, reason: `${D.CERTS[c.need].name} 먼저` };
  const d = lastMonthDefect(s);
  if (d == null) return { ok: false, reason: '지난달 생산 실적 필요' };
  if (d > c.maxDefect) return { ok: false, reason: `지난달 불량률 ${(d * 100).toFixed(1)}% → ${(c.maxDefect * 100).toFixed(1)}% 이하 필요` };
  if (s.cash < c.cost) return { ok: false, reason: '자금 부족' };
  return { ok: true, reason: null };
}
export function buyCert(s, id) {
  const st = certStatus(s, id);
  if (!st.ok) return fail(st.reason);
  s.cash -= D.CERTS[id].cost;
  s.certs[id] = true;
  unlock(s, id);
  checkUnlocks(s);
  return okr();
}
export function startResearch(s, id) {
  const r = D.RESEARCH[id];
  if (s.research[id]) return fail('진행 중');
  if (r.need && !s.certs[r.need]) return fail(`${D.CERTS[r.need].name} 필요`);
  if (!spend(s, r.cost)) return fail('자금 부족');
  s.research[id] = { left: r.days, done: false };
  return okr();
}
export function expandFloor(s) {
  const next = D.FLOOR.levels[s.floorLevel + 1];
  if (!next) return fail('최대');
  if (!spend(s, next.cost, true)) return fail('자금 부족');
  const old = s.floor;
  const tiles = Array(next.cols * next.rows).fill(null);
  for (let y = 0; y < old.rows; y++) for (let x = 0; x < old.cols; x++) tiles[y * next.cols + x] = old.tiles[y * old.cols + x];
  s.floor = { cols: next.cols, rows: next.rows, tiles };
  s.floorLevel += 1;
  return okr();
}

export function resolvePopup(s, choice) {
  const p = s.popups.shift();
  if (!p) return;
  if (p.type === 'story' && p.id === 'veteran') {
    const v = s.workers.find((w) => w.veteran);
    if (!v) return;
    if (choice === 'retire') {
      s.cash -= D.STORY.severance;
      s.workers = s.workers.filter((w) => w !== v);
      for (const w of s.workers) w.morale = Math.min(100, w.morale + 10);
      log(s, '🎖️', '김반장 은퇴. 다들 눈시울을 붉혔다.');
    } else {
      v.advisor = true;
      s.flags.advisor = true;
      log(s, '🧓', '김반장이 고문으로 남았다. 후배들 실력이 빨리 는다.');
    }
    assignWorkers(s);
  } else if (p.type === 'news' && p.news.kind === 'poach' && p.target) {
    const w = s.workers.find((x) => x.id === p.target);
    if (!w) return;
    if (choice === 'keep') { w.wage = Math.round(w.wage * 1.2 / 100000) * 100000; w.morale = Math.min(100, w.morale + 15); }
    else { s.workers = s.workers.filter((x) => x !== w); assignWorkers(s); }
  }
}

// ============================================================ 시간 진행
export function tick(s, dtReal, speed = 1) {
  if (s.popups.length || s.flags.gameOver) return;
  let left = dtReal * speed;
  while (left > 1e-6) {
    const dt = Math.min(D.TIME.maxStep, left);
    left -= dt;
    step(s, dt);
    if (s.popups.length) break;
  }
}

function step(s, dt) {
  if (s.phase === 'night') {
    s.nightLeft -= dt;
    if (s.nightLeft <= 0) { s.phase = 'work'; s.clock = D.TIME.workStart; }
    return;
  }
  s.clock += dt / D.TIME.realSecPerHour;
  simulateFloor(s, dt);
  if (s.clock >= endHour(s)) endDay(s);
}

// ------------------------------------------------------------ 바닥 물류
function accepts(s, x, y, it, travelDir, dryRun = false) {
  const t = tile(s, x, y);
  if (!t) return false;
  const L = D.LOGISTICS;
  if (t.k === 'belt') {
    if (t.dir === opp(travelDir)) return false;
    const last = t.items[t.items.length - 1];
    if (last && last.p < L.beltSpacing) return false;
    if (!dryRun) t.items.push({ it, p: 0 });
    return true;
  }
  if (t.k === 'split') {
    if (t.hold) return false;
    if (!dryRun) t.hold = { it, p: 0, from: travelDir };
    return true;
  }
  if (t.k === 'machine') {
    if (!t.recipe) return false;
    const need = D.RECIPES[t.recipe].in[it];
    if (!need) return false;
    if ((t.inBuf[it] || 0) >= need * D.MACHINE_RULES.inBufferMult) return false;
    if (!dryRun) t.inBuf[it] = (t.inBuf[it] || 0) + 1;
    return true;
  }
  if (t.k === 'output') {
    if (!outputAccepts(s, it)) return false;
    if (!dryRun) {
      s.inventory[it] = (s.inventory[it] || 0) + 1;
      s.fx.push({ type: 'deliver', x, y, it });
    }
    return true;
  }
  return false;
}

function simulateFloor(s, dt) {
  const { cols, rows, tiles } = s.floor;
  const L = D.LOGISTICS;
  const v = L.beltSpeed * dt;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const t = tiles[y * cols + x];
      if (!t) continue;
      if (t.k === 'belt') {
        for (let i = 0; i < t.items.length; i++) {
          const item = t.items[i];
          const limit = i === 0 ? 1 : t.items[i - 1].p - L.beltSpacing;
          item.p = Math.min(item.p + v, limit);
          if (i === 0 && item.p >= 1) {
            if (accepts(s, x + DX[t.dir], y + DY[t.dir], item.it, t.dir)) { t.items.shift(); i--; }
            else item.p = 1;
          }
        }
        t.jam = t.items.length > 0 && t.items[0].p >= 1;
      } else if (t.k === 'split') {
        const h = t.hold;
        if (h) {
          h.p = Math.min(1, h.p + v * 1.5);
          if (h.p >= 1) {
            const outs = [t.dir, (t.dir + 1) % 4, (t.dir + 3) % 4];
            for (let k = 0; k < 3; k++) {
              const d = outs[(t.rr + k) % 3];
              if (d === opp(h.from)) continue;
              if (accepts(s, x + DX[d], y + DY[d], h.it, d)) { t.hold = null; t.rr = (t.rr + k + 1) % 3; break; }
            }
          }
        }
      } else if (t.k === 'input') {
        if (!t.on || !t.item) continue;
        t.t += dt;
        if (t.t >= L.inputInterval) {
          const cost = Math.round(D.ITEMS[t.item].cost * (s.news?.rawMult || 1));
          if (s.cash >= cost && accepts(s, x + DX[t.dir], y + DY[t.dir], t.item, t.dir)) {
            s.cash -= cost; s.month.raw += cost; t.t = 0; t.starved = false;
          } else { t.t = L.inputInterval; t.starved = s.cash < cost; }
        }
      } else if (t.k === 'machine') {
        simulateMachine(s, t, x, y, dt);
      }
    }
  }
}

function simulateMachine(s, m, x, y, dt) {
  const R = D.MACHINE_RULES;
  const def = machineDef(m);
  if (m.serviceLeft > 0) {
    m.serviceLeft -= dt; m.status = 'service';
    if (m.serviceLeft <= 0) { m.serviceLeft = 0; m.cond = 100; }
    return;
  }
  if (m.broken) {
    m.status = 'broken';
    if (m.repairLeft > 0) {
      m.repairLeft -= dt;
      if (m.repairLeft <= 0) { m.repairLeft = 0; m.broken = false; m.brokenSec = 0; m.cond = Math.max(m.cond, R.repairCond); }
    } else {
      m.brokenSec += dt;
      if (m.brokenSec >= R.autoRepairAfterSec) {
        const cost = Math.round(def.price * R.repairCostRate * R.autoRepairCostMult);
        s.cash -= cost; s.month.repairs += cost;
        m.repairLeft = R.repairSec;
        toast(s, '🛠️', `${def.name} 외부 수리 호출 (-${Math.round(cost / 10000)}만)`);
      }
    }
    return;
  }
  // 완성품 내보내기
  if (m.outBuf.length) {
    if (accepts(s, x + DX[m.dir], y + DY[m.dir], m.outBuf[0], m.dir)) m.outBuf.shift();
  }
  if (!m.recipe) { m.status = 'no_recipe'; return; }
  if (!def.auto && !m.worker) { m.status = 'no_worker'; return; }
  const r = D.RECIPES[m.recipe];
  if (!m.crafting) {
    if (m.outBuf.length >= R.outBuffer) { m.status = 'blocked'; return; }
    const ok = Object.entries(r.in).every(([it, n]) => (m.inBuf[it] || 0) >= n);
    if (!ok) { m.status = 'starved'; return; }
    for (const [it, n] of Object.entries(r.in)) m.inBuf[it] -= n;
    m.crafting = true; m.prog = 0;
  }
  m.status = 'work';
  m.prog += (dt * machineRate(s, m)) / r.time;
  if (m.prog >= 1) {
    m.crafting = false; m.prog = 0; m.crafts += 1;
    s.month.crafts += 1;
    if (rand(s) < defectRate(s, m)) { s.month.defects += 1; s.fx.push({ type: 'defect', x, y }); }
    else m.outBuf.push(r.out);
    m.cond = Math.max(0, m.cond - R.wearPerCraft * def.wear);
    if (m.cond < R.breakdownBelow && rand(s) < (R.breakdownBelow - m.cond) * R.breakdownPerCraft) {
      m.broken = true; m.brokenSec = 0;
      s.fx.push({ type: 'break', x, y });
      toast(s, '💥', `${def.name} 고장! 눌러서 수리`);
    }
    const w = workerOf(s, m);
    if (w && w.skill < D.WORKERS.maxSkill) {
      const boost = s.flags.advisor && !w.veteran ? D.STORY.advisorGrowthBoost : 1;
      w.skill = Math.min(D.WORKERS.maxSkill, w.skill + D.WORKERS.growthPerCraft * w.talent * boost);
    }
  }
}

// ------------------------------------------------------------ 하루 끝
function endDay(s) {
  const today = absDay(s);
  // OT 수당·사기
  const otHours = s.overtime ? D.TIME.overtimeEnd - D.TIME.workEnd : 0;
  for (const w of s.workers) {
    if (w.advisor) continue;
    if (otHours) {
      s.month.otPay += Math.round((w.wage / D.WORKERS.hoursPerMonth) * D.WORKERS.otMult * otHours);
      w.morale = Math.max(0, w.morale + D.WORKERS.moraleOtPerDay);
    } else w.morale = Math.min(100, w.morale + D.WORKERS.moraleNormalPerDay);
  }
  // 사직
  for (const w of [...s.workers]) {
    if (!w.veteran && w.morale < D.WORKERS.quitBelow && chance(s, D.WORKERS.quitChancePerDay)) {
      s.workers = s.workers.filter((x) => x !== w);
      toast(s, '🚪', `${w.name} 퇴사 (사기 저하)`);
      log(s, '🚪', `${w.name}이(가) 그만뒀다.`);
      assignWorkers(s);
    }
  }
  shipOrders(s, today);
  // 주문판
  s.offers = s.offers.filter((o) => o.expires > today);
  generateOffers(s);
  // 연구
  for (const [id, r] of Object.entries(s.research)) {
    if (r.done) continue;
    r.left -= 1;
    if (r.left <= 0) { r.done = true; unlock(s, id); toast(s, '⚡', `${D.RESEARCH[id].name} 완료!`); }
  }
  if (s.day % 5 === 0) refreshCandidates(s);
  checkUnlocks(s);
  // 다음 날
  s.phase = 'night';
  s.nightLeft = D.TIME.nightRealSec;
  s.fx.push({ type: 'dayEnd' });
  if (s.day >= D.TIME.daysPerMonth) endMonth(s);
  else s.day += 1;
  s.clock = D.TIME.workStart;
}

function shipOrders(s, today) {
  const sorted = [...s.orders].sort((a, b) => a.dueDay - b.dueDay);
  for (const o of sorted) {
    const have = s.inventory[o.item] || 0;
    const late = Math.max(0, today - o.dueDay);
    if (have >= o.lots) {
      s.inventory[o.item] = have - o.lots;
      const value = o.lots * D.ITEMS[o.item].lot * o.unitPrice;
      const penalty = Math.min(value * 0.5, Math.round(value * D.TIERS[o.tier].penaltyPerDay * late));
      const net = value - penalty;
      s.month.revenue += value; s.month.penalty += penalty; s.month.shippedLots += o.lots;
      if (D.TIERS[o.tier].pay === 'cash') s.cash += net;
      else s.receivables.push({ amount: net, client: o.client, month: s.monthIndex + 1 });
      s.rep[o.tier] = clampRep(s.rep[o.tier] + (late ? D.OFFERS.repLate : D.OFFERS.repOnTime));
      s.orders = s.orders.filter((x) => x !== o);
      s.fx.push({ type: 'truck', item: o.item, value: net, late });
      log(s, '🚚', `${o.client} ${D.ITEMS[o.item].name} ${fmtQty(o)} 출하${late ? ` (지연 ${late}일, 위약금 ${Math.round(penalty / 10000)}만)` : ''}`, net);
      if (o.tier >= 1) unlock(s, 'tier1');
      if (o.tier >= 2) unlock(s, 'tier2');
      if (o.tier >= 3) unlock(s, 'tier3');
      s.flags.shippedItems = s.flags.shippedItems || {};
      s.flags.shippedItems[o.item] = true;
      s.flags.shippedCount = (s.flags.shippedCount || 0) + 1;
      if (Object.keys(s.flags.shippedItems).length >= 2) unlock(s, 'second_line');
      checkEnding(s);
    } else if (late > D.OFFERS.cancelAfterLateDays) {
      const fee = Math.round(o.lots * D.ITEMS[o.item].lot * o.unitPrice * D.OFFERS.cancelFeeRate);
      s.cash -= fee; s.month.penalty += fee;
      s.rep[o.tier] = clampRep(s.rep[o.tier] + D.OFFERS.repCancel);
      s.orders = s.orders.filter((x) => x !== o);
      toast(s, '❌', `${o.client} 계약 해지 (위약금 ${Math.round(fee / 10000)}만)`);
      log(s, '❌', `${o.client} ${D.ITEMS[o.item].name} 납기 초과로 계약 해지`, -fee);
    }
  }
}
export function fmtQty(o) { return `${(o.lots * D.ITEMS[o.item].lot).toLocaleString('ko-KR')}개`; }
const clampRep = (v) => Math.max(0, Math.min(100, v));

function itemDemandWeight(s, item) {
  const it = D.ITEMS[item];
  const y = yearOf(s);
  const T = D.TRANSITION;
  if (y < T.startYear) return it.ev ? 0.6 : 1;
  const k = y - T.startYear + 1;
  if (it.ice) return Math.max(0.15, 1 - T.iceDecline * k);
  if (it.ev) return 1 + T.evBoost * k;
  return 1;
}

function generateOffers(s) {
  const O = D.OFFERS;
  for (const t of [0, 1, 2, 3]) {
    if (s.offers.length >= O.boardMax) break;
    if (!tierUnlocked(s, t)) continue;
    const p = O.dailyChance[t] * (s.news?.offerMult || 1) * (0.5 + s.rep[t] / 100);
    if (!chance(s, p)) continue;
    const parts = O.parts[t].filter((it) => (!D.ITEMS[it].ev || s.research.ev?.done || yearOf(s) >= D.TRANSITION.startYear) && chainFor(it).every((c) => typeUnlocked(s, c.machine)));
    if (!parts.length) continue;
    const producible = parts.filter((it) => canProduce(s, it));
    const pool = producible.length && chance(s, O.producibleBias) ? producible : parts;
    const item = weighted(s, pool.map((it) => [it, itemDemandWeight(s, it)]));
    s.offers.push(makeOffer(s, t, item));
  }
}

function makeOffer(s, t, item, mult = 1) {
  const O = D.OFFERS;
  const days = range(s, O.daysOfWork[t][0], O.daysOfWork[t][1]);
  const rpd = refLotsPerDay(item);
  const lots = Math.max(2, Math.round(rpd * days * (0.7 + s.rep[t] / 170) * mult));
  const decline = D.ITEMS[item].ice ? itemDemandWeight(s, item) : 1;
  const unitPrice = Math.round(D.ITEMS[item].unitPrice * O.tierPriceMult[t] * (1 + range(s, -O.priceJitter, O.priceJitter)) * (decline < 1 ? 0.85 + 0.15 * decline : 1));
  const dueDays = Math.max(2, Math.ceil(days * range(s, O.slack[0], O.slack[1])));
  return {
    id: s.nextId++, client: pick(s, D.CLIENTS[t]), tier: t, item, lots, unitPrice, dueDays,
    expires: absDay(s) + int(s, O.expireDays[0], O.expireDays[1]), pay: D.TIERS[t].pay,
  };
}

// ------------------------------------------------------------ 월말 · 월초
function endMonth(s) {
  const m = s.month;
  const wages = monthlyWages(s);
  const overhead = monthlyOverhead(s);
  const interest = Math.round(s.loan * D.FINANCE.monthlyInterest);
  const collected = s.receivables.filter((r) => r.month <= s.monthIndex).reduce((a, r) => a + r.amount, 0);
  s.receivables = s.receivables.filter((r) => r.month > s.monthIndex);
  s.cash += collected;
  s.cash -= wages + m.otPay + overhead + interest;
  const net = m.revenue - m.penalty - m.raw - wages - m.otPay - overhead - interest - m.repairs;
  let emergency = 0;
  if (s.cash < 0) {
    const need = -s.cash;
    const room = loanLimit(s) - s.loan;
    if (room >= need) { emergency = Math.ceil(need / D.FINANCE.loanStep) * D.FINANCE.loanStep; s.loan += emergency; s.cash += emergency; }
  }
  const rec = {
    monthIndex: s.monthIndex, label: `${yearOf(s)}년차 ${monthOf(s)}월`,
    revenue: m.revenue, penalty: m.penalty, raw: m.raw, wages, otPay: m.otPay, overhead, interest, repairs: m.repairs, collected,
    net, cash: s.cash, loan: s.loan, crafts: m.crafts, defects: m.defects, shippedLots: m.shippedLots, emergency, built: m.built,
    receivable: s.receivables.reduce((a, r) => a + r.amount, 0),
  };
  s.history.push(rec);
  if (s.history.length > 60) s.history.shift();
  if (net > 0) unlock(s, 'first_profit');
  s.popups.push({ type: 'month', rec });
  if (s.cash < 0) {
    s.flags.gameOver = true;
    s.popups.push({ type: 'gameover' });
    return;
  }
  s.monthIndex += 1;
  s.day = 1;
  startMonth(s, false);
}

function startMonth(s, first) {
  s.month = newMonthStats();
  s.news = null;
  // 아버지 단골
  const R = D.REGULAR;
  s.orders.push({ id: s.nextId++, client: R.client, tier: R.tier, item: R.item, lots: R.lots, unitPrice: R.unitPrice, dueDays: R.dueDays, dueDay: absDay(s) + R.dueDays, pay: 'cash', regular: true });
  if (first) {
    s.popups.push({ type: 'intro' });
    return;
  }
  // 이야기
  if (s.monthIndex === D.STORY.veteranRetireMonth && s.workers.some((w) => w.veteran)) {
    s.popups.push({ type: 'story', id: 'veteran' });
  }
  if (yearOf(s) === D.TRANSITION.startYear && monthOf(s) === 1 && !s.flags.evNews) {
    s.flags.evNews = true;
    s.popups.push({ type: 'news', news: { icon: '⚡', title: '전기차 전환 가속', text: '정부가 내연기관 신차 판매 종료를 앞당겼다. 기어·디스크 주문은 줄고, 배터리 케이스·모터 하우징 주문이 늘어난다.' } });
  }
  if (chance(s, D.NEWS_CHANCE)) {
    const pool = D.NEWS.filter((n) => (n.minMonth || 0) <= s.monthIndex);
    const n = weighted(s, pool.map((x) => [x, x.weight]));
    applyNews(s, n);
  }
}

function applyNews(s, n) {
  const popup = { type: 'news', news: n };
  if (n.kind === 'poach') {
    const target = s.workers.filter((w) => !w.veteran && !w.advisor).sort((a, b) => b.skill - a.skill)[0];
    if (!target || target.skill < 2.5) return;
    popup.target = target.id;
    popup.text = `${target.name}(숙련 ${target.skill.toFixed(1)})에게 옆 공장이 연봉 20% 인상을 제안했다.`;
    popup.choices = [{ id: 'keep', label: '월급 20% 올려 붙잡는다' }, { id: 'let', label: '보내 준다' }];
  } else if (n.kind === 'bankrupt') {
    if (!s.receivables.length) return;
    const r = s.receivables.sort((a, b) => b.amount - a.amount)[0];
    const lost = Math.round(r.amount / 2);
    r.amount -= lost;
    popup.text = `${r.client}이(가) 부도났다. 받을 돈 ${Math.round(lost / 10000).toLocaleString('ko-KR')}만원을 떼였다.`;
  } else if (n.kind === 'safety') {
    const old = machinesList(s).filter((m) => m.cond < 40).length;
    if (old >= 2) { s.cash -= n.fine; popup.text = `상태가 나쁜 기계 ${old}대 적발. 과태료 ${n.fine / 10000}만원.`; }
    else popup.text = '점검 통과. 기계 관리가 잘 되어 있다는 평을 들었다.';
  } else {
    s.news = n;
  }
  s.popups.push(popup);
}

// ------------------------------------------------------------ 업적 · 엔딩 · 로그
export function unlock(s, id) {
  if (s.achievements[id]) return;
  s.achievements[id] = { monthIndex: s.monthIndex };
  const a = D.ACHIEVEMENTS[id];
  if (a) toast(s, a.icon, `업적: ${a.name}`);
}
function checkEnding(s) {
  if (s.flags.ended) return;
  if (s.achievements.tier3 && s.loan === 0) {
    s.flags.ended = true;
    s.popups.push({ type: 'ending' });
  }
}
export function toast(s, icon, text) {
  s.toasts.push({ icon, text, id: s.nextId++ });
  if (s.toasts.length > 6) s.toasts.shift();
}
export function log(s, icon, text, amount = null) {
  s.log.unshift({ icon, text, amount, date: dateLabel(s) });
  if (s.log.length > 80) s.log.length = 80;
}

// ============================================================ 저장
export function serialize(s) {
  const { fx, toasts, ...rest } = s;
  return JSON.stringify(rest);
}
export function deserialize(json) {
  try {
    const s = JSON.parse(json);
    if (!s || s.version !== 1) return null;
    s.fx = []; s.toasts = [];
    return s;
  } catch { return null; }
}

// ============================================================ 할 일 (퀘스트)
export function currentQuest(s) { return D.QUESTS[s.quest ?? D.QUESTS.length] || null; }
function questDone(s, id) {
  const ms = machinesList(s);
  switch (id) {
    case 'accept': return !!s.flags.acceptedAny;
    case 'split': return ms.filter((m) => m.recipe === 'bracket').length >= 2;
    case 'staff': return ms.every((m) => !m.recipe || machineDef(m).auto || m.worker) && s.workers.length >= 3;
    case 'ship': return (s.flags.shippedCount || 0) >= 1;
    case 'month': return s.history.length >= 1;
    case 'product': return Object.keys(s.flags.shippedItems || {}).length >= 2;
    case 'tier1': return tierUnlocked(s, 1);
    case 'iso': return !!s.certs.iso;
    default: return false;
  }
}
/** 진행 중인 할 일이 끝났는지 확인하고 다음으로 넘긴다 (여러 개가 한꺼번에 끝날 수도 있음) */
export function checkQuest(s) {
  if (s.quest == null) s.quest = 0;
  let done = null;
  while (s.quest < D.QUESTS.length && questDone(s, D.QUESTS[s.quest].id)) {
    const q = D.QUESTS[s.quest];
    if (q.reward) { s.cash += q.reward; log(s, '🎁', `할 일 보상: ${q.title}`, q.reward); }
    toast(s, '✅', `할 일 완료: ${q.title}${q.reward ? ` (+${Math.round(q.reward / 10000)}만)` : ''}`);
    s.quest += 1;
    done = q;
  }
  return done;
}
