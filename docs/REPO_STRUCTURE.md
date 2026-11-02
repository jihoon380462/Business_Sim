# 저장소 구조 (웹 프로토타입)

## 담당 구획

저장소는 세 구획으로 나뉘고, **각 구획은 담당자만 수정한다.** 남의 구획에 할 말이 있으면 `docs/REQUESTS.md`에 적는다.

| 구획 | 담당 | 폴더 | 역할 |
|---|---|---|---|
| 기획 | 기획 방 (이 채팅) | `docs/`, `art/STYLE_GUIDE.md`, `art/ORDER_TEMPLATE.md`, `art/orders/` | 무엇을 만들지 정한다. 수치 초안, 범위, 아트 주문 |
| 개발 | 개발 방 (별도 채팅) | `src/`, `tests/`, `index.html`, `assets/placeholder/` | 기획 문서대로 만든다. 밸런스 JSON 값은 플레이 결과 보고 조정 가능 |
| 자산 | 사용자 | `art/review/`, `assets/img/`, `assets/audio/` | GPT 결과물 반입, 검수 통과분 배치 |

개발 방이 처음 받는 문서: `docs/HANDOFF_V1.md` (착수 지시서, 기획 방이 작성). 그 문서가 나머지 문서를 가리킨다.

핵심 원칙 하나: **`src/core/`는 화면을 모른다.**
`document`, `window`, DOM 접근 금지. 입력은 상태(state) 객체, 출력은 새 상태.
나중에 Unity로 이식할 때 `core/` + `data/`만 C#으로 옮기고 `ui/`는 버린다.

```
Business_Sim/
├── index.html                ← [개발] 진입점. 세로 모바일 뷰포트 고정
├── src/                      ← [개발]
│   ├── main.js               ← core와 ui를 연결하는 유일한 지점
│   ├── core/                 ← 게임 로직 (순수 JS, 이식 대상)
│   │   ├── state.js          ← 상태 정의, 초기값, 직렬화(저장/불러오기)
│   │   ├── time.js           ← advanceWeek, N년차 M주, 계절 (타이머는 ui 담당)
│   │   ├── economy.js        ← 자금, 수입/지출, 생활비, 대출, 신용
│   │   ├── jobs.js           ← 알바
│   │   ├── stocks.js         ← 주식 시장 시뮬레이션
│   │   ├── business.js       ← 사업체 (개업·운영·직원·업그레이드)
│   │   ├── relationships.js  ← 인물·호감도 (V1은 빈 틀만)
│   │   ├── events.js         ← 랜덤 이벤트 선택·적용
│   │   └── rng.js            ← 시드 기반 난수 (테스트·재현용)
│   ├── data/                 ← 밸런스 수치 (JSON). 초안은 기획이 주고, 조정은 개발이
│   │   ├── config.json       ← 초기 자금, 생활비, 주/년 길이, 단계 진입 조건
│   │   ├── jobs.json
│   │   ├── stocks.json
│   │   ├── businesses.json
│   │   ├── characters.json   ← 연애·인물 (V1은 빈 배열)
│   │   └── events.json
│   └── ui/                   ← 화면 (DOM). 이식 시 폐기
│       ├── app.js            ← 렌더 루프, 주 타이머·속도, 모달 매니저(창 열림=정지)
│       ├── screens/          ← 메인 / 활동 / 주식 / 사업 / 사람 / 설정
│       └── components/       ← 상단 바, 속도 버튼, 알림 피드, 하단 탭, 모달
├── assets/
│   ├── placeholder/          ← [개발] 회색 박스 임시 아트 (주문서와 같은 파일명)
│   ├── img/                  ← [사용자] 검수 통과한 최종 아트
│   └── audio/                ← [사용자]
├── art/
│   ├── STYLE_GUIDE.md        ← [기획] 아트팀(GPT) 고정 규칙
│   ├── ORDER_TEMPLATE.md     ← [기획] 주문서 양식
│   ├── reference/            ← [기획] 확정 레퍼런스 이미지 (주문 시 항상 첨부), screens/ 에 창별 레퍼런스
│   ├── orders/               ← [기획] ART-001.md … 주문서 (개발이 필요 에셋 목록을 REQUESTS에 적으면 기획이 주문서로 작성)
│   └── review/               ← [사용자] GPT 결과물 검수 대기
├── docs/                     ← [기획]
│   ├── GDD.md                ← 전체 비전
│   ├── SCOPE_V1.md           ← 1차 범위
│   ├── HANDOFF_V1.md         ← 개발 방 착수 지시서
│   ├── UI_SPEC_V1.md         ← 화면 명세
│   ├── DECISIONS.md          ← 결정 기록 (한 줄씩, 날짜)
│   └── REQUESTS.md           ← 구획 간 요청/질문 교환 (개발→기획: 수치 질문, 에셋 필요 / 기획→개발: 변경 요청)
├── tests/                    ← [개발] core 함수 테스트
└── README.md                 ← [기획] 프로젝트 소개 + 이 문서 링크
```

