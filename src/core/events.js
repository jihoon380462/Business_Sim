// 랜덤 이벤트 선택·적용. 통보형은 즉시 로그, 선택형은 state.events.pending 에 대기.
import { D, findStock } from './data.js';
import { clone, pushLog } from './state.js';
import { chance, pick, randInt, randRange } from './rng.js';
import { isDelisted } from './stocks.js';

function onCooldown(state, ev) {
  const last = state.events.cooldowns[ev.id];
  return last != null && state.week - last < ev.cooldown;
}

function eligible(state, ev) {
  if (onCooldown(state, ev)) return false;
  if (ev.requiresBusiness && !state.business) return false;
  if (ev.category === 'stock' && (state.events.rumor || state.events.pending)) return false;
  return true;
}

/** 매주 이벤트 판정 (주당 최대 maxPerWeek 건) */
export function rollEvents(state) {
  const E = D.events;
  let fired = 0;

  // 상장폐지 예고 (잡주, 1회)
  const dl = E.delisting;
  if (!state.events.flags.delistWarned && !state.events.delisting && state.week >= dl.minWeek) {
    const junk = D.stocks.symbols.filter((s) => s.type === dl.symbolType && !isDelisted(state, s.id));
    if (junk.length && chance(state, dl.weeklyChance)) {
      const sym = pick(state, junk);
      state.events.delisting = { symbol: sym.id, weeksLeft: dl.warningWeeks };
      state.events.flags.delistWarned = true;
      pushLog(state, { emoji: '⚠️', title: `${sym.name} 상장폐지 심사 통보 (${dl.warningWeeks}주 뒤)` });
      fired += 1;
    }
  }

  for (const ev of E.events) {
    if (fired >= E.maxPerWeek) break;
    if (!eligible(state, ev)) continue;
    if (!chance(state, ev.chance)) continue;
    state.events.cooldowns[ev.id] = state.week;
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
      pushLog(state, { emoji: ev.emoji, title: `${ev.title}: ${ev.failText}`, amount: -fine });
    } else {
      pushLog(state, { emoji: ev.emoji, title: `${ev.title}: ${ev.passText}` });
    }
    return;
  }
  if (typeof ev.money === 'number') {
    state.money += ev.money;
    pushLog(state, { emoji: ev.emoji, title: ev.title, amount: ev.money });
  }
  if (typeof ev.reputation === 'number' && state.business) {
    const B = D.businesses;
    state.business.reputation = Math.max(B.reputationMin, Math.min(B.reputationMax, state.business.reputation + ev.reputation));
    pushLog(state, { emoji: ev.emoji, title: `${ev.title} (평판 +${ev.reputation})` });
  }
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

/** 선택형 이벤트 응답 */
export function resolveEvent(input, { choiceId }) {
  if (!input.events.pending) return input;
  const state = clone(input);
  const p = state.events.pending;
  state.events.pending = null;
  if (p.eventId === 'rumor_good' || p.eventId === 'rumor_bad') {
    const sym = findStock(p.payload.symbol);
    const R = D.events.rumor;
    const known = choiceId === 'pay';
    if (known) {
      state.money -= R.cost;
      const dirText = p.payload.direction > 0 ? '호재' : '악재';
      pushLog(state, { emoji: '💬', title: `소문 구입: ${sym.name} ${p.payload.delay}주 뒤 ${dirText}`, amount: -R.cost });
    } else {
      pushLog(state, { emoji: '💬', title: `소문 무시: ${sym.name}` });
    }
    state.events.rumor = {
      symbol: sym.id,
      direction: p.payload.direction,
      weeksLeft: p.payload.delay,
      shock: p.payload.shock,
      known,
    };
  }
  return state;
}

/** 주식 창 소문 배너 문구 */
export function rumorBanner(state) {
  const r = state.events.rumor;
  if (!r) return null;
  const sym = findStock(r.symbol);
  if (!sym) return null;
  if (r.known) {
    return r.direction > 0 ? `소문: ${sym.name} 호재 예정 (${r.weeksLeft}주 뒤)` : `소문: ${sym.name} 악재 예정 (${r.weeksLeft}주 뒤)`;
  }
  return `소문: ${sym.name} 관련 얘기가 돈다 (내용 불명)`;
}
