export function renderSpeed(app) {
  const paused = app.ui.speed === 0 || !!app.ui.modal || !!app.ui.popup;
  const sp = app.data.config.speeds;
  const btn = (v, label) => {
    const on = v === 0 ? paused : !paused && app.ui.speed === v;
    return `<button class="${on ? 'on' : ''}" data-action="app.speed" data-v="${v}" aria-label="속도 ${label}">${label}</button>`;
  };
  return `<div class="grp">${btn(0, '⏸')}${btn(sp[0], '▶')}${btn(sp[1], `${sp[1]}x`)}</div>`;
}
