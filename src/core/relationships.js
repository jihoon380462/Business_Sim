// 인물·호감도. V1 은 빈 틀만 (V2 에서 설계).
export function listCharacters(state) {
  return Object.values(state.relationships || {});
}
