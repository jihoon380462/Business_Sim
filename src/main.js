// core 와 ui 를 연결하는 유일한 지점. 데이터 JSON 을 읽어 core 에 주입하고 앱을 띄운다.
import { createApp } from './ui/app.js';

const FILES = ['config', 'jobs', 'stocks', 'businesses', 'events', 'characters'];

async function loadData() {
  const entries = await Promise.all(
    FILES.map(async (name) => {
      const res = await fetch(`src/data/${name}.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`failed to load ${name}.json`);
      return [name, await res.json()];
    }),
  );
  return Object.fromEntries(entries);
}

loadData()
  .then((data) => {
    const app = createApp(data);
    window.__app = app; // 디버그용
    app.mount();
  })
  .catch((err) => {
    console.error(err);
    const boot = document.getElementById('boot');
    if (boot) boot.textContent = `데이터 로드 실패: ${err.message}\n(file:// 로 열었다면 로컬 서버로 열어주세요)`;
  });
