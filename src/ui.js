// 화면 (DOM): HUD · 주문 띠 · 하단 바 · 시트 · 팝업 · 캔버스 입력
import * as D from './data.js?v=1.2.1';
import * as S from './sim.js?v=1.2.1';

// ---------- 표기 ----------
export function man(n, { sign = false } = {}) {
  const neg = n < 0; const a = Math.abs(n);
  let body;
  if (a >= 1e8) body = `${(Math.round(a / 1e6) / 100).toLocaleString('ko-KR')}억`;
  else if (a >= 1e4) body = `${Math.round(a / 1e4).toLocaleString('ko-KR')}만`;
  else body = `${Math.round(a).toLocaleString('ko-KR')}원`;
  return (neg ? '-' : sign && n > 0 ? '+' : '') + body;
}
const won = (n) => `${n < 0 ? '-' : ''}₩${Math.abs(Math.round(n)).toLocaleString('ko-KR')}`;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const itemChip = (it, n) => `<span class="it"><i style="background:${D.ITEMS[it].color}"></i>${D.ITEMS[it].final ? D.ITEMS[it].icon + ' ' : ''}${D.ITEMS[it].name}${n > 1 ? ` ×${n}` : ''}</span>`;
const stars = (v) => { const f = Math.round(v); return `<span class="stars">${'★'.repeat(f)}<span class="off">${'★'.repeat(Math.max(0, 5 - f))}</span></span>`; };
const tierTag = (t) => `<span class="tag t${t}">${D.TIERS[t].name}</span>`;
const DIR_ARROW = ['→', '↓', '←', '↑'];
const STATUS = {
  work: '가동 중', starved: '재료 대기', blocked: '출구 막힘 (앞 칸이 꽉 참)', no_worker: '작업자 없음', no_recipe: '레시피를 고르세요',
  broken: '고장', service: '정비 중', idle: '대기', off: '정지됨 (재료를 받지 않고, 작업자도 다른 기계로 감)',
};

