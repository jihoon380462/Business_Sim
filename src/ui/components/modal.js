/** 창 껍데기: 제목 + 닫기 X + 본문 + (선택) 하단 */
export function modalShell(title, body, footer = '') {
  return `
    <div class="m-head"><h2>${title}</h2><button class="m-close" data-action="app.close" aria-label="닫기">×</button></div>
    <div class="m-body">${body}</div>
    ${footer ? `<div class="m-foot">${footer}</div>` : ''}`;
}

/** 팝업 껍데기 (닫기 X 없음. 내용이 버튼으로 닫는다) */
export function popupShell(body) {
  return body;
}
