// 밸런스 데이터 레지스트리.
// main.js(또는 테스트)가 src/data/*.json 을 읽어 setData() 로 한 번 주입한다.
// core 는 fetch·DOM 을 모르며, 이 모듈을 통해서만 수치를 읽는다.

let DATA = null;

export function setData(data) {
  DATA = data;
}

export function getData() {
  if (!DATA) throw new Error('core data not loaded: call setData() first');
  return DATA;
}

export const D = {
  get config() { return getData().config; },
  get jobs() { return getData().jobs; },
  get stocks() { return getData().stocks; },
  get businesses() { return getData().businesses; },
  get events() { return getData().events; },
  get characters() { return getData().characters; },
};

export function findJob(id) {
  return D.jobs.activities.find((a) => a.id === id);
}

export function findStock(id) {
  return D.stocks.symbols.find((s) => s.id === id);
}

export function findBusinessType(id) {
  return D.businesses.types.find((t) => t.id === id);
}
