# 아버지의 공장

아버지에게 물려받은 작은 볼트 공장을 키우는 세로 모바일 웹게임.
탑뷰 격자 위에 입고구 → 벨트 → 기계 → 출하구를 직접 깔아 생산 라인을 설계하고 (팩토리오식),
수주·직원·빚·인증을 경영한다.

- 지금은 **볼트 하나**만, 미니게임처럼 가볍게: 절삭(강봉 → 선반, 싸고 느림) vs 성형(선재 → 헤더 → 전조기, 비싸고 3배 빠름·금형 교체비),
  열처리로 고강도 볼트(8.8)
- 플레이: https://jihoon380462.github.io/Business_Sim/
- 구조: `src/data.js`(밸런스) · `src/sim.js`(시뮬, DOM 없음) · `src/render.js`(캔버스) · `src/ui.js`(화면) · `src/main.js`(루프)
- 테스트: `node tests/run.js`
- 이전 버전: 브랜치 `archive/v1.3.1-multi-product`(여러 부품판), `archive/plan-v2-monthly`(월 턴제 경영 시뮬), `v1-realtime`(실시간 주 단위)
