// 렌더 · "다음 달" 버튼 → advanceMonth · 모달 매니저 · 저장.
// core 를 호출만 하고 수치 계산은 하지 않는다.
import * as core from '../core/index.js';
import { renderTopbar } from './components/topbar.js';
import { renderMainPanel } from './components/mainPanel.js';
import { renderFeed } from './components/feed.js';
import { renderTabs } from './components/tabs.js';
import { renderNextButton } from './components/nextButton.js';
import { modalShell, popupShell } from './components/modal.js';
import * as activity from './screens/activity.js';
import * as stocks from './screens/stocks.js';
import * as business from './screens/business.js';
import * as me from './screens/me.js';
import * as settings from './screens/settings.js';
import * as logScreen from './screens/log.js';
import * as eventPopup from './screens/eventPopup.js';
import * as summary from './screens/summary.js';
import * as report from './screens/report.js';
import * as confirm from './screens/confirm.js';
import * as start from './screens/start.js';

const SCREENS = { activity, stocks, business, me, settings, log: logScreen };
const POPUPS = { event: eventPopup, summary, report, confirm, start };

export function createApp(data) {
  core.setData(data);
  const cfg = data.config;

  const app = {
    data,
    state: null,
    ui: { modal: null, popup: null, scratch: {}, busy: false },
    el: {},
  };

  app.asset = (name) => `${cfg.useArt ? 'assets/img' : 'assets/placeholder'}/${name}`;

  // ---------- 상태 · 저장 ----------
  app.dispatch = (next, { save = false } = {}) => {
    if (next && next !== app.state) app.state = next;
    if (save) app.save();
    app.render();
  };

  app.save = () => {
    try { localStorage.setItem(cfg.saveKey, core.serialize(app.state)); } catch (e) { console.warn('save failed', e); }
  };

  app.loadSave = () => {
    try {
      const raw = localStorage.getItem(cfg.saveKey);
      if (!raw) return null;
      return core.deserialize(raw); // 구버전이면 null
    } catch (e) { console.warn('load failed', e); return null; }
  };

  app.hasSave = () => !!localStorage.getItem(cfg.saveKey);

  app.newGame = () => {
    const seed = (Date.now() ^ Math.floor(performance.now() * 1000)) | 0;
    app.state = core.createInitialState(seed);
    app.ui.scratch = {};
    app.save();
    app.render();
  };

  app.continueGame = () => {
    app.state = app.loadSave() || core.createInitialState(1);
    app.ui.scratch = {};
    app.render();
  };

  // ---------- 모달 매니저 ----------
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

  app.openPopup = (popup) => { app.ui.popup = popup; app.render(); };
  app.closePopup = () => { app.ui.popup = null; app.save(); app.render(); };

  // ---------- 턴 진행 ----------
  app.nextMonth = () => {
    if (app.ui.busy || app.ui.modal || app.ui.popup) return;
    app.ui.busy = true;
    app.render();
    app.state = core.advanceMonth(app.state);
    app.save();
    app.ui.busy = false;
    app.ui.popup = { type: 'summary' };
    app.render();
  };

  /** 결산 팝업 닫은 뒤: 선택형 이벤트 → 결산 리포트 순으로 이어서 연다 */
  app.checkPending = () => {
    if (app.ui.popup) return;
    if (app.state.events.pending) app.ui.popup = { type: 'event' };
    else if (app.state.goal.pendingReport) app.ui.popup = { type: 'report', report: app.state.goal.pendingReport };
  };

  // ---------- 렌더 ----------
  app.render = () => {
    if (!app.state) return;
    app.el.topbar.innerHTML = renderTopbar(app);
    app.el.main.innerHTML = renderMainPanel(app);
    app.el.feed.innerHTML = renderFeed(app);
    app.el.next.innerHTML = renderNextButton(app);
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
    'app.next': (app) => app.nextMonth(),
    'app.tab': (app, el) => {
      const id = el.dataset.v;
      if (app.ui.modal === id) app.closeModal();
      else app.openModal(id);
    },
    'app.open': (app, el) => app.openModal(el.dataset.v),
    'app.close': (app) => app.closeModal(),
    'app.openLog': (app) => app.openModal('log'),
    'app.overlay': (app, el, ev) => {
      if (ev.target !== el) return;
      if (app.ui.popup) return;
      app.closeModal();
    },
  };
  for (const mod of [...Object.values(SCREENS), ...Object.values(POPUPS)]) Object.assign(actions, mod.actions || {});

  app.handleEvent = (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const fn = actions[el.dataset.action];
    if (fn) fn(app, el, ev);
  };

  // ---------- 시작 ----------
  app.mount = () => {
    app.el = {
      topbar: document.getElementById('topbar'),
      main: document.getElementById('main-panel'),
      feed: document.getElementById('feed'),
      next: document.getElementById('next'),
      tabs: document.getElementById('tabs'),
      overlay: document.getElementById('overlay'),
      modal: document.getElementById('modal'),
      popup: document.getElementById('popup'),
    };
    app.el.overlay.dataset.action = 'app.overlay';
    const root = document.getElementById('app');
    root.addEventListener('click', app.handleEvent);
    root.addEventListener('change', (ev) => {
      const el = ev.target.closest('[data-change]');
      if (!el) return;
      const fn = actions[el.dataset.change];
      if (fn) fn(app, el, ev);
    });

    if (app.hasSave()) {
      const loaded = app.loadSave();
      if (loaded) {
        app.state = loaded;
        app.ui.popup = { type: 'start' };
      } else {
        app.newGame();
        app.ui.popup = { type: 'confirm', title: '저장 호환 안내', text: '이전 버전(실시간 주 단위)의 저장은 새 구조와 맞지 않아 새 게임으로 시작합니다.', ok: '확인', cancel: '닫기', onOk: () => {} };
      }
    } else {
      app.newGame();
    }
    app.checkPending();
    app.render();
    document.getElementById('boot').remove();
  };

  return app;
}