## 구획 간 소통 (`docs/REQUESTS.md`)

```markdown
## REQ-001 [개발→기획] 열림
- 날짜:
- 내용: 노점 겨울 매출 배율이 없음. 1.3배로 임시 적용, 확정값 요청
- 답변: (기획 방이 기입) 1.4배로 확정. config.json 반영 요망
```
- 사용자가 두 방 사이를 오가며 이 파일을 복사해 전달한다. 한 방이 다른 방의 채팅을 볼 수 없으므로 **대화는 파일로만**.
- 닫힌 요청은 지우지 않고 `닫힘`으로 표시.

## 규칙

### core ↔ ui 경계
- `core`의 공개 함수는 전부 `(state, input) → newState` 형태.
  예: `advanceWeek(state)`, `setActivity(state, activityId)`, `buyStock(state, symbol, qty)`
- 실시간 진행은 **ui의 타이머가 `advanceWeek`를 주기적으로 호출**하는 것. core에는 시계·타이머·속도 개념이 없다. (속도·일시정지는 ui 상태)
- 화면에 보여줄 메시지(이벤트 발생 등)는 `state.log[]`에 쌓고 ui가 읽어 간다.
- `ui`는 `core`를 호출만 하고, 수치 계산은 절대 하지 않는다.

### 데이터
- 숫자 밸런스는 전부 `src/data/*.json`. 코드에 `30000` 같은 리터럴 금지.
- 밸런스 조정 = JSON만 수정. 코드 변경 없음.

### 저장
- 저장 = `JSON.stringify(state)` → `localStorage`.
- `state.version` 필드 필수. 구조 바뀌면 마이그레이션 함수 추가.

### 아트
- 개발은 `assets/placeholder/`로 먼저 진행. 파일명은 주문서와 동일.
- 아트 도착 시 `assets/img/`에 넣기만 하면 교체됨 (경로 분기는 `config.json`의 `useArt` 플래그).

### 브랜치
- `main`: 항상 플레이 가능한 상태. GitHub Pages 배포 대상.
- `dev`: 작업 브랜치. 기능 하나 끝날 때마다 `main`에 머지.

### 작업 흐름
1. 기획 방이 `HANDOFF_V1.md`·`SCOPE_V1.md` 작성 → 사용자가 개발 방에 전달
2. 개발 방이 구현. 질문·필요 에셋은 `REQUESTS.md`에 기록
3. 사용자가 `REQUESTS.md`를 기획 방에 가져옴 → 기획 방이 답변하고, 필요 에셋은 `art/orders/ART-NNN.md`로 주문서 작성
4. 사용자가 주문서를 GPT에 전달 → 결과물을 `art/review/`에 저장
5. 기획 방이 주문서의 검수 체크리스트로 확인 → 통과 시 사용자가 `assets/img/`로 이동, 주문서 상태 `완료`
6. 개발 방은 파일명만 맞으면 교체된 것을 자동으로 쓴다
