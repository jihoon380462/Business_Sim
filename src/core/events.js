// 랜덤 이벤트 (월 판정). 통보형은 결산 요약 + 피드, 선택형은 state.events.pending 에 대기.
import { D, findStock } from './data.js';
import { clone, pushLog, addIncome, addExpense, addNotice } from './state.js';
import { chance, pick, randInt, randRange } from './rng.js';
import { isDelisted } from './stocks.js';
import { changeCondition, rumorDetailLevel } from './stats.js';

function onCooldown(state, ev) {
  const last = state.events.cooldowns[ev.id];
  return last != null && state.turn - last < ev.cooldown;
}

function eligible(state, ev) {
  if (onCooldown(state, ev)) return false;
  if (ev.requiresBusiness && !state.business) return false;
  if (ev.category === 'stock' && (state.events.rumor || state.events.pending)) return false;
  return true;
}

/** 매달 이벤트 판정 (월 최대 maxPerMonth 건) */
export function rollEvents(state) {
  const E = D.events;
  let fired = 0;

  const dl = E.delisting;
  if (!state.events.flags.delistWarned && !state.events.delisting && state.turn >= dl.minMonth) {
    const junk = D.stocks.symbols.filter((s) => s.type === dl.symbolType && !isDelisted(state, s.id));
    if (junk.length && chance(state, dl.monthlyChance)) {
      const sym = pick(state, junk);
      state.events.delisting = { symbol: sym.id, monthsLeft: dl.warningMonths };
      state.events.flags.delistWarned = true;
      const drop = dl.warningDrop ?? 0;
      if (drop > 0) {
        state.stocks.prices[sym.id] = Math.max(1, Math.round(state.stocks.prices[sym.id] * (1 - drop)));
        const h = state.stocks.history[sym.id];
        h[h.length - 1] = state.stocks.prices[sym.id];
      }
      const text = `${sym.name} 상장폐지 심사 통보 — 주가 -${Math.round(drop * 100)}%, 다음 달 상장폐지`;
      pushLog(state, { emoji: '⚠️', title: text });
      addNotice(state, '⚠️', text);
      fired += 1;
    }
  }

  for (const ev of E.events) {
    if (fired >= E.maxPerMonth) break;
    if (!eligible(state, ev)) continue;
    if (!chance(state, ev.chance)) continue;
    state.events.cooldowns[ev.id] = state.turn;
    if (ev.kind === 'notice') applyNotice(state, ev);
    else if (ev.kind === 'choice') queueChoice(state, ev);
    fired += 1;
  }
  return state;
}

function applyNotice(state, ev) {
  if (ev.id === 'hygiene') {
    const b = state.business;
    if (b.grade < ev.fineIfGradeBelow) {
      const fine = ev.fine[b.type] ?? 0;
      state.money -= fine;
      addExpense(state, '위생 벌금', fine);
      addNotice(state, ev.emoji, `${ev.title}: ${ev.failText} (-${Math.round(fine / 10000)}만)`);
      pushLog(state, { emoji: ev.emoji, title: `${ev.title}: ${ev.failText}`, amount: -fine });
    } else {
      addNotice(state, ev.emoji, `${ev.title}: ${ev.passText}`);
      pushLog(state, { emoji: ev.emoji, title: `${ev.title}: ${ev.passText}` });
    }
    return;
  }
  const parts = [];
  if (typeof ev.money === 'number') {
    state.money += ev.money;
    if (ev.money > 0) addIncome(state, ev.title, ev.money);
    else addExpense(state, ev.title, ev.money);
    parts.push(`${ev.money > 0 ? '+' : '-'}${Math.round(Math.abs(ev.money) / 10000)}만`);
    pushLog(state, { emoji: ev.emoji, title: ev.title, amount: ev.money });
  }
  if (typeof ev.condition === 'number') {
    changeCondition(state, ev.condition);
    parts.push(`컨디션 ${ev.condition}`);
  }
  if (typeof ev.reputation === 'number' && state.business) {
    const B = D.businesses;
    state.business.reputation = Math.max(B.reputationMin, Math.min(B.reputationMax, state.business.reputation + ev.reputation));
    parts.push(`평판 +${ev.reputation}`);
    pushLog(state, { emoji: ev.emoji, title: `${ev.title} (평판 +${ev.reputation})` });
  }
  addNotice(state, ev.emoji, `${ev.title}: ${ev.text}${parts.length ? ` (${parts.join(', ')})` : ''}`);
}

function queueChoice(state, ev) {
  const R = D.events.rumor;
  const targets = D.stocks.symbols.filter((s) => R.targetTypes.includes(s.type) && !isDelisted(state, s.id));
  if (!targets.length) return;
  const sym = pick(state, targets);
  const payload = {
    symbol: sym.id,
    direction: ev.direction,
    delay: randInt(state, R.delayMin, R.delayMax),
    shock: Math.round(randRange(state, R.shockMin, R.shockMax) * 100) / 100,
  };
  state.events.pending = {
    eventId: ev.id,
    emoji: ev.emoji,
    title: ev.title,
    text: ev.text.replaceAll('{name}', sym.name),
    choices: ev.choices.map((c) => ({ ...c })),
    payload,
  };
}

/** 소문 구입 시 지식 수준에 따른 문구 */
function rumorDetailText(state, sym, p) {
  const level = rumorDetailLevel(state);
  const dir = p.direction > 0 ? '호재' : '악재';
  if (level === 'direction') return `${sym.name} ${dir} 예정 (시점·폭 불명)`;
  if (level === 'timing') return `${sym.name} ${p.delay}개월 뒤 ${dir}`;
  return `${sym.name} ${p.delay}개월 뒤 ${dir}, ${p.direction > 0 ? '+' : '-'}${Math.round(p.shock * 100)}%`;
}

export function resolveEvent(input, { choiceId }) {
  if (!input.events.pending) return input;
  const state = clone(input);
  const p = state.events.pending;
  state.events.pending = null;
  if (p.eventId === 'rumor_good' || p.eventId === 'rumor_bad') {
    const sym = findStock(p.payload.symbol);
    const R = D.events.rumor;
    const known = choiceId === 'pay';
    let detail = null;
    if (known) {
      state.money -= R.cost;
      detail = rumorDetailText(state, sym, p.payload);
      pushLog(state, { emoji: '💬', title: `소문 구입: ${detail}`, amount: -R.cost });
    } else {
      pushLog(state, { emoji: '💬', title: `소문 무시: ${sym.name}` });
    }
    state.events.rumor = {
      symbol: sym.id,
      direction: p.payload.direction,
      monthsLeft: p.payload.delay,
      shock: p.payload.shock,
      known,
      detail,
    };
  }
  return state;
}

export function rumorBanner(state) {
  const r = state.events.rumor;
  if (!r) return null;
  const sym = findStock(r.symbol);
  if (!sym) return null;
  if (r.known) return `소문: ${r.detail}`;
  return `소문: ${sym.name} 관련 얘기가 돈다 (내용 불명)`;
}
