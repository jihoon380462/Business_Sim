const TABS = [
  { id: 'activity', ico: '🏃', label: '활동' },
  { id: 'stocks', ico: '📊', label: '주식' },
  { id: 'business', ico: '🏪', label: '사업' },
  { id: 'me', ico: '🧍', label: '나' },
  { id: 'settings', ico: '⚙️', label: '설정' },
];

export function renderTabs(app) {
  return TABS.map(
    (t) => `<button class="${app.ui.modal === t.id ? 'on' : ''}" data-action="app.tab" data-v="${t.id}">
      <span class="ico">${t.ico}</span><span>${t.label}</span></button>`,
  ).join('');
}
