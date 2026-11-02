// 렌더 루프 · 주 타이머·속도 · 모달 매니저(창 열림 = 정지) · 저장.
// core 를 호출만 하고 수치 계산은 하지 않는다.
import * as core from '../core/index.js';
import { renderTopbar } from './components/topbar.js';
import { renderSpeed } from './components/speed.js';
import { renderMainPanel } from './components/mainPanel.js';
import { renderFeed } from './components/feed.js';
import { renderTabs } from './components/tabs.js';
import { modalShell, popupShell } from './components/modal.js';
import * as activity from './screens/activity.js';
import * as stocks from './screens/stocks.js';
import * as business from './screens/business.js';
import * as people from './screens/people.js';
import * as settings from './screens/settings.js';
import * as logScreen from './screens/log.js';
import * as eventPopup from './screens/eventPopup.js';
import * as report from './screens/report.js';
import * as confirm from './screens/confirm.js';
import * as start from './screens/start.js';

const SCREENS = { activity, stocks, business, people, settings, log: logScreen };
const POPUPS = { event: eventPopup, report, confirm, start };

export function createApp(data) {
  core.setData(data);
  const cfg = data.config;

  const app = {
    data,
    state: null,
    ui: {
      speed: 0, // 0 = ⏸, 1, 2
      accum: 0, // 현재 주 진행 ms
      modal: null, // 열린 창 id
      popup: null, // { type, ...props }
      scratch: {}, // 화면별 임시 선택값
    },
    el: {},
    lastTs: null,
    rafId: null,
  };

  // ---------- 에셋 ----------
  app.asset = (name) => `${cfg.useArt ? 'assets/img' : 'assets/placeholder'}/${name}`;

  // ---------- 상태 ----------
  app.dispatch = (next, { save = false } = {}) => {
    if (next && next !== app.state) app.state = next;
    if (save) app.save();
    app.render();
  };

  app.save = () => {
    try {
      localStorage.setItem(cfg.saveKey, core.serialize(app.state));
    } catch (e) {
      console.warn('save failed', e);
    }
  };

  app.loadSave = () => {
    try {
      const raw = localStorage.getItem(cfg.saveKey);
      if (!raw) return null;
      return core.deserialize(raw);
    } catch (e) {
      console.warn('load failed', e);
      return null;
    }
  };

  app.hasSave = () => !!localStorage.getItem(cfg.saveKey);

  app.newGame = () => {
    const seed = (Date.now() ^ Math.floor(performance.now() * 1000)) | 0;
    app.state = core.createInitialState(seed);
    app.ui.accum = 0;
    app.ui.speed = 0;
    app.ui.scratch = {};
    app.save();
    app.render();
  };

  app.continueGame = () => {
    const s = app.loadSave();
    if (s) app.state = s;
    else app.state = core.createInitialState(1);
    app.ui.accum = 0;
    app.ui.speed = 0;
    app.ui.scratch = {};
    app.render();
  };

  // ---------- 모달 매니저 ----------
  app.isPaused = () => app.ui.speed === 0 || !!app.ui.modal || !!app.ui.popup || document.hidden;

  app.openModal = (id) => {
    if (app.ui.modal === id) return;
    app.ui.modal = id;
    app.ui.scratch = {};
    app.render();
  };

  app.closeModal = () => {
    if (!app.ui.modal) return;
    app.ui.modal = null;
    app.ui.scratch = {};
    app.save();
    app.render();
  };

  app.openPopup = (popup) => {
    app.ui.popup = popup;
    app.render();
  };

  app.closePopup = () => {
    app.ui.popup = null;
    app.save();
    app.render();
  };

  app.setSpeed = (speed) => {
    app.ui.speed = speed;
    app.render();
  };

  // ---------- 타이머 ----------
  app.advance = () => {
    app.state = core.advanceWeek(app.state);
    app.save();
    app.checkPending();
  };

  /** 선택형 이벤트·결산 리포트가 대기 중이면 팝업을 연다 */
  app.checkPending = () => {
    if (app.ui.popup) return;
    if (app.state.events.pending) app.ui.popup = { type: 'event' };
    else if (app.state.goal.pendingReport) app.ui.popup = { type: 'report', report: app.state.goal.pendingReport };
  };

  app.tick = (ts) => {
    app.rafId = requestAnimationFrame(app.tick);
    if (app.lastTs == null) { app.lastTs = ts; return; }
    const dt = Math.min(250, ts - app.lastTs);
    app.lastTs = ts;
    if (!app.state || app.isPaused()) return;
    app.ui.accum += dt * app.ui.speed;
    let advanced = false;
    while (app.ui.accum >= cfg.weekDurationMs && !app.isPaused()) {
      app.ui.accum -= cfg.weekDurationMs;
      app.advance();
      advanced = true;
    }
    if (app.ui.popup) app.ui.accum = 0;
    app.renderHud();
    if (advanced) app.render();
  };

  // ---------- 렌더 ----------
  app.renderHud = () => {
    app.el.topbar.innerHTML = renderTopbar(app);
    app.el.speed.innerHTML = renderSpeed(app);
  };

  app.render = () => {
    if (!app.state) return;
    app.renderHud();
    app.el.main.innerHTML = renderMainPanel(app);
    app.el.feed.innerHTML = renderFeed(app);
    app.el.tabs.innerHTML = renderTabs(app);

    const hasModal = !!app.ui.modal;
    const hasPopup = !!app.ui.popup;
    app.el.overlay.classList.toggle('hidden', !hasModal && !hasPopup);
    app.el.modal.classList.toggle('hidden', !hasModal);
    app.el.popup.classList.toggle('hidden', !hasPopup);
    if (hasModal) {
      const scr = SCREENS[app.ui.modal];
      app.el.modal.innerHTML = modalShell(scr.title(app), scr.render(app), scr.footer ? scr.footer(app) : '');
    }
    if (hasPopup) {
      const pp = POPUPS[app.ui.popup.type];
      app.el.popup.innerHTML = popupShell(pp.render(app));
    }
  };

  // ---------- 액션 ----------
  const actions = {
    'app.speed': (app, el) => app.setSpeed(Number(el.dataset.v)),
    'app.tab': (app, el) => {
      const id = el.dataset.v;
      if (app.ui.modal === id) app.closeModal();
      else app.openModal(id);
    },
    'app.close': (app) => app.closeModal(),
    'app.openLog': (app) => app.openModal('log'),
    'app.overlay': (app, el, ev) => {
      if (ev.target !== el) return; // 창 내부 탭은 무시
      if (app.ui.popup) return; // 팝업은 배경 탭으로 닫지 않음
      app.closeModal();
    },
  };
  for (const mod of [...Object.values(SCREENS), ...Object.values(POPUPS)]) {
    Object.assign(actions, mod.actions || {});
  }

  app.handleEvent = (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const fn = actions[el.dataset.action];
    if (!fn) return;
    fn(app, el, ev);
  };

  // ---------- 시작 ----------
  app.mount = () => {
    app.el = {
      topbar: document.getElementById('topbar'),
      speed: document.getElementById('speed'),
      main: document.getElementById('main-panel'),
      feed: document.getElementById('feed'),
      tabs: document.getElementById('tabs'),
      overlay: document.getElementById('overlay'),
      modal: document.getElementById('modal'),
      popup: document.getElementById('popup'),
    };
    app.el.overlay.dataset.action = 'app.overlay';
    document.getElementById('app').addEventListener('click', app.handleEvent);
    document.getElementById('app').addEventListener('change', (ev) => {
      const el = ev.target.closest('[data-change]');
      if (!el) return;
      const fn = actions[el.dataset.change];
      if (fn) fn(app, el, ev);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { app.ui.speed = 0; }
      app.lastTs = null;
      app.render();
    });

    if (app.hasSave()) {
      app.state = app.loadSave() || core.createInitialState(1);
      app.ui.popup = { type: 'start' };
    } else {
      app.newGame();
    }
    app.checkPending();
    app.render();
    document.getElementById('boot').remove();
    app.rafId = requestAnimationFrame(app.tick);
  };

  return app;
}
