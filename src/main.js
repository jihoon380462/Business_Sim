// 부트 · 게임 루프 · 저장
import * as D from './data.js';
import * as S from './sim.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';

const game = {
  s: null,
  ui: { speed: 1, sheet: null, buildMode: false, tool: null, dir: 0, selected: null },
  r: null, view: null,
  save() { try { localStorage.setItem(D.SAVE_KEY, S.serialize(game.s)); } catch (e) { /* 저장 불가 환경 */ } },
  newGame() {
    game.s = S.createGame((Date.now() ^ (performance.now() * 1000)) | 0);
    game.ui.sheet = null; game.ui.buildMode = false; game.ui.speed = 1; game.r.scrollY = 0;
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
  game.s = load() || S.createGame((Date.now() ^ (performance.now() * 1000)) | 0);
  game.view = createUI(game);
  if (!game.s.popups.length && game.s.monthIndex + game.s.day > 1) game.ui.speed = 0; // 이어하기는 일시정지로 시작
  game.view.renderAll();
  window.addEventListener('resize', () => game.r.resize());
  document.addEventListener('visibilitychange', () => { if (document.hidden) { game.save(); game.ui.speed = 0; game.view.renderHud(); } });
  document.getElementById('boot').remove();
  window.__game = game; window.__S = S; // 디버그

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
    if (hudTimer > 0.2) { hudTimer = 0; game.view.renderHud(); game.view.renderOrders(); }
    if (s.popups.length !== lastPopups) {
      lastPopups = s.popups.length;
      game.view.renderPopup(); game.view.renderBar();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

boot();
