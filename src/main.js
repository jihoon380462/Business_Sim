// 부트 · 게임 루프 · 저장
import * as D from './data.js?v=1.4.0';
import * as S from './sim.js?v=1.4.0';
import { createRenderer } from './render.js?v=1.4.0';
import { createUI } from './ui.js?v=1.4.0';

const game = {
  s: null,
  ui: { speed: 1, sheet: null, buildMode: false, tool: null, dir: 0, selected: null },
  r: null, view: null,
  save() { try { localStorage.setItem(D.SAVE_KEY, S.serialize(game.s)); } catch (e) { /* 저장 불가 환경 */ } },
  newGame() {
    game.s = S.createGame((Date.now() ^ (performance.now() * 1000)) | 0);
    game.ui.sheet = null; game.ui.buildMode = false; game.ui.speed = 1; game.r.fit();
    game.save();
    game.view.closeSheet();
    game.view.renderAll();
  },
};

function load() {
  try { const raw = localStorage.getItem(D.SAVE_KEY); return raw ? S.deserialize(raw) : null; } catch { return null; }
}

function boot() {
  const canvas = document.getElementById('floor');
  game.r = createRenderer(canvas);
  game.r.resize();
  const loaded = load();
  game.s = loaded || S.createGame((Date.now() ^ (performance.now() * 1000)) | 0);
  if (loaded && loaded.quest === undefined) loaded.popups.unshift({ type: 'migrate' }); // 1.2 이전 저장
  game.view = createUI(game);
  if (!game.s.popups.length && game.s.monthIndex + game.s.day > 1) game.ui.speed = 0; // 이어하기는 일시정지로 시작
  game.view.renderAll();
  window.addEventListener('resize', () => game.r.resize());
  if (window.ResizeObserver) new ResizeObserver(() => game.r.sync()).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { game.save(); game.ui.speed = 0; game.view.renderHud(); } });
  document.getElementById('boot').remove();
  window.__game = game; window.__S = S; // 디버그

  checkUpdate();
  setInterval(checkUpdate, 5 * 60 * 1000);

  let last = performance.now();
  let hudTimer = 0;
  let lastPopups = 0;
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const s = game.s;
    const paused = game.ui.speed === 0 || !!game.ui.sheet || s.popups.length > 0;
    if (!paused) {
      const dayBefore = S.absDay(s);
      S.tick(s, dt, D.TIME.speeds[game.ui.speed - 1]);
      if (S.absDay(s) !== dayBefore || s.fx.some((f) => f.type === 'dayEnd')) game.save();
    }
    game.r.consumeFx(s);
    game.r.draw(s, dt, game.ui);
    game.view.pumpToasts();
    hudTimer += dt;
    if (hudTimer > 0.2) {
      hudTimer = 0;
      if (S.checkQuest(s) && game.ui.sheet?.type === 'quest') game.view.renderSheet();
      game.view.renderHud(); game.view.renderOrders(); game.view.renderQuest();
    }
    if (s.popups.length !== lastPopups) {
      lastPopups = s.popups.length;
      game.view.renderPopup(); game.view.renderBar();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/** 배포된 version.json 과 지금 실행 중인 버전이 다르면 새로고침 안내 */
async function checkUpdate() {
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { version } = await res.json();
    if (version && version !== D.VERSION && !document.getElementById('update-bar')) {
      const b = document.createElement('button');
      b.id = 'update-bar'; b.className = 'update-bar';
      b.innerHTML = `🔄 새 버전 v${version}이 나왔어요 — 눌러서 업데이트 <small>(지금 v${D.VERSION})</small>`;
      b.onclick = () => { game.save(); location.replace(`${location.pathname}?v=${version}&t=${Date.now()}`); };
      document.getElementById('app').appendChild(b);
    }
  } catch { /* 오프라인 */ }
}

boot();