export function createUI(game) {
  const $ = (id) => document.getElementById(id);
  const el = { hud: $('hud'), orders: $('orders'), bar: $('bar'), sheetWrap: $('sheet-wrap'), sheet: $('sheet'), popupWrap: $('popup-wrap'), popup: $('popup'), toasts: $('toasts'), canvas: $('floor') };
  const ui = game.ui;

  // ============================================================ HUD
  let hudBuilt = false;
  function renderHud() {
    const s = game.s;
    if (!hudBuilt) {
      el.hud.innerHTML = `
      <div class="money"><div class="cash num" id="h-cash"></div><div class="debt" id="h-debt"></div></div>
      <div class="when"><div class="date" id="h-date"></div><div class="clock" id="h-clock"></div></div>
      <div class="daybar"><i id="h-day"></i></div>
      <div class="controls">
        <div class="speed">
          <button data-a="speed" data-v="0">❚❚</button>
          ${D.TIME.speeds.map((v, i) => `<button data-a="speed" data-v="${i + 1}">${'▶'.repeat(i + 1)}</button>`).join('')}
        </div>
        <button class="chip" id="h-ot" data-a="ot"></button>
        <button class="chip grow" data-a="sheet" data-v="books">📒 장부</button>
      </div>`;
      hudBuilt = true;
    }
    const span = S.endHour(s) - D.TIME.workStart;
    const prog = Math.max(0, Math.min(1, (s.clock - D.TIME.workStart) / span));
    const night = s.phase === 'night';
    const q = (id) => document.getElementById(id);
    q('h-cash').textContent = `₩ ${man(s.cash)}`;
    q('h-cash').classList.toggle('low', s.cash < 5e6);
    q('h-debt').textContent = `빚 ${man(s.loan)} · 받을 돈 ${man(s.receivables.reduce((a, r) => a + r.amount, 0))}`;
    q('h-date').textContent = S.dateLabel(s);
    q('h-clock').innerHTML = night ? '🌙 퇴근' : `${S.clockLabel(s)} · <b>${s.clock >= D.TIME.workEnd ? '야근 중' : '근무 중'}</b>`;
    const bar = q('h-day');
    bar.style.width = `${night ? 100 : prog * 100}%`;
    bar.classList.toggle('ot', s.clock >= D.TIME.workEnd);
    el.hud.querySelectorAll('[data-a="speed"]').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === ui.speed));
    const ot = q('h-ot');
    ot.textContent = `🌙 야근 ${s.overtime ? 'ON' : 'OFF'}`;
    ot.classList.toggle('on', s.overtime);
  }

  let ordersSig = '';
  function renderOrders() {
    const s = game.s;
    const today = S.absDay(s);
    const os = [...s.orders].sort((a, b) => a.dueDay - b.dueDay);
    const sig = os.map((o) => `${o.id}:${Math.min(o.lots, s.inventory[o.item] || 0)}:${o.dueDay - today}`).join('|');
    if (sig === ordersSig) return;
    ordersSig = sig;
    if (!os.length) { el.orders.innerHTML = `<div class="ochip empty">진행 중인 주문이 없어요 — 📋 수주에서 받아 오세요</div>`; return; }
    el.orders.innerHTML = os.map((o) => {
      const have = Math.min(o.lots, s.inventory[o.item] || 0);
      const left = o.dueDay - today;
      const cls = left < 0 ? 'late' : left <= 1 ? 'warn' : '';
      return `<div class="ochip" data-a="sheet" data-v="orders" data-tab="active">
        <div class="top"><b>${D.ITEMS[o.item].icon} ${esc(D.ITEMS[o.item].name)}</b><span class="due ${cls}">${left < 0 ? `지연 ${-left}일` : left === 0 ? '오늘' : `D-${left}`}</span></div>
        <div class="muted" style="color:#A9B6C6">${esc(o.client)} · ${have}/${o.lots}상자</div>
        <div class="pbar"><i style="width:${(have / o.lots) * 100}%"></i></div></div>`;
    }).join('');
  }

  const PALETTE = [
    { kind: 'belt', ico: '➡️', nm: '벨트' },
    { kind: 'split', ico: '🔀', nm: '분배기' },
    { kind: 'input', ico: '📥', nm: '입고구' },
    { kind: 'output', ico: '📤', nm: '출하구' },
    { kind: 'machine', model: 'press_old', ico: '🔨', nm: '프레스' },
    { kind: 'machine', model: 'weld_old', ico: '🔥', nm: '용접기' },
    { kind: 'machine', model: 'lathe_old', ico: '⚙️', nm: '선반' },
    { kind: 'machine', model: 'heat', ico: '♨️', nm: '열처리' },
    { kind: 'machine', model: 'mold', ico: '🧪', nm: '사출기' },
    { kind: 'machine', model: 'paint', ico: '🎨', nm: '도장' },
    { kind: 'machine', model: 'assembly', ico: '🔧', nm: '조립대' },
    { kind: 'rotate', ico: '🔄', nm: '회전' },
    { kind: 'remove', ico: '🗑️', nm: '철거', danger: true },
  ];

  function renderBar() {
    const s = game.s;
    if (ui.buildMode) {
      const avail = (p) => (p.kind === 'machine' ? S.modelUnlocked(s, p.model) : p.kind === 'split' ? S.splitUnlocked(s) : true);
      const tools = PALETTE.map((p, i) => [p, i]).filter(([p]) => avail(p)).map(([p, i]) => {
        const on = ui.tool && ui.tool.kind === p.kind && (p.model ? ui.tool.model === p.model : true);
        const cost = ['rotate', 'remove'].includes(p.kind) ? '' : man(S.buildCost(s, p.kind, p.model));
        return `<button class="tool ${on ? 'on' : ''} ${p.danger ? 'danger' : ''}" data-a="tool" data-v="${i}"><span class="ico">${p.ico}</span><span class="nm">${p.nm}</span><span class="pr">${cost}</span></button>`;
      });
      tools.push(`<button class="tool done" data-a="build-done"><span class="ico">✔️</span><span class="nm">완료</span><span class="pr">&nbsp;</span></button>`);
      const next = S.nextUnlocks(s)[0];
      el.bar.innerHTML = `<div class="palette-wrap"><div class="palette">${tools.join('')}</div>${next ? `<div class="next-unlock">🔒 다음 해금: ${next.icon} ${esc(next.name)} — ${esc(next.hint)}</div>` : ''}</div>`;
      return;
    }
    const n = s.offers.length;
    const btn = (id, ico, label, badge) => `<button class="${ui.sheet?.type === id ? 'on' : ''}" data-a="${id === 'build' ? 'build' : 'sheet'}" data-v="${id}"><span class="ico">${ico}</span>${label}${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;
    el.bar.innerHTML = btn('build', '🏗️', '건설') + btn('orders', '📋', '수주', n || '') + btn('staff', '👷', '직원') + btn('manage', '🏢', '경영') + btn('books', '📒', '장부');
  }

  let questSig = '';
  function renderQuest() {
    const s = game.s;
    const q = S.currentQuest(s);
    const sig = `${s.quest}|${ui.buildMode}`;
    let p = document.getElementById('quest-pill');
    if (!q) { if (p) p.remove(); questSig = sig; return; }
    if (sig === questSig && p) return;
    questSig = sig;
    if (!p) { p = document.createElement('button'); p.id = 'quest-pill'; p.className = 'quest-pill'; p.dataset.a = 'quest'; document.querySelector('.stage').appendChild(p); }
    p.classList.toggle('low', ui.buildMode);
    p.innerHTML = `<span class="qn">할 일 ${s.quest + 1}/${D.QUESTS.length}</span><span class="qt">${q.icon} ${esc(q.title)}</span>${q.reward ? `<span class="qr">+${man(q.reward)}</span>` : ''}<span class="qm">›</span>`;
  }

  function renderBuildHint() {
    let h = document.getElementById('build-hint');
    if (!ui.buildMode) { if (h) h.remove(); return; }
    if (!h) { h = document.createElement('div'); h.id = 'build-hint'; h.className = 'build-hint'; document.querySelector('.stage').appendChild(h); }
    const t = ui.tool;
    let text = '도구를 고르세요';
    if (t?.kind === 'belt') text = '손가락으로 쭉 그어서 벨트 깔기 · 탭하면 방향';
    else if (t?.kind === 'remove') text = '철거할 칸을 탭';
    else if (t?.kind === 'rotate') text = '돌릴 칸을 탭';
    else if (t) text = '빈 칸이나 벨트 위에 탭해서 설치 · 다시 탭하면 회전';
    h.innerHTML = `<span>${text}</span>${t && !['remove', 'rotate'].includes(t.kind) ? `<button data-a="dir">방향 ${DIR_ARROW[ui.dir]}</button>` : ''}`;
  }

  // ============================================================ 시트
  function openSheet(type, extra = {}) { ui.sheet = { type, ...extra }; renderSheet(); renderBar(); }
  function closeSheet() { ui.sheet = null; ui.selected = null; el.sheetWrap.classList.add('hidden'); renderBar(); game.save(); }

  function shell(title, body, tabs = '') {
    return `<div class="sh-head"><div class="sh-grab"></div><div class="sh-title"><h2>${title}</h2><button class="sh-x" data-a="close">✕</button></div>${tabs}</div><div class="sh-body">${body}</div>`;
  }

  function renderSheet() {
    if (!ui.sheet) { el.sheetWrap.classList.add('hidden'); return; }
    const f = { orders: sheetOrders, staff: sheetStaff, manage: sheetManage, books: sheetBooks, inspect: sheetInspect, process: sheetProcess, quest: sheetQuest }[ui.sheet.type];
    el.sheet.innerHTML = f();
    el.sheetWrap.classList.remove('hidden');
  }

  // ---------- 수주 ----------
  function capacityOf(item) {
    const s = game.s;
    const ms = S.machinesList(s);
    let cap = Infinity;
    for (const c of S.chainFor(item)) {
      const lots = ms.filter((m) => m.recipe === c.recipe && !m.broken).reduce((a, m) => a + S.machinePerMin(s, m), 0) / c.mult;
      cap = Math.min(cap, lots);
    }
    return cap === Infinity ? 0 : cap;
  }
  function missingFor(item) {
    const s = game.s;
    const types = new Set(S.machinesList(s).map((m) => S.machineDef(m).type));
    const miss = [];
    for (const c of S.chainFor(item)) {
      if (!S.recipeUnlocked(s, c.recipe)) { miss.push('전기차 연구'); continue; }
      if (!types.has(c.machine)) miss.push(D.MACHINE_TYPES[c.machine].name);
    }
    return [...new Set(miss)];
  }

  function sheetOrders() {
    const s = game.s;
    const tab = ui.sheet.tab || 'offers';
    const tabs = `<div class="tabs">${[['offers', `새 주문 ${s.offers.length}`], ['active', `진행 ${s.orders.length}`], ['clients', '거래처']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${l}</button>`).join('')}</div>`;
    let body = '';
    const today = S.absDay(s);
    if (tab === 'offers') {
      body = s.offers.length ? s.offers.map((o) => {
        const it = D.ITEMS[o.item];
        const value = o.lots * it.lot * o.unitPrice;
        const cap = capacityOf(o.item);
        const load = Math.max(0, S.demandLots(s, o.item) - (s.inventory[o.item] || 0));
        const days = cap > 0 ? Math.ceil((load + o.lots) / cap) : null;
        const miss = missingFor(o.item);
        const capTxt = cap > 0 ? ` · 지금 라인 분당 ${cap.toFixed(1)}상자` : '';
        const feas = miss.length ? `<span class="tag no">필요: ${miss.join(', ')}</span>` : days == null ? '<span class="tag no">라인 없음</span>' : days <= o.dueDays ? `<span class="tag ok">약 ${days}일이면 완료${capTxt}</span>` : `<span class="tag warn">약 ${days}일 걸림 (납기 ${o.dueDays}일)${capTxt}</span>`;
        return `<div class="card offer">
          <div class="head">${tierTag(o.tier)}<span class="client">${esc(o.client)}</span><span class="muted" style="margin-left:auto">${o.expires - today <= 0 ? '오늘까지' : `${o.expires - today}일 뒤 마감`}</span></div>
          <div class="row tap" style="margin-top:8px" data-a="process" data-v="${o.item}"><div class="big-ico">${it.icon}</div><div class="grow"><div class="b" style="font-weight:800">${esc(it.name)}</div><div class="qty">${S.fmtQty(o)} <span class="muted">(${o.lots}상자)</span></div></div><span class="howto">공정 보기 ›</span></div>
          <div class="facts">
            <div><div class="l">총액</div><div class="v">${man(value)}</div></div>
            <div><div class="l">개당</div><div class="v">${o.unitPrice.toLocaleString('ko-KR')}원</div></div>
            <div><div class="l">납기</div><div class="v">${o.dueDays}일</div></div>
          </div>
          <div class="row" style="flex-wrap:wrap;gap:6px">${feas}<span class="tag">${o.pay === 'cash' ? '💵 즉시 결제' : '🧾 다음 달 말 결제'}</span></div>
          <div class="btns" style="margin-top:10px"><button class="btn ghost sm" data-a="decline" data-v="${o.id}">거절</button><button class="btn pri sm" data-a="accept" data-v="${o.id}">수락</button></div>
        </div>`;
      }).join('') : `<div class="card muted" style="text-align:center">새 주문이 아직 없어요. 매일 퇴근할 때 들어옵니다.<br/>평판이 오르면 더 자주, 더 크게 옵니다.</div>`;
    } else if (tab === 'active') {
      const os = [...s.orders].sort((a, b) => a.dueDay - b.dueDay);
      body = os.length ? os.map((o) => {
        const it = D.ITEMS[o.item];
        const have = Math.min(o.lots, s.inventory[o.item] || 0);
        const left = o.dueDay - today;
        return `<div class="card ${left < 0 ? 'bad' : left <= 1 ? 'warn' : ''}">
          <div class="row">${tierTag(o.tier)}<b>${esc(o.client)}</b>${o.regular ? '<span class="tag">아버지 단골</span>' : ''}<span class="grow"></span><span class="dh" style="font-size:16px">${left < 0 ? `지연 ${-left}일` : left === 0 ? '오늘 마감' : `D-${left}`}</span></div>
          <div class="row tap" style="margin-top:6px" data-a="process" data-v="${o.item}"><span style="font-size:20px">${it.icon}</span><div class="grow"><b>${esc(it.name)}</b> ${S.fmtQty(o)} · ${man(o.lots * it.lot * o.unitPrice)}</div><span class="howto">공정 ›</span></div>
          <div class="row" style="margin-top:6px"><div class="grow"><div class="bar-mini"><i style="width:${(have / o.lots) * 100}%"></i></div></div><span class="dh">${have}/${o.lots}</span></div>
          ${left < 0 ? `<div class="muted" style="margin-top:4px">하루 늦을 때마다 위약금 ${Math.round(D.TIERS[o.tier].penaltyPerDay * 100)}%, ${D.OFFERS.cancelAfterLateDays}일 넘으면 계약 해지</div>` : ''}
        </div>`;
      }).join('') : '<div class="card muted" style="text-align:center">진행 중인 주문이 없어요</div>';
      body += `<div class="muted" style="text-align:center">출하구에 상자가 다 모이면 그날 퇴근할 때 트럭이 실어 갑니다</div>`;
    } else {
      body = [0, 1, 2, 3].map((t) => {
        const T = D.TIERS[t];
        const unlocked = S.tierUnlocked(s, t);
        let need = '';
        if (!unlocked) {
          const n = T.need;
          const parts = [];
          if (n.rep) parts.push(`${D.TIERS[n.rep[0]].name} 신뢰 ${n.rep[1]} (현재 ${Math.round(s.rep[n.rep[0]])})`);
          if (n.cert) parts.push(`${D.CERTS[n.cert].name} 인증 ${s.certs[n.cert] ? '✓' : ''}`);
          need = `<div class="muted">🔒 ${parts.join(' · ')}</div>`;
        }
        return `<div class="card" style="${unlocked ? '' : 'opacity:.75'}">
          <div class="row">${tierTag(t)}<span class="muted">${T.pay === 'cash' ? '즉시 결제' : '다음 달 말 결제'} · 지연 위약금 ${Math.round(T.penaltyPerDay * 100)}%/일</span></div>
          <div class="row" style="margin-top:8px"><span class="muted" style="width:34px">신뢰</span><div class="grow"><div class="bar-mini ${s.rep[t] < 40 ? 'r' : s.rep[t] < 60 ? 'y' : ''}"><i style="width:${s.rep[t]}%"></i></div></div><span class="dh">${Math.round(s.rep[t])}</span></div>
          <div class="muted" style="margin-top:4px">주문 부품: ${D.OFFERS.parts[t].map((it) => D.ITEMS[it].icon + D.ITEMS[it].name).join(', ')}</div>
          ${need}</div>`;
      }).join('');
    }
    return shell('📋 수주', body, tabs);
  }

  // ---------- 직원 ----------
  function sheetStaff() {
    const s = game.s;
    const ms = S.machinesList(s);
    const needed = ms.filter((m) => !S.machineDef(m).auto && m.recipe).length;
    const working = s.workers.filter((w) => w.machine).length;
    const wages = S.monthlyWages(s);
    const mName = (id) => { const m = ms.find((x) => x.id === id); return m ? S.machineDef(m).name : null; };
    let body = `<div class="card ${working < needed ? 'warn' : ''}"><div class="row"><div class="grow"><b>작업자 ${s.workers.filter((w) => !w.advisor).length}명</b> / 사람이 필요한 기계 ${needed}대</div><span class="dh" style="font-size:16px">월 ${man(wages)}</span></div>
      ${working < needed ? `<div class="muted" style="margin-top:4px">⚠️ 기계 ${needed - working}대가 사람이 없어 멈춰 있어요</div>` : ''}
      <div class="muted" style="margin-top:4px">숙련공은 느린 공정(병목)에 자동 배치됩니다</div></div>
      <div class="card"><div class="row"><div class="grow"><b>🌙 야근</b><div class="muted">22시까지 일함 · 시급 1.5배 · 사기 하루 −3</div></div><button class="btn sm ${s.overtime ? 'red' : 'ghost'}" data-a="ot">${s.overtime ? '끄기' : '켜기'}</button></div></div>
      <div class="card"><div class="row"><div class="grow"><b>🎁 보너스</b><div class="muted">월급의 50% (${man(Math.round(wages * D.WORKERS.bonusRate))}) · 사기 +${D.WORKERS.bonusMorale}</div></div><button class="btn sm yel" data-a="bonus">지급</button></div></div>
      <h3 class="sec">우리 직원</h3>`;
    body += s.workers.map((w) => `<div class="card"><div class="row"><div class="big-ico">${w.advisor ? '🧓' : w.veteran ? '👴' : '👷'}</div>
      <div class="grow"><div><b>${esc(w.name)}</b> <span class="muted">${w.age}세${w.advisor ? ' · 고문' : ''}</span></div>
        <div>${stars(w.skill)} <span class="muted">숙련 ${w.skill.toFixed(1)} · 재능 ${w.talent}</span></div>
        <div class="muted">${w.advisor ? '후배 숙련 성장 ×2' : mName(w.machine) ? `🔧 ${mName(w.machine)}` : '대기 중'}</div></div>
      <div style="text-align:right"><div class="dh">${man(w.wage)}</div><div class="muted">사기 ${Math.round(w.morale)}</div></div></div>
      <div class="bar-mini ${w.morale < 30 ? 'r' : w.morale < 50 ? 'y' : ''}" style="margin-top:8px"><i style="width:${w.morale}%"></i></div>
      ${w.veteran ? '' : `<div style="text-align:right;margin-top:6px"><button class="btn sm ghost" data-a="fire" data-v="${w.id}">내보내기 (퇴직금 ${man(w.wage)})</button></div>`}</div>`).join('');
    body += `<h3 class="sec">지원자 <span class="muted">· 매주 바뀜 · 채용비 ${man(D.WORKERS.hireFee)}</span></h3>`;
    body += s.candidates.map((w) => `<div class="card"><div class="row"><div class="big-ico">🙋</div>
      <div class="grow"><div><b>${esc(w.name)}</b> <span class="muted">${w.age}세</span></div><div>${stars(w.skill)} <span class="muted">숙련 ${w.skill.toFixed(1)} · 재능 ${w.talent}</span></div></div>
      <div style="text-align:right"><div class="dh">월 ${man(w.wage)}</div><button class="btn sm teal" style="margin-top:4px" data-a="hire" data-v="${w.id}">채용</button></div></div></div>`).join('') || '<div class="card muted">이번 주 지원자가 없어요</div>';
    return shell('👷 직원', body);
  }

  // ---------- 경영 ----------
  function sheetManage() {
    const s = game.s;
    const limit = S.loanLimit(s);
    const step = D.FINANCE.loanStep;
    const interest = Math.round(s.loan * D.FINANCE.monthlyInterest);
    let body = `<h3 class="sec">💰 이번 달 고정 지출</h3><div class="card">
      <div class="kv"><span>인건비</span><b class="dh">${man(S.monthlyWages(s))}</b></div>
      <div class="kv"><span>공장 유지비 (전기·임대·보험)</span><b class="dh">${man(S.monthlyOverhead(s))}</b></div>
      <div class="kv"><span>대출 이자 (월 ${(D.FINANCE.monthlyInterest * 100).toFixed(1)}%)</span><b class="dh">${man(interest)}</b></div>
      <div class="kv"><span>이번 달 원자재비 (지금까지)</span><b class="dh">${man(s.month.raw)}</b></div>
      <div class="muted" style="margin-top:4px">월말(10일 퇴근)에 한꺼번에 나갑니다. 현금이 모자라면 자동으로 빚을 지고, 한도도 넘으면 부도.</div></div>
      <h3 class="sec">🏦 대출</h3><div class="card">
      <div class="kv"><span>빚</span><b class="dh">${man(s.loan)}</b></div>
      <div class="kv"><span>한도 (기계 가치 반영)</span><b class="dh">${man(limit)}</b></div>
      <div class="btns" style="margin-top:8px"><button class="btn sm ghost" data-a="borrow" ${s.loan + step > limit ? 'disabled' : ''}>${man(step)} 빌리기</button><button class="btn sm ghost" data-a="repay" ${s.loan <= 0 || s.cash < 1 ? 'disabled' : ''}>${man(step)} 갚기</button></div>
      <button class="btn sm pri full" style="margin-top:8px" data-a="repay-all" ${s.loan <= 0 || s.cash < s.loan ? 'disabled' : ''}>전액 상환</button></div>
      <h3 class="sec">📜 인증</h3>`;
    for (const [id, c] of Object.entries(D.CERTS)) {
      const st = S.certStatus(s, id);
      body += `<div class="card"><div class="row"><div class="big-ico">${c.icon}</div><div class="grow"><b>${c.name}</b><div class="muted">${c.desc} · 불량률 ${(c.maxDefect * 100).toFixed(1)}% 이하</div>
        <div class="muted">${st.done ? '✅ 보유' : st.reason ? `조건: ${esc(st.reason)}` : '지금 받을 수 있어요'}</div></div>
        ${st.done ? '' : `<button class="btn sm yel" data-a="cert" data-v="${id}" ${st.ok ? '' : 'disabled'}>${man(c.cost)}</button>`}</div></div>`;
    }
    const d = S.lastMonthDefect(s);
    body += `<div class="muted" style="padding:0 4px">지난달 불량률: <b>${d == null ? '-' : (d * 100).toFixed(2) + '%'}</b> · 숙련공·기계 상태·로봇이 낮춰 줍니다</div>`;
    body += `<h3 class="sec">⚡ 연구</h3>`;
    for (const [id, r] of Object.entries(D.RESEARCH)) {
      const st = s.research[id];
      body += `<div class="card"><div class="row"><div class="big-ico">${r.icon}</div><div class="grow"><b>${r.name}</b><div class="muted">${r.desc} · ${r.days}일</div>
        ${st ? `<div class="bar-mini" style="margin-top:6px"><i style="width:${st.done ? 100 : ((r.days - st.left) / r.days) * 100}%"></i></div><div class="muted">${st.done ? '✅ 완료' : `${st.left}일 남음`}</div>` : `<div class="muted">${r.need && !s.certs[r.need] ? `🔒 ${D.CERTS[r.need].name} 필요` : ''}</div>`}</div>
        ${st ? '' : `<button class="btn sm yel" data-a="research" data-v="${id}" ${(r.need && !s.certs[r.need]) || s.cash < r.cost ? 'disabled' : ''}>${man(r.cost)}</button>`}</div></div>`;
    }
    const next = D.FLOOR.levels[s.floorLevel + 1];
    body += `<h3 class="sec">🏗️ 공장</h3><div class="card"><div class="row"><div class="big-ico">🏭</div><div class="grow"><b>${D.FLOOR.levels[s.floorLevel].name}</b> <span class="muted">${s.floor.cols}×${s.floor.rows}칸</span>
      ${next ? `<div class="muted">다음: ${next.name} ${next.cols}×${next.rows}칸 · 유지비 월 +${man((next.cols * next.rows - s.floor.cols * s.floor.rows) * D.FLOOR.overheadPerTile)}</div>` : '<div class="muted">최대 규모</div>'}</div>
      ${next ? `<button class="btn sm yel" data-a="expand" ${s.cash < next.cost ? 'disabled' : ''}>${man(next.cost)}</button>` : ''}</div></div>`;
    return shell('🏢 경영', body);
  }

  // ---------- 장부 ----------
  function sheetBooks() {
    const s = game.s;
    const tab = ui.sheet.tab || 'money';
    const tabs = `<div class="tabs">${[['money', '손익'], ['ach', '업적'], ['log', '기록'], ['set', '설정']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${l}</button>`).join('')}</div>`;
    let body = '';
    if (tab === 'money') {
      const h = s.history.slice(-12);
      const max = Math.max(1, ...h.map((r) => r.revenue), ...h.map((r) => Math.abs(r.net)));
      body += `<div class="card"><div class="row"><b>월별 매출 · 순이익</b><span class="grow"></span><span class="muted">■ 매출 ■ 순익</span></div>
        ${h.length ? `<div class="chart">${h.map((r) => `<div class="col"><i style="height:${(r.revenue / max) * 100}%"></i><i class="net ${r.net < 0 ? 'neg' : ''}" style="height:${(Math.abs(r.net) / max) * 100}%"></i></div>`).join('')}</div>
        <div class="chart-l">${h.map((r) => `<span>${r.label.split(' ')[1]}</span>`).join('')}</div>` : '<div class="muted" style="padding:20px 0;text-align:center">첫 달이 끝나면 그래프가 생겨요</div>'}</div>`;
      const r = s.history[s.history.length - 1];
      if (r) body += monthTable(r);
      body += `<div class="card"><div class="kv"><span>순자산 (현금+받을 돈+기계−빚)</span><b class="dh">${man(S.netWorth(s))}</b></div></div>`;
    } else if (tab === 'ach') {
      body = `<div class="ach">${Object.entries(D.ACHIEVEMENTS).map(([id, a]) => `<div class="${s.achievements[id] ? '' : 'off'}"><div class="i">${a.icon}</div>${a.name}</div>`).join('')}</div>
        <div class="card muted">🎯 최종 목표: <b>완성차 직납</b>을 따내고 <b>빚을 모두 갚기</b></div>`;
    } else if (tab === 'log') {
      body = `<div class="card">${s.log.map((l) => `<div class="logrow"><span class="d">${esc(l.date)}</span><span>${l.icon}</span><span class="t">${esc(l.text)}</span>${l.amount != null ? `<b class="dh ${l.amount >= 0 ? 'pos' : 'neg'}">${man(l.amount, { sign: true })}</b>` : ''}</div>`).join('') || '<div class="muted">아직 기록이 없어요</div>'}</div>`;
    } else {
      body = `<div class="card"><div class="row"><div class="grow"><b>새로 시작</b><div class="muted">지금 공장을 접고 처음부터</div></div><button class="btn sm red" data-a="newgame">새 게임</button></div></div>
        <div class="card"><div class="row"><div class="grow"><b>도움말</b><div class="muted">처음 안내를 다시 봅니다</div></div><button class="btn sm ghost" data-a="help">보기</button></div></div>
        <div class="muted" style="text-align:center">아버지의 공장 v${D.VERSION} · 자동 저장 (매일 퇴근 시)</div>`;
    }
    return shell('📒 장부', body, tabs);
  }

  function monthTable(r, inPopup = false) {
    const row = (l, v, cls = '') => `<tr><td>${l}</td><td class="${cls}">${man(v, { sign: true })}</td></tr>`;
    return `<div class="card">${inPopup ? '' : `<b>${esc(r.label)} 결산</b>`}<table class="mtable" style="margin-top:6px">
      ${row('출하 매출', r.revenue, 'pos')}
      ${r.penalty ? row('위약금', -r.penalty, 'neg') : ''}
      ${row('원자재비', -r.raw, 'neg')}
      ${row('인건비', -(r.wages + r.otPay), 'neg')}
      ${row('공장 유지비', -r.overhead, 'neg')}
      ${row('대출 이자', -r.interest, 'neg')}
      ${r.repairs ? row('수리·정비', -r.repairs, 'neg') : ''}
      <tr class="tot"><td>순이익</td><td class="${r.net >= 0 ? 'pos' : 'neg'}">${man(r.net, { sign: true })}</td></tr></table>
      <div class="muted" style="margin-top:6px">생산 ${r.crafts}회 · 불량 ${r.crafts ? ((r.defects / r.crafts) * 100).toFixed(1) : 0}% · 외상 회수 ${man(r.collected)}${r.built ? ` · 설비 투자 ${man(r.built)}` : ''}${r.emergency ? ` · ⚠️ 긴급 대출 ${man(r.emergency)}` : ''}</div></div>`;
  }


  // ---------- 할 일 ----------
  const QUEST_GO = { accept: ['orders', '📋 수주 열기'], split: ['build-split', '🏗️ 분배기 들고 건설'], staff: ['staff', '👷 직원 열기'], ship: ['orders-active', '📋 진행 중 주문 보기'], product: ['orders', '📋 수주 열기'], tier1: ['orders-clients', '🤝 거래처 신뢰 보기'], iso: ['manage', '🏢 경영 열기'] };
  function sheetQuest() {
    const s = game.s;
    const q = S.currentQuest(s);
    if (!q) return shell('🎯 할 일', '<div class="card">안내는 여기까지! 이제 마음대로 공장을 키워 보세요.<br/><b>최종 목표</b>: 완성차 직납 + 빚 청산</div>');
    const go = QUEST_GO[q.id];
    const list = D.QUESTS.map((x, i) => `<div class="qrow ${i < s.quest ? 'done' : i === s.quest ? 'now' : ''}"><span>${i < s.quest ? '✅' : i === s.quest ? '👉' : '⬜'}</span><span class="grow">${x.icon} ${esc(x.title)}</span>${x.reward ? `<span class="muted">+${man(x.reward)}</span>` : ''}</div>`).join('');
    const body = `<div class="card warn"><div class="row"><div class="big-ico">${q.icon}</div><div class="grow"><b style="font-size:16px">${esc(q.title)}</b>${q.reward ? `<div class="muted">보상 ${man(q.reward)}</div>` : ''}</div></div>
      <div style="margin-top:8px;white-space:pre-line;line-height:1.6">${esc(q.text)}</div>
      ${go ? `<button class="btn pri full" style="margin-top:10px" data-a="quest-go" data-v="${go[0]}">${go[1]}</button>` : ''}</div>
      <div class="card">${list}</div>`;
    return shell('🎯 할 일', body);
  }

  // ---------- 공정 보기 ----------
  function sheetProcess() {
    const s = game.s;
    const item = ui.sheet.item;
    const it = D.ITEMS[item];
    const finalRate = S.recipePerMin(item); // 마지막 기계 1대(기본 속도)가 분당 만드는 양
    const ms = S.machinesList(s);
    const rawCost = S.chainFor(item).reduce((a, c) => a + Object.entries(D.RECIPES[c.recipe].in).filter(([x]) => D.ITEMS[x].raw).reduce((b, [x, n]) => b + D.ITEMS[x].cost * n * c.mult, 0), 0);
    const step = (rid, mult) => {
      const r = D.RECIPES[rid];
      const type = D.MACHINE_TYPES[r.machine];
      const rpm = S.recipePerMin(rid);
      const need = (finalRate * mult) / rpm;
      const owned = ms.filter((m) => m.recipe === rid).length;
      const locked = !S.typeUnlocked(s, r.machine) ? D.UNLOCKS.types[r.machine]?.hint : !S.recipeUnlocked(s, rid) ? '전기차 연구' : null;
      return `<div class="pstep ${locked ? 'lock' : owned ? 'have' : ''}">
        <div class="ph"><span class="pi" style="background:${type.color}">${type.icon}</span><b>${type.name}</b><span class="grow"></span>${locked ? `<span class="tag no">🔒</span>` : owned ? `<span class="tag ok">보유 ${owned}</span>` : '<span class="tag">없음</span>'}</div>
        <div class="flow">${Object.entries(r.in).map(([x, n]) => itemChip(x, n)).join(' + ')}<span class="arrow">→</span>${itemChip(r.out)}</div>
        <div class="pm">1대 분당 <b>${rpm.toFixed(1)}</b>상자 · 균형 <b>${need.toFixed(1)}대</b></div>
        ${locked ? `<div class="pm neg">해금: ${esc(locked)}</div>` : ''}</div>`;
    };
    const raw = (x, mult) => `<div class="pstep raw"><div class="ph"><span class="pi" style="background:#2F6F9E">📥</span><b>입고구</b><span class="grow"></span>${itemChip(x)}</div>
      <div class="pm">분당 <b>${(finalRate * mult).toFixed(1)}</b>상자 필요 · 상자당 ${man(D.ITEMS[x].cost)}</div></div>`;
    const node = (x, mult) => {
      if (D.ITEMS[x].raw) return raw(x, mult);
      const r = D.RECIPES[x];
      const ins = Object.entries(r.in);
      const upstream = ins.length === 1
        ? node(ins[0][0], mult * ins[0][1])
        : `<div class="branches">${ins.map(([y, n]) => `<div class="branch">${node(y, mult * n)}</div>`).join('')}</div>`;
      return `${upstream}<div class="parrow">${ins.length > 1 ? '⤵ 합치기' : '↓'}</div>${step(x, mult)}`;
    };
    const unlocked = S.itemUnlocked(s, item);
    const body = `<div class="card"><div class="row"><div class="big-ico">${it.icon}</div><div class="grow"><b style="font-size:16px">${esc(it.name)}</b>
        <div class="muted">상자 1개 = ${it.lot}개 · 기준 개당 ${it.unitPrice.toLocaleString('ko-KR')}원</div>
        <div class="muted">상자당 매출 ≈ ${man(it.lot * it.unitPrice)} · 원자재 ${man(rawCost)}</div></div></div>
        ${unlocked ? '' : '<div class="tag no" style="margin-top:8px">아직 만들 수 없는 설비가 있어요</div>'}</div>
      <div class="muted" style="padding:0 4px">위에서 아래로 상자가 흐릅니다. <b>균형</b> = 마지막 기계 1대를 쉬지 않게 돌리려면 그 공정에 필요한 대수 (기본 속도, 숙련공·좋은 기계면 더 빠름)</div>
      <div class="process">${node(item, 1)}<div class="parrow">↓</div><div class="pstep out"><div class="ph"><span class="pi" style="background:#2E8B5E">📤</span><b>출하구</b><span class="grow"></span><span class="pm">분당 ${finalRate.toFixed(1)}상자</span></div></div></div>
      ${ui.sheet.back ? `<button class="btn ghost full" data-a="process-back">‹ 수주로 돌아가기</button>` : ''}`;
    return shell('🗺️ 만드는 법', body);
  }

  // ---------- 칸 살펴보기 ----------
  function sheetInspect() {
    const s = game.s;
    const { x, y } = ui.sheet;
    const t = S.tile(s, x, y);
    if (!t) return shell('빈 칸', '<div class="card muted">🏗️ 건설 모드에서 무언가를 놓을 수 있어요</div>');
    const common = `<div class="btns"><button class="btn ghost sm" data-a="rot">🔄 회전 ${DIR_ARROW[t.dir ?? 0]}</button><button class="btn ghost sm" data-a="del">🗑️ 철거</button></div>`;
    if (t.k === 'belt' || t.k === 'split') {
      return shell(t.k === 'belt' ? '➡️ 벨트' : '🔀 분배기', `<div class="card">${t.k === 'split' ? '들어온 상자를 앞·왼쪽·오른쪽으로 번갈아 내보냅니다. 기계 두 대에 나눠 먹이거나, 두 줄을 합칠 때 씁니다.' : `상자를 ${DIR_ARROW[t.dir]} 방향으로 나릅니다.<div class="kv" style="margin-top:6px"><span>최대 운반량</span><b class="dh">분당 ${Math.round(S.beltPerMin())}상자</b></div>`}${t.jam ? '<div class="muted" style="margin-top:6px;color:var(--red)">⚠️ 막힘: 앞 칸이 이 물건을 받지 않아요</div>' : ''}</div>${common}`);
    }
    if (t.k === 'input') {
      const raws = Object.entries(D.ITEMS).filter(([, v]) => v.raw);
      return shell('📥 입고구', `<div class="card">원자재를 사서 ${DIR_ARROW[t.dir]} 방향 벨트로 내보냅니다. 앞이 막히면 사지 않아요.
        <div class="kv" style="margin-top:6px"><span>최대 입고량</span><b class="dh">분당 ${Math.round(S.inputPerMin())}상자</b></div>
        <div class="kv"><span>분당 최대 원자재비</span><b class="dh">${man(S.inputPerMin() * (D.ITEMS[t.item]?.cost || 0))}</b></div></div>
        <h3 class="sec">들일 원자재</h3>${raws.map(([id, v]) => `<div class="recipe ${t.item === id ? 'on' : ''}" data-a="raw" data-v="${id}">${itemChip(id)}<span class="grow"></span><span class="dh">${man(v.cost)}/상자</span></div>`).join('')}
        <div class="card"><div class="row"><div class="grow"><b>입고</b> <span class="muted">${t.on ? '켜짐' : '꺼짐'}</span></div><button class="btn sm ${t.on ? 'ghost' : 'teal'}" data-a="input-toggle">${t.on ? '멈추기' : '켜기'}</button></div></div>${common}`);
    }
    if (t.k === 'output') {
      const finals = Object.entries(s.inventory).filter(([, n]) => n > 0);
      return shell('📤 출하구', `<div class="card">완성 부품을 받아 창고에 쌓습니다. 주문 물량을 다 채우면 퇴근 때 트럭이 실어 가요.<br/><span class="muted">주문보다 ${D.LOGISTICS.outputBufferLots}상자 넘게 쌓이면 더 받지 않아 라인이 멈춥니다 (원자재 낭비 방지).</span></div>
        <h3 class="sec">창고</h3><div class="card">${finals.length ? finals.map(([it, n]) => {
          const extra = S.surplusLots(s, it);
          return `<div class="kv"><span>${itemChip(it)}</span><b class="dh">${n}상자 <span class="muted">/ 주문 ${S.demandLots(s, it)}</span></b></div>${extra ? `<button class="btn sm ghost full" style="margin:4px 0 6px" data-a="dump" data-v="${it}">남는 ${extra}상자 헐값 처분 (+${man(S.dumpValue(s, it))})</button>` : ''}`;
        }).join('') : '<div class="muted">비어 있음</div>'}</div>
        <div class="btns"><button class="btn ghost sm" data-a="del">🗑️ 철거</button></div>`);
    }
    // 기계
    const def = S.machineDef(t);
    const type = D.MACHINE_TYPES[def.type];
    const w = S.workerOf(s, t);
    const lpd = S.machinePerMin(s, t);
    let statusText = STATUS[t.status] || t.status;
    if (t.status === 'starved' && t.recipe) {
      const need = Object.entries(D.RECIPES[t.recipe].in).filter(([it, n]) => (t.inBuf[it] || 0) < n).map(([it]) => D.ITEMS[it].name);
      statusText += ` — ${need.join(', ')} 필요`;
    }
    const repairCost = Math.round(def.price * D.MACHINE_RULES.repairCostRate);
    const serviceCost = Math.round(def.price * D.MACHINE_RULES.serviceCostRate);
    let body = `<div class="card ${t.broken ? 'bad' : t.status === 'work' ? '' : 'warn'}"><div class="row"><div class="big-ico" style="background:${type.color};color:#fff">${type.icon}</div>
      <div class="grow"><b>${esc(def.name)}</b>${def.auto ? ' <span class="tag ok">자동</span>' : ''}<div class="muted">${esc(statusText)}</div></div></div>
      ${t.broken ? `<button class="btn red full" style="margin-top:10px" data-a="repair" ${t.repairLeft > 0 ? 'disabled' : ''}>${t.repairLeft > 0 ? '수리 중…' : `🛠️ 지금 수리 (${man(repairCost)})`}</button><div class="muted" style="margin-top:4px">놔두면 ${D.MACHINE_RULES.autoRepairAfterSec}초 뒤 외부 업체가 와서 ${D.MACHINE_RULES.autoRepairCostMult}배 비용으로 고칩니다</div>` : ''}</div>
      <div class="card">
        <div class="kv"><span>분당 처리량</span><b class="dh">${lpd.toFixed(1)}상자 / 분</b></div>
        <div class="kv"><span>속도 배율</span><b class="dh">×${S.machineRate(s, t).toFixed(2)}</b></div>
        <div class="kv"><span>불량률</span><b class="dh">${(S.defectRate(s, t) * 100).toFixed(1)}%</b></div>
        <div class="kv"><span>작업자</span><b>${def.auto ? '필요 없음 🤖' : w ? `${esc(w.name)} ${stars(w.skill)}` : '<button class="btn sm red" data-a="sheet" data-v="staff">없음 — 직원 채용 ›</button>'}</b></div>
        <div class="kv"><span>기계 상태</span><span style="width:50%"><div class="bar-mini ${t.cond < 40 ? 'r' : t.cond < 60 ? 'y' : ''}"><i style="width:${t.cond}%"></i></div></span></div>
        <button class="btn ghost sm full" style="margin-top:8px" data-a="service" ${t.serviceLeft > 0 || t.broken || t.cond > 95 ? 'disabled' : ''}>🔧 정비해서 상태 100으로 (${man(serviceCost)})</button>
      </div>
      <h3 class="sec">레시피</h3>`;
    body += S.recipesFor(def.type).map((rid) => {
      const r = D.RECIPES[rid];
      const lock = !S.recipeUnlocked(s, rid);
      const ins = Object.entries(r.in).map(([it, n]) => itemChip(it, n)).join(' + ');
      return `<div class="recipe ${t.recipe === rid ? 'on' : ''} ${lock ? 'lock' : ''}" ${lock ? '' : `data-a="recipe" data-v="${rid}"`}>
        <div class="flow grow">${ins}<span class="arrow">→</span>${itemChip(r.out)}</div><span class="muted" style="text-align:right;white-space:nowrap">${lock ? '🔒 연구' : `분당 ${(t.recipe === rid && lpd ? lpd : S.recipePerMin(rid, def.speed)).toFixed(1)}`}</span></div>`;
    }).join('');
    const ups = Object.entries(D.MACHINES).filter(([id, m]) => m.type === def.type && id !== t.model && S.modelUnlocked(s, id));
    if (ups.length) {
      body += `<h3 class="sec">설비 교체</h3>`;
      const refund = Math.round(def.price * D.MACHINE_RULES.sellRate * Math.max(0.3, t.cond / 100));
      body += ups.map(([id, m]) => {
        const cost = Math.max(0, S.buildCost(s, 'machine', id) - refund);
        return `<div class="card"><div class="row"><div class="grow"><b>${esc(m.name)}</b>${m.auto ? ' <span class="tag ok">작업자 불필요</span>' : ''}<div class="muted">속도 ×${m.speed} · 마모 ×${m.wear} · 기본 분당 ${t.recipe ? S.recipePerMin(t.recipe, m.speed).toFixed(1) : '-'}</div></div><button class="btn sm yel" data-a="upgrade" data-v="${id}" ${s.cash < cost ? 'disabled' : ''}>${man(cost)}</button></div></div>`;
      }).join('');
      body += `<div class="muted" style="padding:0 4px">지금 기계를 ${man(refund)}에 팔고 차액만 냅니다</div>`;
    }
    body += `<button class="btn ${t.enabled === false ? 'teal' : 'ghost'} sm full" data-a="machine-toggle">${t.enabled === false ? '▶ 다시 가동' : '⏸ 이 기계 정지 (작업자를 다른 기계로)'}</button>`;
    body += common;
    return shell(`${type.icon} ${type.name}`, body);
  }

  // ============================================================ 팝업
  function renderPopup() {
    const s = game.s;
    const p = s.popups[0];
    if (!p) { el.popupWrap.classList.add('hidden'); return; }
    el.popupWrap.classList.remove('hidden');
    let html = '';
    if (p.type === 'intro' || p.type === 'help') {
      html = `<div class="story"><div class="pp-hero"><div class="i">🏭</div><h2>아버지의 공장</h2>
        <p>아버지가 30년 지킨 작은 부품 공장.\n남은 건 낡은 프레스와 용접기 한 줄,\n아버지와 같이 늙은 김반장과 박씨,\n그리고 빚 1억.</p></div></div>
        <div class="pp-body">
          <div class="card warn"><b>이 공장을 살려 보자</b>
            <div class="kv"><span>📋 수주</span><span>주문을 받아 납기 안에 상자를 채우세요</span></div>
            <div class="kv"><span>🏗️ 건설</span><span>입고구 → 벨트 → 기계 → 출하구</span></div>
            <div class="kv"><span>⚖️ 병목</span><span>느린 기계 앞에 상자가 밀립니다</span></div>
            <div class="kv"><span>💥 고장</span><span>연기 나는 기계를 눌러 수리</span></div>
            <div class="kv"><span>💰 월말</span><span>10일마다 월급·유지비·이자</span></div></div>
          <div class="muted" style="text-align:center">🎯 목표: 완성차 직납을 따내고 빚을 모두 갚기</div>
          <button class="btn yel full" data-a="pp-ok">공장 문 열기</button></div>`;
    } else if (p.type === 'migrate') {
      html = `<div class="pp-hero"><div class="i">🆕</div><h2>초반이 새로워졌어요</h2><p>첫날 주문, 할 일 안내, 용접 병목이 생겼습니다.\n예전 저장으로는 이 변화가 안 보여요.</p></div>
        <div class="pp-body"><button class="btn yel full" data-a="newgame-now">새 게임으로 시작 (추천)</button><button class="btn ghost full" data-a="pp-ok">지금 공장 계속하기</button></div>`;
    } else if (p.type === 'month') {
      const r = p.rec;
      html = `<div class="pp-hero"><div class="i">${r.net >= 0 ? '📗' : '📕'}</div><h2>${esc(r.label)} 결산</h2><p class="${r.net >= 0 ? 'pos' : 'neg'}" style="font-family:'Do Hyeon';font-size:28px;margin:0">${man(r.net, { sign: true })}</p></div>
        <div class="pp-body">${monthTable(r, true)}
          <div class="card"><div class="kv"><span>현금</span><b class="dh">${man(r.cash)}</b></div><div class="kv"><span>빚</span><b class="dh">${man(r.loan)}</b></div><div class="kv"><span>다음 달 들어올 외상</span><b class="dh">${man(r.receivable)}</b></div></div>
          <button class="btn pri full" data-a="pp-ok">다음 달로</button></div>`;
    } else if (p.type === 'news') {
      const n = p.news;
      html = `<div class="pp-hero"><div class="i">${n.icon}</div><h2>${esc(n.title)}</h2><p>${esc(p.text || n.text)}</p></div><div class="pp-body">
        ${p.choices ? p.choices.map((c, i) => `<button class="btn ${i === 0 ? 'yel' : 'ghost'} full" data-a="pp-choice" data-v="${c.id}">${esc(c.label)}</button>`).join('') : '<button class="btn pri full" data-a="pp-ok">알겠다</button>'}</div>`;
    } else if (p.type === 'story' && p.id === 'veteran') {
      html = `<div class="story"><div class="pp-hero"><div class="i">👴</div><h2>김반장의 은퇴</h2><p>"사장님, 저도 이제 손이 예전 같지가 않습니다.\n아버님 모시고 30년… 이제 쉬려고요."</p></div></div>
        <div class="pp-body"><button class="btn yel full" data-a="pp-choice" data-v="retire">고생하셨습니다 — 퇴직금 ${man(D.STORY.severance)}</button>
        <button class="btn ghost full" data-a="pp-choice" data-v="advisor">고문으로 남아 달라 부탁한다 (월급 절반, 후배 성장 ×2)</button></div>`;
    } else if (p.type === 'gameover') {
      html = `<div class="story"><div class="pp-hero"><div class="i">🏚️</div><h2>부도</h2><p>월말 지급을 못 막았다.\n대출 한도도 바닥났다.\n공장 셔터가 내려간다.</p></div></div>
        <div class="pp-body"><button class="btn yel full" data-a="newgame-now">다시 시작</button></div>`;
    } else if (p.type === 'ending') {
      html = `<div class="story"><div class="pp-hero"><div class="i">🏆</div><h2>아버지, 해냈어요</h2><p>완성차 회사에 우리 부품이 직접 들어간다.\n빚도 다 갚았다.\n${S.dateLabel(s)}, 직원 ${s.workers.length}명.</p></div></div>
        <div class="pp-body"><div class="card"><div class="kv"><span>순자산</span><b class="dh">${man(S.netWorth(s))}</b></div><div class="kv"><span>업적</span><b class="dh">${Object.keys(s.achievements).length}/${Object.keys(D.ACHIEVEMENTS).length}</b></div></div>
        <button class="btn yel full" data-a="pp-ok">공장을 계속 키운다</button></div>`;
    }
    el.popup.innerHTML = html;
  }

  // ============================================================ 토스트
  function pumpToasts() {
    const s = game.s;
    while (s.toasts.length) {
      const t = s.toasts.shift();
      const d = document.createElement('div');
      d.className = 'toast';
      d.textContent = `${t.icon} ${t.text}`;
      el.toasts.prepend(d);
      setTimeout(() => d.remove(), 2600);
      while (el.toasts.children.length > 3) el.toasts.lastChild.remove();
    }
  }

  // ============================================================ 액션
  const act = {
    speed: (v) => { ui.speed = Number(v); renderHud(); },
    ot: () => { S.setOvertime(game.s, !game.s.overtime); renderHud(); if (ui.sheet) renderSheet(); },
    sheet: (v, e) => openSheet(v, { tab: e.dataset.tab }),
    close: () => closeSheet(),
    tab: (v) => { ui.sheet.tab = v; renderSheet(); },
    build: () => { ui.buildMode = true; ui.tool = ui.tool || { kind: 'belt' }; ui.selected = null; renderBar(); renderBuildHint(); renderQuest(); },
    'build-done': () => { ui.buildMode = false; game.r.ghost = null; renderBar(); renderBuildHint(); renderQuest(); game.save(); },
    tool: (v) => { const p = PALETTE[Number(v)]; ui.tool = { kind: p.kind, model: p.model }; renderBar(); renderBuildHint(); },
    dir: () => { ui.dir = (ui.dir + 1) % 4; renderBuildHint(); },
    quest: () => openSheet('quest'),
    'quest-go': (v) => {
      closeSheet();
      if (v === 'build-split') { ui.buildMode = true; const i = PALETTE.findIndex((p) => p.kind === 'split'); ui.tool = { kind: 'split' }; renderBar(); renderBuildHint(); renderQuest(); return i; }
      if (v === 'orders-active') return openSheet('orders', { tab: 'active' });
      if (v === 'orders-clients') return openSheet('orders', { tab: 'clients' });
      openSheet(v);
    },
    process: (v) => { const back = ui.sheet ? { type: ui.sheet.type, tab: ui.sheet.tab } : null; ui.sheet = { type: 'process', item: v, back }; renderSheet(); },
    'process-back': () => { const b = ui.sheet.back; ui.sheet = { ...b }; renderSheet(); },
    accept: (v) => { S.acceptOffer(game.s, Number(v)); ordersSig = ''; renderSheet(); renderOrders(); renderBar(); },
    decline: (v) => { S.declineOffer(game.s, Number(v)); renderSheet(); renderBar(); },
    hire: (v) => result(S.hire(game.s, Number(v))),
    fire: (v) => result(S.fire(game.s, Number(v))),
    bonus: () => result(S.payBonus(game.s), (r) => `보너스 지급 ${man(r.msg)}`),
    borrow: () => result(S.borrow(game.s, D.FINANCE.loanStep)),
    repay: () => result(S.repay(game.s, D.FINANCE.loanStep)),
    'repay-all': () => result(S.repay(game.s, game.s.loan)),
    cert: (v) => result(S.buyCert(game.s, v), () => `${D.CERTS[v].name} 인증 획득!`),
    research: (v) => result(S.startResearch(game.s, v), () => `${D.RESEARCH[v].name} 시작`),
    expand: () => result(S.expandFloor(game.s), () => '공장이 넓어졌어요!'),
    rot: () => { S.rotate(game.s, ui.sheet.x, ui.sheet.y); renderSheet(); },
    del: () => { const r = S.removeAt(game.s, ui.sheet.x, ui.sheet.y); if (r.ok) toastNow(`철거 +${man(r.msg)}`); closeSheet(); },
    raw: (v) => { S.setInputItem(game.s, ui.sheet.x, ui.sheet.y, v); renderSheet(); },
    'machine-toggle': () => { S.toggleMachine(game.s, ui.sheet.x, ui.sheet.y); renderSheet(); },
    dump: (v) => result(S.dumpStock(game.s, v), (r) => `재고 처분 +${man(r.msg)}`),
    'input-toggle': () => { S.toggleInput(game.s, ui.sheet.x, ui.sheet.y); renderSheet(); },
    recipe: (v) => { S.setRecipe(game.s, ui.sheet.x, ui.sheet.y, v); renderSheet(); },
    repair: () => result(S.repair(game.s, ui.sheet.x, ui.sheet.y), () => '수리 시작'),
    service: () => result(S.service(game.s, ui.sheet.x, ui.sheet.y), () => '정비 시작'),
    upgrade: (v) => result(S.upgradeMachine(game.s, ui.sheet.x, ui.sheet.y, v), () => `${D.MACHINES[v].name} 설치!`),
    newgame: () => { if (confirmBox('정말 처음부터 시작할까요? 지금 공장은 사라집니다.')) game.newGame(); },
    'newgame-now': () => game.newGame(),
    help: () => { game.s.popups.unshift({ type: 'help' }); closeSheet(); renderPopup(); },
    'pp-ok': () => { S.resolvePopup(game.s); afterPopup(); },
    'pp-choice': (v) => { S.resolvePopup(game.s, v); afterPopup(); },
  };
  function afterPopup() { renderPopup(); renderAll(); game.save(); }
  function confirmBox(msg) { return window.confirm(msg); }
  function result(r, okMsg) {
    if (!r.ok) { if (r.msg) toastNow(`⚠️ ${r.msg}`); }
    else if (okMsg) toastNow(typeof okMsg === 'function' ? okMsg(r) : okMsg);
    renderSheet(); renderHud(); renderOrders(); renderBar();
  }
  function toastNow(text) { game.s.toasts.push({ icon: '', text, id: Math.random() }); pumpToasts(); }

  document.getElementById('app').addEventListener('click', (e) => {
    const t = e.target.closest('[data-a]');
    if (t) { const f = act[t.dataset.a]; if (f) f(t.dataset.v, t); return; }
    if (e.target === el.sheetWrap) closeSheet();
  });

  // ============================================================ 캔버스 입력
  let down = null;
  el.canvas.addEventListener('pointerdown', (e) => {
    el.canvas.setPointerCapture(e.pointerId);
    const p = pos(e);
    down = { x: p.x, y: p.y, sy: game.r.scrollY, moved: false, last: game.r.toTile(game.s, p.x, p.y), painting: ui.buildMode && ui.tool?.kind === 'belt', painted: false };
  });
  el.canvas.addEventListener('pointermove', (e) => {
    const p = pos(e);
    if (ui.buildMode) updateGhost(p);
    if (!down) return;
    const dist = Math.hypot(p.x - down.x, p.y - down.y);
    if (dist > 8) down.moved = true;
    if (down.painting) {
      const t = game.r.toTile(game.s, p.x, p.y);
      if (t && down.last && (t.x !== down.last.x || t.y !== down.last.y)) {
        paintStep(down.last, t);
        down.last = t; down.painted = true;
      }
    } else if (down.moved) {
      game.r.scrollY = down.sy - (p.y - down.y);
    }
  });
  el.canvas.addEventListener('pointerup', (e) => {
    const p = pos(e);
    if (down && !down.moved && !down.painted) tap(p);
    down = null;
  });
  el.canvas.addEventListener('pointercancel', () => { down = null; });
  el.canvas.addEventListener('wheel', (e) => { game.r.scrollY += e.deltaY; e.preventDefault(); }, { passive: false });

  function pos(e) { const r = el.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  function paintStep(a, b) {
    const s = game.s;
    // 한 칸씩만 (대각선은 가로 먼저)
    let cx = a.x, cy = a.y;
    while (cx !== b.x || cy !== b.y) {
      let d;
      if (cx !== b.x) d = b.x > cx ? 0 : 2; else d = b.y > cy ? 1 : 3;
      const prev = S.tile(s, cx, cy);
      if (!prev) { const r = S.build(s, cx, cy, 'belt', { dir: d }); if (!r.ok) { toastNow(`⚠️ ${r.msg}`); return; } }
      else if (prev.k === 'belt') S.setBeltDir(s, cx, cy, d);
      cx += Math.sign(b.x - cx) * (d === 0 || d === 2 ? 1 : 0);
      cy += Math.sign(b.y - cy) * (d === 1 || d === 3 ? 1 : 0);
      const cur = S.tile(s, cx, cy);
      if (!cur) { const r = S.build(s, cx, cy, 'belt', { dir: d }); if (!r.ok) { toastNow(`⚠️ ${r.msg}`); return; } }
      else if (cur.k === 'belt') S.setBeltDir(s, cx, cy, d);
      ui.dir = d;
    }
    renderHud(); renderBuildHint();
  }

  function updateGhost(p) {
    const t = game.r.toTile(game.s, p.x, p.y);
    if (!t || !ui.tool) { game.r.ghost = null; return; }
    const occ = S.tile(game.s, t.x, t.y);
    const placing = !['remove', 'rotate'].includes(ui.tool.kind);
    game.r.ghost = { ...t, valid: placing ? !occ : !!occ, dir: placing ? ui.dir : null };
  }

  function tap(p) {
    const s = game.s;
    const t = game.r.toTile(s, p.x, p.y);
    if (!t) return;
    const cur = S.tile(s, t.x, t.y);
    if (ui.buildMode) {
      const k = ui.tool?.kind;
      if (!k) return;
      if (k === 'remove') { if (cur) { const r = S.removeAt(s, t.x, t.y); toastNow(`철거 +${man(r.msg)}`); } }
      else if (k === 'rotate') { if (cur) S.rotate(s, t.x, t.y); }
      else if (cur && cur.k === 'belt' && k !== 'belt') {
        // 벨트 위에 바로 설치: 벨트를 걷어 내고 같은 방향으로 놓는다
        const dir = cur.dir;
        const items = cur.items.length;
        S.removeAt(s, t.x, t.y);
        const r = S.build(s, t.x, t.y, k, { dir, model: ui.tool.model });
        if (!r.ok) { S.build(s, t.x, t.y, 'belt', { dir }); toastNow(`⚠️ ${r.msg}`); }
        else { ui.dir = dir; toastNow(`벨트 자리에 설치${items ? ` (상자 ${items}개 버림)` : ''}`); }
      }
      else if (cur) {
        const same = cur.k === k && (k !== 'machine' || D.MACHINES[cur.model].type === D.MACHINES[ui.tool.model].type);
        if (same && cur.k !== 'output') { S.rotate(s, t.x, t.y); ui.dir = cur.dir; }
        else { ui.selected = t; openSheet('inspect', t); }
      } else {
        const r = S.build(s, t.x, t.y, k, { dir: ui.dir, model: ui.tool.model });
        if (!r.ok) toastNow(`⚠️ ${r.msg}`);
        else if (k === 'machine') toastNow(`${D.MACHINES[ui.tool.model].name} 설치 · 레시피는 완료 후 탭`);
      }
      renderHud(); renderBuildHint(); updateGhost(p);
      return;
    }
    if (!cur) return;
    if (cur.k === 'machine' && cur.broken && cur.repairLeft <= 0) {
      const r = S.repair(s, t.x, t.y);
      toastNow(r.ok ? `🛠️ 수리 시작 (${man(r.msg)})` : `⚠️ ${r.msg}`);
      renderHud();
      return;
    }
    ui.selected = t;
    openSheet('inspect', t);
  }

  function renderAll() { renderHud(); renderOrders(); renderBar(); renderBuildHint(); renderQuest(); renderSheet(); renderPopup(); }

  return { renderAll, renderHud, renderOrders, renderBar, renderPopup, renderSheet, renderQuest, pumpToasts, closeSheet };
}
